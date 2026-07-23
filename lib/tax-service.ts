import { SupabaseClient } from "@supabase/supabase-js"

// Server-only helpers for talking to the Armenian tax service directly.
// Credentials live in settings under "tax_service" ({ tin, login, password });
// tokens are cached in settings the same way /api/tax-service/auth does.

const SOAP_LOGIN_URL = "http://ews.taxservice.am/taxsystem-fe-ws/taxpayer/loginService"
const REST_URL = "https://e-invoicing.taxservice.am/api"

const ITEMS_ENDPOINT: Record<string, string> = {
  GOODS: "/goods/goods-product-by-invoice-id",
  EXCISE: "/excise/excise-product-by-invoice-id",
  SERVICES: "/services/services-product-by-invoice-id",
  LEASING: "/leasing-act/leasing-act-subject-by-invoice-id",
  VAT_RETURN: "/vat-refund/vat-refund-product-by-invoice-id",
  ACC_DOC_TRACEABLE_G: "/acc-doc-traceable-g/acc-doc-traceable-g-product-by-invoice-id",
  ACC_DOC_GOODS: "/acc-doc-goods/acc-doc-goods-product-by-invoice-id",
  ACC_DOC_SERVICES: "/acc-doc-services/acc-doc-services-product-by-invoice-id",
  ACC_DOC_TRANSPORTATION: "/acc-doc-transportation/acc-doc-transportation-product-by-invoice-id",
}

export function hasTaxServiceItemsEndpoint(invoiceType: string | null | undefined): boolean {
  return !!invoiceType && invoiceType in ITEMS_ENDPOINT
}

export async function getTaxServiceToken(
  supabase: SupabaseClient,
  opts?: { forceRefresh?: boolean }
): Promise<{ token: string | null; error: string | null }> {
  const { data: creds } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "tax_service")
    .single()

  const { tin, login, password } = (creds?.value || {}) as { tin?: string; login?: string; password?: string }
  if (!tin || !login || !password) {
    return { token: null, error: "Tax service credentials are not configured" }
  }

  const cacheKey = `tax_service_token_${tin}`

  if (!opts?.forceRefresh) {
    const { data: cached } = await supabase
      .from("settings")
      .select("value")
      .eq("key", cacheKey)
      .single()
    const { token, expiresAt } = (cached?.value || {}) as { token?: string; expiresAt?: string }
    if (token && expiresAt && new Date(expiresAt).getTime() > Date.now() + 60000) {
      return { token, error: null }
    }
  }

  const soapEnvelope = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:def="http://www.taxservice.am/tp3/invoice/definitions">
  <soapenv:Header/>
  <soapenv:Body>
    <def:LoginWebRequest Tin="${tin}" Login="${login}" Password="${password}" />
  </soapenv:Body>
</soapenv:Envelope>`

  const response = await fetch(SOAP_LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "text/xml;charset=UTF-8", SOAPAction: "" },
    body: soapEnvelope,
  })
  const xmlText = await response.text()

  const statusMatch = xmlText.match(/<Status Code="(\d+)" Message="([^"]+)"/)
  if (statusMatch && statusMatch[1] !== "0000") {
    return { token: null, error: statusMatch[2] }
  }
  if (!response.ok) {
    return { token: null, error: `Tax service auth failed (${response.status})` }
  }

  const tokenMatch = xmlText.match(/<AuthToken>(.*?)<\/AuthToken>/) || xmlText.match(/AuthToken="([^"]+)"/)
  if (!tokenMatch?.[1]) {
    return { token: null, error: "Failed to extract token from tax service response" }
  }
  const token = tokenMatch[1]

  const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString()
  const { data: existing } = await supabase.from("settings").select("key").eq("key", cacheKey).single()
  if (existing) {
    await supabase.from("settings").update({ value: { token, expiresAt } }).eq("key", cacheKey)
  } else {
    await supabase.from("settings").insert({ key: cacheKey, value: { token, expiresAt } })
  }

  return { token, error: null }
}

export async function fetchTaxServiceItems(
  token: string,
  invoiceId: string,
  invoiceType: string
): Promise<{ items: any[] | null; needsReauth: boolean; error: string | null }> {
  const endpoint = ITEMS_ENDPOINT[invoiceType]
  if (!endpoint) return { items: [], needsReauth: false, error: null }

  const response = await fetch(REST_URL + endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      Cookie: `jwt-auth-token=${token}`,
    },
    body: JSON.stringify({ payload: { invoiceId } }),
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return { items: null, needsReauth: true, error: null }
    }
    // Tax service answers 404/500 for invoices without items
    if (response.status === 404 || response.status === 500) {
      return { items: [], needsReauth: false, error: null }
    }
    return { items: null, needsReauth: false, error: `Tax service items fetch failed (${response.status})` }
  }

  const data = await response.json()
  if (data?.ok && Array.isArray(data.payload)) {
    return { items: data.payload, needsReauth: false, error: null }
  }
  return { items: [], needsReauth: false, error: null }
}

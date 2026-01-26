import { NextRequest, NextResponse } from "next/server"

const REST_URL = "https://e-invoicing.taxservice.am/api"

export async function POST(request: NextRequest) {
  try {
    const { token, tin, anchor } = await request.json()

    if (!token || !tin) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      )
    }

    const newAnchor = Date.now()

    const formatTimestamp = (timestamp: number): string => {
      const date = new Date(timestamp)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const day = String(date.getDate()).padStart(2, "0")
      const hours = String(date.getHours()).padStart(2, "0")
      const minutes = String(date.getMinutes()).padStart(2, "0")
      const seconds = String(date.getSeconds()).padStart(2, "0")
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    }

    // Format dates for the condition
    const fromDate = formatTimestamp(anchor)
    const toDate = formatTimestamp(newAnchor)

    // Build condition matching the working Postman example
    const statusCondition = "((#status = 'ISSUED') or (#status = 'APPROVED'))"

    const buyerCondition = `((((#buyerTin = '${tin}') and ${statusCondition}) and (#issuedAt >= date('${fromDate}'))) and (#issuedAt <= date('${toDate}')))`
    const supplierCondition = buyerCondition.replace("#buyerTin", "#supplierTin")

    console.log('[Invoices] Fetching from:', formatTimestamp(anchor), 'to', formatTimestamp(newAnchor))
    console.log('[Invoices] TIN:', tin)
    console.log('[Invoices] Buyer condition:', buyerCondition)
    console.log('[Invoices] Supplier condition:', supplierCondition)

    // Helper function to fetch data from tax service
    const fetchData = async (path: string, payload: any): Promise<any> => {
      console.log('[Invoices] Requesting:', REST_URL + path)
      console.log('[Invoices] Token (first 20 chars):', token.substring(0, 20))
      console.log('[Invoices] Payload:', JSON.stringify(payload, null, 2))

      const response = await fetch(REST_URL + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "accept": "application/json",
          "Cookie": `jwt-auth-token=${token}`,
        },
        body: JSON.stringify(payload),
      })

      console.log('[Invoices] Response status:', response.status)
      console.log('[Invoices] Response headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Token expired or invalid")
        }
        const errorText = await response.text()
        console.error("[Invoices] Request failed:", response.status, errorText.substring(0, 500))
        throw new Error(`Request failed: ${response.status}`)
      }

      const text = await response.text()

      // Check if response is HTML (error page)
      if (text.trim().startsWith('<')) {
        console.error("[Invoices] Received HTML instead of JSON:", text.substring(0, 500))
        throw new Error("Invalid response from tax service - got HTML instead of JSON")
      }

      const data = JSON.parse(text)
      console.log('[Invoices] Response data:', JSON.stringify(data, null, 2).substring(0, 1000))
      return data.payload
    }

    // Get count of buyer and supplier invoices
    const buyerCount = await fetchData("/invoice/invoice-count", {
      payload: { condition: buyerCondition },
    })

    const supplierCount = await fetchData("/invoice/invoice-count", {
      payload: { condition: supplierCondition },
    })

    console.log('[Invoices] Buyer count:', buyerCount, 'Supplier count:', supplierCount)

    const result: any[] = []
    const PER_PAGE = 100

    // Fetch buyer invoices with pagination
    for (let offset = 0; offset < buyerCount; offset += PER_PAGE) {
      const pageData = await fetchData("/invoice/invoice-list", {
        payload: {
          condition: buyerCondition,
          pageLimit: PER_PAGE,
          pageOffset: offset,
          sortCol: "issuedAt",
          sortAsc: false,
        },
      })
      result.push(...pageData)
      console.log('[Invoices] Fetched buyer invoices, total:', result.length)
    }

    // Fetch supplier invoices with pagination
    for (let offset = 0; offset < supplierCount; offset += PER_PAGE) {
      const pageData = await fetchData("/invoice/invoice-list", {
        payload: {
          condition: supplierCondition,
          pageLimit: PER_PAGE,
          pageOffset: offset,
          sortCol: "issuedAt",
          sortAsc: false,
        },
      })
      result.push(...pageData)
      console.log('[Invoices] Fetched supplier invoices, total:', result.length)
    }

    console.log('[Invoices] Success! Found', result.length, 'invoices')

    return NextResponse.json({
      data: result,
      count: buyerCount + supplierCount,
      anchor: newAnchor,
    })
  } catch (error) {
    console.error("[Invoices] Error:", error)

    if (error instanceof Error && error.message.includes("Token expired")) {
      return NextResponse.json(
        { error: "Token expired or invalid", needsReauth: true },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

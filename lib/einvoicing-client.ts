/**
 * Client-side EInvoicing wrapper that uses API routes to avoid CORS issues
 */

interface InvoiceData {
  id: string
  serialNo?: string
  type?: string
  sort?: string
  approvalState?: string
  status?: string
  correctionState?: string
  correctionType?: string
  createdAt?: number
  issuedAt?: number
  approvedAt?: number
  deliveredAt?: number
  dealtAt?: number
  canceledAt?: number
  supplierTin?: string
  buyerTin?: string
  deliveryAddress?: string
  destinationAddress?: string
  envTax?: number
  totalValue?: number
  totalVatAmount?: number
  total?: number
  cancellationReason?: string
  canceledNotified?: string
  benCanceledNotified?: string
  benIssuedNotified?: string
  userName?: string
  finalUse?: boolean
  hasCodes?: boolean
  additionalInfo?: string
  otherData?: string
}

interface InvoicesResult {
  data: InvoiceData[]
  count: number
  anchor: number
}

interface EInvoicingClientConfig {
  tin: string
  username: string
  password: string
}

export class EInvoicingClient {
  private tin: string
  private username: string
  private password: string
  private token: string | null = null
  private anchor: number = Date.now() - 30 * 24 * 60 * 60 * 1000 // Default: 30 days ago
  private proxyUrl: string

  constructor(config: EInvoicingClientConfig) {
    this.tin = config.tin
    this.username = config.username
    this.password = config.password
    // Use environment variable for proxy URL, fallback to local API routes
    this.proxyUrl = process.env.NEXT_PUBLIC_TAX_PROXY_URL || ''
  }

  public setAnchor(timestamp: number) {
    this.anchor = timestamp
  }

  public async init() {
    await this.authenticate()
  }

  private async authenticate() {
    const url = this.proxyUrl ? `${this.proxyUrl}/api/tax-service/auth` : "/api/tax-service/auth"
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tin: this.tin,
        username: this.username,
        password: this.password,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Authentication failed")
    }

    const data = await response.json()
    this.token = data.token
  }

  public async getInvoices(): Promise<InvoicesResult> {
    if (!this.token) {
      throw new Error("Not authenticated. Call init() first.")
    }

    const url = this.proxyUrl ? `${this.proxyUrl}/api/tax-service/invoices` : "/api/tax-service/invoices"
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: this.token,
        tin: this.tin,
        anchor: this.anchor,
      }),
    })

    if (!response.ok) {
      const error = await response.json()

      // If token expired, re-authenticate and retry
      if (error.needsReauth) {
        await this.authenticate()
        return this.getInvoices()
      }

      throw new Error(error.error || "Failed to fetch invoices")
    }

    return response.json()
  }

  public async getInvoiceItems(invoiceId: string, invoiceType: string): Promise<any[]> {
    if (!this.token) {
      throw new Error("Not authenticated. Call init() first.")
    }

    const url = this.proxyUrl ? `${this.proxyUrl}/api/tax-service/invoice-items` : "/api/tax-service/invoice-items"
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: this.token,
        invoiceId,
        invoiceType,
      }),
    })

    if (!response.ok) {
      const error = await response.json()

      // If token expired, re-authenticate and retry
      if (error.needsReauth) {
        await this.authenticate()
        return this.getInvoiceItems(invoiceId, invoiceType)
      }

      // Return empty array if items not found
      if (response.status === 404) {
        return []
      }

      throw new Error(error.error || "Failed to fetch invoice items")
    }

    return response.json()
  }
}

import { parseStringPromise } from "xml2js";

interface TokenCache {
  token: string;
  expiresAt: number;
}

interface EInvoicingConfig {
  tin: string;
  username: string;
  password: string;
}

interface Invoice {
  id: string;
  createdAt: string;
  buyerTin: string;
  supplierTin: string;
  [key: string]: any;
}

interface InvoicesResult {
  anchor: number;
  data: Invoice[];
  count: number;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);

  const pad = (n: number) => String(n).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export class EInvoicing {
  private AUTH_URL = "http://ews.taxservice.am/taxsystem-fe-ws/taxpayer/loginService";
  private REST_URL = "https://e-invoicing.taxservice.am/api";

  private static tokenCache: Map<string, TokenCache> = new Map();
  private static readonly TOKEN_LIFETIME = 10 * 60 * 1000; // 10 minutes in milliseconds

  private token: string | null = null;

  private password: string;
  private tin: string;
  private username: string;

  private anchor: number;

  constructor({ tin, username, password }: EInvoicingConfig) {
    this.tin = tin;
    this.username = username;
    this.password = password;
    this.anchor = Date.now() - 30 * 24 * 60 * 60 * 1000 * 12 * 3; // 3 years ago
    console.log("[EInvoicing] Initialized for TIN:", this.tin);
  }

  public async init() {
    // Try to get cached token
    const cachedToken = this.getCachedToken();

    if (cachedToken) {
      console.log(`[EInvoicing] Using cached token for TIN ${this.tin}`);
      this.token = cachedToken;
      return;
    }

    // No valid cached token, need to login
    await this.login();
  }

  private getCachedToken(): string | null {
    const cached = EInvoicing.tokenCache.get(this.tin);

    if (!cached) {
      return null;
    }

    // Check if token is still valid
    if (Date.now() >= cached.expiresAt) {
      console.log(`[EInvoicing] Token expired for TIN ${this.tin}`);
      EInvoicing.tokenCache.delete(this.tin);
      return null;
    }

    return cached.token;
  }

  private setCachedToken(token: string) {
    const expiresAt = Date.now() + EInvoicing.TOKEN_LIFETIME;
    EInvoicing.tokenCache.set(this.tin, { token, expiresAt });
    console.log(`[EInvoicing] Token cached for TIN ${this.tin}, expires at ${new Date(expiresAt).toISOString()}`);
  }

  private async login() {
    console.log(`[EInvoicing] Logging in to get new token for TIN ${this.tin}`);

    const soapBody = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
        xmlns:def="http://www.taxservice.am/tp3/invoice/definitions">
        <soapenv:Header/>
        <soapenv:Body>
          <def:LoginWebRequest
            Tin="${this.tin}"
            Login="${this.username}"
            Password="${this.password}"
            />
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const res = await fetch(this.AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "text/xml;charset=UTF-8" },
      body: soapBody,
    });

    if (!res.ok) {
      throw new Error(`Login failed: ${res.status} ${res.statusText}`);
    }

    const text = await res.text();
    const parsed = await parseStringPromise(text, { explicitArray: false });

    // AuthToken in SOAP response
    const LoginWebResponse =
      parsed["soapenv:Envelope"]?.["soapenv:Body"]?.LoginWebResponse ||
      parsed["S:Envelope"]?.["S:Body"]?.LoginWebResponse;

    const token = LoginWebResponse?.AuthToken;

    if (!token) {
      throw new Error("AuthToken not found in response");
    }

    // Store token locally and in cache
    this.token = token;
    this.setCachedToken(token);

    console.log(`[EInvoicing] Token obtained for TIN ${this.tin}`);
  }

  public async refreshToken() {
    console.log(`[EInvoicing] Forcing token refresh for TIN ${this.tin}`);
    EInvoicing.tokenCache.delete(this.tin);
    await this.login();
  }

  public getAnchor(): number {
    return this.anchor;
  }

  public setAnchor(value: number) {
    this.anchor = value;
  }

  public getAuthToken(): string | null {
    return this.token;
  }

  private async fetchInvoicesCount(condition: string): Promise<number> {
    return await this.fetchData("/invoice/invoice-count", {
      payload: { condition },
    });
  }

  private async fetchData(path: string, payload: any, isRetry: boolean = false): Promise<any> {
    const res = await fetch(this.REST_URL + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        Cookie: `jwt-auth-token=${this.token}`,
      },
      body: JSON.stringify(payload),
    });

    // If request fails with 401/403 and we haven't retried yet, refresh token and retry
    if ((res.status === 401 || res.status === 403) && !isRetry) {
      console.log(`[EInvoicing] Request failed with ${res.status}, refreshing token and retrying`);
      await this.refreshToken();
      return this.fetchData(path, payload, true);
    }

    if (!res.ok) {
      console.error("[EInvoicing] Request failed:", this.REST_URL + path, payload);
      throw new Error(`REST request failed ${res.status} ${res.statusText}`);
    }

    return (await res.json() as any).payload;
  }

  public async getInvoiceItems(invoiceId: string, type: string): Promise<any[]> {
    let url = "";
    switch (type) {
      case "GOODS":
        url = "/goods/goods-product-by-invoice-id";
        break;
      case "EXCISE":
        url = "/excise/excise-product-by-invoice-id";
        break;
      case "SERVICES":
        url = "/services/services-product-by-invoice-id";
        break;
      case "LEASING":
        url = "/leasing-act/leasing-act-subject-by-invoice-id";
        break;
      case "VAT_RETURN":
        url = "/vat-refund/vat-refund-product-by-invoice-id";
        break;
      case "ACC_DOC_TRACEABLE_G":
        url = "/acc-doc-traceable-g/acc-doc-traceable-g-product-by-invoice-id";
        break;
      case "ACC_DOC_GOODS":
        url = "/acc-doc-goods/acc-doc-goods-product-by-invoice-id";
        break;
      case "ACC_DOC_SERVICES":
        url = "/acc-doc-services/acc-doc-services-product-by-invoice-id";
        break;
      case "ACC_DOC_TRANSPORTATION":
        url = "/acc-doc-transportation/acc-doc-transportation-product-by-invoice-id";
        break;
      case "ACC_DOC_EXPORT_EEU":
        url = "/acc-doc-export-eeu/acc-doc-export-eeu-product-by-invoice-id";
        break;
      default:
        throw new Error(`Unknown invoice type: ${type}`);
    }

    const result = await this.fetchData(url, {
      payload: { invoiceId },
    });

    return result;
  }

  public async getInvoices(): Promise<InvoicesResult> {
    const newAnchor = Date.now();
    const result: Invoice[] = [];

    const buyerCondition = `((#buyerTin = '${this.tin}') and (#createdAt >= date('${formatTimestamp(
      this.anchor
    )}')) and (#createdAt <= date('${formatTimestamp(newAnchor)}')) )`;
    const supplierCondition = buyerCondition.replace("#buyerTin", "#supplierTin");

    const buyerCountResult = await this.fetchInvoicesCount(buyerCondition);
    const supplierCountResult = await this.fetchInvoicesCount(supplierCondition);

    console.log("[EInvoicing] Found invoices:", buyerCountResult + supplierCountResult);
    console.log("[EInvoicing] Buyer invoices:", buyerCountResult);
    console.log("[EInvoicing] Supplier invoices:", supplierCountResult);
    console.log("[EInvoicing] Fetching invoices start after 5 sec");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const PER_PAGE = 100;
    const buyerPayload = {
      payload: {
        condition: buyerCondition,
        pageLimit: PER_PAGE,
        pageOffset: 1,
        sortCol: "createdAt",
        sortAsc: false,
      },
    };
    const supplierPayload = {
      payload: { ...buyerPayload.payload, condition: supplierCondition },
    };

    async function* asyncGenerator(l: number) {
      let i = 0;
      while (i - PER_PAGE < l) {
        yield (i += PER_PAGE);
      }
    }

    for await (const pageOffset of asyncGenerator(buyerCountResult)) {
      buyerPayload.payload.pageOffset = pageOffset - PER_PAGE;
      const pageData = await this.fetchData("/invoice/invoice-list", buyerPayload);
      result.push(...pageData);
      console.log("[EInvoicing] Updated buyers, Length:", result.length);
    }

    for await (const pageOffset of asyncGenerator(supplierCountResult)) {
      supplierPayload.payload.pageOffset = pageOffset - PER_PAGE;
      const pageData = await this.fetchData("/invoice/invoice-list", supplierPayload);
      result.push(...pageData);
      console.log("[EInvoicing] Updated Suppliers, Length:", result.length);
    }

    this.anchor = newAnchor;
    return {
      anchor: this.anchor,
      data: result,
      count: buyerCountResult + supplierCountResult,
    };
  }

  public async downloadInvoice(
    invoiceIds: string[],
    format: "pdf" | "xml" | "excel"
  ): Promise<Blob> {
    const url = `/dispatcher/${format}-export`;
    const payload = { payload: { ids: invoiceIds } };

    const res = await fetch(this.REST_URL + url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        Cookie: `jwt-auth-token=${this.token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Download request failed ${res.status} ${res.statusText}`);
    }

    return await res.blob();
  }
}

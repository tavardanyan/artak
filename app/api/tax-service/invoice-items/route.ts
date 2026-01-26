import { NextRequest, NextResponse } from "next/server"

const REST_URL = "https://e-invoicing.taxservice.am/api"

export async function POST(request: NextRequest) {
  try {
    const { token, invoiceId, invoiceType } = await request.json()

    if (!token || !invoiceId || !invoiceType) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      )
    }

    const typeMap: Record<string, string> = {
      "GOODS": "/goods/goods-product-by-invoice-id",
      "EXCISE": "/excise/excise-product-by-invoice-id",
      "SERVICES": "/services/services-product-by-invoice-id",
      "LEASING": "/leasing-act/leasing-act-subject-by-invoice-id",
      "VAT_RETURN": "/vat-refund/vat-refund-product-by-invoice-id",
      "ACC_DOC_TRACEABLE_G": "/acc-doc-traceable-g/acc-doc-traceable-g-product-by-invoice-id",
      "ACC_DOC_GOODS": "/acc-doc-goods/acc-doc-goods-product-by-invoice-id",
      "ACC_DOC_SERVICES": "/acc-doc-services/acc-doc-services-product-by-invoice-id",
      "ACC_DOC_TRANSPORTATION": "/acc-doc-transportation/acc-doc-transportation-product-by-invoice-id",
    }

    const url = typeMap[invoiceType]
    if (!url) {
      console.log('[Items] Unknown invoice type:', invoiceType)
      return NextResponse.json([])
    }

    console.log('[Items] Fetching items for invoice:', invoiceId, 'type:', invoiceType)

    const response = await fetch(REST_URL + url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json",
        "Cookie": `jwt-auth-token=${token}`,
      },
      body: JSON.stringify({
        payload: { invoiceId },
      }),
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: "Token expired or invalid", needsReauth: true },
          { status: 401 }
        )
      }

      // Some invoices might not have items, return empty array
      if (response.status === 404 || response.status === 500) {
        console.log('[Items] No items found for invoice:', invoiceId)
        return NextResponse.json([])
      }

      console.error('[Items] Failed:', response.status)
      return NextResponse.json(
        { error: "Failed to fetch invoice items" },
        { status: response.status }
      )
    }

    const data = await response.json()

    // The response contains items array in payload
    // But we also need invoice details, so let's fetch them separately
    if (data.ok && Array.isArray(data.payload)) {
      console.log('[Items] Success! Found', data.payload.length, 'items')

      // Try to fetch full invoice details for bank account info
      // Use the type-specific endpoint with -by-id (not -by-invoice-id)
      let invoiceDetails = null
      try {
        const detailsTypeMap: Record<string, string> = {
          "GOODS": "/goods/goods-by-id",
          "EXCISE": "/excise/excise-by-id",
          "SERVICES": "/services/services-by-id",
          "LEASING": "/leasing-act/leasing-act-by-id",
          "VAT_RETURN": "/vat-refund/vat-refund-by-id",
          "ACC_DOC_TRACEABLE_G": "/acc-doc-traceable-g/acc-doc-traceable-g-by-id",
          "ACC_DOC_GOODS": "/acc-doc-goods/acc-doc-goods-by-id",
          "ACC_DOC_SERVICES": "/acc-doc-services/acc-doc-services-by-id",
          "ACC_DOC_TRANSPORTATION": "/acc-doc-transportation/acc-doc-transportation-by-id",
        }

        const detailsUrl = detailsTypeMap[invoiceType]
        if (detailsUrl) {
          console.log('[Items] Fetching full invoice details for:', invoiceId, 'using:', detailsUrl)
          const detailsResponse = await fetch(`${REST_URL}${detailsUrl}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "accept": "application/json",
              "Cookie": `jwt-auth-token=${token}`,
            },
            body: JSON.stringify({
              payload: { id: invoiceId },
            }),
          })

          if (detailsResponse.ok) {
            const detailsData = await detailsResponse.json()
            console.log('[Items] Full details response:', JSON.stringify(detailsData, null, 2))
            if (detailsData.ok && detailsData.payload) {
              invoiceDetails = detailsData.payload
              console.log('[Items] ✓ Got invoice details with bank info')
              console.log('[Items] Bank info in payload:', {
                supplierBank: detailsData.payload.supplierBank,
                supplierAccNo: detailsData.payload.supplierAccNo,
                supplierName: detailsData.payload.supplierName,
                supplierTin: detailsData.payload.supplierTin,
              })
            } else {
              console.log('[Items] Invoice details response not ok:', detailsData)
            }
          } else {
            console.log('[Items] Failed to fetch invoice details, status:', detailsResponse.status)
            const errorText = await detailsResponse.text()
            console.log('[Items] Error response body:', errorText)
          }
        } else {
          console.log('[Items] No details endpoint for invoice type:', invoiceType)
        }
      } catch (detailsError) {
        console.error('[Items] Error fetching invoice details:', detailsError)
        // Continue without invoice details - we'll use basic data from invoice list
      }

      // Return both items and invoice details
      return NextResponse.json({
        ok: true,
        items: data.payload,
        payload: invoiceDetails
      })
    }

    // Fallback
    return NextResponse.json({ ok: false, items: [], payload: null })
  } catch (error) {
    console.error("[Items] Error:", error)

    // Return empty array on error instead of failing
    return NextResponse.json([])
  }
}

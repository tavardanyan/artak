import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { tin, username, password } = await request.json()
    const supabase = await createClient()

    if (!tin || !username || !password) {
      return NextResponse.json(
        { error: "Missing required credentials" },
        { status: 400 }
      )
    }

    // Check for cached token
    const cacheKey = `tax_service_token_${tin}`
    const { data: cachedData } = await supabase
      .from("settings")
      .select("value")
      .eq("key", cacheKey)
      .single()

    if (cachedData?.value) {
      const { token, expiresAt } = cachedData.value
      // Check if token is still valid (with 1 minute buffer)
      if (expiresAt && new Date(expiresAt).getTime() > Date.now() + 60000) {
        console.log('[Auth] Using cached token, expires at:', expiresAt)
        return NextResponse.json({ token })
      }
    }

    const soapEnvelope = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:def="http://www.taxservice.am/tp3/invoice/definitions">
  <soapenv:Header/>
  <soapenv:Body>
    <def:LoginWebRequest Tin="${tin}" Login="${username}" Password="${password}" />
  </soapenv:Body>
</soapenv:Envelope>`

    console.log('[Auth] Authenticating with Armenian tax service...')

    const response = await fetch("http://ews.taxservice.am/taxsystem-fe-ws/taxpayer/loginService", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        "SOAPAction": "",
      },
      body: soapEnvelope,
    })

    const xmlText = await response.text()
    console.log('[Auth] Response status:', response.status)
    console.log('[Auth] Response text:', xmlText.substring(0, 500))

    // Check for error status in the response
    const statusMatch = xmlText.match(/<Status Code="(\d+)" Message="([^"]+)"/)
    if (statusMatch) {
      const [, code, message] = statusMatch

      // Code "0000" means success
      if (code !== "0000") {
        console.error('[Auth] Tax service error:', code, message)
        return NextResponse.json(
          { error: message, code },
          { status: 400 }
        )
      }
    }

    if (!response.ok) {
      console.error('[Auth] Failed:', response.status, response.statusText)
      return NextResponse.json(
        { error: "Authentication failed", response: xmlText.substring(0, 200) },
        { status: response.status }
      )
    }

    // Extract token from XML response
    let tokenMatch = xmlText.match(/<AuthToken>(.*?)<\/AuthToken>/)
    if (!tokenMatch || !tokenMatch[1]) {
      // Try alternative format
      tokenMatch = xmlText.match(/AuthToken="([^"]+)"/)
    }

    if (!tokenMatch || !tokenMatch[1]) {
      console.error('[Auth] Failed to extract token from response')
      console.error('[Auth] Full response:', xmlText)
      return NextResponse.json(
        { error: "Failed to extract token from response", response: xmlText.substring(0, 200) },
        { status: 500 }
      )
    }

    const token = tokenMatch[1]
    console.log('[Auth] Success! Token:', token.substring(0, 20) + '...')

    // Cache token for 20 minutes
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString()

    // Check if cache entry exists
    const { data: existing } = await supabase
      .from("settings")
      .select("key")
      .eq("key", cacheKey)
      .single()

    if (existing) {
      await supabase
        .from("settings")
        .update({ value: { token, expiresAt } })
        .eq("key", cacheKey)
    } else {
      await supabase
        .from("settings")
        .insert({ key: cacheKey, value: { token, expiresAt } })
    }

    console.log('[Auth] Token cached until:', expiresAt)

    return NextResponse.json({ token })
  } catch (error) {
    console.error("[Auth] Error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

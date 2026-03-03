import { bech32 } from '@scure/base'

/**
 * LNURL-pay response from the decoded URL
 */
export interface LNURLPayResponse {
    tag: 'payRequest'
    callback: string
    minSendable: number  // millisatoshis
    maxSendable: number  // millisatoshis
    metadata: string
    commentAllowed?: number
    allowsNostr?: boolean
    nostrPubkey?: string
}

/**
 * Strip the `lightning:` URI prefix if present
 */
function stripLightningPrefix(input: string): string {
    const trimmed = input.trim()
    if (trimmed.toLowerCase().startsWith('lightning:')) {
        return trimmed.slice('lightning:'.length)
    }
    return trimmed
}

/**
 * Check if the input string is a bech32-encoded LNURL
 */
export function isLNURL(input: string): boolean {
    const stripped = stripLightningPrefix(input).toLowerCase()
    return stripped.startsWith('lnurl1')
}

/**
 * Decode a bech32-encoded LNURL to the cleartext HTTPS URL
 *
 * LNURL is encoded as bech32 with Human-Readable Part "lnurl" and the
 * data portion encoding the UTF-8 bytes of the cleartext URL.
 */
export function decodeLNURL(lnurl: string): string {
    const stripped = stripLightningPrefix(lnurl)
    const lnurlLower = stripped.toLowerCase() as `${string}1${string}`

    console.log('[asanee-lnurl] Decoding LNURL, length:', lnurlLower.length)

    // bech32 decode (LNURL uses bech32 with up to 2048 char limit)
    const decoded = bech32.decode(lnurlLower, 2048)

    // Convert 5-bit words back to 8-bit bytes
    const bytes = bech32.fromWords(decoded.words)

    // Decode UTF-8 bytes to string
    const url = new TextDecoder().decode(new Uint8Array(bytes))

    console.log('[asanee-lnurl] Decoded URL:', url)

    return url
}

/**
 * Decode an LNURL and fetch the LNURL-pay metadata from the resulting URL.
 * Validates that the response is an LNURL-pay (`tag: "payRequest"`).
 */
export async function resolveLNURL(lnurl: string): Promise<LNURLPayResponse> {
    console.log('[asanee-lnurl] Resolving LNURL...')

    const url = decodeLNURL(lnurl)

    console.log('[asanee-lnurl] Fetching:', url)

    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`LNURL request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('[asanee-lnurl] Response data:', JSON.stringify(data).substring(0, 200))

    if (data.status === 'ERROR') {
        throw new Error(data.reason || 'LNURL server returned an error')
    }

    if (data.tag !== 'payRequest') {
        throw new Error(`Unsupported LNURL type: ${data.tag || 'unknown'}. Only LNURL-pay is supported.`)
    }

    console.log('[asanee-lnurl] Resolved! callback:', data.callback, 'min:', data.minSendable, 'max:', data.maxSendable)

    return data as LNURLPayResponse
}

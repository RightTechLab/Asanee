/**
 * PriceService — Fetches BTC/THB price from Bitkub and provides sats→THB conversion
 */

const BITKUB_TICKER_URL = 'https://api.bitkub.com/api/v3/market/ticker?sym=btc_thb'
const CACHE_DURATION_MS = 30_000 // 30 seconds

let cachedPrice: number | null = null
let lastFetchTime = 0

/**
 * Fetch BTC/THB price from Bitkub.
 * Returns the "last" traded price. Caches for 30s to avoid excessive API calls.
 */
export async function fetchBtcThbPrice(): Promise<number | null> {
    const now = Date.now()
    if (cachedPrice !== null && now - lastFetchTime < CACHE_DURATION_MS) {
        return cachedPrice
    }

    try {
        const response = await fetch(BITKUB_TICKER_URL)
        const data = await response.json()

        // Response: [{ "symbol": "BTC_THB", "last": "2103823.83", ... }]
        if (Array.isArray(data) && data.length > 0 && data[0].last) {
            cachedPrice = Number.parseFloat(data[0].last)
            lastFetchTime = now
            return cachedPrice
        }
        return cachedPrice // return stale cache if parse fails
    } catch {
        return cachedPrice // return stale cache on network error
    }
}

/**
 * Convert millisats to THB
 */
export function msatToThb(msat: number, btcThbPrice: number): number {
    const btc = msat / 1_000 / 100_000_000
    return btc * btcThbPrice
}

/**
 * Convert sats to THB
 */
export function satsToThb(sats: number, btcThbPrice: number): number {
    const btc = sats / 100_000_000
    return btc * btcThbPrice
}

/**
 * Format THB amount for display
 */
export function formatThb(amount: number): string {
    if (amount < 0.01) return '< ฿0.01'
    return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

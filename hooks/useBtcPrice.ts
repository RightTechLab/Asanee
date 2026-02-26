import { useState, useEffect, useRef } from 'react'
import { fetchBtcThbPrice } from '../services/PriceService'

/**
 * Hook that fetches and auto-refreshes BTC/THB price every 30s.
 * Returns the current price or null if not yet loaded.
 */
export function useBtcPrice(): number | null {
    const [price, setPrice] = useState<number | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        // Initial fetch
        fetchBtcThbPrice().then(setPrice)

        // Refresh every 30s
        intervalRef.current = setInterval(() => {
            fetchBtcThbPrice().then(setPrice)
        }, 30_000)

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [])

    return price
}

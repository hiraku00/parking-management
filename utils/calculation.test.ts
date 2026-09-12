import { describe, it, expect } from 'vitest'
import { calculateUnpaidMonths } from './calculation'

describe('calculateUnpaidMonths', () => {
    it('should return all months from start to current when none are paid', () => {
        const start = '2024-01'
        const current = '2024-03'
        const paid = new Set<string>()

        const result = calculateUnpaidMonths(start, null, paid, current)
        expect(result).toEqual(['2024-01', '2024-02', '2024-03'])
    })

    it('should exclude months that are already paid', () => {
        const start = '2024-01'
        const current = '2024-03'
        const paid = new Set(['2024-01'])

        const result = calculateUnpaidMonths(start, null, paid, current)
        expect(result).toEqual(['2024-02', '2024-03'])
    })

    it('should respect contract end date (clamp to earlier of current or end)', () => {
        const start = '2024-01'
        const current = '2024-05' // Now is May
        const end = '2024-03'     // Contract ended in March
        const paid = new Set<string>()

        const result = calculateUnpaidMonths(start, end, paid, current)
        expect(result).toEqual(['2024-01', '2024-02', '2024-03'])
    })

    it('should calculate up to current month even if contract end is in future', () => {
        const start = '2024-01'
        const current = '2024-03' // Now is March
        const end = '2024-12'     // Contract ends in December
        const paid = new Set<string>()

        const result = calculateUnpaidMonths(start, end, paid, current)
        expect(result).toEqual(['2024-01', '2024-02', '2024-03'])
    })

    it('should handle single month duration', () => {
        const start = '2024-01'
        const current = '2024-01'
        const paid = new Set<string>()

        const result = calculateUnpaidMonths(start, null, paid, current)
        expect(result).toEqual(['2024-01'])
    })

    it('should return empty list if all months are paid', () => {
        const start = '2024-01'
        const current = '2024-02'
        const paid = new Set(['2024-01', '2024-02'])

        const result = calculateUnpaidMonths(start, null, paid, current)
        expect(result).toEqual([])
    })

    it('should handle start date missing (fallback to current)', () => {
        const current = '2024-03'
        const result = calculateUnpaidMonths(null, null, new Set(), current)
        expect(result).toEqual(['2024-03'])
    })
})

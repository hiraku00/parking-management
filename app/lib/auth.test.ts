import { describe, it, expect, beforeAll } from 'vitest'
import { encrypt, decrypt } from './auth'

// Mock environment variable
beforeAll(() => {
    process.env.AUTH_SECRET = 'AA7zKQBqSdaOhZClQQGtBhgIWXo0dVOaBSbUQIGfvq4=' // Sample key
})

describe('Auth Utilities', () => {
    const payload = { id: 'user-123', role: 'contractor' }

    it('should encrypt and decrypt a payload correctly', async () => {
        const token = await encrypt(payload)
        expect(typeof token).toBe('string')
        expect(token.length).toBeGreaterThan(0)

        const decoded = await decrypt(token)
        expect(decoded).toMatchObject(payload)
        // Check if expiration is set (approx)
        expect(decoded.exp).toBeDefined()
    })

    it('should return null for invalid token', async () => {
        const invalidToken = 'invalid.token.string'
        const result = await decrypt(invalidToken)
        expect(result).toBeNull()
    })

    it('should return null for tampered token', async () => {
        const token = await encrypt(payload)

        // JWS is header.payload.signature
        const parts = token.split('.')
        if (parts.length === 3) {
            // Tamper with the signature part (the 3rd part)
            // Change the first few characters of the signature
            parts[2] = 'X' + parts[2].substring(1)
            const tampered = parts.join('.')
            const result = await decrypt(tampered)
            expect(result).toBeNull()
        }
    })
})

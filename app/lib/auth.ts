import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

function getKey() {
    const secret = process.env.AUTH_SECRET
    if (!secret) {
        throw new Error('AUTH_SECRET is not set')
    }
    return new TextEncoder().encode(secret)
}

export async function encrypt(payload: Record<string, unknown>) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(getKey())
}

export async function decrypt(input: string): Promise<Record<string, unknown> | null> {
    try {
        const { payload } = await jwtVerify(input, getKey(), {
            algorithms: ['HS256'],
        })
        return payload as Record<string, unknown>
    } catch {
        return null
    }
}

export async function getSession() {
    const cookieStore = await cookies()
    const session = cookieStore.get('contractor_session')?.value
    if (!session) return null
    return await decrypt(session)
}

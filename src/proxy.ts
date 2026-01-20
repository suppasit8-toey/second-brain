import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
    console.log('[Proxy] Checking request:', request.nextUrl.pathname)

    // Only protect /admin routes
    // Matcher handles this, but doube check logic prevents issues
    if (request.nextUrl.pathname.startsWith('/admin')) {
        const adminSession = request.cookies.get('admin_session')
        console.log('[Proxy] Admin Session Cookie:', adminSession ? 'Found' : 'Missing')

        if (!adminSession) {
            console.log('[Proxy] Redirecting to /login')
            const loginUrl = new URL('/login', request.url)
            return NextResponse.redirect(loginUrl)
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/admin', '/admin/:path*'],
}

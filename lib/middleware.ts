import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const isAuth = req.cookies.get('sb-access-token');
  const isProtected = req.nextUrl.pathname.startsWith('/trade');

  if (isProtected && !isAuth) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}
export const config = {
  matcher: ["/trade/:path*", "/mining/:path*", "/settings/:path*", "/admin/:path*"],
};
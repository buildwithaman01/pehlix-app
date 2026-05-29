import { NextResponse } from 'next/server';

export function proxy(request) {
  const url = request.nextUrl.clone();
  const host = request.headers.get('host') || '';
  const { pathname } = url;

  // Let Next.js internal requests, static assets, and API routes pass through
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Skip redirects during local development
  const isLocalDev = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('::1');
  if (isLocalDev) {
    return NextResponse.next();
  }

  // 1. Handle app.pehlix.in (and admin.pehlix.in)
  if (host.includes('app.pehlix.in') || host.includes('admin.pehlix.in')) {
    // If root path on app subdomain, redirect to login
    if (pathname === '/') {
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    
    // Redirect marketing paths on app subdomain to the main marketing site
    const marketingPaths = ['/about', '/pricing', '/contact', '/refund', '/terms', '/privacy'];
    if (marketingPaths.some(path => pathname.startsWith(path))) {
      return NextResponse.redirect(`https://pehlix.in${pathname}${url.search}`);
    }
  }

  // 2. Handle verify.pehlix.in
  if (host.includes('verify.pehlix.in')) {
    // verify.pehlix.in is only for verification path /r/[id]
    if (!pathname.startsWith('/r/')) {
      return NextResponse.redirect(`https://pehlix.in${pathname}${url.search}`);
    }
  }

  // 3. Handle root domain pehlix.in (and www.pehlix.in)
  if (host === 'pehlix.in' || host === 'www.pehlix.in') {
    // Redirect app-specific paths on marketing domain to the app subdomain
    const appPaths = [
      '/login',
      '/register',
      '/otp',
      '/set-password',
      '/dashboard',
      '/results',
      '/patients',
      '/staff',
      '/critical',
      '/audit-log',
      '/whatsapp-outbox',
      '/settings',
      '/tests',
      '/visits',
      '/doctors',
      '/inventory'
    ];
    if (appPaths.some(path => pathname.startsWith(path))) {
      return NextResponse.redirect(`https://app.pehlix.in${pathname}${url.search}`);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

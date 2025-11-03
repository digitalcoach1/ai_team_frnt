import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: [
    '/(api|trpc)(.*)',  // Always protect API routes
    '/((?!_next|static|favicon.ico).*)',  // Simplified pattern
  ],
};
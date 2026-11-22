import { next } from '@vercel/functions';
import { getMember } from './lib/access.js';

// Only the login page and the one API endpoint are publicly reachable.
// The API endpoint performs its own authentication/authorization.
const PUBLIC = new Set(['/login.html', '/api/access', '/favicon.ico', '/robots.txt']);
const BLOCKED_SOURCE = /^(?:\/lib\/|\/supabase\/|\/docs\/|\/tests\/|\/\.github\/)/;
const BLOCKED_FILES = new Set(['/package.json', '/package-lock.json', '/vercel.json', '/proxy.js']);

export default async function proxy(request) {
  const pathname = new URL(request.url).pathname;
  if (BLOCKED_SOURCE.test(pathname) || BLOCKED_FILES.has(pathname)) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  if (PUBLIC.has(pathname)) return next();
  try {
    const member = await getMember(request);
    if (!member) {
      const url = new URL('/login.html', request.url);
      return Response.redirect(url, 303);
    }
    if (pathname === '/admin.html' && member.role !== 'admin') {
      return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }
    return next();
  } catch (error) {
    console.error('Access guard failed:', error.message);
    return new Response('Access service unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

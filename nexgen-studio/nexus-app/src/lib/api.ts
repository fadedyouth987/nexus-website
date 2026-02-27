'use client'

import { getSession, signOut } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const DEV_LOCAL_TARGETS = ['http://127.0.0.1:8000', 'http://localhost:8000'];

function buildTargets() {
  const targets = [API_URL];
  const hostFallback =
    API_URL.includes('127.0.0.1')
      ? API_URL.replace('127.0.0.1', 'localhost')
      : API_URL.includes('localhost')
        ? API_URL.replace('localhost', '127.0.0.1')
        : null;
  if (hostFallback) {
    targets.push(hostFallback);
  }
  // In local dev, allow recovery when NEXT_PUBLIC_API_URL is set to production.
  if (process.env.NODE_ENV !== 'production') {
    for (const target of DEV_LOCAL_TARGETS) {
      if (!targets.includes(target)) {
        targets.push(target);
      }
    }
  }
  return targets;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  // Skip auth for public endpoints
  const publicPaths = ['/auth/login', '/auth/register'];
  const isPublicPath = publicPaths.some(p => path.startsWith(p));
  
  let token = null;
  if (!isPublicPath) {
    const session = await getSession();
    token = session?.user?.accessToken;
  }

  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const targets = buildTargets();
  let response: Response | null = null;
  let lastError: unknown = null;

  for (const baseUrl of targets) {
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
      });
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) {
    throw new Error(
      `Failed to reach API at ${targets.join(' or ')}. ` +
      'Ensure the API service is reachable and the configured base URL is correct.',
      { cause: lastError as Error | undefined }
    );
  }

  // Only trigger signOut for 401 on non-public paths
  if (response.status === 401 && !isPublicPath) {
    await signOut({ callbackUrl: '/auth?error=Session+Expired' });
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return response;
}

export default apiFetch;

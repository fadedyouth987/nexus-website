import { supabase } from './supabase';

export class ApiError extends Error {
  status: number;
  code: string;
  payload: any;
  constructor(status: number, payload: any) {
    super(payload?.message || payload?.error || `HTTP_${status}`);
    this.status = status;
    this.code = payload?.error || `HTTP_${status}`;
    this.payload = payload;
  }
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}, workspaceId?: string): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new ApiError(401, { error: 'AUTH_REQUIRED' });

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('x-request-id', crypto.randomUUID());
  if (workspaceId) headers.set('x-workspace-id', workspaceId);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(path, { ...init, headers, credentials: 'omit' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, payload);
  return payload as T;
}

export type Root = { id: number; label: string; enabled: boolean };
export type Work = { id: number; rjCode: string | null; title: string; folderName: string; circle: string | null; voiceActors: string | null; coverPath: string | null; remoteCoverUrl?: string | null; subtitleSource?: 'official' | 'ai' | null; rootId: number; trackCount: number };
export type Track = { id: number; title: string; relativePath: string; durationMs: number | null; codec: string | null };
export type Subtitle = { id: number; trackId: number; relativePath: string; language: string | null; sourceType: 'official' | 'ai' | 'unknown'; cuesJson: string };
export type WishlistWork = { rjCode: string; title: string; voiceActors: string | null; coverUrl: string | null; sourceUrl: string; addedAt: number };
export type Detail = Work & { tracks: Track[]; subtitles: Subtitle[]; tags: Array<{ id: number; name: string; source: string }>; trackTags: Array<{ trackId: number; id: number; name: string; source: string }>; displayTitle: string; manualTitle?: string | null; asmrOneNormalizedTitle?: string | null; dlsiteTitle?: string | null; dlsiteSourceUrl?: string | null; dlsiteSyncedAt?: number | null; asmrOneSourceUrl?: string | null; asmrOneSyncedAt?: number | null };

let csrfToken = '';
export const api = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD'].includes(init.method ?? 'GET') && csrfToken) headers.set('X-CSRF-Token', csrfToken);
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  if (!response.ok) { const message = await response.json().catch(() => ({})); throw new Error(message.error ?? '请求失败，请稍后重试。'); }
  return response.json() as Promise<T>;
};
export async function restoreSession() { const value = await api<{ csrfToken: string }>('/api/auth/me'); csrfToken = value.csrfToken; }
export async function login(password: string) { const value = await api<{ csrfToken: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) }); csrfToken = value.csrfToken; }
export async function logout() { await api('/api/auth/logout', { method: 'POST' }); csrfToken = ''; }

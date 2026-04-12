// Simple in-memory SSE broadcaster for real-time messaging
// Works for single-server (dev). For production, use Pusher or Upstash.

type Listener = (data: string) => void;

// Use globalThis so the Map survives HMR reloads and is shared across route modules
const g = globalThis as typeof globalThis & { _sseListeners?: Map<string, Set<Listener>> };
if (!g._sseListeners) g._sseListeners = new Map();
const listeners = g._sseListeners;

export function subscribe(conversationId: string, listener: Listener) {
  if (!listeners.has(conversationId)) {
    listeners.set(conversationId, new Set());
  }
  listeners.get(conversationId)!.add(listener);
  return () => {
    listeners.get(conversationId)?.delete(listener);
    if (listeners.get(conversationId)?.size === 0) {
      listeners.delete(conversationId);
    }
  };
}

export function broadcast(conversationId: string, data: object) {
  const subs = listeners.get(conversationId);
  if (!subs) return;
  const payload = JSON.stringify(data);
  subs.forEach((fn) => fn(payload));
}

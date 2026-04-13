// In-memory real-time visitor tracking
// Uses globalThis so the store survives HMR and is shared across route modules

type AdminListener = (count: number) => void;

const g = globalThis as typeof globalThis & {
  _visitorSessions?: Map<string, number>; // sessionId -> lastSeen timestamp
  _visitorAdminListeners?: Set<AdminListener>;
  _visitorCleanupInterval?: ReturnType<typeof setInterval>;
};

if (!g._visitorSessions) g._visitorSessions = new Map();
if (!g._visitorAdminListeners) g._visitorAdminListeners = new Set();

const sessions = g._visitorSessions;
const adminListeners = g._visitorAdminListeners;

// Remove sessions older than 60s every 15s
if (!g._visitorCleanupInterval) {
  g._visitorCleanupInterval = setInterval(() => {
    const cutoff = Date.now() - 60_000;
    let changed = false;
    for (const [id, ts] of sessions) {
      if (ts < cutoff) {
        sessions.delete(id);
        changed = true;
      }
    }
    if (changed) broadcastCount();
  }, 15_000);
}

function broadcastCount() {
  const count = sessions.size;
  adminListeners.forEach((fn) => fn(count));
}

export function registerVisitor(sessionId: string) {
  const isNew = !sessions.has(sessionId);
  sessions.set(sessionId, Date.now());
  if (isNew) broadcastCount();
}

export function removeVisitor(sessionId: string) {
  if (sessions.delete(sessionId)) broadcastCount();
}

export function getVisitorCount() {
  return sessions.size;
}

export function subscribeAdmin(listener: AdminListener) {
  adminListeners.add(listener);
  return () => adminListeners.delete(listener);
}

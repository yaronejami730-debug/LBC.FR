// In-memory real-time view count broadcaster
// Uses globalThis so the store survives HMR and is shared across route modules

type ListingListener = (listingId: string, viewCount: number) => void;

const g = globalThis as typeof globalThis & {
  _viewListenersByUser?: Map<string, Set<ListingListener>>;
  _viewListenersByListing?: Map<string, Set<ListingListener>>;
};

if (!g._viewListenersByUser) g._viewListenersByUser = new Map();
if (!g._viewListenersByListing) g._viewListenersByListing = new Map();

const byUser = g._viewListenersByUser;
const byListing = g._viewListenersByListing;

export function broadcastViewUpdate(
  userId: string,
  listingId: string,
  viewCount: number
) {
  // Notify per-listing listeners (listing detail page)
  const listingListeners = byListing.get(listingId);
  if (listingListeners) {
    for (const fn of listingListeners) fn(listingId, viewCount);
  }
  // Notify per-user listeners (profile performance tab)
  const userListeners = byUser.get(userId);
  if (userListeners) {
    for (const fn of userListeners) fn(listingId, viewCount);
  }
}

export function subscribeListingViews(
  listingId: string,
  listener: ListingListener
) {
  if (!byListing.has(listingId)) byListing.set(listingId, new Set());
  byListing.get(listingId)!.add(listener);
  return () => {
    byListing.get(listingId)?.delete(listener);
    if (byListing.get(listingId)?.size === 0) byListing.delete(listingId);
  };
}

export function subscribeUserViews(userId: string, listener: ListingListener) {
  if (!byUser.has(userId)) byUser.set(userId, new Set());
  byUser.get(userId)!.add(listener);
  return () => {
    byUser.get(userId)?.delete(listener);
    if (byUser.get(userId)?.size === 0) byUser.delete(userId);
  };
}

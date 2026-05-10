export function listingSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function listingUrl(id: string, title: string): string {
  return `/annonce/${id}/${listingSlug(title)}`;
}

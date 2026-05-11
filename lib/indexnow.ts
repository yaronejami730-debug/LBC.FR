const SITE_HOST = "www.dealandcompany.fr";
const ENDPOINT = "https://api.indexnow.org/indexnow";

export async function pingIndexNow(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY;
  if (!key || urls.length === 0) return;

  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: SITE_HOST,
        key,
        keyLocation: `https://${SITE_HOST}/indexnow/${key}.txt`,
        urlList: urls,
      }),
    });
  } catch (err) {
    console.error("[indexnow]", err);
  }
}

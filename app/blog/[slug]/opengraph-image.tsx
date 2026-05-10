import { ImageResponse } from "next/og";
import { getArticleBySlug } from "@/lib/blog";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  const title = article?.title ?? "Deal&Co — Blog";
  const category = article?.category ?? "Blog";

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #1e3a5f 0%, #2f6fb8 100%)",
          padding: "60px 80px",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "white", fontSize: 28, fontWeight: 800 }}>Deal&amp;Co</span>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 28 }}>·</span>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 22 }}>{category}</span>
        </div>

        <div
          style={{
            color: "white",
            fontSize: title.length > 60 ? 44 : 54,
            fontWeight: 800,
            lineHeight: 1.2,
            maxWidth: 950,
          }}
        >
          {title}
        </div>

        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 20 }}>
          dealandcompany.fr
        </div>
      </div>
    ),
    { ...size }
  );
}

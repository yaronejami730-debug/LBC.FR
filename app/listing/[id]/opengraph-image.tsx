import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const alt = "Annonce Deal&Co";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { title: true, price: true, location: true, images: true },
  }).catch(() => null);

  // Fallback — no listing found
  if (!listing) {
    return new ImageResponse(
      <div
        style={{
          width: 1200, height: 630,
          background: "#2f6fb8",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <span style={{ color: "white", fontSize: 56, fontWeight: "bold" }}>Deal&amp;Co</span>
      </div>
    );
  }

  const images = JSON.parse(listing.images) as string[];
  const mainImg = images[0] ?? "";
  const priceStr = listing.price.toLocaleString("fr-FR") + " €";

  return new ImageResponse(
    <div style={{ width: 1200, height: 630, display: "flex", position: "relative", background: "#1e293b" }}>
      {/* Main photo */}
      {mainImg && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mainImg}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}

      {/* Gradient overlay */}
      <div
        style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.85) 100%)",
          display: "flex",
        }}
      />

      {/* Text content */}
      <div
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "40px 48px",
          display: "flex", flexDirection: "column", gap: 12,
        }}
      >
        <div style={{ color: "white", fontSize: 42, fontWeight: 800, lineHeight: 1.2, maxWidth: 900 }}>
          {listing.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <span style={{ color: "#4ade80", fontSize: 36, fontWeight: 800 }}>{priceStr}</span>
          <span style={{ color: "#cbd5e1", fontSize: 24 }}>{listing.location}</span>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 18, marginTop: 4 }}>dealandcompany.fr</div>
      </div>
    </div>,
    { width: 1200, height: 630 }
  );
}

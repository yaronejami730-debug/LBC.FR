import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";

export const runtime = "nodejs";
export const alt = "Annonces catégorie — Deal&Co";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ categorie: string }>;
}) {
  const { categorie } = await params;
  const cat = CATEGORIES.find((c) => c.id === categorie);

  const count = cat
    ? await prisma.listing
        .count({
          where: {
            status: "APPROVED",
            deletedAt: null,
            category: cat.label,
          } as any,
        })
        .catch(() => 0)
    : 0;

  const label = cat?.label ?? categorie;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 64px",
          background: "linear-gradient(135deg, #0f172a 0%, #2f6fb8 70%, #60a5fa 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Deal&amp;Co</span>
          <span style={{ fontSize: 18, opacity: 0.8 }}>·</span>
          <span style={{ fontSize: 18, opacity: 0.8 }}>Petites annonces gratuites entre particuliers</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ fontSize: 32, fontWeight: 600, opacity: 0.9 }}>Annonces</span>
          <span style={{ fontSize: 110, fontWeight: 900, letterSpacing: -2, lineHeight: 1 }}>
            {label}
          </span>
          {count > 0 && (
            <span style={{ fontSize: 38, fontWeight: 700, color: "#fef08a", marginTop: 4 }}>
              {count.toLocaleString("fr-FR")} annonces en France
            </span>
          )}
        </div>

        <div style={{ fontSize: 22, opacity: 0.85 }}>dealandcompany.fr</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

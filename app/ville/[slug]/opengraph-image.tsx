import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { slugToCity } from "@/lib/cities";

export const runtime = "nodejs";
export const alt = "Annonces à la ville — Deal&Co";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const city = slugToCity(slug);

  const count = city
    ? await prisma.listing
        .count({
          where: {
            status: "APPROVED",
            deletedAt: null,
            location: { contains: city.name, mode: "insensitive" },
          } as any,
        })
        .catch(() => 0)
    : 0;

  const cityName = city?.name ?? slug;
  const dept = city?.departmentCode ?? "";

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
          background: "linear-gradient(135deg, #1e3a8a 0%, #2f6fb8 60%, #38bdf8 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Deal&amp;Co</span>
          <span style={{ fontSize: 18, opacity: 0.8 }}>·</span>
          <span style={{ fontSize: 18, opacity: 0.8 }}>Petites annonces gratuites</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ fontSize: 28, fontWeight: 600, opacity: 0.9 }}>Annonces à</span>
          <span style={{ fontSize: 96, fontWeight: 900, letterSpacing: -2, lineHeight: 1 }}>
            {cityName}
            {dept && (
              <span style={{ fontSize: 48, fontWeight: 700, opacity: 0.7, marginLeft: 16 }}>
                ({dept})
              </span>
            )}
          </span>
          {count > 0 && (
            <span style={{ fontSize: 36, fontWeight: 700, color: "#fef08a", marginTop: 4 }}>
              {count.toLocaleString("fr-FR")} annonces disponibles
            </span>
          )}
        </div>

        <div style={{ fontSize: 22, opacity: 0.85 }}>dealandcompany.fr</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

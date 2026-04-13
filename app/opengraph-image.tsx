import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          gap: 32,
        }}
      >
        {/* Logo */}
        <img
          src={`${process.env.NEXT_PUBLIC_BASE_URL || "https://www.dealandcompany.fr"}/logo-dealco.png`}
          width={500}
          height={160}
          style={{ objectFit: "contain" }}
        />

        {/* Tagline */}
        <p
          style={{
            fontSize: 32,
            color: "#555555",
            margin: 0,
            fontFamily: "sans-serif",
            textAlign: "center",
          }}
        >
          Achetez et vendez près de chez vous
        </p>
      </div>
    ),
    { ...size }
  );
}

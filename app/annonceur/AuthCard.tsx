import { Sora } from "next/font/google";
import { COLORS } from "@/lib/ads/theme";

const sora = Sora({ subsets: ["latin"], weight: ["600", "700", "800"], display: "swap" });

/**
 * Cadre des écrans d'entrée : connexion et changement de mot de passe.
 *
 * Même vocabulaire que le reste de l'espace annonceur — la première chose que
 * voit un nouvel annonceur doit déjà ressembler à l'outil dans lequel il va
 * travailler, pas à une page de connexion générique.
 */
export default function AuthCard({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${sora.className} min-h-screen grid place-items-center px-4 py-12`}
      style={{ background: COLORS.ground, color: COLORS.ink }}
    >
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-2.5 mb-6">
          <span
            className="w-10 h-10 rounded-xl grid place-items-center text-white shrink-0"
            style={{
              background: `linear-gradient(135deg, ${COLORS.blueLight}, ${COLORS.blue})`,
              boxShadow: "0 6px 14px -4px rgba(37,99,235,0.5)",
            }}
          >
            <span className="material-symbols-outlined text-[20px]">campaign</span>
          </span>
          <span>
            <span className="block font-extrabold text-[17px] leading-tight">Deal&amp;Co</span>
            <span className="block text-[11px] font-semibold" style={{ color: COLORS.muted }}>
              Espace annonceur
            </span>
          </span>
        </div>

        <div
          className="rounded-[18px] p-6"
          style={{ background: "#fff", border: `1px solid ${COLORS.line}` }}
        >
          <h1 className="font-extrabold text-[21px] leading-tight">{title}</h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: COLORS.muted }}>
            {intro}
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}

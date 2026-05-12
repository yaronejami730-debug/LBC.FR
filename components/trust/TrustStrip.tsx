import { TrustBadge } from "./TrustBadge";

interface TrustStripProps {
  variant?: "register" | "listing" | "upload" | "footer";
  className?: string;
}

const VARIANTS = {
  register: [
    { icon: "public", label: "Hébergement UE 🇪🇺", tone: "primary" as const },
    { icon: "shield_lock", label: "Conforme RGPD", tone: "emerald" as const },
    { icon: "visibility_off", label: "Jamais revendues", tone: "neutral" as const },
  ],
  listing: [
    { icon: "verified_user", label: "Modération active", tone: "primary" as const },
    { icon: "lock", label: "Messagerie privée", tone: "emerald" as const },
    { icon: "report", label: "Signalement 1-clic", tone: "neutral" as const },
  ],
  upload: [
    { icon: "encrypted", label: "Stockage chiffré", tone: "emerald" as const },
    { icon: "public", label: "Serveurs UE", tone: "primary" as const },
    { icon: "delete", label: "Suppression à la demande", tone: "neutral" as const },
  ],
  footer: [
    { icon: "public", label: "Hébergement européen", tone: "primary" as const },
    { icon: "verified", label: "Conforme RGPD", tone: "emerald" as const },
    { icon: "lock", label: "TLS 1.3", tone: "neutral" as const },
    { icon: "cookie_off", label: "Zéro cookie pub tiers", tone: "neutral" as const },
  ],
};

export function TrustStrip({ variant = "register", className = "" }: TrustStripProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {VARIANTS[variant].map((b) => (
        <TrustBadge key={b.label} {...b} />
      ))}
    </div>
  );
}

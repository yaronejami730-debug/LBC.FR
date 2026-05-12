export function TrustLockNote({
  variant,
}: {
  variant: "upload-photo" | "upload-doc" | "payment" | "password" | "personal-info";
}) {
  const COPY = {
    "upload-photo": {
      icon: "image",
      text: "Vos photos sont stockées de manière sécurisée sur des serveurs européens. Aucune utilisation publicitaire.",
    },
    "upload-doc": {
      icon: "description",
      text: "Document chiffré au stockage. Accès strict, suppression possible à tout moment.",
    },
    payment: {
      icon: "payments",
      text: "Paiement traité par un prestataire certifié PCI-DSS. Aucune donnée bancaire n'est stockée par Deal&Co.",
    },
    password: {
      icon: "lock",
      text: "Mot de passe haché avec bcrypt — jamais lu en clair, par personne.",
    },
    "personal-info": {
      icon: "shield_person",
      text: "Informations utilisées uniquement pour ton compte. Jamais revendues, jamais partagées sans accord.",
    },
  } as const;

  const { icon, text } = COPY[variant];

  return (
    <p className="inline-flex items-start gap-1.5 text-[11.5px] leading-relaxed text-slate-500 dark:text-white/55">
      <span className="material-symbols-outlined mt-[1px] shrink-0 text-[14px] text-emerald-600 dark:text-emerald-400">
        {icon}
      </span>
      <span>{text}</span>
    </p>
  );
}

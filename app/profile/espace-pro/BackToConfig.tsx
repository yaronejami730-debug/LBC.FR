import Link from "next/link";

/**
 * Retour au hub de configuration.
 *
 * Les écrans de réglage ne sont plus des onglets : sans ce lien, on n'en sort
 * qu'en repassant par « Configuration » dans la barre, ce qui donne
 * l'impression d'avoir quitté la section.
 */
export default function BackToConfig({ etab }: { etab?: string }) {
  return (
    <Link
      href={etab ? `/profile/espace-pro/configuration?etab=${etab}` : "/profile/espace-pro/configuration"}
      title="Retour à la configuration"
      className="inline-flex items-center gap-1.5 text-xs font-bold text-outline hover:text-primary mb-2"
    >
      <span className="material-symbols-outlined text-[16px]">arrow_back</span>
      Configuration
    </Link>
  );
}

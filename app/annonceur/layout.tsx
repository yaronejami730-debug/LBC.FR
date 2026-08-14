import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Espace annonceur — Deal&Co",
  // L'espace annonceur n'a rien à faire dans un moteur de recherche : il est
  // privé, et ses URL circulent par e-mail, pas par Google.
  robots: { index: false, follow: false },
};

/**
 * Espace annonceur Deal&Co Ads.
 *
 * Volontairement hors de `/profile` : un annonceur n'est pas un membre de la
 * marketplace. Il ne partage ni sa session, ni sa navigation, ni son entête.
 */
export default function AdvertiserLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-surface text-on-surface">{children}</div>;
}

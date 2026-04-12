import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 text-center">
      <p className="text-8xl font-extrabold text-primary/10 font-['Manrope'] mb-2">404</p>
      <h1 className="text-2xl font-extrabold text-on-surface font-['Manrope'] mb-2">Page introuvable</h1>
      <p className="text-on-surface-variant mb-8 max-w-sm">
        Cette page n&apos;existe pas ou a été supprimée.
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="px-6 py-3 bg-primary text-white rounded-full font-bold text-sm shadow-md shadow-primary/20 active:scale-95 transition-transform"
        >
          Retour à l'accueil
        </Link>
        <Link
          href="/search"
          className="px-6 py-3 bg-surface-container text-on-surface rounded-full font-semibold text-sm active:scale-95 transition-transform"
        >
          Voir les annonces
        </Link>
      </div>
    </div>
  );
}

import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";

export default function ListingNotFound() {
  return (
    <div className="min-h-screen bg-[#f7f9fb] text-on-surface pb-24">
      <Navbar />

      <main className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="text-6xl mb-6">🔍</div>

        <h1 className="text-2xl font-black text-[#2f6fb8] font-['Manrope'] mb-2">
          Cette annonce n'est plus disponible
        </h1>
        <p className="text-slate-500 text-sm max-w-xs mb-8 leading-relaxed">
          Elle a peut-être été vendue, supprimée ou le lien n'est plus valide.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/search"
            className="px-6 py-3 bg-[#2f6fb8] text-white rounded-full font-bold text-sm shadow-md shadow-[#2f6fb8]/20 active:scale-95 transition-transform"
          >
            Voir les annonces
          </Link>
          <Link
            href="/"
            className="px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-full font-semibold text-sm active:scale-95 transition-transform"
          >
            Retour à l'accueil
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

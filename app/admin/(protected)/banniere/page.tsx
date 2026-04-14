import { prisma } from "@/lib/prisma";
import BannerForm from "./BannerForm";
import BannerList from "./BannerList";

export default async function BannierePage() {
  const banners = await prisma.heroBanner.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-[#191c1e] font-headline">Bannière d'accueil</h1>
        <p className="text-sm text-[#777683] mt-1">Personnalisez la bannière héro de la homepage. Programmez des bannières saisonnières.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulaire création */}
        <BannerForm />

        {/* Liste des bannières */}
        <BannerList banners={banners} />
      </div>
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import CreateClientPageContent from "./CreateClientPageContent";

export default async function CreateClientPage() {
  // Show non-activated clients AND clients with at least one listing (likely admin-created).
  // Lets the admin reopen any client they previously created to edit their listings.
  const clients = await prisma.user.findMany({
    where: {
      role: "USER",
      OR: [
        { lastLoginAt: null },
        { listings: { some: {} } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      isPro: true,
      companyName: true,
      // Annonces non supprimées uniquement — total exact après suppression.
      _count: { select: { listings: { where: { deletedAt: null } } } },
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#191c1e] font-headline">Créer un client</h1>
        <p className="text-sm text-[#777683] mt-1">
          Créez un compte pour un client et publiez une annonce en son nom. Il recevra un lien pour définir son mot de passe.
        </p>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: "person_add", step: "1", label: "Créez le compte", desc: "Entrez le nom et l'email du client" },
          { icon: "sell", step: "2", label: "Publiez une annonce", desc: "Créez une annonce en son nom (optionnel)" },
          { icon: "mail", step: "3", label: "Il reçoit tout", desc: "Email d'invitation + confirmation d'annonce" },
        ].map(({ icon, step, label, desc }) => (
          <div key={step} className="bg-white rounded-2xl border border-[#eceef0] p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#2f6fb8]/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[20px] text-[#2f6fb8]">{icon}</span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#777683] mb-0.5">Étape {step}</p>
              <p className="text-sm font-bold text-[#191c1e]">{label}</p>
              <p className="text-xs text-[#777683] mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <CreateClientPageContent initialClients={clients} />
    </div>
  );
}

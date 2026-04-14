"use client";

import { useState } from "react";
import CreateClientForm from "./CreateClientForm";
import ClientsPanel from "./ClientsPanel";

type Client = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  _count: { listings: number };
};

export default function CreateClientPageContent({
  initialClients,
}: {
  initialClients: Client[];
}) {
  const [clients, setClients] = useState(initialClients);

  function handleCreated(client: { userId: string; email: string; name: string }) {
    setClients((prev) => [
      {
        id: client.userId,
        name: client.name,
        email: client.email,
        createdAt: new Date(),
        _count: { listings: 0 },
      },
      ...prev,
    ]);
  }

  return (
    <div className="space-y-8">
      {/* Create account form */}
      <div className="bg-white rounded-2xl border border-[#eceef0] p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-[#2f6fb8]/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[20px] text-[#2f6fb8]">person_add</span>
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#191c1e] font-headline">Créer un compte client</h2>
            <p className="text-xs text-[#777683]">Un lien d'activation sera envoyé par email automatiquement</p>
          </div>
        </div>
        <CreateClientForm onCreated={handleCreated} />
      </div>

      {/* Clients list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-extrabold text-[#191c1e] font-headline">
            Comptes créés via admin
          </h2>
          <span className="text-xs text-[#777683] bg-white border border-[#eceef0] px-3 py-1 rounded-xl font-medium">
            {clients.length} compte{clients.length !== 1 ? "s" : ""}
          </span>
        </div>
        <ClientsPanel clients={clients} />
      </div>
    </div>
  );
}

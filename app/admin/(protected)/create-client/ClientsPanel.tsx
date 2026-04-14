"use client";

import { useState } from "react";
import { resendInvitation } from "@/app/admin/actions";
import AdminListingForm from "./AdminListingForm";

type Client = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  _count: { listings: number };
};

export default function ClientsPanel({ clients }: { clients: Client[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [createdListings, setCreatedListings] = useState<Record<string, string>>({});
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  async function handleResend(userId: string, email: string) {
    setResendingId(userId);
    setResendSuccess(null);
    try {
      await resendInvitation(userId);
      setResendSuccess(userId);
      setTimeout(() => setResendSuccess(null), 3000);
    } finally {
      setResendingId(null);
    }
  }

  if (clients.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#eceef0] py-16 text-center">
        <span className="material-symbols-outlined text-5xl text-[#c7c5d4]">group_add</span>
        <p className="text-[#777683] mt-2 text-sm">Aucun compte créé via l'admin pour l'instant</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
      <div className="divide-y divide-[#f2f4f6]">
        {clients.map((client) => (
          <div key={client.id}>
            <div className="flex items-center gap-4 px-6 py-4 hover:bg-[#f7f9fb] transition-colors">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-[#e1e0ff] flex items-center justify-center flex-shrink-0">
                <span className="text-[#2f6fb8] text-sm font-bold">
                  {client.name.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#191c1e] truncate">{client.name}</p>
                <p className="text-xs text-[#777683] truncate">{client.email}</p>
              </div>

              {/* Badge annonces */}
              <span className="text-xs text-[#777683] font-medium hidden sm:block flex-shrink-0">
                {client._count.listings} annonce{client._count.listings !== 1 ? "s" : ""}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setExpandedId(expandedId === client.id ? null : client.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    expandedId === client.id
                      ? "bg-[#2f6fb8] text-white"
                      : "text-[#2f6fb8] bg-[#e8f0fb] hover:bg-[#d5e3fc]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {expandedId === client.id ? "expand_less" : "add_circle"}
                  </span>
                  <span className="hidden sm:inline">
                    {expandedId === client.id ? "Fermer" : "Créer une annonce"}
                  </span>
                </button>
                <button
                  onClick={() => handleResend(client.id, client.email)}
                  disabled={resendingId === client.id}
                  title="Renvoyer l'invitation"
                  className={`p-2 rounded-lg transition-all disabled:opacity-50 ${
                    resendSuccess === client.id
                      ? "text-emerald-600 bg-emerald-50"
                      : "text-[#777683] hover:text-[#2f6fb8] hover:bg-[#e8f0fb]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: resendSuccess === client.id ? "'FILL' 1" : "'FILL' 0" }}>
                    {resendSuccess === client.id ? "check_circle" : resendingId === client.id ? "hourglass_empty" : "send"}
                  </span>
                </button>
              </div>
            </div>

            {/* Listing form accordion */}
            {expandedId === client.id && (
              <div className="px-6 pb-6 border-t border-[#f2f4f6] bg-[#f7f9fb]">
                <div className="pt-5">
                  {createdListings[client.id] ? (
                    <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50 px-4 py-4 rounded-xl border border-emerald-100">
                      <span
                        className="material-symbols-outlined text-[22px] flex-shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <div>
                        <p className="text-sm font-bold">Annonce publiée et email envoyé !</p>
                        <a
                          href={`/annonce/${createdListings[client.id]}`}
                          target="_blank"
                          className="text-xs font-semibold underline"
                        >
                          Voir l'annonce →
                        </a>
                      </div>
                    </div>
                  ) : (
                    <AdminListingForm
                      userId={client.id}
                      userName={client.name}
                      onDone={(listingId) => {
                        setCreatedListings((prev) => ({ ...prev, [client.id]: listingId }));
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

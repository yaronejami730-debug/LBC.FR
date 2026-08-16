"use client";

/**
 * Écran de stock.
 *
 * Ce qu'un commerçant fait dix fois par jour doit tenir en un geste : « il m'en
 * reste un de moins ». D'où les boutons −1 / +1 en tête de ligne, avant toute
 * autre commande. Le reste — corriger un solde après recomptage, changer un
 * prix — est plus rare et peut demander un clic de plus.
 *
 * Les ruptures et les alertes remontent en haut de liste sans qu'on les
 * cherche : c'est la seule information de cet écran qui appelle une action.
 *
 * Chaque mouvement part au serveur, qui seul décide. L'affichage se met à jour
 * sur sa réponse, jamais par anticipation : un stock affiché à 3 alors que le
 * serveur en compte 2 ferait vendre une pièce qui n'existe pas.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export type StockState = {
  onHand: number | null;
  reserved: number;
  available: number | null;
  unlimited: boolean;
  low: boolean;
  outOfStock: boolean;
};

export type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  section: string | null;
  price: number;
  status: string;
  lowStockAt: number | null;
  unlimited: boolean;
  stock: StockState;
  listings: { id: string; title: string; status: string }[];
};

export default function StockBoard({ products }: { products: ProductRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function move(productId: string, delta: number, reason: string) {
    setBusy(productId);
    setError(null);
    try {
      const res = await fetch(`/api/pro/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movement: { delta, reason } }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Mouvement refusé");
      // Le serveur fait foi : on relit plutôt que de deviner le nouvel état.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mouvement refusé");
    } finally {
      setBusy(null);
    }
  }

  // Ce qui demande une action passe devant : rupture, puis alerte, puis le reste.
  const sorted = [...products].sort((a, b) => {
    const weight = (p: ProductRow) => (p.stock.outOfStock ? 0 : p.stock.low ? 1 : 2);
    return weight(a) - weight(b) || a.name.localeCompare(b.name, "fr");
  });

  const alerts = products.filter((p) => p.stock.outOfStock || p.stock.low).length;

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="bg-[#fdf2f3] border border-[#f4d3d6] text-[#99303a] rounded-xl px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {alerts > 0 && (
        <p className="bg-[#f6ecdd] border border-[#e6d3b3] text-[#9a6118] rounded-xl px-4 py-3 text-sm font-medium">
          {alerts === 1
            ? "1 produit demande votre attention."
            : `${alerts} produits demandent votre attention.`}
        </p>
      )}

      {products.length === 0 ? (
        <div className="bg-white border border-[#eceef0] rounded-2xl px-6 py-12 text-center">
          <p className="font-bold text-[#191c1e] mb-1">Aucun produit</p>
          <p className="text-sm text-[#777683]">
            Ajoutez vos articles pour suivre vos quantités et laisser vos annonces
            se mettre à jour toutes seules.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#eceef0] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f7f7fb] text-[#5a5b6e] text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">Produit</th>
                  <th className="text-right px-4 py-3 font-bold">Prix</th>
                  <th className="text-center px-4 py-3 font-bold">Stock</th>
                  <th className="text-center px-4 py-3 font-bold">Mouvement</th>
                  <th className="text-left px-4 py-3 font-bold">Annonce</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id} className="border-t border-[#eceef0]">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#191c1e]">{p.name}</div>
                      <div className="text-xs text-[#9ea4a9]">
                        {p.sku ? `Réf. ${p.sku}` : "Sans référence"}
                        {p.section ? ` · ${p.section}` : ""}
                        {p.status === "ARCHIVED" ? " · archivé" : ""}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                      {p.price.toLocaleString("fr-FR")} €
                    </td>

                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <StockBadge stock={p.stock} />
                      {p.stock.reserved > 0 && (
                        <div className="text-[11px] text-[#9ea4a9] mt-1">
                          dont {p.stock.reserved} réservé{p.stock.reserved > 1 ? "s" : ""}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {p.unlimited ? (
                        <span className="text-xs text-[#9ea4a9]">—</span>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <StepButton
                            label={`Retirer une unité de ${p.name}`}
                            symbol="remove"
                            disabled={busy === p.id || (p.stock.onHand ?? 0) <= 0}
                            onClick={() => move(p.id, -1, "SALE")}
                          />
                          <StepButton
                            label={`Ajouter une unité de ${p.name}`}
                            symbol="add"
                            disabled={busy === p.id}
                            onClick={() => move(p.id, 1, "RECEIPT")}
                          />
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {p.listings.length === 0 ? (
                        <span className="text-xs text-[#9ea4a9]">Non publié</span>
                      ) : (
                        p.listings.map((l) => (
                          <div key={l.id} className="text-xs">
                            <span
                              className={
                                l.status === "SOLD" ? "text-[#9a6118]" : "text-[#1d6a58]"
                              }
                            >
                              {l.status === "SOLD" ? "Épuisée" : "En ligne"}
                            </span>
                            <span className="text-[#9ea4a9]"> · {l.title}</span>
                          </div>
                        ))
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-[#9ea4a9] leading-relaxed">
        Un produit épuisé passe automatiquement ses annonces en «&nbsp;épuisée&nbsp;», et les
        remet en ligne dès son réapprovisionnement. Les annonces retirées par la
        modération ne sont jamais republiées de cette façon.
      </p>
    </div>
  );
}

function StockBadge({ stock }: { stock: StockState }) {
  if (stock.unlimited) {
    return <span className="text-sm text-[#5a5b6e]">Illimité</span>;
  }
  const cls = stock.outOfStock
    ? "bg-[#f7e5e6] text-[#99303a]"
    : stock.low
      ? "bg-[#f6ecdd] text-[#9a6118]"
      : "bg-[#e2efea] text-[#1d6a58]";

  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-sm font-bold tabular-nums ${cls}`}>
      {stock.available ?? 0}
    </span>
  );
}

function StepButton({
  label,
  symbol,
  disabled,
  onClick,
}: {
  label: string;
  symbol: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-9 h-9 rounded-lg border border-[#dfe4e8] text-[#5a5b6e] hover:border-[#2f6fb8] hover:text-[#2f6fb8] disabled:opacity-35 disabled:hover:border-[#dfe4e8] disabled:hover:text-[#5a5b6e] transition-colors flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#2f6fb8]/40 outline-none"
    >
      <span aria-hidden className="material-symbols-outlined text-[18px]">
        {symbol}
      </span>
    </button>
  );
}

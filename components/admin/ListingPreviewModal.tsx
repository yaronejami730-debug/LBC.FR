"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export type PreviewVehicle = {
  marque?: string;
  modele?: string;
  annee?: string;
  kilometrage?: string;
  carburant?: string;
  transmission?: string;
  couleur?: string;
  puissanceFiscale?: string;
  nombrePortes?: string;
  motorisation?: string;
  nombrePlaces?: string;
  typeVehicule?: string;
  emissionCO2?: string;
  consoMixte?: string;
  critAir?: string;
  options?: string[];
};

export type PreviewImmo = {
  typeBien?: string;
  surface?: string;
  nombrePieces?: string;
  nombreChambres?: string;
  nombreSallesEau?: string;
  etage?: string;
  exposition?: string;
  classeEnergie?: string;
  ges?: string;
  anneeConstruction?: string;
  caracteristiques?: string[];
};

export type PreviewData = {
  title: string;
  price: string | number;
  description: string;
  location: string;
  condition: string;
  category: string;
  subcategory?: string;
  brand?: string;
  images: string[];
  phone?: string;
  hidePhone?: boolean;
  authorName: string;
  isPro?: boolean;
  companyName?: string | null;
  vehicle?: PreviewVehicle;
  immo?: PreviewImmo;
};

export default function ListingPreviewModal({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: PreviewData;
}) {
  const [view, setView] = useState<"detail" | "card">("detail");
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const displayName =
    data.isPro && data.companyName?.trim() ? data.companyName : data.authorName;
  const priceNumber = typeof data.price === "number" ? data.price : parseFloat(String(data.price));
  const priceStr = isNaN(priceNumber) ? "Prix non défini" : `${priceNumber.toLocaleString("fr-FR")} €`;
  const cover = data.images[activePhoto] ?? data.images[0];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-stretch justify-center overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl my-6 mx-4 bg-[#f7f9fb] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="sticky top-0 z-10 bg-white border-b border-[#eceef0] flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
              Aperçu
            </span>
            <span className="text-xs text-[#777683] hidden sm:inline">
              Prévisualisation — l'annonce n'est pas encore publiée
            </span>
          </div>
          <div className="flex items-center gap-1 bg-[#f2f4f6] rounded-full p-1">
            <button
              type="button"
              onClick={() => setView("detail")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                view === "detail" ? "bg-white text-[#2f6fb8] shadow" : "text-[#777683]"
              }`}
            >
              Fiche
            </button>
            <button
              type="button"
              onClick={() => setView("card")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                view === "card" ? "bg-white text-[#2f6fb8] shadow" : "text-[#777683]"
              }`}
            >
              Carte (résultats)
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-9 h-9 rounded-full bg-[#f2f4f6] hover:bg-[#e8eaed] flex items-center justify-center text-[#191c1e] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {view === "detail" ? (
            <DetailView
              data={data}
              cover={cover}
              activePhoto={activePhoto}
              setActivePhoto={setActivePhoto}
              displayName={displayName}
              priceStr={priceStr}
            />
          ) : (
            <CardView data={data} cover={cover} priceStr={priceStr} displayName={displayName} />
          )}
        </div>
      </div>
    </div>
  );
}

function DetailView({
  data,
  cover,
  activePhoto,
  setActivePhoto,
  displayName,
  priceStr,
}: {
  data: PreviewData;
  cover?: string;
  activePhoto: number;
  setActivePhoto: (i: number) => void;
  displayName: string;
  priceStr: string;
}) {
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      {/* Photo gallery */}
      <div>
        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-[#e8eaed]">
          {cover ? (
            <Image src={cover} alt={data.title || "Photo"} fill sizes="800px" className="object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#9ca3af]">
              <span className="material-symbols-outlined text-5xl">image</span>
              <p className="text-xs">Aucune photo ajoutée</p>
            </div>
          )}
          {data.images.length > 1 && (
            <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
              {activePhoto + 1} / {data.images.length}
            </div>
          )}
        </div>
        {data.images.length > 1 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {data.images.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActivePhoto(i)}
                className={`relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                  i === activePhoto ? "border-[#2f6fb8]" : "border-transparent"
                }`}
              >
                <Image src={src} alt={`Photo ${i + 1}`} fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Title + price */}
      <div className="bg-white rounded-2xl border border-[#eceef0] p-5 sm:p-6 space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
          {data.category}
          {data.subcategory ? ` · ${data.subcategory}` : ""}
        </p>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#191c1e] leading-snug">
          {data.title || "(Titre non défini)"}
        </h1>
        <div className="flex items-baseline gap-3 flex-wrap">
          <p className="text-2xl sm:text-3xl font-extrabold text-[#2f6fb8]">{priceStr}</p>
          {data.condition && (
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#e8f0fb] text-[#2f6fb8]">
              {data.condition}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-[#464652]">
          <span className="material-symbols-outlined text-[18px] text-[#777683]">location_on</span>
          <span>{data.location || "Localisation non définie"}</span>
        </div>
        {data.brand && (
          <div className="flex items-center gap-2 text-sm text-[#464652]">
            <span className="material-symbols-outlined text-[18px] text-[#777683]">sell</span>
            <span>Marque · <strong>{data.brand}</strong></span>
          </div>
        )}
      </div>

      {/* Vehicle / Immo metadata */}
      {data.vehicle && hasVehicleData(data.vehicle) && <VehicleBlock v={data.vehicle} />}
      {data.immo && hasImmoData(data.immo) && <ImmoBlock i={data.immo} />}

      {/* Description */}
      <div className="bg-white rounded-2xl border border-[#eceef0] p-5 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#777683] mb-3">Description</h2>
        {data.description ? (
          <p className="text-[#191c1e] text-sm leading-relaxed whitespace-pre-wrap">
            {data.description}
          </p>
        ) : (
          <p className="text-[#9ca3af] text-sm italic">Aucune description renseignée</p>
        )}
      </div>

      {/* Vendeur */}
      <div className="bg-white rounded-2xl border border-[#eceef0] p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#e1e0ff] flex items-center justify-center shrink-0">
          <span className="text-[#2f6fb8] text-base font-extrabold">
            {displayName.charAt(0).toUpperCase() || "?"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#191c1e] truncate">{displayName}</p>
          <p className="text-xs text-[#777683]">
            {data.isPro ? "Vendeur professionnel" : "Vendeur particulier"}
          </p>
        </div>
        {data.phone && !data.hidePhone && (
          <span className="text-sm text-[#2f6fb8] font-bold tabular-nums">{data.phone}</span>
        )}
      </div>
    </div>
  );
}

function CardView({
  data,
  cover,
  priceStr,
  displayName,
}: {
  data: PreviewData;
  cover?: string;
  priceStr: string;
  displayName: string;
}) {
  return (
    <div className="p-6 sm:p-10 space-y-6 max-w-3xl mx-auto">
      <p className="text-xs text-[#777683] text-center">
        Voici comment l&apos;annonce apparaît dans les résultats de recherche et sur la page d&apos;accueil.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {/* The actual card */}
        <div className="group flex flex-col bg-white rounded-xl overflow-hidden border border-[#eceef0]">
          <div className="relative aspect-square overflow-hidden bg-[#f2f4f6]">
            {cover ? (
              <Image src={cover} alt={data.title || ""} fill sizes="200px" className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-[#c7c5d4]">image</span>
              </div>
            )}
          </div>
          <div className="p-2.5 flex flex-col gap-0.5">
            <p className="text-[#191c1e] font-semibold text-sm leading-snug line-clamp-2">
              {data.title || "(Titre)"}
            </p>
            <p className="text-[#2f6fb8] font-bold text-base mt-1">{priceStr}</p>
            <p className="text-[#777683] text-xs truncate">{data.location || "—"}</p>
            <p className="text-[#9ca3af] text-[10px]">À l&apos;instant</p>
          </div>
        </div>

        {/* Spacer cards for context */}
        <div className="hidden sm:block bg-[#f2f4f6] rounded-xl border border-dashed border-[#c7c5d4] flex items-center justify-center text-[10px] text-[#9ca3af]">
          (autre annonce)
        </div>
        <div className="hidden sm:block bg-[#f2f4f6] rounded-xl border border-dashed border-[#c7c5d4] flex items-center justify-center text-[10px] text-[#9ca3af]">
          (autre annonce)
        </div>
      </div>
      <div className="text-xs text-[#777683] bg-white border border-[#eceef0] rounded-xl px-4 py-3">
        <p>
          <strong>Vendeur affiché :</strong> {displayName}
          {data.isPro ? " (compte pro)" : " (compte particulier)"}
        </p>
      </div>
    </div>
  );
}

function VehicleBlock({ v }: { v: PreviewVehicle }) {
  const items: { label: string; value: string | undefined }[] = [
    { label: "Marque", value: v.marque },
    { label: "Modèle", value: v.modele },
    { label: "Année", value: v.annee },
    { label: "Kilométrage", value: v.kilometrage ? `${Number(v.kilometrage).toLocaleString("fr-FR")} km` : undefined },
    { label: "Carburant", value: v.carburant },
    { label: "Boîte", value: v.transmission },
    { label: "Puissance fiscale", value: v.puissanceFiscale ? `${v.puissanceFiscale} CV` : undefined },
    { label: "Portes", value: v.nombrePortes },
    { label: "Places", value: v.nombrePlaces },
    { label: "Couleur", value: v.couleur },
    { label: "Crit'Air", value: v.critAir },
    { label: "CO₂", value: v.emissionCO2 ? `${v.emissionCO2} g/km` : undefined },
    { label: "Conso mixte", value: v.consoMixte ? `${v.consoMixte} L/100km` : undefined },
    { label: "Type", value: v.typeVehicule },
  ].filter((it) => it.value && String(it.value).trim());

  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-[#eceef0] p-5 sm:p-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#777683] mb-3">
        Caractéristiques du véhicule
      </h2>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
        {items.map((it) => (
          <div key={it.label}>
            <dt className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-bold">
              {it.label}
            </dt>
            <dd className="text-sm text-[#191c1e] font-semibold">{it.value}</dd>
          </div>
        ))}
      </dl>
      {v.options && v.options.length > 0 && (
        <div className="mt-5 pt-5 border-t border-[#eceef0]">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
            Équipements ({v.options.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {v.options.map((o) => (
              <span key={o} className="px-2.5 py-1 rounded-full bg-[#f2f4f6] text-[#191c1e] text-[11px] font-medium">
                {o}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ImmoBlock({ i }: { i: PreviewImmo }) {
  const items: { label: string; value: string | undefined }[] = [
    { label: "Type", value: i.typeBien },
    { label: "Surface", value: i.surface ? `${i.surface} m²` : undefined },
    { label: "Pièces", value: i.nombrePieces },
    { label: "Chambres", value: i.nombreChambres },
    { label: "Salles d'eau", value: i.nombreSallesEau },
    { label: "Étage", value: i.etage },
    { label: "Exposition", value: i.exposition },
    { label: "DPE", value: i.classeEnergie },
    { label: "GES", value: i.ges },
    { label: "Année construction", value: i.anneeConstruction },
  ].filter((it) => it.value && String(it.value).trim());

  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-[#eceef0] p-5 sm:p-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#777683] mb-3">
        Caractéristiques du bien
      </h2>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
        {items.map((it) => (
          <div key={it.label}>
            <dt className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-bold">
              {it.label}
            </dt>
            <dd className="text-sm text-[#191c1e] font-semibold">{it.value}</dd>
          </div>
        ))}
      </dl>
      {i.caracteristiques && i.caracteristiques.length > 0 && (
        <div className="mt-5 pt-5 border-t border-[#eceef0]">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
            Équipements ({i.caracteristiques.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {i.caracteristiques.map((c) => (
              <span key={c} className="px-2.5 py-1 rounded-full bg-[#f2f4f6] text-[#191c1e] text-[11px] font-medium">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function hasVehicleData(v: PreviewVehicle): boolean {
  return Boolean(
    v.marque || v.modele || v.annee || v.kilometrage || v.carburant ||
    v.transmission || v.puissanceFiscale || v.couleur || v.critAir ||
    v.emissionCO2 || v.consoMixte || (v.options && v.options.length > 0),
  );
}

function hasImmoData(i: PreviewImmo): boolean {
  return Boolean(
    i.typeBien || i.surface || i.nombrePieces || i.nombreChambres ||
    i.nombreSallesEau || i.etage || i.exposition || i.classeEnergie ||
    i.ges || i.anneeConstruction || (i.caracteristiques && i.caracteristiques.length > 0),
  );
}

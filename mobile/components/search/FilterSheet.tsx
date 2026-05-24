import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";
import { CATEGORIES, CONDITIONS } from "@/lib/categories";

export type SortKey = "recent" | "price_asc" | "price_desc";

export type Filters = {
  category: string; // label, "" = toutes
  minPrice: string;
  maxPrice: string;
  location: string;
  condition: string;
  minYear: string;
  maxYear: string;
  minKm: string;
  maxKm: string;
  fuel: string;
  gearbox: string;
  minSurface: string;
  maxSurface: string;
  minRooms: string;
  maxRooms: string;
  size: string;
  since: string; // jours (1, 7, 30, 90, ""=tout)
  sort: SortKey;
};

export const EMPTY_FILTERS: Filters = {
  category: "", minPrice: "", maxPrice: "", location: "", condition: "",
  minYear: "", maxYear: "", minKm: "", maxKm: "", fuel: "", gearbox: "",
  minSurface: "", maxSurface: "", minRooms: "", maxRooms: "", size: "",
  since: "", sort: "recent",
};

const FUELS = ["Essence", "Diesel", "Hybride", "Électrique"];
const GEARBOXES = ["Manuelle", "Automatique"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

// Champs affichés selon la catégorie — s'adapte comme LeBonCoin.
// "since" et "condition" sont communs à tout (ajoutés à la fin).
type FieldKind = "year" | "km" | "fuel" | "gearbox" | "surface" | "rooms" | "size";
const CATEGORY_FIELDS: Record<string, FieldKind[]> = {
  "Véhicules": ["year", "km", "fuel", "gearbox"],
  "Immobilier": ["surface", "rooms"],
  "Mode": ["size"],
  // Maison, Multimédia, Loisirs, Animaux, etc. : juste les champs communs
  // (prix, état, date, localisation) — adapté au type de bien.
};

// Compte les filtres actifs (hors catégorie + tri) pour le badge "Filtres (N)".
export function countActiveFilters(f: Filters): number {
  const keys: (keyof Filters)[] = [
    "minPrice", "maxPrice", "location", "condition", "minYear", "maxYear",
    "minKm", "maxKm", "fuel", "gearbox", "minSurface", "maxSurface", "minRooms", "maxRooms",
    "size", "since",
  ];
  return keys.reduce((n, k) => (f[k] ? n + 1 : n), 0);
}

export function filtersToQuery(f: Filters, q: string): string {
  const p = new URLSearchParams();
  if (q.trim()) p.set("q", q.trim());
  if (f.category) p.set("category", f.category);
  if (f.minPrice) p.set("minPrice", f.minPrice);
  if (f.maxPrice) p.set("maxPrice", f.maxPrice);
  if (f.location.trim()) p.set("location", f.location.trim());
  if (f.condition) p.set("condition", f.condition);
  if (f.minYear) p.set("minYear", f.minYear);
  if (f.maxYear) p.set("maxYear", f.maxYear);
  if (f.minKm) p.set("minKm", f.minKm);
  if (f.maxKm) p.set("maxKm", f.maxKm);
  if (f.fuel) p.set("fuel", f.fuel);
  if (f.gearbox) p.set("gearbox", f.gearbox);
  if (f.minSurface) p.set("minSurface", f.minSurface);
  if (f.maxSurface) p.set("maxSurface", f.maxSurface);
  if (f.minRooms) p.set("minRooms", f.minRooms);
  if (f.maxRooms) p.set("maxRooms", f.maxRooms);
  if (f.size) p.set("size", f.size);
  if (f.since) p.set("since", f.since);
  if (f.sort !== "recent") p.set("sort", f.sort);
  return p.toString();
}

export default function FilterSheet({
  visible,
  initial,
  query,
  onClose,
  onApply,
}: {
  visible: boolean;
  initial: Filters;
  query: string;
  onClose: () => void;
  onApply: (f: Filters) => void;
}) {
  const [draft, setDraft] = useState<Filters>(initial);
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) setDraft(initial);
  }, [visible, initial]);

  const set = (k: keyof Filters, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const fetchCount = useCallback(async (f: Filters) => {
    setCounting(true);
    try {
      const qs = filtersToQuery(f, query);
      const res = await apiFetch<{ total: number }>(`/api/listings?${qs}`, { auth: false });
      setCount(res.total);
    } catch {
      setCount(null);
    } finally {
      setCounting(false);
    }
  }, [query]);

  useEffect(() => {
    if (!visible) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fetchCount(draft), 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [draft, visible, fetchCount]);

  const fields = CATEGORY_FIELDS[draft.category] ?? [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={["top"]} className="flex-1 bg-surface">
        <View className="items-center pt-2">
          <View className="w-10 h-1 rounded-full bg-surface-container" />
        </View>
        <View className="flex-row items-center justify-center px-4 py-3">
          <Text className="text-on-surface text-lg font-bold">Filtres</Text>
          <Pressable onPress={onClose} className="absolute right-3 p-1">
            <Ionicons name="close" size={26} color="#1a1a1a" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <Section title="Catégorie" />
          <ChipRow
            options={[{ label: "Toutes", value: "" }, ...CATEGORIES.map((c) => ({ label: c.label, value: c.label }))]}
            value={draft.category}
            onSelect={(v) => set("category", v)}
          />

          <Section title="Prix" />
          <RangeRow
            minVal={draft.minPrice} maxVal={draft.maxPrice}
            onMin={(v) => set("minPrice", v)} onMax={(v) => set("maxPrice", v)}
            unit="€" keyboard="number-pad"
          />

          {/* Filtres adaptés à la catégorie sélectionnée */}
          {fields.includes("year") && (
            <>
              <Section title="Année" />
              <RangeRow minVal={draft.minYear} maxVal={draft.maxYear} onMin={(v) => set("minYear", v)} onMax={(v) => set("maxYear", v)} keyboard="number-pad" />
            </>
          )}
          {fields.includes("km") && (
            <>
              <Section title="Kilométrage" />
              <RangeRow minVal={draft.minKm} maxVal={draft.maxKm} onMin={(v) => set("minKm", v)} onMax={(v) => set("maxKm", v)} unit="km" keyboard="number-pad" />
            </>
          )}
          {fields.includes("fuel") && (
            <>
              <Section title="Carburant" />
              <ChipRow options={[{ label: "Tous", value: "" }, ...FUELS.map((f) => ({ label: f, value: f }))]} value={draft.fuel} onSelect={(v) => set("fuel", v)} />
            </>
          )}
          {fields.includes("gearbox") && (
            <>
              <Section title="Boîte de vitesse" />
              <ChipRow options={[{ label: "Toutes", value: "" }, ...GEARBOXES.map((g) => ({ label: g, value: g }))]} value={draft.gearbox} onSelect={(v) => set("gearbox", v)} />
            </>
          )}
          {fields.includes("surface") && (
            <>
              <Section title="Surface (m²)" />
              <RangeRow minVal={draft.minSurface} maxVal={draft.maxSurface} onMin={(v) => set("minSurface", v)} onMax={(v) => set("maxSurface", v)} keyboard="number-pad" />
            </>
          )}
          {fields.includes("rooms") && (
            <>
              <Section title="Nombre de pièces" />
              <RangeRow minVal={draft.minRooms} maxVal={draft.maxRooms} onMin={(v) => set("minRooms", v)} onMax={(v) => set("maxRooms", v)} keyboard="number-pad" />
            </>
          )}
          {fields.includes("size") && (
            <>
              <Section title="Taille" />
              <ChipRow options={[{ label: "Toutes", value: "" }, ...SIZES.map((s) => ({ label: s, value: s }))]} value={draft.size} onSelect={(v) => set("size", v)} />
            </>
          )}

          <Section title="État" />
          <ChipRow options={[{ label: "Tous", value: "" }, ...CONDITIONS.map((c) => ({ label: c, value: c }))]} value={draft.condition} onSelect={(v) => set("condition", v)} />

          <Section title="Publié depuis" />
          <ChipRow
            options={[
              { label: "Tout", value: "" },
              { label: "24 h", value: "1" },
              { label: "7 jours", value: "7" },
              { label: "30 jours", value: "30" },
              { label: "90 jours", value: "90" },
            ]}
            value={draft.since}
            onSelect={(v) => set("since", v)}
          />

          <Section title="Localisation" />
          <TextInput
            value={draft.location}
            onChangeText={(v) => set("location", v)}
            placeholder="Ville ou code postal"
            placeholderTextColor="#94a3b8"
            className="bg-surface-container rounded-xl px-4 py-3 text-on-surface"
          />

          <Section title="Trier par" />
          <ChipRow
            options={[
              { label: "Plus récentes", value: "recent" },
              { label: "Prix croissant", value: "price_asc" },
              { label: "Prix décroissant", value: "price_desc" },
            ]}
            value={draft.sort}
            onSelect={(v) => set("sort", v as SortKey)}
          />
        </ScrollView>

        <View className="flex-row gap-3 px-4 py-3 border-t border-surface-container">
          <Pressable onPress={() => setDraft({ ...EMPTY_FILTERS })} className="px-5 py-3.5 rounded-full border border-primary items-center justify-center">
            <Text className="text-primary font-bold">Effacer</Text>
          </Pressable>
          <Pressable onPress={() => onApply(draft)} className="flex-1 py-3.5 rounded-full bg-primary items-center justify-center flex-row">
            {counting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold">
                Rechercher{count !== null ? ` (${count.toLocaleString("fr-FR")})` : ""}
              </Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Section({ title }: { title: string }) {
  return <Text className="text-on-surface text-base font-bold mb-2 mt-4">{title}</Text>;
}

function ChipRow({
  options,
  value,
  onSelect,
}: {
  options: { label: string; value: string }[];
  value: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <Pressable
            key={o.value || "all"}
            onPress={() => onSelect(o.value)}
            className={`px-3 py-2 rounded-full ${active ? "bg-primary" : "bg-surface-container"}`}
          >
            <Text className={`text-sm font-semibold ${active ? "text-white" : "text-on-surface-variant"}`}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RangeRow({
  minVal, maxVal, onMin, onMax, unit, keyboard,
}: {
  minVal: string; maxVal: string;
  onMin: (v: string) => void; onMax: (v: string) => void;
  unit?: string; keyboard?: "number-pad" | "default";
}) {
  return (
    <View className="flex-row gap-3">
      <View className="flex-1 flex-row items-center bg-surface-container rounded-xl px-3">
        <TextInput
          value={minVal} onChangeText={onMin} placeholder="Min" placeholderTextColor="#94a3b8"
          keyboardType={keyboard ?? "default"} className="flex-1 py-3 text-on-surface"
        />
        {unit && <Text className="text-on-surface-variant ml-1">{unit}</Text>}
      </View>
      <View className="flex-1 flex-row items-center bg-surface-container rounded-xl px-3">
        <TextInput
          value={maxVal} onChangeText={onMax} placeholder="Max" placeholderTextColor="#94a3b8"
          keyboardType={keyboard ?? "default"} className="flex-1 py-3 text-on-surface"
        />
        {unit && <Text className="text-on-surface-variant ml-1">{unit}</Text>}
      </View>
    </View>
  );
}

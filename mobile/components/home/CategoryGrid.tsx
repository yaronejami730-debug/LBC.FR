import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";

const CATEGORIES = [
  { id: "vehicules", label: "Véhicules" },
  { id: "immobilier", label: "Immobilier" },
  { id: "mode", label: "Mode" },
  { id: "maison", label: "Maison" },
  { id: "multimedia", label: "Multimédia" },
  { id: "services", label: "Services" },
  { id: "loisirs", label: "Loisirs" },
  { id: "emploi", label: "Emploi" },
];

export default function CategoryGrid() {
  const router = useRouter();
  return (
    <View className="px-4 mt-5">
      <Text className="text-on-surface text-lg font-bold mb-3">Catégories</Text>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => router.push("/recherche")}
            className="bg-surface-container-low border border-surface-container rounded-2xl px-4 py-3 active:opacity-70"
            style={{ width: "48%" }}
          >
            <Text className="text-on-surface font-semibold">{c.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

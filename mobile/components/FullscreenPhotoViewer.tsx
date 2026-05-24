import { useEffect, useRef, useState } from "react";
import { Modal, View, Text, Pressable, Dimensions, FlatList, type ListRenderItem } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const PHOTO_HEIGHT = SCREEN_W; // carré, comme l'aperçu inline

type Props = {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
};

/**
 * Visionneuse plein écran : photos empilées verticalement, scroll continu.
 * Tap sur une photo de l'annonce → ouverture sur cette photo (auto-scroll).
 */
export function FullscreenPhotoViewer({ visible, images, initialIndex = 0, onClose }: Props) {
  const [topIndex, setTopIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<string>>(null);

  // Quand le modal s'ouvre, scroll à la photo cliquée
  useEffect(() => {
    if (visible) {
      setTopIndex(initialIndex);
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: initialIndex * PHOTO_HEIGHT, animated: false });
      });
    }
  }, [visible, initialIndex]);

  const renderItem: ListRenderItem<string> = ({ item }) => (
    <View style={{ width: SCREEN_W, height: PHOTO_HEIGHT, backgroundColor: "#000" }}>
      <Image
        source={{ uri: item }}
        style={{ width: SCREEN_W, height: PHOTO_HEIGHT }}
        contentFit="contain"
        transition={100}
        cachePolicy="memory-disk"
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent={false} statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(_, i) => `photo-${i}`}
          renderItem={renderItem}
          getItemLayout={(_, i) => ({ length: PHOTO_HEIGHT, offset: PHOTO_HEIGHT * i, index: i })}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.y / PHOTO_HEIGHT);
            if (i !== topIndex && i >= 0 && i < images.length) setTopIndex(i);
          }}
          scrollEventThrottle={32}
          ItemSeparatorComponent={() => <View style={{ height: 8, backgroundColor: "#000" }} />}
          contentContainerStyle={{ paddingTop: 80, paddingBottom: SCREEN_H * 0.3 }}
        />

        {/* Top bar */}
        <View style={{ position: "absolute", top: 50, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12 }}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <View style={{ backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>{topIndex + 1} / {images.length}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>
    </Modal>
  );
}

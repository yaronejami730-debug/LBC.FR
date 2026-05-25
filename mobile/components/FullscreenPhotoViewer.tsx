import { useEffect, useRef, useState } from "react";
import { Modal, View, Text, Pressable, Dimensions, FlatList, type ListRenderItem } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ZoomableImage } from "./ZoomableImage";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const H_PAD = 12;
const GAP = 12;
const CARD_W = SCREEN_W - H_PAD * 2;
const PHOTO_H = CARD_W; // carré
const ITEM_H = PHOTO_H + GAP;

type Props = {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  title?: string;
  onClose: () => void;
};

/**
 * Visionneuse plein écran : fond clair, photos en cartes blanches avec relief,
 * scroll vertical continu, titre de l'annonce en en-tête.
 */
export function FullscreenPhotoViewer({ visible, images, initialIndex = 0, title, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [topIndex, setTopIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<string>>(null);

  const headerH = insets.top + 52;

  // Quand le modal s'ouvre, scroll à la photo cliquée
  useEffect(() => {
    if (visible) {
      setTopIndex(initialIndex);
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: initialIndex * ITEM_H, animated: false });
      });
    }
  }, [visible, initialIndex]);

  const renderItem: ListRenderItem<string> = ({ item }) => (
    <View
      style={{
        marginHorizontal: H_PAD,
        marginBottom: GAP,
        borderRadius: 16,
        backgroundColor: "#fff",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
      }}
    >
      <View style={{ borderRadius: 16, overflow: "hidden" }}>
        <ZoomableImage uri={item} width={CARD_W} height={PHOTO_H} background="#fff" />
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent={false} statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#f2f3f5" }}>
        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(_, i) => `photo-${i}`}
          renderItem={renderItem}
          getItemLayout={(_, i) => ({ length: ITEM_H, offset: ITEM_H * i, index: i })}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
            if (i !== topIndex && i >= 0 && i < images.length) setTopIndex(i);
          }}
          scrollEventThrottle={32}
          contentContainerStyle={{ paddingTop: headerH + 8, paddingBottom: SCREEN_H * 0.25 }}
        />

        {/* En-tête : fermer + titre + compteur */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            paddingTop: insets.top,
            backgroundColor: "#ffffff",
            borderBottomWidth: 1,
            borderBottomColor: "#ececef",
          }}
        >
          <View style={{ height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#f2f3f5", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="close" size={22} color="#1a1a1a" />
            </Pressable>
            <Text
              numberOfLines={1}
              style={{ flex: 1, textAlign: "center", marginHorizontal: 8, fontSize: 15, fontWeight: "800", color: "#1a1a1a" }}
            >
              {title ?? ""}
            </Text>
            <View style={{ minWidth: 48, alignItems: "flex-end", paddingRight: 6 }}>
              <Text style={{ color: "#5b5b66", fontSize: 13, fontWeight: "700" }}>{topIndex + 1} / {images.length}</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

import { AccessibilityInfo, findNodeHandle, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef, type ReactNode } from "react";
import { colors, radius, spacing } from "@/design";
import { AppText } from "./AppText";
import { Button } from "./Button";

/** Feuille modale native (présentée par le bas). */
export function Sheet({ visible, title, onClose, children, focusTitle = false }: { visible: boolean; title: string; onClose: () => void; children: ReactNode; /** VoiceOver : place le focus sur le titre à l'ouverture. */ focusTitle?: boolean }) {
  const insets = useSafeAreaInsets();
  const titleRef = useRef<View>(null);
  useEffect(() => {
    if (!visible || !focusTitle) return;
    // Laisse la feuille finir de s'afficher avant de déplacer le focus.
    const timer = setTimeout(() => {
      const handle = findNodeHandle(titleRef.current);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }, 400);
    return () => clearTimeout(timer);
  }, [visible, focusTitle]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <View ref={titleRef} accessible={focusTitle || undefined} accessibilityRole={focusTitle ? "header" : undefined} style={styles.title}>
            <AppText variant="headline" accessibilityRole="header">
              {title}
            </AppText>
          </View>
          <Button label="Fermer" variant="ghost" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SheetBackdrop({ onPress }: { onPress: () => void }) {
  return <Pressable style={StyleSheet.absoluteFill} onPress={onPress} accessibilityLabel="Fermer" />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.gutter, paddingTop: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, borderTopLeftRadius: radius.xl },
  title: { flex: 1 },
  body: { padding: spacing.gutter, gap: spacing.lg },
});

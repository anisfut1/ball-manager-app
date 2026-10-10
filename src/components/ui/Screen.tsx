import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import { colors, spacing } from "@/design";

export interface ScreenProps extends ScrollViewProps {
  children: ReactNode;
  /** Pull-to-refresh. */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Contenu non défilant (listes FlatList/SectionList qui gèrent leur propre défilement). */
  scroll?: boolean;
  edges?: Edge[];
}

/** Écran : fond ivoire, zones sûres, marge latérale de 16 px, défilement par défaut. */
export function Screen({ children, refreshing = false, onRefresh, scroll = true, edges = ["top"], contentContainerStyle, ...props }: ScreenProps) {
  return (
    <SafeAreaView edges={edges} style={styles.root}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentContainerStyle]}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
          keyboardShouldPersistTaps="handled"
          {...props}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.fill}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  content: { paddingHorizontal: spacing.gutter, paddingTop: spacing.md, paddingBottom: spacing.xxxl * 2, gap: spacing.lg },
});

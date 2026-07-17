import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{title}</ThemedText>
      <ThemedText style={styles.hint}>em construção</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  hint: {
    opacity: 0.5,
  },
});

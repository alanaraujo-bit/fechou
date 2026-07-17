import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { API_URL } from '@/constants/api';

type HealthState =
  | { status: 'checking' }
  | { status: 'ok'; latencyMs: number; version: string }
  | { status: 'error'; message: string };

export default function HomeScreen() {
  const [health, setHealth] = useState<HealthState>({ status: 'checking' });

  const checkHealth = useCallback(async () => {
    setHealth({ status: 'checking' });
    const startedAt = Date.now();
    try {
      const response = await fetch(`${API_URL}/health`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as { version: string };
      setHealth({ status: 'ok', latencyMs: Date.now() - startedAt, version: body.version });
    } catch (error) {
      setHealth({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Fechou ⚡</ThemedText>
      <ThemedText style={styles.tagline}>
        Compre e venda usados na sua região, sem enrolação.
      </ThemedText>

      <ThemedView style={styles.card}>
        <ThemedText type="subtitle">API</ThemedText>
        {health.status === 'checking' && <ThemedText>verificando…</ThemedText>}
        {health.status === 'ok' && (
          <ThemedText>
            🟢 no ar — v{health.version} · {health.latencyMs}ms
          </ThemedText>
        )}
        {health.status === 'error' && <ThemedText>🔴 fora do ar — {health.message}</ThemedText>}
        <ThemedText style={styles.apiUrl}>{API_URL}</ThemedText>
        <Pressable onPress={checkHealth}>
          <ThemedText type="link">verificar de novo</ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  tagline: {
    textAlign: 'center',
    opacity: 0.7,
  },
  card: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#808080',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'stretch',
  },
  apiUrl: {
    fontSize: 12,
    opacity: 0.5,
  },
});

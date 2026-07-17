import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';

import { AnuncioCard } from '@/components/anuncio-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { buscarAnuncios, type AnuncioResumo } from '@/lib/anuncios';

type Posicao = { lat: number; lng: number } | null;

export default function HomeScreen() {
  const [posicao, setPosicao] = useState<Posicao>(null);
  const [posicaoResolvida, setPosicaoResolvida] = useState(false);
  const [itens, setItens] = useState<AnuncioResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const permissao = await Location.requestForegroundPermissionsAsync();
        if (permissao.granted) {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setPosicao({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch {
        // Sem localização o feed vira "mais recentes" — segue o jogo.
      } finally {
        setPosicaoResolvida(true);
      }
    })();
  }, []);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const resposta = await buscarAnuncios({
        ...(posicao ? { lat: posicao.lat, lng: posicao.lng, raioKm: 50 } : {}),
      });
      setItens(resposta.itens);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [posicao]);

  useEffect(() => {
    if (posicaoResolvida) carregar();
  }, [posicaoResolvida, carregar]);

  async function atualizar() {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={itens ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AnuncioCard anuncio={item} />}
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={atualizar} />}
        ListHeaderComponent={
          <ThemedView style={styles.cabecalho}>
            <ThemedText type="title">Fechou ⚡</ThemedText>
            <ThemedText style={styles.hint}>
              {posicao ? 'Perto de você' : 'Anúncios recentes'}
            </ThemedText>
          </ThemedView>
        }
        ListEmptyComponent={
          <ThemedView style={styles.vazio}>
            {erro ? (
              <ThemedText style={styles.hint}>🔴 {erro}</ThemedText>
            ) : itens === null ? (
              <ThemedText style={styles.hint}>carregando…</ThemedText>
            ) : (
              <>
                <ThemedText style={styles.vazioEmoji}>🛋️</ThemedText>
                <ThemedText style={styles.hint}>
                  Nada por aqui ainda. Seja quem estreia: anuncie algo!
                </ThemedText>
              </>
            )}
          </ThemedView>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  lista: { padding: 16, paddingTop: 64, gap: 10 },
  cabecalho: { gap: 2, marginBottom: 8 },
  hint: { opacity: 0.6 },
  vazio: { alignItems: 'center', gap: 8, marginTop: 64 },
  vazioEmoji: { fontSize: 40 },
});

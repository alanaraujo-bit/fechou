import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { formatarPreco } from '@/lib/anuncios';
import { useAuth } from '@/lib/auth-context';
import type { ConversaResumo } from '@/lib/conversas';

export default function ChatScreen() {
  const { usuario, chamarComToken } = useAuth();
  const router = useRouter();
  const [itens, setItens] = useState<ConversaResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    if (!usuario) return;
    setErro(null);
    try {
      const resposta = await chamarComToken<{ itens: ConversaResumo[] }>('/conversas');
      setItens(resposta.itens);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [usuario, chamarComToken]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  if (!usuario) {
    return (
      <ThemedView style={styles.centro}>
        <ThemedText type="title">Chat</ThemedText>
        <ThemedText style={styles.hint}>
          Entre na sua conta (aba Perfil) pra conversar com vendedores.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={itens ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={async () => {
              setAtualizando(true);
              await carregar();
              setAtualizando(false);
            }}
          />
        }
        ListHeaderComponent={
          <ThemedText type="title" style={styles.cabecalho}>
            Chat
          </ThemedText>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.cartao}
            onPress={() =>
              router.push({ pathname: '/conversa/[id]', params: { id: item.id } })
            }>
            {item.anuncio.foto ? (
              <Image source={{ uri: item.anuncio.foto }} style={styles.foto} />
            ) : (
              <View style={[styles.foto, styles.semFoto]}>
                <ThemedText>📦</ThemedText>
              </View>
            )}
            <View style={styles.info}>
              <ThemedText type="defaultSemiBold" numberOfLines={1}>
                {item.anuncio.titulo} · {formatarPreco(item.anuncio.precoCentavos)}
              </ThemedText>
              <ThemedText style={styles.meta} numberOfLines={1}>
                {item.papel === 'comprador' ? 'Vendedor(a)' : 'Comprador(a)'}:{' '}
                {item.outro.nome ?? 'sem nome'}
              </ThemedText>
              <ThemedText style={styles.ultima} numberOfLines={1}>
                {item.ultimaMensagem?.texto ?? 'Conversa iniciada'}
              </ThemedText>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <ThemedView style={styles.centroLista}>
            {erro ? (
              <ThemedText style={styles.hint}>🔴 {erro}</ThemedText>
            ) : itens === null ? (
              <ThemedText style={styles.hint}>carregando…</ThemedText>
            ) : (
              <>
                <ThemedText style={styles.vazioEmoji}>💬</ThemedText>
                <ThemedText style={styles.hint}>
                  Nenhuma conversa ainda. Ache um item e chame o vendedor!
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
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  centroLista: { alignItems: 'center', gap: 8, marginTop: 64 },
  lista: { padding: 16, paddingTop: 64, gap: 10 },
  cabecalho: { marginBottom: 8 },
  cartao: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#808080',
  },
  foto: { width: 64, height: 64, borderRadius: 10 },
  semFoto: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#80808020' },
  info: { flex: 1, gap: 2, justifyContent: 'center' },
  meta: { fontSize: 13, opacity: 0.6 },
  ultima: { fontSize: 13, opacity: 0.8 },
  hint: { opacity: 0.6, textAlign: 'center' },
  vazioEmoji: { fontSize: 40 },
});

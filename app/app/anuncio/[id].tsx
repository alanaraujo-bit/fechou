import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  carregarAnuncio,
  formatarPreco,
  rotuloCategoria,
  rotuloCondicao,
  type AnuncioDetalhe,
  type StatusAnuncio,
} from '@/lib/anuncios';
import { useAuth } from '@/lib/auth-context';

const LARGURA = Dimensions.get('window').width;

const STATUS_OPCOES: { valor: StatusAnuncio; rotulo: string }[] = [
  { valor: 'disponivel', rotulo: 'Disponível' },
  { valor: 'reservado', rotulo: 'Reservado' },
  { valor: 'vendido', rotulo: 'Vendido' },
];

export default function AnuncioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario, chamarComToken } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const cores = Colors[colorScheme ?? 'light'];

  const [anuncio, setAnuncio] = useState<AnuncioDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mudandoStatus, setMudandoStatus] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setAnuncio(await carregarAnuncio(id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const souDono = usuario !== null && anuncio !== null && usuario.id === anuncio.vendedor.id;

  async function mudarStatus(status: StatusAnuncio) {
    if (!anuncio || status === anuncio.status) return;
    setMudandoStatus(true);
    try {
      await chamarComToken(`/anuncios/${anuncio.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await carregar();
    } catch (e) {
      Alert.alert('Não deu certo', e instanceof Error ? e.message : String(e));
    } finally {
      setMudandoStatus(false);
    }
  }

  function confirmarExclusao() {
    Alert.alert('Excluir anúncio?', 'Essa ação não tem volta.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await chamarComToken(`/anuncios/${anuncio!.id}`, { method: 'DELETE' });
            router.back();
          } catch (e) {
            Alert.alert('Não deu certo', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  }

  if (erro) {
    return (
      <ThemedView style={styles.centro}>
        <Stack.Screen options={{ title: 'Anúncio' }} />
        <ThemedText style={styles.hint}>🔴 {erro}</ThemedText>
      </ThemedView>
    );
  }

  if (!anuncio) {
    return (
      <ThemedView style={styles.centro}>
        <Stack.Screen options={{ title: 'Anúncio' }} />
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const membroDesde = new Date(anuncio.vendedor.membroDesde).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: anuncio.titulo }} />
      <ScrollView>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {anuncio.fotos.map((url) => (
            <Image key={url} source={{ uri: url }} style={styles.foto} />
          ))}
        </ScrollView>

        <View style={styles.conteudo}>
          {anuncio.status !== 'disponivel' && (
            <ThemedText style={anuncio.status === 'vendido' ? styles.vendido : styles.reservado}>
              {anuncio.status === 'vendido' ? 'Vendido' : 'Reservado'}
            </ThemedText>
          )}

          <ThemedText type="title">{formatarPreco(anuncio.precoCentavos)}</ThemedText>
          <ThemedText type="subtitle">{anuncio.titulo}</ThemedText>
          <ThemedText style={styles.meta}>
            {rotuloCondicao(anuncio.condicao)} · {rotuloCategoria(anuncio.categoria)} ·{' '}
            {anuncio.cidade}
          </ThemedText>

          {anuncio.descricao && <ThemedText style={styles.descricao}>{anuncio.descricao}</ThemedText>}

          <View style={[styles.vendedor, { borderColor: cores.icon }]}>
            <ThemedText type="defaultSemiBold">
              {anuncio.vendedor.nome ?? 'Vendedor(a)'}
            </ThemedText>
            <ThemedText style={styles.meta}>
              {anuncio.vendedor.cidade ? `${anuncio.vendedor.cidade} · ` : ''}membro desde{' '}
              {membroDesde}
            </ThemedText>
          </View>

          {souDono ? (
            <View style={styles.donoArea}>
              <ThemedText type="defaultSemiBold">Status do anúncio</ThemedText>
              <View style={styles.statusLinha}>
                {STATUS_OPCOES.map((s) => (
                  <Pressable
                    key={s.valor}
                    disabled={mudandoStatus}
                    onPress={() => mudarStatus(s.valor)}
                    style={[
                      styles.statusChip,
                      { borderColor: cores.icon },
                      anuncio.status === s.valor && {
                        backgroundColor: cores.tint,
                        borderColor: cores.tint,
                      },
                    ]}>
                    <ThemedText
                      style={
                        anuncio.status === s.valor
                          ? colorScheme === 'dark'
                            ? styles.chipAtivoTextoDark
                            : styles.chipAtivoTexto
                          : styles.chipTexto
                      }>
                      {s.rotulo}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={confirmarExclusao}>
                <ThemedText style={styles.excluir}>Excluir anúncio</ThemedText>
              </Pressable>
            </View>
          ) : (
            <ThemedText style={styles.hint}>
              💬 O chat com o vendedor chega na Fase 3 — aguenta firme!
            </ThemedText>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  foto: { width: LARGURA, height: LARGURA * 0.75 },
  conteudo: { padding: 20, gap: 8 },
  meta: { opacity: 0.6 },
  descricao: { marginTop: 8 },
  hint: { opacity: 0.6, marginTop: 16 },
  reservado: { color: '#b8860b', fontWeight: '600' },
  vendido: { color: '#d9534f', fontWeight: '600' },
  vendedor: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  donoArea: { marginTop: 16, gap: 8 },
  statusLinha: { flexDirection: 'row', gap: 8 },
  statusChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipTexto: { fontSize: 14 },
  chipAtivoTexto: { fontSize: 14, color: '#fff' },
  chipAtivoTextoDark: { fontSize: 14, color: '#151718' },
  excluir: { color: '#d9534f', marginTop: 12 },
});

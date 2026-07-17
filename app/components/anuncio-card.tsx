import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { formatarPreco, rotuloCondicao, type AnuncioResumo } from '@/lib/anuncios';

export function AnuncioCard({ anuncio }: { anuncio: AnuncioResumo }) {
  const router = useRouter();

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push({ pathname: '/anuncio/[id]', params: { id: anuncio.id } })}>
      {anuncio.foto ? (
        <Image source={{ uri: anuncio.foto }} style={styles.foto} />
      ) : (
        <View style={[styles.foto, styles.semFoto]}>
          <ThemedText style={styles.semFotoTexto}>📦</ThemedText>
        </View>
      )}
      <View style={styles.info}>
        <View style={styles.linhaTitulo}>
          <ThemedText type="defaultSemiBold" numberOfLines={1} style={styles.titulo}>
            {anuncio.titulo}
          </ThemedText>
          {anuncio.status === 'reservado' && (
            <ThemedText style={styles.reservado}>Reservado</ThemedText>
          )}
        </View>
        <ThemedText type="subtitle">{formatarPreco(anuncio.precoCentavos)}</ThemedText>
        <ThemedText style={styles.meta} numberOfLines={1}>
          {rotuloCondicao(anuncio.condicao)} · {anuncio.cidade}
          {anuncio.distanciaKm !== null ? ` · ${anuncio.distanciaKm} km` : ''}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#808080',
  },
  foto: { width: 96, height: 96, borderRadius: 10 },
  semFoto: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#80808020' },
  semFotoTexto: { fontSize: 32 },
  info: { flex: 1, gap: 2, justifyContent: 'center' },
  linhaTitulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { flex: 1 },
  reservado: {
    fontSize: 11,
    color: '#b8860b',
    borderWidth: 1,
    borderColor: '#b8860b',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  meta: { fontSize: 13, opacity: 0.6 },
});

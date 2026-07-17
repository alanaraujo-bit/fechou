import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AnuncioCard } from '@/components/anuncio-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  buscarAnuncios,
  CATEGORIAS,
  CONDICOES,
  precoParaCentavos,
  type AnuncioResumo,
} from '@/lib/anuncios';

const RAIOS_KM = [5, 10, 25, 50, 100];

export default function BuscarScreen() {
  const colorScheme = useColorScheme();
  const cores = Colors[colorScheme ?? 'light'];

  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [condicao, setCondicao] = useState<string | null>(null);
  const [precoMax, setPrecoMax] = useState('');
  const [raioKm, setRaioKm] = useState(25);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const [posicao, setPosicao] = useState<{ lat: number; lng: number } | null>(null);
  const [itens, setItens] = useState<AnuncioResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const buscaAgendada = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const permissao = await Location.getForegroundPermissionsAsync();
        if (permissao.granted) {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setPosicao({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch {
        // Sem posição a busca ignora o raio.
      }
    })();
  }, []);

  const buscar = useCallback(async () => {
    setErro(null);
    try {
      const precoMaxCentavos = precoParaCentavos(precoMax);
      const resposta = await buscarAnuncios({
        ...(q.trim() ? { q: q.trim() } : {}),
        ...(categoria ? { categoria } : {}),
        ...(condicao ? { condicao } : {}),
        ...(precoMaxCentavos !== null && precoMax !== '' ? { precoMax: precoMaxCentavos } : {}),
        ...(posicao ? { lat: posicao.lat, lng: posicao.lng, raioKm } : {}),
      });
      setItens(resposta.itens);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [q, categoria, condicao, precoMax, raioKm, posicao]);

  // Busca com atraso curto enquanto digita; filtros disparam na hora.
  useEffect(() => {
    if (buscaAgendada.current) clearTimeout(buscaAgendada.current);
    buscaAgendada.current = setTimeout(buscar, 350);
    return () => {
      if (buscaAgendada.current) clearTimeout(buscaAgendada.current);
    };
  }, [buscar]);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.topo}>
        <TextInput
          style={[styles.input, { color: cores.text, borderColor: cores.icon }]}
          placeholder="O que você procura?"
          placeholderTextColor="#808080"
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
        />
        <Pressable onPress={() => setMostrarFiltros((v) => !v)} style={styles.filtroBotao}>
          <ThemedText type="link">{mostrarFiltros ? 'esconder filtros' : 'filtros'}</ThemedText>
        </Pressable>

        {mostrarFiltros && (
          <View style={styles.filtros}>
            <ThemedText type="defaultSemiBold">Categoria</ThemedText>
            <View style={styles.chips}>
              {CATEGORIAS.map((c) => (
                <FiltroChip
                  key={c.valor}
                  rotulo={c.rotulo}
                  ativo={categoria === c.valor}
                  onPress={() => setCategoria(categoria === c.valor ? null : c.valor)}
                />
              ))}
            </View>

            <ThemedText type="defaultSemiBold">Condição</ThemedText>
            <View style={styles.chips}>
              {CONDICOES.map((c) => (
                <FiltroChip
                  key={c.valor}
                  rotulo={c.rotulo}
                  ativo={condicao === c.valor}
                  onPress={() => setCondicao(condicao === c.valor ? null : c.valor)}
                />
              ))}
            </View>

            <View style={styles.linhaDupla}>
              <View style={styles.metade}>
                <ThemedText type="defaultSemiBold">Preço até</ThemedText>
                <TextInput
                  style={[styles.input, { color: cores.text, borderColor: cores.icon }]}
                  placeholder="R$"
                  placeholderTextColor="#808080"
                  keyboardType="decimal-pad"
                  value={precoMax}
                  onChangeText={setPrecoMax}
                />
              </View>
              {posicao && (
                <View style={styles.metade}>
                  <ThemedText type="defaultSemiBold">Distância</ThemedText>
                  <View style={styles.chips}>
                    {RAIOS_KM.map((r) => (
                      <FiltroChip
                        key={r}
                        rotulo={`${r} km`}
                        ativo={raioKm === r}
                        onPress={() => setRaioKm(r)}
                      />
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      <FlatList
        data={itens ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AnuncioCard anuncio={item} />}
        contentContainerStyle={styles.lista}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <ThemedView style={styles.vazio}>
            {erro ? (
              <ThemedText style={styles.hint}>🔴 {erro}</ThemedText>
            ) : itens === null ? (
              <ThemedText style={styles.hint}>buscando…</ThemedText>
            ) : (
              <ThemedText style={styles.hint}>Nenhum anúncio encontrado por aqui.</ThemedText>
            )}
          </ThemedView>
        }
      />
    </ThemedView>
  );
}

function FiltroChip({
  rotulo,
  ativo,
  onPress,
}: {
  rotulo: string;
  ativo: boolean;
  onPress: () => void;
}) {
  const colorScheme = useColorScheme();
  const cores = Colors[colorScheme ?? 'light'];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: cores.icon },
        ativo && { backgroundColor: cores.tint, borderColor: cores.tint },
      ]}>
      <ThemedText
        style={[
          styles.chipTexto,
          ativo && { color: colorScheme === 'dark' ? '#151718' : '#fff' },
        ]}>
        {rotulo}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topo: { padding: 16, paddingTop: 64, gap: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  filtroBotao: { alignSelf: 'flex-end' },
  filtros: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipTexto: { fontSize: 13 },
  linhaDupla: { flexDirection: 'row', gap: 12 },
  metade: { flex: 1, gap: 4 },
  lista: { padding: 16, gap: 10 },
  vazio: { alignItems: 'center', marginTop: 48 },
  hint: { opacity: 0.6 },
});

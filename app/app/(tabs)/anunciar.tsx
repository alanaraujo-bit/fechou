import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  CATEGORIAS,
  CONDICOES,
  precoParaCentavos,
  subirFoto,
  type Condicao,
} from '@/lib/anuncios';
import { useAuth } from '@/lib/auth-context';

const MAX_FOTOS = 8;

type FotoLocal = { uri: string; mimeType: string };

export default function AnunciarScreen() {
  const { usuario, chamarComToken } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const cores = Colors[colorScheme ?? 'light'];

  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [preco, setPreco] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [condicao, setCondicao] = useState<Condicao | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);

  if (!usuario) {
    return (
      <ThemedView style={styles.centro}>
        <ThemedText type="title">Anunciar</ThemedText>
        <ThemedText style={styles.hint}>
          Entre na sua conta (aba Perfil) pra publicar um anúncio.
        </ThemedText>
      </ThemedView>
    );
  }

  async function escolherFotos() {
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_FOTOS - fotos.length,
      quality: 0.7,
    });
    if (resultado.canceled) return;

    const novas = resultado.assets.map((a) => ({
      uri: a.uri,
      mimeType: a.mimeType ?? 'image/jpeg',
    }));
    setFotos((atuais) => [...atuais, ...novas].slice(0, MAX_FOTOS));
  }

  function removerFoto(uri: string) {
    setFotos((atuais) => atuais.filter((f) => f.uri !== uri));
  }

  async function publicar() {
    const precoCentavos = precoParaCentavos(preco);
    if (fotos.length === 0) {
      Alert.alert('Falta a foto', 'Adicione pelo menos uma foto do item.');
      return;
    }
    if (titulo.trim().length < 3) {
      Alert.alert('Falta o título', 'Descreva o item em poucas palavras.');
      return;
    }
    if (precoCentavos === null) {
      Alert.alert('Preço inválido', 'Digite o valor, ex.: 150 ou 89,90.');
      return;
    }
    if (!categoria) {
      Alert.alert('Falta a categoria', 'Escolha uma categoria.');
      return;
    }
    if (!condicao) {
      Alert.alert('Falta a condição', 'Novo, seminovo, usado ou para peças?');
      return;
    }

    setPublicando(true);
    try {
      setProgresso('Pegando sua localização…');
      const permissao = await Location.requestForegroundPermissionsAsync();
      if (!permissao.granted) {
        Alert.alert(
          'Sem localização',
          'O Fechou é hiperlocal: precisamos da sua região aproximada pra mostrar o anúncio pra quem está perto.',
        );
        return;
      }
      const posicao = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      // Arredonda pra ~1 km — nunca guardamos o endereço exato.
      const lat = Math.round(posicao.coords.latitude * 100) / 100;
      const lng = Math.round(posicao.coords.longitude * 100) / 100;

      const [endereco] = await Location.reverseGeocodeAsync(posicao.coords);
      const cidade =
        endereco?.city ?? endereco?.subregion ?? usuario?.cidade ?? 'Região não informada';

      const chaves: string[] = [];
      for (const [i, foto] of fotos.entries()) {
        setProgresso(`Enviando foto ${i + 1} de ${fotos.length}…`);
        chaves.push(await subirFoto(chamarComToken, foto.uri, foto.mimeType));
      }

      setProgresso('Publicando anúncio…');
      const anuncio = await chamarComToken<{ id: string }>('/anuncios', {
        method: 'POST',
        body: JSON.stringify({
          titulo: titulo.trim(),
          ...(descricao.trim() ? { descricao: descricao.trim() } : {}),
          precoCentavos,
          categoria,
          condicao,
          lat,
          lng,
          cidade,
          fotos: chaves,
        }),
      });

      setFotos([]);
      setTitulo('');
      setDescricao('');
      setPreco('');
      setCategoria(null);
      setCondicao(null);

      Alert.alert('Anúncio publicado! ⚡', 'Ele já aparece pra quem está por perto.', [
        {
          text: 'Ver anúncio',
          onPress: () => router.push({ pathname: '/anuncio/[id]', params: { id: anuncio.id } }),
        },
        { text: 'Fechou!' },
      ]);
    } catch (e) {
      Alert.alert('Não deu certo', e instanceof Error ? e.message : String(e));
    } finally {
      setProgresso(null);
      setPublicando(false);
    }
  }

  const inputStyle = [styles.input, { color: cores.text, borderColor: cores.icon }];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ThemedView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.conteudo}>
          <ThemedText type="title">Anunciar</ThemedText>

          <View style={styles.grade}>
            {fotos.map((foto) => (
              <Pressable key={foto.uri} onPress={() => removerFoto(foto.uri)} disabled={publicando}>
                <Image source={{ uri: foto.uri }} style={styles.miniatura} />
                <ThemedText style={styles.remover}>✕</ThemedText>
              </Pressable>
            ))}
            {fotos.length < MAX_FOTOS && (
              <Pressable
                onPress={escolherFotos}
                disabled={publicando}
                style={[styles.miniatura, styles.adicionarFoto, { borderColor: cores.icon }]}>
                <ThemedText style={styles.adicionarFotoTexto}>＋</ThemedText>
                <ThemedText style={styles.hintPequeno}>foto</ThemedText>
              </Pressable>
            )}
          </View>

          <TextInput
            style={inputStyle}
            placeholder="Título — ex.: Bicicleta aro 29"
            placeholderTextColor="#808080"
            maxLength={100}
            value={titulo}
            onChangeText={setTitulo}
            editable={!publicando}
          />

          <TextInput
            style={[...inputStyle, styles.multilinha]}
            placeholder="Descrição (opcional) — estado, motivo da venda…"
            placeholderTextColor="#808080"
            maxLength={2000}
            multiline
            value={descricao}
            onChangeText={setDescricao}
            editable={!publicando}
          />

          <TextInput
            style={inputStyle}
            placeholder="Preço — ex.: 150 ou 89,90"
            placeholderTextColor="#808080"
            keyboardType="decimal-pad"
            value={preco}
            onChangeText={setPreco}
            editable={!publicando}
          />

          <ThemedText type="defaultSemiBold">Categoria</ThemedText>
          <View style={styles.chips}>
            {CATEGORIAS.map((c) => (
              <Chip
                key={c.valor}
                rotulo={c.rotulo}
                ativo={categoria === c.valor}
                onPress={() => setCategoria(c.valor)}
                desabilitado={publicando}
              />
            ))}
          </View>

          <ThemedText type="defaultSemiBold">Condição</ThemedText>
          <View style={styles.chips}>
            {CONDICOES.map((c) => (
              <Chip
                key={c.valor}
                rotulo={c.rotulo}
                ativo={condicao === c.valor}
                onPress={() => setCondicao(c.valor)}
                desabilitado={publicando}
              />
            ))}
          </View>

          <Pressable
            onPress={publicar}
            disabled={publicando}
            style={[styles.botao, { backgroundColor: cores.tint }, publicando && styles.desabilitado]}>
            {publicando ? (
              <View style={styles.progresso}>
                <ActivityIndicator color={colorScheme === 'dark' ? '#151718' : '#fff'} />
                <ThemedText
                  style={colorScheme === 'dark' ? styles.botaoTextoDark : styles.botaoTexto}>
                  {progresso ?? 'Publicando…'}
                </ThemedText>
              </View>
            ) : (
              <ThemedText
                type="defaultSemiBold"
                style={colorScheme === 'dark' ? styles.botaoTextoDark : styles.botaoTexto}>
                Publicar anúncio
              </ThemedText>
            )}
          </Pressable>

          <ThemedText style={styles.hintPequeno}>
            Sua localização é arredondada (~1 km) — nunca mostramos seu endereço exato.
          </ThemedText>
        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

function Chip({
  rotulo,
  ativo,
  onPress,
  desabilitado,
}: {
  rotulo: string;
  ativo: boolean;
  onPress: () => void;
  desabilitado?: boolean;
}) {
  const colorScheme = useColorScheme();
  const cores = Colors[colorScheme ?? 'light'];

  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado}
      style={[
        styles.chip,
        { borderColor: cores.icon },
        ativo && { backgroundColor: cores.tint, borderColor: cores.tint },
      ]}>
      <ThemedText
        style={[
          styles.chipTexto,
          ativo && (colorScheme === 'dark' ? styles.botaoTextoDark : styles.botaoTexto),
        ]}>
        {rotulo}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  conteudo: { padding: 24, paddingTop: 64, gap: 12 },
  hint: { opacity: 0.7, textAlign: 'center' },
  hintPequeno: { opacity: 0.5, fontSize: 12, textAlign: 'center' },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  miniatura: { width: 76, height: 76, borderRadius: 10 },
  adicionarFoto: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adicionarFotoTexto: { fontSize: 22, lineHeight: 26 },
  remover: {
    position: 'absolute',
    top: 2,
    right: 6,
    color: '#fff',
    textShadowColor: '#000',
    textShadowRadius: 4,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multilinha: { minHeight: 80, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipTexto: { fontSize: 14 },
  botao: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  desabilitado: { opacity: 0.7 },
  botaoTexto: { color: '#fff' },
  botaoTextoDark: { color: '#151718' },
  progresso: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

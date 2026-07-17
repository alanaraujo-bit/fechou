import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatarPreco, precoParaCentavos } from '@/lib/anuncios';
import { useAuth } from '@/lib/auth-context';
import { conectarTempoReal, type ConversaContexto, type Mensagem } from '@/lib/conversas';

export default function ConversaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario, accessToken, chamarComToken } = useAuth();
  const colorScheme = useColorScheme();
  const cores = Colors[colorScheme ?? 'light'];

  const [conversa, setConversa] = useState<ConversaContexto | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [modal, setModal] = useState<
    | { tipo: 'oferta' }
    | { tipo: 'contraproposta'; ofertaId: string }
    | { tipo: 'encontro' }
    | null
  >(null);

  const carregar = useCallback(async () => {
    try {
      const resposta = await chamarComToken<{
        conversa: ConversaContexto;
        mensagens: Mensagem[];
      }>(`/conversas/${id}/mensagens`);
      setConversa(resposta.conversa);
      setMensagens(resposta.mensagens);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [id, chamarComToken]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Tempo real: novas mensagens chegam pelo WebSocket.
  useEffect(() => {
    if (!accessToken) return;
    const socket = conectarTempoReal(accessToken, (evento) => {
      if (evento.evento === 'mensagem' && evento.conversaId === id) {
        setMensagens((atuais) =>
          atuais.some((m) => m.id === evento.mensagem.id)
            ? atuais
            : [...atuais, evento.mensagem],
        );
        // Resposta de oferta muda o estado das bolhas anteriores — recarrega.
        if (evento.mensagem.tipo === 'sistema' || evento.mensagem.tipo === 'oferta') {
          carregar();
        }
      }
      if (evento.evento === 'negocio-fechado' && evento.conversaId === id) {
        carregar();
      }
    });
    return () => socket.close();
  }, [accessToken, id, carregar]);

  async function enviarTexto() {
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;
    setEnviando(true);
    try {
      const mensagem = await chamarComToken<Mensagem>(`/conversas/${id}/mensagens`, {
        method: 'POST',
        body: JSON.stringify({ texto: conteudo }),
      });
      setMensagens((atuais) =>
        atuais.some((m) => m.id === mensagem.id) ? atuais : [...atuais, mensagem],
      );
      setTexto('');
    } catch (e) {
      Alert.alert('Não deu certo', e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }

  async function responderOferta(ofertaId: string, acao: 'aceitar' | 'recusar') {
    try {
      await chamarComToken(`/conversas/${id}/ofertas/${ofertaId}/responder`, {
        method: 'POST',
        body: JSON.stringify({ acao }),
      });
      await carregar();
    } catch (e) {
      Alert.alert('Não deu certo', e instanceof Error ? e.message : String(e));
    }
  }

  if (erro) {
    return (
      <ThemedView style={styles.centro}>
        <Stack.Screen options={{ title: 'Conversa' }} />
        <ThemedText style={styles.hint}>🔴 {erro}</ThemedText>
      </ThemedView>
    );
  }

  if (!conversa || !usuario) {
    return (
      <ThemedView style={styles.centro}>
        <Stack.Screen options={{ title: 'Conversa' }} />
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const negocioFechado = conversa.anuncio.status !== 'disponivel';

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen
        options={{
          title: `${conversa.outro.nome ?? 'Conversa'} · ${conversa.anuncio.titulo}`,
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {negocioFechado && (
          <View style={styles.banner}>
            <ThemedText style={styles.bannerTexto}>
              {conversa.anuncio.status === 'reservado'
                ? '🤝 Negócio fechado — anúncio reservado. Combinem o encontro!'
                : 'Este anúncio já foi vendido.'}
            </ThemedText>
          </View>
        )}

        <FlatList
          data={[...mensagens].reverse()}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={styles.lista}
          renderItem={({ item }) => (
            <Bolha
              mensagem={item}
              minha={item.autorId === usuario.id}
              aoResponder={responderOferta}
              aoContrapropor={(ofertaId) => setModal({ tipo: 'contraproposta', ofertaId })}
            />
          )}
          ListEmptyComponent={
            <ThemedText style={[styles.hint, styles.invertido]}>
              Diga um oi ou já mande uma oferta. 😉
            </ThemedText>
          }
        />

        <View style={styles.acoes}>
          <Pressable
            style={[styles.acaoBotao, { borderColor: cores.tint }]}
            onPress={() => setModal({ tipo: 'oferta' })}
            disabled={negocioFechado}>
            <ThemedText type="link">💰 Oferta</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.acaoBotao, { borderColor: cores.tint }]}
            onPress={() => setModal({ tipo: 'encontro' })}>
            <ThemedText type="link">📅 Encontro</ThemedText>
          </Pressable>
        </View>

        <View style={styles.rodape}>
          <TextInput
            style={[styles.input, { color: cores.text, borderColor: cores.icon }]}
            placeholder="Mensagem…"
            placeholderTextColor="#808080"
            value={texto}
            onChangeText={setTexto}
            multiline
            editable={!enviando}
          />
          <Pressable
            onPress={enviarTexto}
            disabled={enviando || !texto.trim()}
            style={[
              styles.enviar,
              { backgroundColor: cores.tint },
              (enviando || !texto.trim()) && styles.desabilitado,
            ]}>
            <ThemedText style={colorScheme === 'dark' ? styles.enviarTextoDark : styles.enviarTexto}>
              ➤
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {modal && (
        <ModalFormulario
          tipo={modal.tipo}
          aoFechar={() => setModal(null)}
          aoConfirmar={async (valores) => {
            try {
              if (modal.tipo === 'oferta') {
                const centavos = precoParaCentavos(valores.valor ?? '');
                if (centavos === null || centavos === 0) throw new Error('Valor inválido');
                await chamarComToken(`/conversas/${id}/ofertas`, {
                  method: 'POST',
                  body: JSON.stringify({ valorCentavos: centavos }),
                });
              } else if (modal.tipo === 'contraproposta') {
                const centavos = precoParaCentavos(valores.valor ?? '');
                if (centavos === null || centavos === 0) throw new Error('Valor inválido');
                await chamarComToken(
                  `/conversas/${id}/ofertas/${modal.ofertaId}/responder`,
                  {
                    method: 'POST',
                    body: JSON.stringify({ acao: 'contrapropor', valorCentavos: centavos }),
                  },
                );
              } else {
                if (!valores.quando?.trim() || !valores.local?.trim()) {
                  throw new Error('Preencha quando e onde');
                }
                await chamarComToken(`/conversas/${id}/encontro`, {
                  method: 'POST',
                  body: JSON.stringify({
                    quando: valores.quando.trim(),
                    local: valores.local.trim(),
                  }),
                });
              }
              setModal(null);
              await carregar();
            } catch (e) {
              Alert.alert('Não deu certo', e instanceof Error ? e.message : String(e));
            }
          }}
        />
      )}
    </ThemedView>
  );
}

function Bolha({
  mensagem,
  minha,
  aoResponder,
  aoContrapropor,
}: {
  mensagem: Mensagem;
  minha: boolean;
  aoResponder: (ofertaId: string, acao: 'aceitar' | 'recusar') => void;
  aoContrapropor: (ofertaId: string) => void;
}) {
  const colorScheme = useColorScheme();
  const cores = Colors[colorScheme ?? 'light'];

  if (mensagem.tipo === 'sistema') {
    return (
      <View style={styles.sistema}>
        <ThemedText style={styles.sistemaTexto}>{mensagem.texto}</ThemedText>
      </View>
    );
  }

  const oferta = mensagem.oferta;
  const posso = oferta?.status === 'pendente' && !minha;

  return (
    <View
      style={[
        styles.bolha,
        minha
          ? [styles.bolhaMinha, { backgroundColor: cores.tint }]
          : [styles.bolhaOutro, { borderColor: cores.icon }],
      ]}>
      {oferta ? (
        <View style={styles.ofertaArea}>
          <ThemedText
            type="subtitle"
            style={minha ? (colorScheme === 'dark' ? styles.textoMinhaDark : styles.textoMinha) : undefined}>
            {mensagem.tipo === 'oferta' && mensagem.texto.startsWith('Contra')
              ? 'Contraproposta'
              : 'Oferta'}
            : {formatarPreco(oferta.valorCentavos)}
          </ThemedText>
          {oferta.status !== 'pendente' && (
            <ThemedText
              style={[
                styles.ofertaStatus,
                minha && (colorScheme === 'dark' ? styles.textoMinhaDark : styles.textoMinha),
              ]}>
              {oferta.status === 'aceita'
                ? '✅ aceita'
                : oferta.status === 'recusada'
                  ? '❌ recusada'
                  : '↩️ substituída'}
            </ThemedText>
          )}
          {posso && (
            <View style={styles.ofertaBotoes}>
              <Pressable
                style={styles.fechou}
                onPress={() => aoResponder(oferta.id, 'aceitar')}>
                <ThemedText style={styles.fechouTexto}>Fechou! 🤝</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.ofertaAcao, { borderColor: cores.icon }]}
                onPress={() => aoContrapropor(oferta.id)}>
                <ThemedText style={styles.ofertaAcaoTexto}>Contrapropor</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.ofertaAcao, { borderColor: cores.icon }]}
                onPress={() => aoResponder(oferta.id, 'recusar')}>
                <ThemedText style={styles.ofertaAcaoTexto}>Recusar</ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <ThemedText
          style={minha ? (colorScheme === 'dark' ? styles.textoMinhaDark : styles.textoMinha) : undefined}>
          {mensagem.texto}
        </ThemedText>
      )}
    </View>
  );
}

function ModalFormulario({
  tipo,
  aoFechar,
  aoConfirmar,
}: {
  tipo: 'oferta' | 'contraproposta' | 'encontro';
  aoFechar: () => void;
  aoConfirmar: (valores: { valor?: string; quando?: string; local?: string }) => void;
}) {
  const colorScheme = useColorScheme();
  const cores = Colors[colorScheme ?? 'light'];
  const [valor, setValor] = useState('');
  const [quando, setQuando] = useState('');
  const [local, setLocal] = useState('');

  const titulo =
    tipo === 'oferta'
      ? 'Fazer oferta'
      : tipo === 'contraproposta'
        ? 'Contraproposta'
        : 'Propor encontro';

  const inputStyle = [styles.inputModal, { color: cores.text, borderColor: cores.icon }];

  return (
    <Modal transparent animationType="fade" onRequestClose={aoFechar}>
      <Pressable style={styles.fundoModal} onPress={aoFechar}>
        <Pressable onPress={() => {}} style={{ width: '100%' }}>
          <ThemedView style={styles.caixaModal}>
            <ThemedText type="subtitle">{titulo}</ThemedText>
            {tipo === 'encontro' ? (
              <>
                <TextInput
                  style={inputStyle}
                  placeholder="Quando — ex.: sábado às 15h"
                  placeholderTextColor="#808080"
                  value={quando}
                  onChangeText={setQuando}
                />
                <TextInput
                  style={inputStyle}
                  placeholder="Onde — ex.: praça central, lugar movimentado"
                  placeholderTextColor="#808080"
                  value={local}
                  onChangeText={setLocal}
                />
                <ThemedText style={styles.hintPequeno}>
                  💡 Prefira lugares públicos e movimentados, de dia.
                </ThemedText>
              </>
            ) : (
              <TextInput
                style={inputStyle}
                placeholder="Valor — ex.: 120 ou 89,90"
                placeholderTextColor="#808080"
                keyboardType="decimal-pad"
                autoFocus
                value={valor}
                onChangeText={setValor}
              />
            )}
            <View style={styles.modalBotoes}>
              <Pressable onPress={aoFechar} style={styles.modalCancelar}>
                <ThemedText>Cancelar</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => aoConfirmar({ valor, quando, local })}
                style={[styles.modalConfirmar, { backgroundColor: cores.tint }]}>
                <ThemedText
                  type="defaultSemiBold"
                  style={colorScheme === 'dark' ? styles.textoMinhaDark : styles.textoMinha}>
                  Enviar
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hint: { opacity: 0.6, textAlign: 'center' },
  hintPequeno: { opacity: 0.5, fontSize: 12 },
  invertido: { transform: [{ scaleY: -1 }] },
  banner: { padding: 10, backgroundColor: '#b8860b30' },
  bannerTexto: { textAlign: 'center', fontSize: 13 },
  lista: { padding: 16, gap: 8 },
  bolha: { maxWidth: '82%', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  bolhaMinha: { alignSelf: 'flex-end' },
  bolhaOutro: { alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth },
  textoMinha: { color: '#fff' },
  textoMinhaDark: { color: '#151718' },
  sistema: { alignSelf: 'center', maxWidth: '90%', paddingVertical: 4 },
  sistemaTexto: { fontSize: 13, opacity: 0.7, textAlign: 'center' },
  ofertaArea: { gap: 6 },
  ofertaStatus: { fontSize: 13 },
  ofertaBotoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  fechou: { backgroundColor: '#2e8b57', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  fechouTexto: { color: '#fff', fontWeight: '700' },
  ofertaAcao: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  ofertaAcaoTexto: { fontSize: 13 },
  acoes: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  acaoBotao: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  rodape: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'flex-end' },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 120,
  },
  inputModal: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  enviar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enviarTexto: { color: '#fff', fontSize: 18 },
  enviarTextoDark: { color: '#151718', fontSize: 18 },
  desabilitado: { opacity: 0.4 },
  fundoModal: {
    flex: 1,
    backgroundColor: '#00000088',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  caixaModal: { borderRadius: 14, padding: 20, gap: 12 },
  modalBotoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  modalCancelar: { paddingHorizontal: 12, paddingVertical: 10 },
  modalConfirmar: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
});

import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth, type Usuario } from '@/lib/auth-context';

export default function PerfilScreen() {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return usuario ? <Perfil usuario={usuario} /> : <Login />;
}

function Login() {
  const { solicitarCodigo, verificarCodigo } = useAuth();
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputStyle = useInputStyle();

  async function enviarEmail() {
    setEnviando(true);
    setErro(null);
    try {
      await solicitarCodigo(email);
      setEtapa('codigo');
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }

  async function enviarCodigo() {
    setEnviando(true);
    setErro(null);
    try {
      await verificarCodigo(email, codigo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ThemedView style={styles.container}>
        <ThemedText type="title">Entrar</ThemedText>

        {etapa === 'email' ? (
          <>
            <ThemedText style={styles.hint}>
              Digite seu e-mail pra receber um código de acesso.
            </ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="seu@email.com"
              placeholderTextColor="#808080"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!enviando}
            />
            <Botao
              titulo={enviando ? 'Enviando…' : 'Receber código'}
              desabilitado={enviando || !email.includes('@')}
              onPress={enviarEmail}
            />
          </>
        ) : (
          <>
            <ThemedText style={styles.hint}>
              Enviamos um código de 6 dígitos pra {email}.
            </ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="000000"
              placeholderTextColor="#808080"
              keyboardType="number-pad"
              maxLength={6}
              value={codigo}
              onChangeText={setCodigo}
              editable={!enviando}
            />
            <Botao
              titulo={enviando ? 'Verificando…' : 'Entrar'}
              desabilitado={enviando || codigo.length !== 6}
              onPress={enviarCodigo}
            />
            <Pressable onPress={() => setEtapa('email')} disabled={enviando}>
              <ThemedText type="link">usar outro e-mail</ThemedText>
            </Pressable>
          </>
        )}

        {erro && <ThemedText style={styles.erro}>{erro}</ThemedText>}
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

function Perfil({ usuario }: { usuario: Usuario }) {
  const { atualizarPerfil, sair } = useAuth();
  const [nome, setNome] = useState(usuario.nome ?? '');
  const [cidade, setCidade] = useState(usuario.cidade ?? '');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const inputStyle = useInputStyle();

  const membroDesde = new Date(usuario.membroDesde).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  const houveMudanca =
    nome !== (usuario.nome ?? '') || cidade !== (usuario.cidade ?? '');

  async function salvar() {
    setSalvando(true);
    setMensagem(null);
    try {
      await atualizarPerfil({
        ...(nome.trim() ? { nome: nome.trim() } : {}),
        ...(cidade.trim() ? { cidade: cidade.trim() } : {}),
      });
      setMensagem('Perfil salvo ✅');
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{usuario.nome ?? 'Seu perfil'}</ThemedText>
      <ThemedText style={styles.hint}>
        {usuario.email} · membro desde {membroDesde}
      </ThemedText>

      <ThemedView style={styles.campo}>
        <ThemedText type="defaultSemiBold">Nome</ThemedText>
        <TextInput
          style={inputStyle}
          placeholder="Como você quer aparecer"
          placeholderTextColor="#808080"
          value={nome}
          onChangeText={setNome}
          editable={!salvando}
        />
      </ThemedView>

      <ThemedView style={styles.campo}>
        <ThemedText type="defaultSemiBold">Cidade</ThemedText>
        <TextInput
          style={inputStyle}
          placeholder="Onde você negocia"
          placeholderTextColor="#808080"
          value={cidade}
          onChangeText={setCidade}
          editable={!salvando}
        />
      </ThemedView>

      <Botao
        titulo={salvando ? 'Salvando…' : 'Salvar'}
        desabilitado={salvando || !houveMudanca}
        onPress={salvar}
      />
      {mensagem && <ThemedText style={styles.hint}>{mensagem}</ThemedText>}

      <Pressable onPress={sair} style={styles.sair}>
        <ThemedText type="link">Sair da conta</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function Botao({
  titulo,
  desabilitado,
  onPress,
}: {
  titulo: string;
  desabilitado?: boolean;
  onPress: () => void;
}) {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme ?? 'light'].tint;

  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado}
      style={[styles.botao, { backgroundColor: tint }, desabilitado && styles.botaoDesabilitado]}>
      <ThemedText
        style={[styles.botaoTexto, colorScheme === 'dark' && styles.botaoTextoDark]}
        type="defaultSemiBold">
        {titulo}
      </ThemedText>
    </Pressable>
  );
}

function useInputStyle() {
  const colorScheme = useColorScheme();
  const cores = Colors[colorScheme ?? 'light'];
  return [styles.input, { color: cores.text, borderColor: cores.icon }];
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  hint: {
    opacity: 0.7,
  },
  erro: {
    color: '#d9534f',
  },
  campo: {
    gap: 4,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  botao: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botaoDesabilitado: {
    opacity: 0.5,
  },
  botaoTexto: {
    color: '#fff',
  },
  botaoTextoDark: {
    color: '#151718',
  },
  sair: {
    marginTop: 24,
    alignItems: 'center',
  },
});

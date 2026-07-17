import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { API_URL } from '@/constants/api';

export type Usuario = {
  id: string;
  email: string;
  nome: string | null;
  fotoUrl: string | null;
  cidade: string | null;
  membroDesde: string;
};

type Sessao = {
  accessToken: string;
  refreshToken: string;
  usuario: Usuario;
};

const CHAVE_ACCESS = 'fechou.accessToken';
const CHAVE_REFRESH = 'fechou.refreshToken';

async function chamarApi<T>(
  caminho: string,
  init?: RequestInit & { accessToken?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (init?.accessToken) {
    headers.Authorization = `Bearer ${init.accessToken}`;
  }

  const resposta = await fetch(`${API_URL}${caminho}`, { ...init, headers });
  const corpo = (await resposta.json().catch(() => null)) as
    | (T & { erro?: string })
    | null;

  if (!resposta.ok) {
    throw new Error(corpo?.erro ?? `Erro ${resposta.status}`);
  }
  return corpo as T;
}

type AuthContextType = {
  usuario: Usuario | null;
  carregando: boolean;
  /** Token de acesso da sessão (pra conexões WebSocket). */
  accessToken: string | null;
  solicitarCodigo: (email: string) => Promise<void>;
  verificarCodigo: (email: string, codigo: string) => Promise<void>;
  atualizarPerfil: (dados: { nome?: string; cidade?: string }) => Promise<void>;
  sair: () => Promise<void>;
  /** Chama a API com o token da sessão (pra rotas autenticadas). */
  chamarComToken: <T>(caminho: string, init?: RequestInit) => Promise<T>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const salvarSessao = useCallback(async (sessao: Sessao) => {
    await SecureStore.setItemAsync(CHAVE_ACCESS, sessao.accessToken);
    await SecureStore.setItemAsync(CHAVE_REFRESH, sessao.refreshToken);
    setAccessToken(sessao.accessToken);
    setUsuario(sessao.usuario);
  }, []);

  const limparSessao = useCallback(async () => {
    await SecureStore.deleteItemAsync(CHAVE_ACCESS);
    await SecureStore.deleteItemAsync(CHAVE_REFRESH);
    setAccessToken(null);
    setUsuario(null);
  }, []);

  // Restaura a sessão ao abrir o app: usa o refresh token pra emitir uma nova.
  useEffect(() => {
    (async () => {
      try {
        const refreshToken = await SecureStore.getItemAsync(CHAVE_REFRESH);
        if (!refreshToken) return;

        const sessao = await chamarApi<Sessao>('/auth/renovar', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
        await salvarSessao(sessao);
      } catch {
        // Sessão expirada ou sem rede — segue deslogado; tokens inválidos são limpos no próximo login.
      } finally {
        setCarregando(false);
      }
    })();
  }, [salvarSessao]);

  const solicitarCodigo = useCallback(async (email: string) => {
    await chamarApi('/auth/solicitar-codigo', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }, []);

  const verificarCodigo = useCallback(
    async (email: string, codigo: string) => {
      const sessao = await chamarApi<Sessao>('/auth/verificar-codigo', {
        method: 'POST',
        body: JSON.stringify({ email, codigo }),
      });
      await salvarSessao(sessao);
    },
    [salvarSessao],
  );

  const atualizarPerfil = useCallback(
    async (dados: { nome?: string; cidade?: string }) => {
      if (!accessToken) throw new Error('Sem sessão ativa');
      const atualizado = await chamarApi<Usuario>('/perfil', {
        method: 'PATCH',
        body: JSON.stringify(dados),
        accessToken,
      });
      setUsuario(atualizado);
    },
    [accessToken],
  );

  const chamarComToken = useCallback(
    async <T,>(caminho: string, init?: RequestInit): Promise<T> => {
      if (!accessToken) throw new Error('Entre na sua conta primeiro (aba Perfil)');
      return chamarApi<T>(caminho, { ...init, accessToken });
    },
    [accessToken],
  );

  const sair = useCallback(async () => {
    const refreshToken = await SecureStore.getItemAsync(CHAVE_REFRESH);
    if (refreshToken) {
      await chamarApi('/auth/sair', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {
        // Mesmo sem rede o logout local acontece.
      });
    }
    await limparSessao();
  }, [limparSessao]);

  const valor = useMemo(
    () => ({
      usuario,
      carregando,
      accessToken,
      solicitarCodigo,
      verificarCodigo,
      atualizarPerfil,
      sair,
      chamarComToken,
    }),
    [usuario, carregando, accessToken, solicitarCodigo, verificarCodigo, atualizarPerfil, sair, chamarComToken],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  }
  return contexto;
}

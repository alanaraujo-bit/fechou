import { API_URL } from '@/constants/api';
import type { StatusAnuncio } from '@/lib/anuncios';

export type TipoMensagem = 'texto' | 'oferta' | 'sistema' | 'encontro';
export type StatusOferta = 'pendente' | 'aceita' | 'recusada' | 'substituida';

export type Mensagem = {
  id: string;
  conversaId: string;
  autorId: string;
  tipo: TipoMensagem;
  texto: string;
  criadoEm: string;
  oferta: {
    id: string;
    valorCentavos: number;
    status: StatusOferta;
    autorId: string;
  } | null;
};

export type ConversaContexto = {
  id: string;
  papel: 'comprador' | 'vendedor';
  outro: { id: string; nome: string | null };
  anuncio: {
    id: string;
    titulo: string;
    precoCentavos: number;
    status: StatusAnuncio;
  };
};

export type ConversaResumo = ConversaContexto & {
  anuncio: ConversaContexto['anuncio'] & { foto: string | null };
  ultimaMensagem: { tipo: TipoMensagem; texto: string; criadoEm: string } | null;
};

export type EventoTempoReal =
  | { evento: 'mensagem'; conversaId: string; mensagem: Mensagem }
  | { evento: 'negocio-fechado'; conversaId: string; anuncioId: string };

/** Abre o WebSocket de tempo real autenticado. */
export function conectarTempoReal(
  accessToken: string,
  aoReceber: (evento: EventoTempoReal) => void,
): WebSocket {
  const wsUrl = API_URL.replace(/^http/, 'ws');
  const socket = new WebSocket(`${wsUrl}/ws?token=${encodeURIComponent(accessToken)}`);
  socket.onmessage = (e) => {
    try {
      aoReceber(JSON.parse(String(e.data)) as EventoTempoReal);
    } catch {
      // Evento fora do formato esperado — ignora.
    }
  };
  return socket;
}

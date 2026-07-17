import { API_URL } from '@/constants/api';

export type Condicao = 'novo' | 'seminovo' | 'usado' | 'para_pecas';
export type StatusAnuncio = 'disponivel' | 'reservado' | 'vendido';

export type AnuncioResumo = {
  id: string;
  titulo: string;
  descricao: string | null;
  precoCentavos: number;
  categoria: string;
  condicao: Condicao;
  status: StatusAnuncio;
  cidade: string;
  criadoEm: string;
  distanciaKm: number | null;
  foto: string | null;
};

export type AnuncioDetalhe = Omit<AnuncioResumo, 'distanciaKm' | 'foto'> & {
  fotos: string[];
  vendedor: {
    id: string;
    nome: string | null;
    cidade: string | null;
    membroDesde: string;
  };
};

export const CATEGORIAS = [
  { valor: 'eletronicos', rotulo: 'Eletrônicos' },
  { valor: 'moveis', rotulo: 'Móveis' },
  { valor: 'eletrodomesticos', rotulo: 'Eletrodomésticos' },
  { valor: 'roupas_acessorios', rotulo: 'Roupas e acessórios' },
  { valor: 'esportes_lazer', rotulo: 'Esportes e lazer' },
  { valor: 'bebes_criancas', rotulo: 'Bebês e crianças' },
  { valor: 'veiculos_pecas', rotulo: 'Veículos e peças' },
  { valor: 'ferramentas', rotulo: 'Ferramentas' },
  { valor: 'casa_jardim', rotulo: 'Casa e jardim' },
  { valor: 'livros_midia', rotulo: 'Livros e mídia' },
  { valor: 'outros', rotulo: 'Outros' },
] as const;

export const CONDICOES: { valor: Condicao; rotulo: string }[] = [
  { valor: 'novo', rotulo: 'Novo' },
  { valor: 'seminovo', rotulo: 'Seminovo' },
  { valor: 'usado', rotulo: 'Usado' },
  { valor: 'para_pecas', rotulo: 'Para peças' },
];

export function rotuloCategoria(valor: string): string {
  return CATEGORIAS.find((c) => c.valor === valor)?.rotulo ?? valor;
}

export function rotuloCondicao(valor: Condicao): string {
  return CONDICOES.find((c) => c.valor === valor)?.rotulo ?? valor;
}

export function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: centavos % 100 === 0 ? 0 : 2,
  });
}

/** "1.500" / "1500,50" / "R$ 89,90" → centavos (ou null se inválido). */
export function precoParaCentavos(texto: string): number | null {
  const limpo = texto.replace(/[R$\s.]/g, '').replace(',', '.');
  if (!limpo) return null;
  const valor = Number(limpo);
  if (!Number.isFinite(valor) || valor < 0) return null;
  return Math.round(valor * 100);
}

export function buscarAnuncios(filtros: {
  lat?: number;
  lng?: number;
  raioKm?: number;
  categoria?: string;
  condicao?: string;
  precoMin?: number;
  precoMax?: number;
  q?: string;
}): Promise<{ itens: AnuncioResumo[] }> {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== '') params.set(chave, String(valor));
  }
  return fetch(`${API_URL}/anuncios?${params}`).then(async (resposta) => {
    if (!resposta.ok) throw new Error(`Erro ${resposta.status} ao buscar anúncios`);
    return resposta.json();
  });
}

export async function carregarAnuncio(id: string): Promise<AnuncioDetalhe> {
  const resposta = await fetch(`${API_URL}/anuncios/${id}`);
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error(corpo?.erro ?? `Erro ${resposta.status}`);
  return corpo as AnuncioDetalhe;
}

/**
 * Sobe uma foto direto pro R2: pede a URL assinada pra API e faz PUT do arquivo.
 * Retorna a `key` pra usar na criação do anúncio.
 */
export async function subirFoto(
  chamarComToken: <T>(caminho: string, init?: RequestInit) => Promise<T>,
  uri: string,
  mimeType: string,
): Promise<string> {
  const contentType = ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)
    ? mimeType
    : 'image/jpeg';

  const { key, uploadUrl } = await chamarComToken<{ key: string; uploadUrl: string }>(
    '/anuncios/fotos/url-upload',
    { method: 'POST', body: JSON.stringify({ contentType }) },
  );

  const arquivo = await fetch(uri).then((r) => r.blob());
  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: arquivo,
  });
  if (!upload.ok) throw new Error(`Falha no upload da foto (${upload.status})`);

  return key;
}

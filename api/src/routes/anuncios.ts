import { and, asc, desc, eq, gte, ilike, lte, ne, or, sql, type SQL } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { listingPhotos, listings, users } from "../db/schema.js";
import { criarUrlLeituraFoto, criarUrlUploadFoto } from "../lib/r2.js";

export const CATEGORIAS = [
  "eletronicos",
  "moveis",
  "eletrodomesticos",
  "roupas_acessorios",
  "esportes_lazer",
  "bebes_criancas",
  "veiculos_pecas",
  "ferramentas",
  "casa_jardim",
  "livros_midia",
  "outros",
] as const;

const CONDICOES = ["novo", "seminovo", "usado", "para_pecas"] as const;
const STATUS = ["disponivel", "reservado", "vendido"] as const;
const MAX_FOTOS = 8;

type Anuncio = typeof listings.$inferSelect;

async function fotosDoAnuncio(listingId: string) {
  const fotos = await db
    .select()
    .from(listingPhotos)
    .where(eq(listingPhotos.listingId, listingId))
    .orderBy(asc(listingPhotos.position));
  return Promise.all(fotos.map((f) => criarUrlLeituraFoto(f.key)));
}

function anuncioPublico(a: Anuncio, extras: Record<string, unknown> = {}) {
  return {
    id: a.id,
    titulo: a.title,
    descricao: a.description,
    precoCentavos: a.priceCents,
    categoria: a.category,
    condicao: a.condition,
    status: a.status,
    cidade: a.city,
    criadoEm: a.createdAt,
    ...extras,
  };
}

export default async function rotasAnuncios(app: FastifyInstance) {
  app.post(
    "/anuncios/fotos/url-upload",
    {
      preHandler: [app.autenticar],
      schema: {
        body: {
          type: "object",
          required: ["contentType"],
          properties: {
            contentType: {
              type: "string",
              enum: ["image/jpeg", "image/png", "image/webp"],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { contentType } = request.body as { contentType: string };
      return reply.send(await criarUrlUploadFoto(contentType));
    },
  );

  app.post(
    "/anuncios",
    {
      preHandler: [app.autenticar],
      schema: {
        body: {
          type: "object",
          required: ["titulo", "precoCentavos", "categoria", "condicao", "lat", "lng", "cidade", "fotos"],
          properties: {
            titulo: { type: "string", minLength: 3, maxLength: 100 },
            descricao: { type: "string", maxLength: 2000 },
            precoCentavos: { type: "integer", minimum: 0, maximum: 100_000_000 },
            categoria: { type: "string", enum: [...CATEGORIAS] },
            condicao: { type: "string", enum: [...CONDICOES] },
            lat: { type: "number", minimum: -90, maximum: 90 },
            lng: { type: "number", minimum: -180, maximum: 180 },
            cidade: { type: "string", minLength: 1, maxLength: 120 },
            fotos: {
              type: "array",
              minItems: 1,
              maxItems: MAX_FOTOS,
              items: { type: "string", pattern: "^anuncios/[A-Za-z0-9-]+\\.(jpg|png|webp)$" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const corpo = request.body as {
        titulo: string;
        descricao?: string;
        precoCentavos: number;
        categoria: string;
        condicao: (typeof CONDICOES)[number];
        lat: number;
        lng: number;
        cidade: string;
        fotos: string[];
      };

      const [anuncio] = await db
        .insert(listings)
        .values({
          sellerId: request.user.sub,
          title: corpo.titulo,
          description: corpo.descricao ?? null,
          priceCents: corpo.precoCentavos,
          category: corpo.categoria,
          condition: corpo.condicao,
          lat: corpo.lat,
          lng: corpo.lng,
          city: corpo.cidade,
        })
        .returning();

      if (!anuncio) {
        return reply.status(500).send({ erro: "Falha ao criar o anúncio." });
      }

      await db.insert(listingPhotos).values(
        corpo.fotos.map((key, position) => ({
          listingId: anuncio.id,
          key,
          position,
        })),
      );

      return reply
        .status(201)
        .send(anuncioPublico(anuncio, { fotos: await fotosDoAnuncio(anuncio.id) }));
    },
  );

  app.get(
    "/anuncios",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            lat: { type: "number", minimum: -90, maximum: 90 },
            lng: { type: "number", minimum: -180, maximum: 180 },
            raioKm: { type: "number", minimum: 1, maximum: 500, default: 25 },
            categoria: { type: "string", enum: [...CATEGORIAS] },
            condicao: { type: "string", enum: [...CONDICOES] },
            precoMin: { type: "integer", minimum: 0 },
            precoMax: { type: "integer", minimum: 0 },
            q: { type: "string", maxLength: 100 },
            limite: { type: "integer", minimum: 1, maximum: 50, default: 20 },
            offset: { type: "integer", minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const filtros = request.query as {
        lat?: number;
        lng?: number;
        raioKm: number;
        categoria?: string;
        condicao?: string;
        precoMin?: number;
        precoMax?: number;
        q?: string;
        limite: number;
        offset: number;
      };

      const condicoes: SQL[] = [ne(listings.status, "vendido")];
      if (filtros.categoria) condicoes.push(eq(listings.category, filtros.categoria));
      if (filtros.condicao)
        condicoes.push(eq(listings.condition, filtros.condicao as (typeof CONDICOES)[number]));
      if (filtros.precoMin !== undefined) condicoes.push(gte(listings.priceCents, filtros.precoMin));
      if (filtros.precoMax !== undefined) condicoes.push(lte(listings.priceCents, filtros.precoMax));
      if (filtros.q) {
        const busca = or(
          ilike(listings.title, `%${filtros.q}%`),
          ilike(listings.description, `%${filtros.q}%`),
        );
        if (busca) condicoes.push(busca);
      }

      const temPosicao = filtros.lat !== undefined && filtros.lng !== undefined;
      const distanciaKm = temPosicao
        ? sql<number>`6371 * acos(least(1.0,
            cos(radians(${filtros.lat})) * cos(radians(${listings.lat})) *
            cos(radians(${listings.lng}) - radians(${filtros.lng})) +
            sin(radians(${filtros.lat})) * sin(radians(${listings.lat}))))`
        : null;

      if (distanciaKm) {
        condicoes.push(sql`${distanciaKm} <= ${filtros.raioKm}`);
      }

      const linhas = await db
        .select({
          anuncio: listings,
          ...(distanciaKm ? { distanciaKm } : {}),
        })
        .from(listings)
        .where(and(...condicoes))
        .orderBy(distanciaKm ?? desc(listings.createdAt))
        .limit(filtros.limite)
        .offset(filtros.offset);

      const itens = await Promise.all(
        linhas.map(async (linha) => {
          const [primeiraFoto] = await db
            .select()
            .from(listingPhotos)
            .where(eq(listingPhotos.listingId, linha.anuncio.id))
            .orderBy(asc(listingPhotos.position))
            .limit(1);

          return anuncioPublico(linha.anuncio, {
            distanciaKm:
              "distanciaKm" in linha && typeof linha.distanciaKm === "number"
                ? Math.round(linha.distanciaKm * 10) / 10
                : null,
            foto: primeiraFoto ? await criarUrlLeituraFoto(primeiraFoto.key) : null,
          });
        }),
      );

      return reply.send({ itens, limite: filtros.limite, offset: filtros.offset });
    },
  );

  app.get(
    "/anuncios/meus",
    { preHandler: [app.autenticar] },
    async (request, reply) => {
      const meus = await db
        .select()
        .from(listings)
        .where(eq(listings.sellerId, request.user.sub))
        .orderBy(desc(listings.createdAt));

      const itens = await Promise.all(
        meus.map(async (anuncio) =>
          anuncioPublico(anuncio, { fotos: await fotosDoAnuncio(anuncio.id) }),
        ),
      );

      return reply.send({ itens });
    },
  );

  app.get("/anuncios/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [linha] = await db
      .select({ anuncio: listings, vendedor: users })
      .from(listings)
      .innerJoin(users, eq(users.id, listings.sellerId))
      .where(eq(listings.id, id))
      .limit(1);

    if (!linha) {
      return reply.status(404).send({ erro: "Anúncio não encontrado." });
    }

    return reply.send(
      anuncioPublico(linha.anuncio, {
        fotos: await fotosDoAnuncio(linha.anuncio.id),
        vendedor: {
          id: linha.vendedor.id,
          nome: linha.vendedor.name,
          cidade: linha.vendedor.city,
          membroDesde: linha.vendedor.createdAt,
        },
      }),
    );
  });

  app.patch(
    "/anuncios/:id",
    {
      preHandler: [app.autenticar],
      schema: {
        body: {
          type: "object",
          properties: {
            titulo: { type: "string", minLength: 3, maxLength: 100 },
            descricao: { type: "string", maxLength: 2000 },
            precoCentavos: { type: "integer", minimum: 0, maximum: 100_000_000 },
            categoria: { type: "string", enum: [...CATEGORIAS] },
            condicao: { type: "string", enum: [...CONDICOES] },
            status: { type: "string", enum: [...STATUS] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const corpo = request.body as {
        titulo?: string;
        descricao?: string;
        precoCentavos?: number;
        categoria?: string;
        condicao?: (typeof CONDICOES)[number];
        status?: (typeof STATUS)[number];
      };

      const mudancas: Partial<typeof listings.$inferInsert> = { updatedAt: new Date() };
      if (corpo.titulo !== undefined) mudancas.title = corpo.titulo;
      if (corpo.descricao !== undefined) mudancas.description = corpo.descricao;
      if (corpo.precoCentavos !== undefined) mudancas.priceCents = corpo.precoCentavos;
      if (corpo.categoria !== undefined) mudancas.category = corpo.categoria;
      if (corpo.condicao !== undefined) mudancas.condition = corpo.condicao;
      if (corpo.status !== undefined) mudancas.status = corpo.status;

      const [anuncio] = await db
        .update(listings)
        .set(mudancas)
        .where(and(eq(listings.id, id), eq(listings.sellerId, request.user.sub)))
        .returning();

      if (!anuncio) {
        return reply
          .status(404)
          .send({ erro: "Anúncio não encontrado ou não é seu." });
      }

      return reply.send(
        anuncioPublico(anuncio, { fotos: await fotosDoAnuncio(anuncio.id) }),
      );
    },
  );

  app.delete(
    "/anuncios/:id",
    { preHandler: [app.autenticar] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const [apagado] = await db
        .delete(listings)
        .where(and(eq(listings.id, id), eq(listings.sellerId, request.user.sub)))
        .returning();

      if (!apagado) {
        return reply
          .status(404)
          .send({ erro: "Anúncio não encontrado ou não é seu." });
      }

      return reply.send({ ok: true });
    },
  );
}

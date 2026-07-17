import { and, asc, desc, eq, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import {
  conversations,
  listingPhotos,
  listings,
  meetups,
  messages,
  offers,
  transactions,
  users,
} from "../db/schema.js";
import { criarUrlLeituraFoto } from "../lib/r2.js";

type Conversa = typeof conversations.$inferSelect;
type Anuncio = typeof listings.$inferSelect;
type Mensagem = typeof messages.$inferSelect;
type Oferta = typeof offers.$inferSelect;

function precoTexto(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: centavos % 100 === 0 ? 0 : 2,
  });
}

function mensagemPublica(m: Mensagem, oferta: Oferta | null = null) {
  return {
    id: m.id,
    conversaId: m.conversationId,
    autorId: m.senderId,
    tipo: m.type,
    texto: m.content,
    criadoEm: m.createdAt,
    oferta: oferta
      ? {
          id: oferta.id,
          valorCentavos: oferta.amountCents,
          status: oferta.status,
          autorId: oferta.proposedBy,
        }
      : null,
  };
}

async function carregarConversa(conversaId: string, usuarioId: string) {
  const [linha] = await db
    .select({ conversa: conversations, anuncio: listings })
    .from(conversations)
    .innerJoin(listings, eq(listings.id, conversations.listingId))
    .where(eq(conversations.id, conversaId))
    .limit(1);

  if (!linha) return null;
  const participantes = [linha.conversa.buyerId, linha.anuncio.sellerId];
  if (!participantes.includes(usuarioId)) return null;
  return { ...linha, participantes };
}

export default async function rotasConversas(app: FastifyInstance) {
  async function registrarMensagem(
    conversa: Conversa,
    participantes: string[],
    dados: {
      senderId: string;
      type: Mensagem["type"];
      content: string;
      offerId?: string;
    },
    oferta: Oferta | null = null,
  ) {
    const [mensagem] = await db
      .insert(messages)
      .values({ conversationId: conversa.id, ...dados })
      .returning();

    if (mensagem) {
      app.tempoReal.enviarPara(participantes, {
        evento: "mensagem",
        conversaId: conversa.id,
        mensagem: mensagemPublica(mensagem, oferta),
      });
    }
    return mensagem;
  }

  app.post(
    "/conversas",
    {
      preHandler: [app.autenticar],
      schema: {
        body: {
          type: "object",
          required: ["anuncioId"],
          properties: { anuncioId: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request, reply) => {
      const { anuncioId } = request.body as { anuncioId: string };
      const compradorId = request.user.sub;

      const [anuncio] = await db
        .select()
        .from(listings)
        .where(eq(listings.id, anuncioId))
        .limit(1);

      if (!anuncio) {
        return reply.status(404).send({ erro: "Anúncio não encontrado." });
      }
      if (anuncio.sellerId === compradorId) {
        return reply
          .status(400)
          .send({ erro: "Esse anúncio é seu — não dá pra negociar com você mesmo." });
      }

      let [conversa] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.listingId, anuncioId),
            eq(conversations.buyerId, compradorId),
          ),
        )
        .limit(1);

      if (!conversa) {
        [conversa] = await db
          .insert(conversations)
          .values({ listingId: anuncioId, buyerId: compradorId })
          .returning();
      }

      return reply.send({ id: conversa!.id });
    },
  );

  app.get("/conversas", { preHandler: [app.autenticar] }, async (request, reply) => {
    const usuarioId = request.user.sub;

    const linhas = await db
      .select({ conversa: conversations, anuncio: listings })
      .from(conversations)
      .innerJoin(listings, eq(listings.id, conversations.listingId))
      .where(
        or(eq(conversations.buyerId, usuarioId), eq(listings.sellerId, usuarioId)),
      )
      .orderBy(desc(conversations.createdAt));

    const itens = await Promise.all(
      linhas.map(async ({ conversa, anuncio }) => {
        const outroId =
          conversa.buyerId === usuarioId ? anuncio.sellerId : conversa.buyerId;

        const [outro] = await db
          .select()
          .from(users)
          .where(eq(users.id, outroId))
          .limit(1);

        const [ultima] = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conversa.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        const [primeiraFoto] = await db
          .select()
          .from(listingPhotos)
          .where(eq(listingPhotos.listingId, anuncio.id))
          .orderBy(asc(listingPhotos.position))
          .limit(1);

        return {
          id: conversa.id,
          papel: conversa.buyerId === usuarioId ? "comprador" : "vendedor",
          outro: { id: outroId, nome: outro?.name ?? null },
          anuncio: {
            id: anuncio.id,
            titulo: anuncio.title,
            precoCentavos: anuncio.priceCents,
            status: anuncio.status,
            foto: primeiraFoto ? await criarUrlLeituraFoto(primeiraFoto.key) : null,
          },
          ultimaMensagem: ultima
            ? { tipo: ultima.type, texto: ultima.content, criadoEm: ultima.createdAt }
            : null,
        };
      }),
    );

    return reply.send({ itens });
  });

  app.get(
    "/conversas/:id/mensagens",
    { preHandler: [app.autenticar] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const usuarioId = request.user.sub;

      const contexto = await carregarConversa(id, usuarioId);
      if (!contexto) {
        return reply.status(404).send({ erro: "Conversa não encontrada." });
      }

      const linhas = await db
        .select({ mensagem: messages, oferta: offers })
        .from(messages)
        .leftJoin(offers, eq(offers.id, messages.offerId))
        .where(eq(messages.conversationId, id))
        .orderBy(asc(messages.createdAt))
        .limit(200);

      const outroId =
        contexto.conversa.buyerId === usuarioId
          ? contexto.anuncio.sellerId
          : contexto.conversa.buyerId;
      const [outro] = await db
        .select()
        .from(users)
        .where(eq(users.id, outroId))
        .limit(1);

      return reply.send({
        conversa: {
          id: contexto.conversa.id,
          papel: contexto.conversa.buyerId === usuarioId ? "comprador" : "vendedor",
          outro: { id: outroId, nome: outro?.name ?? null },
          anuncio: {
            id: contexto.anuncio.id,
            titulo: contexto.anuncio.title,
            precoCentavos: contexto.anuncio.priceCents,
            status: contexto.anuncio.status,
          },
        },
        mensagens: linhas.map((l) => mensagemPublica(l.mensagem, l.oferta)),
      });
    },
  );

  app.post(
    "/conversas/:id/mensagens",
    {
      preHandler: [app.autenticar],
      schema: {
        body: {
          type: "object",
          required: ["texto"],
          properties: { texto: { type: "string", minLength: 1, maxLength: 2000 } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { texto } = request.body as { texto: string };
      const usuarioId = request.user.sub;

      const contexto = await carregarConversa(id, usuarioId);
      if (!contexto) {
        return reply.status(404).send({ erro: "Conversa não encontrada." });
      }

      const mensagem = await registrarMensagem(contexto.conversa, contexto.participantes, {
        senderId: usuarioId,
        type: "texto",
        content: texto,
      });

      return reply.status(201).send(mensagemPublica(mensagem!));
    },
  );

  app.post(
    "/conversas/:id/ofertas",
    {
      preHandler: [app.autenticar],
      schema: {
        body: {
          type: "object",
          required: ["valorCentavos"],
          properties: {
            valorCentavos: { type: "integer", minimum: 1, maximum: 100_000_000 },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { valorCentavos } = request.body as { valorCentavos: number };
      const usuarioId = request.user.sub;

      const contexto = await carregarConversa(id, usuarioId);
      if (!contexto) {
        return reply.status(404).send({ erro: "Conversa não encontrada." });
      }
      if (contexto.anuncio.status === "vendido") {
        return reply.status(400).send({ erro: "Esse anúncio já foi vendido." });
      }

      const [jaAceita] = await db
        .select()
        .from(offers)
        .where(and(eq(offers.conversationId, id), eq(offers.status, "aceita")))
        .limit(1);
      if (jaAceita) {
        return reply
          .status(400)
          .send({ erro: "Vocês já fecharam negócio nessa conversa. 🤝" });
      }

      // A nova oferta substitui qualquer pendente na conversa.
      await db
        .update(offers)
        .set({ status: "substituida", respondedAt: new Date() })
        .where(and(eq(offers.conversationId, id), eq(offers.status, "pendente")));

      const [oferta] = await db
        .insert(offers)
        .values({ conversationId: id, proposedBy: usuarioId, amountCents: valorCentavos })
        .returning();

      const mensagem = await registrarMensagem(
        contexto.conversa,
        contexto.participantes,
        {
          senderId: usuarioId,
          type: "oferta",
          content: `Oferta: ${precoTexto(valorCentavos)}`,
          offerId: oferta!.id,
        },
        oferta,
      );

      return reply.status(201).send(mensagemPublica(mensagem!, oferta));
    },
  );

  app.post(
    "/conversas/:id/ofertas/:ofertaId/responder",
    {
      preHandler: [app.autenticar],
      schema: {
        body: {
          type: "object",
          required: ["acao"],
          properties: {
            acao: { type: "string", enum: ["aceitar", "recusar", "contrapropor"] },
            valorCentavos: { type: "integer", minimum: 1, maximum: 100_000_000 },
          },
        },
      },
    },
    async (request, reply) => {
      const { id, ofertaId } = request.params as { id: string; ofertaId: string };
      const { acao, valorCentavos } = request.body as {
        acao: "aceitar" | "recusar" | "contrapropor";
        valorCentavos?: number;
      };
      const usuarioId = request.user.sub;

      const contexto = await carregarConversa(id, usuarioId);
      if (!contexto) {
        return reply.status(404).send({ erro: "Conversa não encontrada." });
      }

      const [oferta] = await db
        .select()
        .from(offers)
        .where(and(eq(offers.id, ofertaId), eq(offers.conversationId, id)))
        .limit(1);

      if (!oferta || oferta.status !== "pendente") {
        return reply.status(400).send({ erro: "Essa oferta não está mais em aberto." });
      }
      if (oferta.proposedBy === usuarioId) {
        return reply.status(400).send({ erro: "A oferta é sua — espere a resposta." });
      }

      if (acao === "aceitar") {
        await db
          .update(offers)
          .set({ status: "aceita", respondedAt: new Date() })
          .where(eq(offers.id, oferta.id));

        await db.insert(transactions).values({
          listingId: contexto.anuncio.id,
          buyerId: contexto.conversa.buyerId,
          sellerId: contexto.anuncio.sellerId,
          offerId: oferta.id,
          agreedPriceCents: oferta.amountCents,
        });

        await db
          .update(listings)
          .set({ status: "reservado", updatedAt: new Date() })
          .where(eq(listings.id, contexto.anuncio.id));

        await registrarMensagem(contexto.conversa, contexto.participantes, {
          senderId: usuarioId,
          type: "sistema",
          content: `Fechou! 🤝 Negócio fechado por ${precoTexto(oferta.amountCents)}. O anúncio foi reservado — combinem o encontro.`,
        });

        app.tempoReal.enviarPara(contexto.participantes, {
          evento: "negocio-fechado",
          conversaId: id,
          anuncioId: contexto.anuncio.id,
        });

        return reply.send({ ok: true, resultado: "aceita" });
      }

      if (acao === "recusar") {
        await db
          .update(offers)
          .set({ status: "recusada", respondedAt: new Date() })
          .where(eq(offers.id, oferta.id));

        await registrarMensagem(contexto.conversa, contexto.participantes, {
          senderId: usuarioId,
          type: "sistema",
          content: `Oferta de ${precoTexto(oferta.amountCents)} recusada.`,
        });

        return reply.send({ ok: true, resultado: "recusada" });
      }

      // Contraproposta
      if (!valorCentavos) {
        return reply.status(400).send({ erro: "Informe o valor da contraproposta." });
      }

      await db
        .update(offers)
        .set({ status: "substituida", respondedAt: new Date() })
        .where(eq(offers.id, oferta.id));

      const [contra] = await db
        .insert(offers)
        .values({ conversationId: id, proposedBy: usuarioId, amountCents: valorCentavos })
        .returning();

      const mensagem = await registrarMensagem(
        contexto.conversa,
        contexto.participantes,
        {
          senderId: usuarioId,
          type: "oferta",
          content: `Contraproposta: ${precoTexto(valorCentavos)}`,
          offerId: contra!.id,
        },
        contra,
      );

      return reply.status(201).send(mensagemPublica(mensagem!, contra));
    },
  );

  app.post(
    "/conversas/:id/encontro",
    {
      preHandler: [app.autenticar],
      schema: {
        body: {
          type: "object",
          required: ["quando", "local"],
          properties: {
            quando: { type: "string", minLength: 1, maxLength: 120 },
            local: { type: "string", minLength: 1, maxLength: 200 },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { quando, local } = request.body as { quando: string; local: string };
      const usuarioId = request.user.sub;

      const contexto = await carregarConversa(id, usuarioId);
      if (!contexto) {
        return reply.status(404).send({ erro: "Conversa não encontrada." });
      }

      await db.insert(meetups).values({
        conversationId: id,
        proposedBy: usuarioId,
        whenText: quando,
        place: local,
      });

      const mensagem = await registrarMensagem(contexto.conversa, contexto.participantes, {
        senderId: usuarioId,
        type: "encontro",
        content: `📅 Encontro: ${quando} — ${local}`,
      });

      return reply.status(201).send(mensagemPublica(mensagem!));
    },
  );
}

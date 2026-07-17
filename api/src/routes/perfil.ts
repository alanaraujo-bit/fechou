import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

export default async function rotasPerfil(app: FastifyInstance) {
  app.get("/perfil", { preHandler: [app.autenticar] }, async (request, reply) => {
    const [usuario] = await db
      .select()
      .from(users)
      .where(eq(users.id, request.user.sub))
      .limit(1);

    if (!usuario) {
      return reply.status(404).send({ erro: "Conta não encontrada." });
    }

    return reply.send({
      id: usuario.id,
      email: usuario.email,
      nome: usuario.name,
      fotoUrl: usuario.photoUrl,
      cidade: usuario.city,
      membroDesde: usuario.createdAt,
    });
  });

  app.patch(
    "/perfil",
    {
      preHandler: [app.autenticar],
      schema: {
        body: {
          type: "object",
          properties: {
            nome: { type: "string", minLength: 1, maxLength: 80 },
            cidade: { type: "string", minLength: 1, maxLength: 80 },
            fotoUrl: { type: "string", format: "uri", maxLength: 500 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const corpo = request.body as {
        nome?: string;
        cidade?: string;
        fotoUrl?: string;
      };

      const mudancas: Partial<typeof users.$inferInsert> = {};
      if (corpo.nome !== undefined) mudancas.name = corpo.nome;
      if (corpo.cidade !== undefined) mudancas.city = corpo.cidade;
      if (corpo.fotoUrl !== undefined) mudancas.photoUrl = corpo.fotoUrl;

      if (Object.keys(mudancas).length === 0) {
        return reply.status(400).send({ erro: "Nada pra atualizar." });
      }

      const [usuario] = await db
        .update(users)
        .set(mudancas)
        .where(eq(users.id, request.user.sub))
        .returning();

      if (!usuario) {
        return reply.status(404).send({ erro: "Conta não encontrada." });
      }

      return reply.send({
        id: usuario.id,
        email: usuario.email,
        nome: usuario.name,
        fotoUrl: usuario.photoUrl,
        cidade: usuario.city,
        membroDesde: usuario.createdAt,
      });
    },
  );
}

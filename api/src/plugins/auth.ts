import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    autenticar: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const ACCESS_TOKEN_TTL = "1h";

export default fp(async (app: FastifyInstance) => {
  const segredo = process.env.JWT_SECRET;
  if (!segredo) {
    throw new Error("JWT_SECRET não definido");
  }

  await app.register(fastifyJwt, { secret: segredo });

  app.decorate(
    "autenticar",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply
          .status(401)
          .send({ erro: "Sessão inválida ou expirada" });
      }
    },
  );
});

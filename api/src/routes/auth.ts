import { and, eq, gt, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { otpCodes, refreshTokens, users } from "../db/schema.js";
import {
  gerarCodigoOtp,
  gerarRefreshToken,
  hashSha256,
} from "../lib/codigos.js";
import { enviarCodigoOtp } from "../lib/email.js";
import { ACCESS_TOKEN_TTL } from "../plugins/auth.js";

const OTP_VALIDADE_MIN = 10;
const OTP_MAX_TENTATIVAS = 5;
const REFRESH_VALIDADE_DIAS = 30;

function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

type Usuario = typeof users.$inferSelect;

function usuarioPublico(u: Usuario) {
  return {
    id: u.id,
    email: u.email,
    nome: u.name,
    fotoUrl: u.photoUrl,
    cidade: u.city,
    membroDesde: u.createdAt,
  };
}

async function emitirSessao(app: FastifyInstance, usuario: Usuario) {
  const refreshToken = gerarRefreshToken();
  await db.insert(refreshTokens).values({
    userId: usuario.id,
    tokenHash: hashSha256(refreshToken),
    expiresAt: new Date(
      Date.now() + REFRESH_VALIDADE_DIAS * 24 * 60 * 60 * 1000,
    ),
  });

  const accessToken = app.jwt.sign(
    { sub: usuario.id },
    { expiresIn: ACCESS_TOKEN_TTL },
  );

  return { accessToken, refreshToken, usuario: usuarioPublico(usuario) };
}

export default async function rotasAuth(app: FastifyInstance) {
  app.post(
    "/auth/solicitar-codigo",
    {
      schema: {
        body: {
          type: "object",
          required: ["email"],
          properties: { email: { type: "string", format: "email" } },
        },
      },
    },
    async (request, reply) => {
      const { email } = request.body as { email: string };
      const emailNormalizado = normalizarEmail(email);

      const codigo = gerarCodigoOtp();

      // Invalida códigos anteriores ainda abertos pra este e-mail.
      await db
        .update(otpCodes)
        .set({ consumedAt: new Date() })
        .where(
          and(eq(otpCodes.email, emailNormalizado), isNull(otpCodes.consumedAt)),
        );

      await db.insert(otpCodes).values({
        email: emailNormalizado,
        codeHash: hashSha256(codigo),
        expiresAt: new Date(Date.now() + OTP_VALIDADE_MIN * 60 * 1000),
      });

      await enviarCodigoOtp(request.log, emailNormalizado, codigo);

      return reply.send({ ok: true, validadeMinutos: OTP_VALIDADE_MIN });
    },
  );

  app.post(
    "/auth/verificar-codigo",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "codigo"],
          properties: {
            email: { type: "string", format: "email" },
            codigo: { type: "string", pattern: "^\\d{6}$" },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, codigo } = request.body as {
        email: string;
        codigo: string;
      };
      const emailNormalizado = normalizarEmail(email);

      const [registro] = await db
        .select()
        .from(otpCodes)
        .where(
          and(
            eq(otpCodes.email, emailNormalizado),
            isNull(otpCodes.consumedAt),
            gt(otpCodes.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (!registro) {
        return reply
          .status(400)
          .send({ erro: "Código expirado ou não encontrado. Peça um novo." });
      }

      if (registro.attempts >= OTP_MAX_TENTATIVAS) {
        return reply
          .status(429)
          .send({ erro: "Muitas tentativas. Peça um novo código." });
      }

      if (registro.codeHash !== hashSha256(codigo)) {
        await db
          .update(otpCodes)
          .set({ attempts: registro.attempts + 1 })
          .where(eq(otpCodes.id, registro.id));
        return reply.status(400).send({ erro: "Código incorreto." });
      }

      await db
        .update(otpCodes)
        .set({ consumedAt: new Date() })
        .where(eq(otpCodes.id, registro.id));

      let [usuario] = await db
        .select()
        .from(users)
        .where(eq(users.email, emailNormalizado))
        .limit(1);

      if (!usuario) {
        [usuario] = await db
          .insert(users)
          .values({ email: emailNormalizado })
          .returning();
      }

      if (!usuario) {
        return reply.status(500).send({ erro: "Falha ao criar a conta." });
      }

      return reply.send(await emitirSessao(app, usuario));
    },
  );

  app.post(
    "/auth/renovar",
    {
      schema: {
        body: {
          type: "object",
          required: ["refreshToken"],
          properties: { refreshToken: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const { refreshToken } = request.body as { refreshToken: string };

      const [registro] = await db
        .select()
        .from(refreshTokens)
        .where(
          and(
            eq(refreshTokens.tokenHash, hashSha256(refreshToken)),
            isNull(refreshTokens.revokedAt),
            gt(refreshTokens.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (!registro) {
        return reply
          .status(401)
          .send({ erro: "Sessão expirada. Entre de novo." });
      }

      // Rotação: o token usado é revogado e um novo é emitido.
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, registro.id));

      const [usuario] = await db
        .select()
        .from(users)
        .where(eq(users.id, registro.userId))
        .limit(1);

      if (!usuario) {
        return reply.status(401).send({ erro: "Conta não encontrada." });
      }

      return reply.send(await emitirSessao(app, usuario));
    },
  );

  app.post(
    "/auth/sair",
    {
      schema: {
        body: {
          type: "object",
          required: ["refreshToken"],
          properties: { refreshToken: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const { refreshToken } = request.body as { refreshToken: string };

      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.tokenHash, hashSha256(refreshToken)));

      return reply.send({ ok: true });
    },
  );
}

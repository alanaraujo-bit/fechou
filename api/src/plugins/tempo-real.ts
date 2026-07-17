import fastifyWebsocket from "@fastify/websocket";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { WebSocket } from "ws";

declare module "fastify" {
  interface FastifyInstance {
    tempoReal: {
      /** Envia um evento JSON pra todas as conexões abertas dos usuários. */
      enviarPara: (userIds: string[], evento: Record<string, unknown>) => void;
    };
  }
}

/**
 * WebSocket em `/ws?token=<JWT>`. O app conecta uma vez e recebe eventos
 * de novas mensagens/ofertas das conversas em que participa.
 */
export default fp(async (app: FastifyInstance) => {
  await app.register(fastifyWebsocket);

  const conexoes = new Map<string, Set<WebSocket>>();

  app.decorate("tempoReal", {
    enviarPara(userIds: string[], evento: Record<string, unknown>) {
      const corpo = JSON.stringify(evento);
      for (const userId of userIds) {
        for (const socket of conexoes.get(userId) ?? []) {
          if (socket.readyState === socket.OPEN) socket.send(corpo);
        }
      }
    },
  });

  app.get("/ws", { websocket: true }, (socket, request) => {
    const { token } = request.query as { token?: string };

    let userId: string;
    try {
      if (!token) throw new Error("sem token");
      userId = app.jwt.verify<{ sub: string }>(token).sub;
    } catch {
      socket.close(4001, "Sessão inválida");
      return;
    }

    let doUsuario = conexoes.get(userId);
    if (!doUsuario) {
      doUsuario = new Set();
      conexoes.set(userId, doUsuario);
    }
    doUsuario.add(socket);

    socket.on("close", () => {
      doUsuario.delete(socket);
      if (doUsuario.size === 0) conexoes.delete(userId);
    });
  });
});

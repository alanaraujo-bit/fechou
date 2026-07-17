import Fastify from "fastify";
import pluginAuth from "./plugins/auth.js";
import pluginTempoReal from "./plugins/tempo-real.js";
import rotasAnuncios from "./routes/anuncios.js";
import rotasAuth from "./routes/auth.js";
import rotasConversas from "./routes/conversas.js";
import rotasPerfil from "./routes/perfil.js";

const app = Fastify({ logger: true });

app.get("/health", async () => ({
  status: "ok",
  service: "fechou-api",
  version: "0.4.0",
  timestamp: new Date().toISOString(),
}));

await app.register(pluginAuth);
await app.register(pluginTempoReal);
await app.register(rotasAuth);
await app.register(rotasPerfil);
await app.register(rotasAnuncios);
await app.register(rotasConversas);

const port = Number(process.env.PORT ?? 3333);

app
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    app.log.info(`fechou-api no ar na porta ${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

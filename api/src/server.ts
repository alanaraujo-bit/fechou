import Fastify from "fastify";
import pluginAuth from "./plugins/auth.js";
import rotasAuth from "./routes/auth.js";
import rotasPerfil from "./routes/perfil.js";

const app = Fastify({ logger: true });

app.get("/health", async () => ({
  status: "ok",
  service: "fechou-api",
  version: "0.2.0",
  timestamp: new Date().toISOString(),
}));

await app.register(pluginAuth);
await app.register(rotasAuth);
await app.register(rotasPerfil);

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

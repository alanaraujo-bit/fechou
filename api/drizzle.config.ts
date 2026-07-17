import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    // Nas migrações a partir da máquina do Alan, use a URL pública do
    // Postgres da Railway (DATABASE_PUBLIC_URL do serviço Postgres).
    url: process.env.DATABASE_URL ?? "",
  },
});

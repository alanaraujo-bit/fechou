# Fechou ⚡ — guia de orientação (leia antes de qualquer coisa)

App de marketplace de usados do Alan — compra e venda **local** com confiança,
atacando as falhas do Facebook Marketplace/OLX/Enjoei/Mercado Livre.
Idioma do projeto: **tudo em pt-BR** (docs, UI, commits).

## Leia nesta ordem

1. [docs/ROADMAP.md](docs/ROADMAP.md) — **documento mestre**: fases, escopo, critérios e **status atual**. Sempre atualize o status lá ao concluir qualquer etapa.
2. [docs/VISAO.md](docs/VISAO.md) — por que o app existe, diferenciais, estratégia hiperlocal.
3. [docs/ARQUITETURA.md](docs/ARQUITETURA.md) — stack e decisões técnicas.

## Regras que não mudam (sem confirmar com o Alan antes)

- **Expo SDK 54, pinado.** O Alan testa no iPhone via Expo Go da App Store, que suporta SDK 54. NUNCA subir o SDK sem ele confirmar que o Expo Go do celular dele suporta.
- **Backend na Railway** — é a plataforma padrão do Alan (mesma do projeto Lumen).
- **Sem escrow/pagamento na v1** — mas toda oferta aceita gera registro em `transactions` pra plugar escrow na v2 sem retrabalho (decisão consciente, não esquecimento).
- **Estratégia hiperlocal**: lançar na cidade do Alan primeiro. Não construir features de "escala nacional" antes da Fase 5.
- O nome **Fechou** foi escolhido de propósito: o botão de aceitar oferta diz "Fechou!". Não renomear esse botão.

## Estrutura

```
app/    # Expo SDK 54 (React Native + TS + Expo Router) — 5 abas prontas
api/    # Fastify + TS, porta 3333, deploy futuro na Railway
docs/   # Documentação (pt-BR)
```

- O app descobre a URL da API sozinho em dev via `hostUri` do Expo (veja `app/constants/api.ts`) — não hardcodar IP.
- API lê `PORT` do ambiente (Railway) com fallback 3333.

## Comandos

```bash
cd api && npm run dev        # API em http://localhost:3333
cd app && npx expo start     # QR code pro Expo Go (mesmo Wi-Fi)
cd api && npm run typecheck  # typecheck da API
cd app && npx tsc --noEmit   # typecheck do app
```

## Onde paramos (2026-07-17)

Fases 0 e 1 **concluídas e validadas no iPhone** (2026-07-17): OTP por e-mail, perfil,
JWT + refresh com rotação, Postgres (Drizzle) na Railway, app com sessão persistente.
API: https://fechou-api-production-e265.up.railway.app (projeto Railway `fechou`).
**Importante:** Alan não roda infra local — API e banco ficam na Railway; o app aponta pra lá por padrão.
**Pendente (não bloqueia):** configurar `RESEND_API_KEY` pro OTP chegar por e-mail de verdade
(sem ela o código sai nos logs: `railway logs --service fechou-api`).
Próximo passo de código: **Fase 2 — Anúncios** (CRUD com fotos no R2, feed por proximidade, busca). Detalhes no ROADMAP.

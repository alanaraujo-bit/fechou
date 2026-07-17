# Fechou ⚡

**Marketplace de usados feito do jeito certo — local, seguro e sem enrolação.**

Comprar e vender usado na sua região sem golpe, sem "ainda está disponível?" e sem taxa escondida. Quando o negócio dá certo, você sabe: **Fechou!**

## Estrutura

```
fechou/
├── app/    # App mobile — Expo SDK 54 (React Native + TypeScript)
├── api/    # Backend — Node + Fastify + Drizzle + PostgreSQL (Railway)
└── docs/   # Documentação do projeto (pt-BR)
```

> **Importante:** o app usa **Expo SDK 54** porque é a versão suportada pelo Expo Go
> da App Store usado nos testes. Não atualizar o SDK sem confirmar o suporte no celular.

## Documentação

- [docs/VISAO.md](docs/VISAO.md) — por que o Fechou existe e o que ele ataca
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md) — stack e decisões técnicas
- [docs/ROADMAP.md](docs/ROADMAP.md) — **documento mestre**: fases, escopo e critérios de conclusão

## Rodando em desenvolvimento

```bash
# API
cd api
npm install
npm run dev        # http://localhost:3333

# App (em outro terminal)
cd app
npm install
npx expo start     # escaneie o QR code com o Expo Go (iOS)
```

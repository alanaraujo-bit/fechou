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

Fases 0 e 1 **concluídas e validadas no iPhone**; Fase 2 (Anúncios) **código pronto e testado
na produção** (2026-07-17): fotos no R2 (bucket `fechou-fotos`, upload por URL assinada),
feed por proximidade, busca com filtros, status Disponível/Reservado/Vendido.
API: https://fechou-api-production-e265.up.railway.app (projeto Railway `fechou`).
**Importante:** Alan não roda infra local — API, Postgres e R2 são os ambientes reais; o app aponta pra lá por padrão.
**Atenção:** Resend em modo teste — OTP só chega no e-mail alanvitoraraujo2a@gmail.com;
outros e-mails dão erro 500 até verificar um domínio no Resend.
**Pendente:** Alan validar a Fase 2 no iPhone (anunciar item real e achar na busca por distância).

# Roadmap — Fechou ⚡ (documento mestre)

Cada fase tem um **critério de conclusão** verificável. Uma fase só está pronta
quando o critério foi cumprido de verdade no celular, não mockado.
**Este arquivo é a fonte da verdade do status — atualize-o ao concluir qualquer etapa.**

## Fase 0 — Fundação ✅ (concluída em 2026-07-17)
- [x] Monorepo `app/` (Expo SDK 54 + TypeScript + Expo Router) e `api/` (Fastify + TS).
- [x] API com healthcheck (`GET /health`) rodando local — verificado, responde `{status:"ok"}`.
- [x] Deploy da API na Railway — projeto `fechou`, serviço `fechou-api` + Postgres.
      URL: https://fechou-api-production-e265.up.railway.app
- [x] App com navegação por abas (Início, Buscar, Anunciar, Chat, Perfil) — telas placeholder.
- [x] App consome a API (agora apontando pra Railway por padrão; `EXPO_PUBLIC_API_URL` sobrescreve).

**Critério:** app abre no Expo Go do iPhone do Alan e exibe resposta da API. ← **✅ validado em 2026-07-17**

## Fase 1 — Identidade ✅ (critério validado no iPhone em 2026-07-17; envio real de e-mail pendente, não bloqueia)
- [x] Cadastro/login com OTP por e-mail: `POST /auth/solicitar-codigo` e `POST /auth/verificar-codigo`
      (código de 6 dígitos, expira em 10 min, máx. 5 tentativas, hash no banco).
- [ ] Envio real do e-mail — **hoje o código sai nos logs da Railway** (`railway logs`).
      A API já suporta Resend: basta setar `RESEND_API_KEY` (+ `EMAIL_FROM`) no serviço.
- [x] Perfil: nome, cidade, "membro desde" (`GET/PATCH /perfil`); foto fica pra Fase 2 (precisa do R2).
- [x] Sessão persistente: JWT de acesso (1h) + refresh token (30 dias, rotação e revogação no banco);
      app guarda tokens no `expo-secure-store` e renova a sessão ao abrir.
- [x] Banco: Postgres na Railway com tabelas `users`, `otp_codes`, `refresh_tokens` (Drizzle ORM).
- [x] Fluxo completo testado de ponta a ponta na produção (OTP → conta → perfil → renovar → sair).

**Critério:** Alan cria a própria conta real e permanece logado após fechar o app. ← **✅ validado em 2026-07-17**

## Fase 2 — Anúncios 🚧 (código pronto e testado na Railway em 2026-07-17; falta validação do Alan no iPhone)
- [x] CRUD de anúncio: fotos (upload direto pro R2 via URL assinada — bucket `fechou-fotos`, privado,
      leitura via URL assinada de 24h), título, preço, categoria, condição, localização aproximada
      (lat/lng arredondados pra ~1 km no app; nunca o endereço exato).
- [x] Feed por proximidade (Haversine em SQL) + busca com filtros (texto, categoria, preço, distância, condição).
- [x] Status do anúncio: **Disponível / Reservado / Vendido** — dono troca na tela de detalhe;
      Vendido some do feed e da busca automaticamente.
- [x] Testado de ponta a ponta na produção: upload real pro R2, feed com distância (1,5 km ✓), filtros ✓.
- Rotas: `POST /anuncios/fotos/url-upload`, `POST/GET /anuncios`, `GET /anuncios/meus`,
  `GET/PATCH/DELETE /anuncios/:id`. Telas: Anunciar, Início (feed), Buscar, detalhe (`/anuncio/[id]`).

**Critério:** Alan anuncia um item de verdade pelo celular e o encontra pela busca com filtro de distância. ← **pendente, próximo passo**

## Fase 3 — Negociação
- Chat em tempo real (WebSocket) entre comprador e vendedor por anúncio.
- **Oferta estruturada**: propor valor → aceitar ("Fechou!") / recusar / contrapropor.
- Oferta aceita → cria `transaction` + anúncio vira Reservado automaticamente.
- Agendamento do encontro (data/hora/local) registrado no chat.

**Critério:** venda completa simulada entre duas contas, do anúncio ao "Fechou!".

## Fase 4 — Confiança
- Avaliação bilateral pós-venda (comprador ⭐ vendedor e vendedor ⭐ comprador).
- Denúncia de anúncio/usuário com fila de triagem.
- Busca salva com alerta push.
- Dicas contextuais de encontro seguro no fluxo de agendamento.

**Critério:** ciclo completo com avaliação dos dois lados e push de busca salva recebido no iPhone.

## Fase 5 — Beta local
- Polimento visual, onboarding, ícone e splash.
- Deploy estável na Railway; app via TestFlight (EAS Build).
- Lançamento fechado na cidade do Alan, nas categorias que ele negocia.
- Alan migra seus anúncios do Facebook Marketplace.

**Critério:** primeira venda real entre duas pessoas que não são o Alan.

## v2 (fora do MVP)
- **Escrow presencial** via provedor com split (Mercado Pago / Pagar.me / Asaas):
  pagamento retido, liberado no encontro. O modelo de `transactions` da Fase 3 já prevê isso.
- Sugestão de preço baseada em vendas reais.
- Detecção de foto roubada / anúncio duplicado.
- Verificação de identidade por documento.
- Página web pública de anúncio (link compartilhável no WhatsApp com preview → abre/baixa o app).

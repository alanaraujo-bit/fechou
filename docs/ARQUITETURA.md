# Arquitetura — Fechou ⚡

## Stack

| Camada | Tecnologia | Notas |
|---|---|---|
| App mobile | **Expo SDK 54** (React Native + TypeScript) + Expo Router | SDK **pinado em 54**: é a versão suportada pelo Expo Go da App Store usado nos testes no iPhone do Alan. Não subir de SDK sem confirmar suporte no aparelho. |
| Push | Expo Notifications | Alertas de busca salva, chat e ofertas. |
| API | **Node + TypeScript + Fastify**, deploy na **Railway** | Mesma linguagem do app; Railway é a plataforma padrão do Alan. |
| Banco | **PostgreSQL** (plugin da Railway) + **Drizzle ORM** | Busca por distância com lat/lng no Postgres (Haversine); PostGIS só se precisar. |
| Chat | WebSocket no próprio Fastify (`@fastify/websocket`) | Tempo real para chat e status de anúncio. |
| Fotos | **Cloudflare R2** (compatível com S3) | Railway não faz object storage; R2 tem tier grátis e não cobra egress. |
| Auth | OTP (e-mail no início, SMS/Twilio depois) + JWT | Verificação de telefone é a base da confiança — entra assim que houver orçamento pra SMS. |

## Decisões estruturais

### Preparado para escrow (v2)
Reter dinheiro de terceiros tem peso regulatório, então a v1 **não** processa
pagamento — as partes combinam Pix/dinheiro no encontro. Mas o modelo de dados
já nasce pronto: toda oferta aceita gera um registro de **transação**
(`transactions`: anúncio, comprador, vendedor, valor acordado, status).
Quando o escrow chegar (Mercado Pago / Pagar.me / Asaas com split), ele pluga
nesse registro sem retrabalho.

### Monorepo simples
```
fechou/
├── app/    # Expo
├── api/    # Fastify
└── docs/
```
Sem workspace/turborepo por enquanto — dois `npm install` separados.
Tipos compartilhados podem virar um pacote `shared/` quando doer.

### Geolocalização
Anúncio guarda lat/lng aproximados (nunca o endereço exato do vendedor).
Busca por raio usa Haversine em SQL puro. Cidade/bairro exibidos como texto.

## Ambientes

- **Dev local:** API em `http://localhost:3333`, app via Expo Go apontando
  pro IP da máquina na rede local.
- **Produção:** API + Postgres na Railway; app distribuído via Expo Go
  (dev) e depois EAS Build → TestFlight/Play Store.

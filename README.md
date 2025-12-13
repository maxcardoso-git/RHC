# Resource Health Checker (RHC)

Bootstrap inicial do serviço/worker **Resource Health Checker** para monitoramento proativo dos recursos do Resource Registry com regras declarativas, estados normalizados (UP/DEGRADED/DOWN) e histórico auditável.

## Stack
- Node.js 18+, TypeScript
- Fastify (API REST)
- Scheduler em memória + collectors simulados
- Store em memória (substituível por PostgreSQL futuramente)

## Rodando local
```bash
npm install
npm run dev
# API em http://localhost:3000, scheduler ativo
```
Variáveis de ambiente opcionais:
- `PORT` (padrão 3000)
- `INTERNAL_API_KEY` (se definido, valida `X-Internal-Api-Key`)
- `DEFAULT_LOCALE` (pt-BR|en-US|es-ES)
- `SCHEDULER_LOOP_SECONDS` (padrão 30)
- `SCHEDULER_JITTER_MAX_SECONDS` (padrão 30)
- `LOG_LEVEL` (padrão info)

## Endpoints principais (base `/api/v1/resource-health`)
- `GET /status` — lista status atuais com filtros (`type, subtype, status, tag, owner, env, limit, offset`).
- `GET /status/:resource_id` — status atual do recurso.
- `POST /check/:resource_id` — dispara checagem manual (responde 202 com `check_id`).
- `GET /history/:resource_id` — histórico de checks (paginado).
- `GET /checks/:check_id` — detalhe de uma execução.
- `GET /schema/metrics` — catálogo de métricas por tipo de recurso.
- `GET /resources` — catálogo simulado vindo do Resource Registry.

Use o header `Accept-Language` (`pt-BR`, `en-US`, `es-ES`) para mensagens localizadas. Quando `INTERNAL_API_KEY` estiver definido, inclua `X-Internal-Api-Key` no request.

## Rodando via Docker
```bash
docker build -t rhc:latest .
docker run -p 3000:3000 \
  -e INTERNAL_API_KEY=dev-key \
  -e DEFAULT_LOCALE=pt-BR \
  --name rhc rhc:latest
# API em http://localhost:3000/api/v1/resource-health/status
```

Para atualizar/rodar em servidor remoto com Docker já instalado:
```bash
git clone https://github.com/maxcardoso-git/RHC.git && cd RHC
docker build -t rhc:latest .
docker stop rhc || true && docker rm rhc || true
docker run -d --restart unless-stopped -p 3000:3000 \
  -e INTERNAL_API_KEY=prod-key \
  --name rhc rhc:latest
```

## O que já está implementado
- Contratos de domínio: métricas, políticas, regras e tipos de recurso do PRD.
- Catálogo de métricas por tipo e recursos/policies de exemplo.
- Rule engine `worst_of` com operadores básicos.
- Collectors simulados por tipo de recurso (latências e valores sintéticos).
- Scheduler pull-based com intervalos ISO-8601 simples (PT10M), jitter e filtragem de recursos habilitados.
- API REST com responses multi-idioma no summary/message.

## Próximos passos sugeridos
1) Persistência em PostgreSQL (tabelas `resource_health_status` e `resource_health_checks`).
2) Integração real com Resource Registry (listar recursos e policies). 
3) Webhooks/eventos (RabbitMQ/Kafka) para `resource.health.changed` e `resource.health.check.completed`.
4) Novas estratégias de agregação (`weighted_score`, `quorum`) e cooldown por regra/recurso.
5) Collectors reais para bancos, cache/filas, HTTP e LLM providers (com timeout/retry/backoff por policy).
6) Harden de segurança: rate limit e mTLS/gateway conforme PRD.

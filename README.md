# Resource Health Checker (RHC)

Bootstrap inicial do serviço/worker **Resource Health Checker** para monitoramento proativo dos recursos do Resource Registry com regras declarativas, estados normalizados (UP/DEGRADED/DOWN) e histórico auditável.

## Stack
- Node.js 18+, TypeScript
- Fastify (API REST)
- Scheduler em memória + collectors simulados
- PostgreSQL ou MemoryStore (configurável via DATABASE_URL)

## Setup de Banco de Dados (PostgreSQL)

### Opção 1: Usar PostgreSQL (Recomendado para Produção)

1. **Criar banco de dados:**
```bash
createdb rhc_db
```

2. **Rodar migrations:**
```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/rhc_db"
npm run migrate:up
```

3. **Popular com dados de exemplo (opcional):**
```bash
npm run seed
```

4. **Iniciar aplicação:**
```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/rhc_db"
npm run dev
```

### Opção 2: Usar MemoryStore (Desenvolvimento)

Se `DATABASE_URL` não estiver configurado, a aplicação usa memória volátil automaticamente:

```bash
npm install
npm run dev
# API em http://localhost:3000, scheduler ativo
```

⚠️ **Atenção:** MemoryStore perde todos os dados ao reiniciar!

## Variáveis de Ambiente

### Obrigatórias para PostgreSQL:
- `DATABASE_URL` - Connection string PostgreSQL (ex.: `postgresql://user:password@localhost:5432/rhc_db`)

### Opcionais:
- `PORT` (padrão 3000)
- `INTERNAL_API_KEY` (se definido, valida `X-Internal-Api-Key`)
- `DEFAULT_LOCALE` (pt-BR|en-US|es-ES)
- `DATABASE_CACHE_ENABLED` (padrão true; cache em memória para reads rápidos)
- `RESOURCE_REGISTRY_BASE_URL` (ex.: http://resource-registry:8080)
- `RESOURCE_REGISTRY_API_KEY` (opcional, para `X-Internal-Api-Key` no RR)
- `RESOURCE_REGISTRY_CACHE_SECONDS` (padrão 30; cache simples da lista)
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
- `GET /resources` — catálogo vindo do Resource Registry.

Use o header `Accept-Language` (`pt-BR`, `en-US`, `es-ES`) para mensagens localizadas. Quando `INTERNAL_API_KEY` estiver definido, inclua `X-Internal-Api-Key` no request.

## UI simples (dashboard)
- Acessar em `/ui` (ex.: http://localhost:3000/ui ou http://72.61.52.70:32000/ui).
- Exibe status dos recursos com filtros, auto-refresh e detalhe/histórico ao clicar no recurso.
- Consome os endpoints da API existente e envia `Accept-Language` conforme seleção na UI.

## Rodando via Docker

### Com PostgreSQL (Recomendado)

```bash
# 1. Iniciar PostgreSQL
docker run -d \
  --name rhc-postgres \
  -e POSTGRES_PASSWORD=rhc_password \
  -e POSTGRES_USER=rhc_user \
  -e POSTGRES_DB=rhc_db \
  -p 5432:5432 \
  postgres:15

# 2. Rodar migrations
export DATABASE_URL="postgresql://rhc_user:rhc_password@localhost:5432/rhc_db"
npm run migrate:up

# 3. Build e rodar RHC
docker build -t rhc:latest .
docker run -d -p 3000:3000 \
  -e DATABASE_URL="postgresql://rhc_user:rhc_password@host.docker.internal:5432/rhc_db" \
  -e INTERNAL_API_KEY=prod-key \
  -e DEFAULT_LOCALE=pt-BR \
  --name rhc rhc:latest
```

### Sem PostgreSQL (MemoryStore)

```bash
docker build -t rhc:latest .
docker run -p 3000:3000 \
  -e INTERNAL_API_KEY=dev-key \
  -e DEFAULT_LOCALE=pt-BR \
  --name rhc rhc:latest
```

### Docker Compose (Completo)

Crie um arquivo `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: rhc_user
      POSTGRES_PASSWORD: rhc_password
      POSTGRES_DB: rhc_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rhc_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  rhc:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://rhc_user:rhc_password@postgres:5432/rhc_db
      INTERNAL_API_KEY: prod-key
      DEFAULT_LOCALE: pt-BR
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
```

Inicie com:
```bash
docker-compose up -d
docker-compose exec rhc npm run migrate:up
docker-compose exec rhc npm run seed  # opcional
```

## O que já está implementado

### ✅ Funcionalidades Core
- Contratos de domínio: métricas, políticas, regras e tipos de recurso
- Integração com Resource Registry (REST) para listar recursos/policies
- Rule engine `worst_of` com operadores básicos
- Collectors: HTTP/REST (funcionais), outros simulados (latências sintéticas)
- Scheduler pull-based com intervalos ISO-8601 (PT10M), jitter e filtragem
- API REST com responses multi-idioma no summary/message
- **✅ Persistência PostgreSQL** com connection pooling e cache em memória
- **✅ MemoryStore como fallback** para desenvolvimento
- **✅ Migrations automatizadas** com scripts de up/down
- **✅ Graceful shutdown** com cleanup de conexões

### 📋 Próximos Passos (Ver [ANALISE_E_PLANO.md](ANALISE_E_PLANO.md) para detalhes)

#### 🔴 CRÍTICOS (Fase 1 - MVP Operacional):
1. **Collectors Reais** - Implementar collectors reais para databases, Redis, Vector DBs, Message Queues
2. **Sistema de Notificações** - Email, Slack, Webhooks para alertas proativos
3. **Melhorias no Catálogo** - Wizard UI, validação forte com Zod, templates por tipo
4. **Dashboard NOC Aprimorado** - Real-time updates (SSE), drill-down, alertas visuais

#### 🟡 IMPORTANTES (Fase 2 - Hardening):
5. **Segurança** - RBAC, Secrets Vault, Audit Log, HTTPS obrigatório
6. **Integrações** - Prometheus exporter, Grafana dashboards, SIEM
7. **Testes Automatizados** - Cobertura > 70% (unitários, integração, E2E)
8. **Novas Estratégias** - Agregação `weighted_score`, `quorum`, cooldown por regra

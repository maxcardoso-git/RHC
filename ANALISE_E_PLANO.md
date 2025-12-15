# Análise e Plano de Melhorias - RHC (Resource Health Checker)

## 📋 SUMÁRIO EXECUTIVO

O **RHC** é uma aplicação de monitoramento independente para NOC (Network Operations Center) que monitora a saúde de recursos críticos da infraestrutura. A aplicação está **funcionalmente completa**, mas possui gaps operacionais e conceituais que precisam ser resolvidos para uso em produção.

**Status Atual:** 🟡 Funcional em desenvolvimento, precisa de melhorias para produção

---

## 🎯 OBJETIVO DA APLICAÇÃO

Servir como **camada independente de monitoramento** para observar todos os recursos críticos:
- 🗄️ Bancos de Dados (PostgreSQL, MongoDB, etc)
- 🌐 APIs e Serviços HTTP (Health checks)
- ⚡ Serviços de Infraestrutura (Redis, RabbitMQ, etc)
- 🤖 Provedores de LLM (OpenAI, Anthropic, etc)
- 📊 Bancos de Dados Vetoriais (Pinecone, Weaviate, etc)

---

## ✅ O QUE ESTÁ FUNCIONANDO BEM

### 1. Arquitetura Core Sólida
- ✅ Separação clara de responsabilidades (API, Serviços, Collectors, Rules Engine)
- ✅ TypeScript com tipagem forte
- ✅ Fastify como framework web (performance)
- ✅ Sistema de logs estruturado (Pino)
- ✅ Frontend simples e funcional (sem dependências pesadas)

### 2. Sistema de Health Checks
- ✅ Engine de coleta de métricas funcionando
- ✅ Avaliação de regras (rule engine) implementada
- ✅ Estratégia de agregação (`worst_of`) funcional
- ✅ Suporte a checks manuais e agendados
- ✅ Histórico de checks mantido em memória

### 3. Funcionalidades Implementadas
- ✅ API REST completa (CRUD de recursos, checks, status, histórico)
- ✅ Scheduler com ISO-8601 intervals e jitter
- ✅ Dois tipos de UI: Tabela (operacional) e Dashboard (NOC grid)
- ✅ Suporte a internacionalização (pt-BR, en-US, es-ES)
- ✅ Integração básica com Resource Registry

---

## 🔴 PROBLEMAS CRÍTICOS IDENTIFICADOS

### 1. PERSISTÊNCIA DE DADOS
**Problema:** Tudo está em memória, dados são perdidos ao reiniciar
- ❌ Status, histórico de checks e recursos em memória volátil
- ❌ Limite artificial de 5000 checks por recurso
- ❌ Sem redundância ou backup
- ❌ Impossível fazer análises históricas de longo prazo

**Impacto:** 🔴 CRÍTICO - Inviável para produção

### 2. COLLECTORS SIMULADOS
**Problema:** Os collectors não fazem ping real na maioria dos recursos
- ❌ Database: Apenas retorna métricas falsas (não conecta no banco)
- ❌ Cache/Queue: Apenas retorna métricas default (não testa Redis)
- ❌ Vector DB: Apenas retorna métricas falsas
- ✅ HTTP Service: Funciona bem (único collector real)
- ⚠️ LLM Provider: Funciona mas é caro (faz chamada real à API)

**Impacto:** 🔴 CRÍTICO - Não monitora de verdade

### 3. CATÁLOGO MAL ESTRUTURADO
**Problema:** Sistema de catálogo confuso e manual
- ❌ Arquivo JSON manual difícil de gerenciar
- ❌ Falta validação forte na entrada de dados
- ❌ UI do catálogo é confusa (mix de campos estáticos e dinâmicos)
- ❌ Não há templates ou wizards para facilitar configuração
- ❌ Sem importação automática ou descoberta de recursos

**Impacto:** 🟡 ALTO - Dificulta adoção e manutenção

### 4. TELA DE STATUS LIMITADA
**Problema:** UI de status básica demais para NOC
- ❌ Sem agrupamento visual por criticidade
- ❌ Sem indicadores visuais de tendências (melhorando/piorando)
- ❌ Sem alertas visuais ou sonoros
- ❌ Dashboard Grid muito básico (sem drill-down)
- ❌ Sem filtros salvos ou views customizadas
- ❌ Auto-refresh pode ser otimizado (polling vs Server-Sent Events)

**Impacto:** 🟡 ALTO - Experiência de NOC inferior

### 5. SISTEMA DE NOTIFICAÇÕES AUSENTE
**Problema:** Não há alertas proativos
- ❌ Sem integração com email, Slack, Teams, PagerDuty
- ❌ Sem webhooks para eventos críticos
- ❌ Sem regras de escalonamento
- ❌ Operadores precisam ficar olhando a tela

**Impacto:** 🔴 CRÍTICO - Não é um monitor de verdade sem alertas

### 6. SEGURANÇA E AUTENTICAÇÃO
**Problema:** Segurança básica demais
- ❌ API Key opcional e simples
- ❌ Sem controle de acesso por recurso
- ❌ Sem audit log de quem fez o quê
- ❌ Credenciais em texto plano no catálogo JSON
- ❌ Sem HTTPS obrigatório

**Impacto:** 🟡 ALTO - Risco de segurança

### 7. FALTA DE TESTES
**Problema:** Zero testes automatizados
- ❌ Sem testes unitários
- ❌ Sem testes de integração
- ❌ Sem testes E2E
- ❌ Difícil garantir que mudanças não quebram funcionalidades

**Impacto:** 🟡 MÉDIO - Aumenta risco de bugs

---

## 📊 ANÁLISE CONCEITUAL

### Conceito Atual vs Necessário

| Aspecto | Estado Atual | Necessário para NOC |
|---------|--------------|---------------------|
| **Persistência** | Em memória (volátil) | PostgreSQL com histórico |
| **Collectors** | 80% simulados | 100% reais |
| **Alertas** | Nenhum | Email, Slack, webhooks |
| **Segurança** | API Key básica | RBAC, audit log, secrets vault |
| **UI** | Básica | Dashboard rico com drill-down |
| **Integrações** | Resource Registry (básico) | Grafana, Prometheus, SIEM |
| **Testes** | Zero | Cobertura > 70% |

---

## 🎯 PLANO DE AÇÃO - FASE 1 (MVP Operacional)

### Objetivo: Tornar a aplicação operacionalmente viável para NOC

**Prazo Estimado:** Desenvolvimento iterativo

---

### ✅ TAREFA 1: IMPLEMENTAR PERSISTÊNCIA POSTGRESQL

**Prioridade:** 🔴 CRÍTICA

**O que fazer:**
1. Criar schema de banco de dados:
   - Tabela `resources` (catálogo)
   - Tabela `health_status` (status atual)
   - Tabela `health_checks` (histórico)
   - Índices otimizados para queries comuns

2. Criar migrations (usando node-pg-migrate ou similar)

3. Implementar `PostgresStore` (substituir `memory-store.ts`):
   - Métodos CRUD para resources, status, checks
   - Connection pool
   - Error handling e retries
   - Manter cache em memória para leituras rápidas

4. Adicionar configuração de DATABASE_URL

5. Manter `MemoryStore` como fallback (modo dev)

**Arquivos a criar/modificar:**
- `src/stores/postgres-store.ts` (novo)
- `migrations/001_initial_schema.sql` (novo)
- `src/config/index.ts` (adicionar DATABASE_URL)
- `package.json` (adicionar dependência `pg`)

**Critério de sucesso:**
- [ ] Reiniciar aplicação não perde dados
- [ ] Queries de status < 100ms
- [ ] Histórico de checks mantido por 30+ dias

---

### ✅ TAREFA 2: IMPLEMENTAR COLLECTORS REAIS

**Prioridade:** 🔴 CRÍTICA

**O que fazer:**

#### 2.1 Database Collector (PostgreSQL, MongoDB)
```typescript
// Conectar no banco e fazer ping real
- PostgreSQL: SELECT 1 via node-postgres
- MongoDB: db.admin().ping() via mongodb driver
- MySQL: SELECT 1 via mysql2
```

#### 2.2 Redis/Cache Collector
```typescript
// Conectar e fazer PING
- Redis: redis.ping() via ioredis
- Memcached: stats via memcached
```

#### 2.3 Vector DB Collector
```typescript
// Testar conexão e query simples
- Pinecone: list indexes
- Weaviate: health endpoint
- Qdrant: health endpoint
```

#### 2.4 RabbitMQ/Message Queue Collector
```typescript
// Testar conexão e health
- RabbitMQ: management API /api/health/checks/alarms
- Kafka: admin.listTopics()
```

**Arquivos a modificar:**
- `src/collectors/database-collector.ts` (novo)
- `src/collectors/cache-collector.ts` (novo)
- `src/collectors/vector-db-collector.ts` (novo)
- `src/collectors/queue-collector.ts` (novo)
- `src/collectors/index.ts` (atualizar switch)

**Dependências a adicionar:**
```json
{
  "pg": "^8.11.0",
  "mongodb": "^6.3.0",
  "ioredis": "^5.3.2",
  "mysql2": "^3.9.0"
}
```

**Critério de sucesso:**
- [ ] Cada collector faz ping real no recurso
- [ ] Timeout de 5s é respeitado
- [ ] Credenciais são lidas do catálogo
- [ ] Erros de conexão são capturados e reportados

---

### ✅ TAREFA 3: MELHORAR O CATÁLOGO

**Prioridade:** 🟡 ALTA

**O que fazer:**

#### 3.1 Backend: Validação forte com Zod
```typescript
// Criar schemas de validação por tipo de recurso
const DatabaseResourceSchema = z.object({
  type: z.literal('database'),
  subtype: z.enum(['postgres', 'mongodb', 'mysql']),
  connection: z.object({
    host: z.string(),
    port: z.number(),
    database: z.string(),
    username: z.string(),
    password: z.string()
  })
});
```

#### 3.2 Frontend: Wizard de configuração
- Step 1: Escolher tipo de recurso (cards grandes com ícones)
- Step 2: Preencher campos específicos do tipo
- Step 3: Testar conexão (botão "Test Connection")
- Step 4: Configurar regras de health check
- Step 5: Revisar e salvar

#### 3.3 Templates pré-configurados
```json
{
  "postgres": {
    "default_metrics": ["connection_ok", "latency_ms"],
    "default_rules": [
      { "metric": "connection_ok", "operator": "==", "value": true, "status": "DOWN" }
    ],
    "default_schedule": "PT5M"
  }
}
```

**Arquivos a criar/modificar:**
- `src/domain/validation.ts` (novo - schemas Zod)
- `src/domain/templates.ts` (novo - templates por tipo)
- `public/catalog-wizard.html` (novo - wizard UI)
- `src/api/routes.ts` (adicionar validação)

**Critério de sucesso:**
- [ ] Não é possível salvar configuração inválida
- [ ] Wizard facilita criação de novos recursos
- [ ] Templates reduzem tempo de configuração
- [ ] Botão "Test Connection" funciona

---

### ✅ TAREFA 4: MELHORAR TELA DE STATUS (NOC)

**Prioridade:** 🟡 ALTA

**O que fazer:**

#### 4.1 Dashboard Grid aprimorado
```html
<!-- Adicionar -->
- Cards coloridos por criticidade (vermelho=critical, laranja=high, amarelo=medium)
- Indicador de tendência (⬆️ melhorando, ⬇️ piorando, ➡️ estável)
- Tempo desde última mudança de status
- Mini-gráfico sparkline dos últimos checks
- Drill-down: clicar no card abre modal com detalhes
```

#### 4.2 Alertas visuais e sonoros
```javascript
// Adicionar
- Badge de contador de recursos DOWN (vermelho piscante)
- Som de alerta quando novo DOWN é detectado (opcional, configurável)
- Notificação desktop (Web Notifications API)
```

#### 4.3 Filtros salvos e views
```javascript
// Permitir salvar combinações de filtros
const savedViews = [
  { name: "Critical Production", filters: { criticality: "critical", env: "prod" } },
  { name: "All Databases", filters: { type: "database" } }
];
```

#### 4.4 Server-Sent Events (substituir polling)
```typescript
// Backend: endpoint SSE
app.get('/api/v1/resource-health/status/stream', async (req, reply) => {
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  // Enviar eventos quando status mudar
});

// Frontend: conectar com EventSource
const events = new EventSource('/api/v1/resource-health/status/stream');
events.onmessage = (e) => updateDashboard(JSON.parse(e.data));
```

**Arquivos a criar/modificar:**
- `public/dashboard.html` (melhorar)
- `public/css/dashboard.css` (adicionar animações)
- `public/js/notifications.js` (novo - Web Notifications)
- `src/api/routes.ts` (adicionar endpoint SSE)

**Critério de sucesso:**
- [ ] Dashboard atualiza em tempo real (sem polling)
- [ ] Fácil identificar recursos críticos DOWN
- [ ] Drill-down mostra histórico e métricas
- [ ] Notificações desktop funcionam

---

### ✅ TAREFA 5: SISTEMA DE NOTIFICAÇÕES

**Prioridade:** 🔴 CRÍTICA

**O que fazer:**

#### 5.1 Engine de notificações
```typescript
// src/services/notification-service.ts
class NotificationService {
  async notify(event: HealthEvent, channels: NotificationChannel[]) {
    for (const channel of channels) {
      switch (channel.type) {
        case 'email': await this.sendEmail(event, channel);
        case 'slack': await this.sendSlack(event, channel);
        case 'webhook': await this.sendWebhook(event, channel);
      }
    }
  }
}
```

#### 5.2 Configuração de alertas por recurso
```json
{
  "resource_id": "prod-postgres",
  "alerts": [
    {
      "condition": "status == DOWN",
      "channels": ["slack-critical", "email-oncall"],
      "cooldown": "PT5M"
    },
    {
      "condition": "consecutive_failures > 3",
      "channels": ["slack-critical"],
      "escalate_after": "PT15M"
    }
  ]
}
```

#### 5.3 Integrações
- **Email:** Nodemailer com templates
- **Slack:** Webhook ou Slack API
- **Webhook:** HTTP POST genérico
- **Opcional:** PagerDuty, Teams, Discord

**Arquivos a criar:**
- `src/services/notification-service.ts` (novo)
- `src/integrations/email-notifier.ts` (novo)
- `src/integrations/slack-notifier.ts` (novo)
- `src/integrations/webhook-notifier.ts` (novo)
- `src/domain/types.ts` (adicionar tipos de notificação)

**Dependências:**
```json
{
  "nodemailer": "^6.9.0",
  "@slack/webhook": "^7.0.0"
}
```

**Critério de sucesso:**
- [ ] Email enviado quando recurso fica DOWN
- [ ] Slack recebe alerta em canal específico
- [ ] Cooldown previne spam de alertas
- [ ] Webhooks funcionam para integrações customizadas

---

## 🎯 PLANO DE AÇÃO - FASE 2 (Melhorias Operacionais)

### Objetivo: Melhorar segurança, observabilidade e manutenibilidade

---

### ✅ TAREFA 6: SEGURANÇA E AUTENTICAÇÃO

**Prioridade:** 🟡 ALTA

**O que fazer:**

1. **Vault de Secrets:**
   - Integrar com HashiCorp Vault ou AWS Secrets Manager
   - Credenciais de recursos não ficam em texto plano

2. **RBAC (Role-Based Access Control):**
   - Roles: `admin`, `operator`, `viewer`
   - Permissões por recurso e ação

3. **Audit Log:**
   - Logar todas as ações (quem criou/editou/deletou recursos)
   - Logar quem executou checks manuais

4. **HTTPS obrigatório:**
   - Configuração de certificados TLS
   - Redirect HTTP → HTTPS

**Arquivos a criar:**
- `src/services/secrets-manager.ts` (novo)
- `src/middleware/auth.ts` (novo - RBAC)
- `src/services/audit-log.ts` (novo)

---

### ✅ TAREFA 7: INTEGRAÇÕES EXTERNAS

**Prioridade:** 🟡 MÉDIA

**O que fazer:**

1. **Prometheus Exporter:**
   - Endpoint `/metrics` no formato Prometheus
   - Métricas: `resource_health_status`, `check_duration_ms`, etc.

2. **Grafana Dashboard:**
   - Template de dashboard pronto
   - Gráficos de disponibilidade por recurso

3. **SIEM Integration:**
   - Enviar logs estruturados para Splunk, ELK, etc.

**Arquivos a criar:**
- `src/api/metrics.ts` (novo - Prometheus exporter)
- `grafana/dashboard.json` (novo - template Grafana)

---

### ✅ TAREFA 8: TESTES AUTOMATIZADOS

**Prioridade:** 🟡 MÉDIA

**O que fazer:**

1. **Setup de testes:**
   ```json
   {
     "vitest": "^1.0.0",
     "@types/supertest": "^6.0.0",
     "supertest": "^6.3.0"
   }
   ```

2. **Testes unitários:**
   - `rule-engine.test.ts`
   - `health-service.test.ts`
   - `catalog-service.test.ts`

3. **Testes de integração:**
   - `api.routes.test.ts` (testar endpoints)
   - `collectors.test.ts` (testar collectors com mocks)

4. **Testes E2E:**
   - `dashboard.spec.ts` (usando Playwright)

**Arquivos a criar:**
- `tests/unit/*.test.ts`
- `tests/integration/*.test.ts`
- `tests/e2e/*.spec.ts`

---

## 📈 MÉTRICAS DE SUCESSO

| Métrica | Objetivo |
|---------|----------|
| **Uptime da aplicação RHC** | > 99.5% |
| **Tempo de resposta API** | < 200ms (p95) |
| **Latência de checks** | < 5s |
| **Cobertura de testes** | > 70% |
| **Tempo para detectar DOWN** | < 1 minuto |
| **Falsos positivos** | < 1% |
| **Recursos monitorados** | > 50 (inicial) |

---

## 🚀 ROADMAP DE IMPLEMENTAÇÃO

### Sprint 1 (Fundação)
- [ ] Tarefa 1: PostgreSQL persistence
- [ ] Tarefa 2: Collectors reais (database, redis)

### Sprint 2 (Operacional)
- [ ] Tarefa 2: Collectors reais (vector db, queues)
- [ ] Tarefa 5: Sistema de notificações

### Sprint 3 (UX)
- [ ] Tarefa 3: Melhorar catálogo
- [ ] Tarefa 4: Melhorar dashboard

### Sprint 4 (Hardening)
- [ ] Tarefa 6: Segurança
- [ ] Tarefa 7: Integrações
- [ ] Tarefa 8: Testes

---

## 💡 RECOMENDAÇÕES ADICIONAIS

### Curto Prazo
1. **Documentação:** Criar `README.md` com instruções de setup
2. **Docker Compose:** Facilitar desenvolvimento local com banco
3. **CI/CD:** GitHub Actions para build e testes

### Médio Prazo
1. **Descoberta automática:** Scan de rede para descobrir recursos
2. **Machine Learning:** Predição de falhas baseada em histórico
3. **Correlação de eventos:** Detectar cascata de falhas

### Longo Prazo
1. **Multi-tenancy:** Suportar múltiplos ambientes/clientes
2. **Alta disponibilidade:** Cluster do RHC com load balancer
3. **API pública:** SDK para integração com outras ferramentas

---

## ⚠️ RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Perda de dados (memória) | Alta | Crítico | ✅ Implementar PostgreSQL (Tarefa 1) |
| Collectors lentos travam sistema | Média | Alto | ✅ Timeout de 5s + circuit breaker |
| Credenciais expostas | Média | Crítico | ✅ Secrets vault (Tarefa 6) |
| Spam de alertas | Média | Médio | ✅ Cooldown e rate limiting |
| RHC fica DOWN e ninguém sabe | Baixa | Crítico | ✅ Meta-monitoring (monitorar o monitor) |

---

## 📞 PRÓXIMOS PASSOS

1. **Revisar e aprovar este plano**
2. **Priorizar tarefas** conforme necessidade do negócio
3. **Definir time e alocação** de recursos
4. **Começar pela Fase 1** (MVP Operacional)
5. **Iteração contínua** com feedback de operadores do NOC

---

## 📄 APÊNDICE: ARQUITETURA PROPOSTA

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (NOC)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Dashboard  │  │ Status Table │  │ Catalog Mgmt  │  │
│  │   (Grid)    │  │  (Detail)    │  │   (Wizard)    │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ REST API + SSE
┌────────────────────────┴────────────────────────────────┐
│                    API LAYER (Fastify)                  │
│  /status  /check  /catalog  /metrics  /stream          │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                  BUSINESS LOGIC LAYER                   │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────┐  │
│  │   Health     │  │   Catalog      │  │Notification│  │
│  │   Service    │  │   Service      │  │  Service   │  │
│  └──────┬───────┘  └────────────────┘  └────────────┘  │
│         │                                               │
│  ┌──────┴──────────────────────┐                       │
│  │     Rule Engine              │                       │
│  │  (Evaluate metrics → status) │                       │
│  └──────┬──────────────────────┘                       │
└─────────┼──────────────────────────────────────────────┘
          │
┌─────────┴──────────────────────────────────────────────┐
│              COLLECTORS (Ping Resources)               │
│  ┌──────────┐ ┌───────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Database │ │ Redis │ │ HTTP     │ │ Vector DB    │ │
│  │ Collector│ │Collect│ │ Collector│ │ Collector    │ │
│  └──────────┘ └───────┘ └──────────┘ └──────────────┘ │
└────────────────────────┬───────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│               DATA LAYER (PostgreSQL)                   │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ resources  │  │ health_status│  │ health_checks  │  │
│  │  (catalog) │  │   (current)  │  │   (history)    │  │
│  └────────────┘  └──────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                WORKER LAYER (Background)                │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Scheduler (executa checks a cada N segundos)    │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│              INTEGRATIONS (Outbound)                    │
│  ┌────────┐  ┌────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Email  │  │ Slack  │  │ Webhook  │  │ Prometheus │  │
│  └────────┘  └────────┘  └──────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

**Documento criado em:** 2025-12-15
**Versão:** 1.0
**Autor:** Análise automatizada do codebase RHC

# 🏗️ Arquitectura Enterprise Escalable - MCP Novasoft

## Visión Actual

Sistema de chat basado en IA que:
- ✅ Conecta a múltiples servidores SQL Server
- ✅ Clasifica automáticamente consultas (chat vs SQL)
- ✅ Genera SQL legible con JOINs automáticos
- ✅ Cachea esquemas cada 10 minutos
- ✅ Persiste 20 últimos mensajes en localStorage

## 🎯 Objetivo: Extensibilidad Sin Reescritura

El sistema está diseñado para crecer a:
- 🔐 **Active Directory** (gestionar usuarios, permisos)
- 📊 **Azure DevOps** (gestionar releases, pipeline info)
- 📈 **Analytics Services** (análisis de datos)
- 🔌 **Custom Connectors** (futuros servicios)

---

## 🏛️ Patrón de Arquitectura: Connectors → Resolvers → Gateway → Client

```
┌─────────────────────────────────────────────────────────────┐
│                   FRONTEND (React)                          │
│              localStorage (20-msg history)                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND EXPRESS (REST)                         │
│                   Port 3000                                 │
│          Validates auth, forwards to Gateway                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   GATEWAY (Orchestrator)                    │
│                   Port 4000                                 │
│     ┌────────────────────────────────────────────┐         │
│     │ 1. Fast-Path Router (admin queries)        │         │
│     │ 2. Intent Classification (SQL vs Chat)     │         │
│     │ 3. Chart Detection (strict rules)          │         │
│     │ 4. SQL Generation (with schema + FK)       │         │
│     └────────────────────────────────────────────┘         │
│                                                             │
│  ┌──────────────────┬─────────────────┬─────────────┐     │
│  │                  │                 │             │     │
│  ▼                  ▼                 ▼             ▼     │
│ SQL Router    AD Router         DevOps Router    Chat      │
│ (calls        (calls             (calls         (calls    │
│  Resolver)     Resolver)          Resolver)      OpenAI)  │
└──────┬──────────────┬──────────────────┬─────────────────────┘
       │              │                  │
       ▼              ▼                  ▼
   ┌─────────────────────────────────────────────────────┐
   │          RESOLVERS + CONNECTORS                     │
   │                                                     │
   │  SQL:          AD:             DevOps:            │
   │  ├─Resolver    ├─Resolver      ├─Resolver        │
   │  │ (server?)   │ (user?)        │ (project?)      │
   │  └─Connector   └─Connector      └─Connector       │
   │   (mcp-sql:    (MS Graph API)   (Azure DevOps)   │
   │    5000)                                           │
   │                                                     │
   │  ┌─────────────────────────────────────┐          │
   │  │ Shared Cache (10 min refresh)       │          │
   │  │ ├─ Schemas                          │          │
   │  │ ├─ Relations                        │          │
   │  │ ├─ AD Groups                        │          │
   │  │ └─ DevOps Projects                  │          │
   │  └─────────────────────────────────────┘          │
   │                                                     │
   └──────────────────────────────────────────────────────┘
```

---

## 📁 Estructura de Carpetas (Target)

```
mcp-novasoft/
├── backend/                    # Express server (port 3000)
│   └── src/index.js
│
├── frontend/                   # React + Vite (port 3000 dev)
│   ├── src/
│   │   ├── pages/Chat.jsx
│   │   └── components/
│   └── vite.config.js
│
├── gateway/                    # Main orchestrator (port 4000)
│   ├── src/
│   │   ├── index.js           # Main entry + routes
│   │   ├── router.js          # Fast-path + intent classification
│   │   └── cache.js           # Shared cache management
│   └── package.json
│
├── connectors/
│   ├── sql/
│   │   ├── index.js           # SQL Server connector service
│   │   ├── schema.js          # Schema fetching + caching
│   │   ├── query.js           # Query execution
│   │   └── package.json       # (runs on port 5000)
│   │
│   ├── ad/                    # [PLACEHOLDER] Active Directory
│   │   ├── index.js           # AD connector service
│   │   ├── auth.js            # Token + MSAL integration
│   │   ├── users.js           # User lookup, groups
│   │   └── package.json       # (runs on port 7000)
│   │
│   └── devops/                # [PLACEHOLDER] Azure DevOps
│       ├── index.js           # DevOps connector service
│       ├── projects.js        # Project + release info
│       ├── builds.js          # Build pipeline status
│       └── package.json       # (runs on port 8000)
│
├── resolvers/
│   ├── sql/
│   │   ├── index.js           # SQL context resolver (port 6000)
│   │   └── database-resolver.js
│   │
│   ├── ad/                    # [PLACEHOLDER]
│   │   └── index.js           # AD context resolver
│   │
│   └── devops/                # [PLACEHOLDER]
│       └── index.js           # DevOps context resolver
│
├── lib/
│   ├── cache.js               # Shared cache utility
│   ├── logger.js              # Logging utility
│   └── errors.js              # Custom error classes
│
├── docker-compose.yml         # All services + volumes + networks
├── .env                       # Global config
├── README.md
└── test.ps1                   # Quick test script
```

---

## 🔌 Interface Estándar para Connectors

Cada conector expone:

```javascript
// GET /health
{ ok: true, service: "connector-name" }

// POST /query (SQL-specific)
{
  query: "SELECT ...",
  connection: { server, database }
}

// GET /schema?server=X&database=Y (SQL-specific)
{
  success: true,
  schema: { "table1": [...columns], "table2": [...columns] }
}

// GET /databases?server=X
{
  databases: ["db1", "db2", ...]
}

// GET /databases/all
{
  servers: {
    "sql-01": ["db1", "db2"],
    "sql-02": ["db3", "db4"],
    ...
  }
}
```

---

## 🔍 Interface Estándar para Resolvers

Cada resolver expone:

```javascript
// GET /health
{ ok: true, service: "resolver-name" }

// POST /resolve
// Input:
{
  message: "¿Cuántos clientes hay en sql-03?",
  context: {
    currentServer: "sql-03",
    currentDatabase: "empresa1"
  }
}

// Output (success):
{
  resolved: true,
  target: {
    server: "sql-03",
    database: "prueba_mcp",
    table: "clientes"
  }
}

// Output (ambiguous):
{
  resolved: false,
  ambiguity: true,
  message: "¿En cuál servidor deseas consultar?",
  options: ["sql-01", "sql-02", "sql-03"]
}

// Output (error):
{
  resolved: false,
  message: "No se puede resolver el contexto"
}
```

---

## 🚀 Flujo: Request → Response

### 1️⃣ Request llega a Gateway

```json
{
  "message": "¿Cuántos clientes hay en sql-03?",
  "context": {
    "history": [...]
  }
}
```

### 2️⃣ Gateway clasifica intención

```javascript
detectAdminQuery(message)           // ⚡ Fast-path?
classifyIntent(message)             // SQL vs Chat?
detectChartIntent(message)          // ¿Quiere gráfica?
```

### 3️⃣ Si es SQL, resolver contexto

```javascript
resolveContext(message, context)    // ¿Cuál server/db?
```

### 4️⃣ Fetch esquema (con caché)

```javascript
getSchemaWithRelations(server, db)  // Tablas + FKs
```

### 5️⃣ Generar SQL con IA

```javascript
generateSQL(message, schema, history) // LLM genera T-SQL legible
```

### 6️⃣ Ejecutar en Connector

```javascript
fetch(`${CONNECTOR_URL}/query`, { query, connection })
```

### 7️⃣ Formatear respuesta

```json
{
  "type": "success",
  "response": "📊 Resultado:\n| Cliente | Cantidad |\n...",
  "source": "sql",
  "data": [...],
  "wantsChart": false,
  "metadata": { "query": "...", "rowCount": 5 }
}
```

---

## 🔐 Seguridad & Permisos (Futuro)

```javascript
// En Gateway, agregar middleware de autorización
app.use(authenticateJWT);
app.use(authorizeByRole);  // SQL vs AD vs DevOps

// Cada resolver valida permisos
async function resolveContext(message, context, user) {
  // ¿Tiene permiso el usuario para acceder a sql-03?
  const hasAccess = await checkAccess(user, server);
  if (!hasAccess) {
    return { 
      resolved: false, 
      message: "No tienes permiso para acceder a este servidor"
    };
  }
  // ...resolver normalmente
}
```

---

## 📊 Cache Strategy

```javascript
const schemaCache = new Map();
const relationsCache = new Map();
const adGroupsCache = new Map();
const devopsProjectsCache = new Map();

// Refresh cada 10 minutos por recurso
setInterval(() => {
  for (const cacheKey of schemaCache.keys()) {
    const [server, database] = cacheKey.split("::");
    refreshSchema(server, database);
  }
}, 10 * 60 * 1000);
```

---

## 🧪 Testing en Cada Layer

### Layer 1: Connectors
```bash
# Test SQL Connector
curl http://localhost:5000/health
curl http://localhost:5000/databases/all
curl http://localhost:5000/schema?server=sql-03&database=prueba_mcp
```

### Layer 2: Resolvers
```bash
# Test SQL Resolver
curl -X POST http://localhost:6000/resolve \
  -H "Content-Type: application/json" \
  -d '{"message": "¿Cuántos hay en sql-03?", "context": {}}'
```

### Layer 3: Gateway
```bash
# Test Fast-Path
curl -X POST http://localhost:4000/execute \
  -H "Content-Type: application/json" \
  -d '{"message": "Lista bases de datos", "context": {}}'

# Test SQL Query
curl -X POST http://localhost:4000/execute \
  -H "Content-Type: application/json" \
  -d '{"message": "¿Cuántos clientes hay?", "context": {}}'
```

### Layer 4: Frontend
```bash
# En browser, abrir http://localhost:3000
# Y testear chat normal
```

---

## 🎓 Próximos Pasos

### ✅ Done
- [x] Fast-path router (admin queries)
- [x] SQL multi-server support
- [x] Schema caching (10 min refresh)
- [x] Message persistence (localStorage)
- [x] Table rendering (responsive)

### 🔄 In Progress
- [ ] Docker build fix (npm SSL → done in Dockerfiles)
- [ ] Complete Postman validation
- [ ] End-to-end test in local

### ⏳ Next Phase
- [ ] AD Connector (placeholder + basic auth)
- [ ] AD Resolver
- [ ] DevOps Connector
- [ ] DevOps Resolver
- [ ] Authorization layer
- [ ] Comprehensive docs

---

## 🚨 Error Handling

```javascript
// Standardized errors
{
  "type": "error",
  "message": "User-friendly message",
  "details": "Technical details",
  "source": "connector|resolver|gateway|chat"
}

// Ambiguity handling
{
  "type": "ambiguity",
  "message": "¿En cuál servidor deseas consultar?",
  "options": ["sql-01", "sql-02", "sql-03"]
}

// Timeout handling
{
  "type": "timeout",
  "message": "La consulta tardó más de lo esperado",
  "retryAfter": 30
}
```

---

## 📈 Performance Targets

- ⚡ Health check: < 100ms
- ⚡ Fast-path (list databases): < 500ms
- ⚡ SQL query (simple): < 2s
- ⚡ SQL query (complex with joins): < 5s
- 📊 Schema cache hit: < 50ms
- 💾 Persistence (localStorage): instant

---

## 🤝 Integration Points

### External Services
- **Azure OpenAI**: LLM for intent classification + SQL generation
- **SQL Server**: Data source (multi-server)
- **MS Graph API**: User + AD info (future)
- **Azure DevOps API**: Release + pipeline info (future)

### Internal Services
- **Backend** ↔ **Gateway**: REST
- **Gateway** ↔ **Connectors**: REST
- **Gateway** ↔ **Resolvers**: REST
- **Frontend** ↔ **Backend**: REST

---

Documento de referencia para mantener escalabilidad sin reescritura.

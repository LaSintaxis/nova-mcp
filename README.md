# 🚀 MCP-Novasoft: AI Chat System con Multi-Servidor SQL

## 📋 Tabla de Contenidos

- [Quick Start](#quick-start)
- [Arquitectura](#arquitectura)
- [APIs](#apis)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## ⚡ Quick Start

### 1. Pre-requisitos

- Node.js 20+ (con npm)
- SQL Server 2019+
- Azure OpenAI API key (para IA)
- Docker (opcional, para prod)

### 2. Configurar variables de entorno

#### `gateway/.env`
```env
AZURE_OPENAI_ENDPOINT=https://your-instance.openai.azure.com/
AZURE_OPENAI_API_KEY=your-key-here
AZURE_OPENAI_DEPLOYMENT=gpt-4.1-mini
AZURE_OPENAI_API_VERSION=2024-12-01-preview
MCP_SQL_URL=http://localhost:5000
CONTEXT_RESOLVER_URL=http://localhost:6000
```

#### `mcp-sql/.env`
```env
# Servidor 1
SQL_SERVER_01=server1.domain.com
SQL_USER_01=sa
SQL_PASSWORD_01=YourPassword123!
SQL_DATABASE_01=empresa1

# Servidor 2
SQL_SERVER_02=server2.domain.com
SQL_USER_02=sa
SQL_PASSWORD_02=YourPassword123!
SQL_DATABASE_02=empresa2

# Servidor 3
SQL_SERVER_03=server3.domain.com
SQL_USER_03=sa
SQL_PASSWORD_03=YourPassword123!
SQL_DATABASE_03=prueba_mcp
```

#### `context-resolver/.env`
```env
MCP_SQL_URL=http://localhost:5000
```

#### `backend/.env`
```env
GATEWAY_URL=http://localhost:4000
```

#### `frontend/.env`
```env
VITE_BACKEND_URL=http://localhost:3000
```

### 3. Instalar dependencias

```bash
# Gateway
cd gateway && npm install && cd ..

# SQL Connector
cd mcp-sql && npm install && cd ..

# Context Resolver
cd context-resolver && npm install && cd ..

# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

### 4. Iniciar servicios (terminal separadas)

**Terminal 1: SQL Connector (puerto 5000)**
```bash
cd mcp-sql
npm start
# Output: 🚀 MCP-SQL corriendo en puerto 5000
```

**Terminal 2: Context Resolver (puerto 6000)**
```bash
cd context-resolver
npm start
# Output: 🚀 Context Resolver corriendo en puerto 6000
```

**Terminal 3: Gateway (puerto 4000)**
```bash
cd gateway
npm start
# Output: 🚀 MCP Gateway corriendo en puerto 4000
```

**Terminal 4: Backend (puerto 3000)**
```bash
cd backend
npm start
# Output: 🚀 Backend corriendo en puerto 3000
```

**Terminal 5: Frontend (puerto 3000 dev)**
```bash
cd frontend
npm run dev
# Output: ➜  Local:   http://localhost:5173/
```

### 5. Probar en browser

Abre http://localhost:5173 (Vite dev) o http://localhost:3000 (prod)

---

## 🏛️ Arquitectura

```
Frontend (React 19 + Vite)
    ↓
Backend (Express, port 3000)
    ↓
Gateway (Orchestrator, port 4000)
    ├→ Fast-Path Router (admin queries)
    ├→ Intent Classifier (SQL vs Chat)
    ├→ Chart Detector (strict keywords)
    └→ SQL Generator (with schema + FK)
    ↓
Resolvers + Connectors
    ├→ SQL Resolver (port 6000) ↔ SQL Connector (port 5000)
    ├→ AD Resolver [placeholder] ↔ AD Connector
    └→ DevOps Resolver [placeholder] ↔ DevOps Connector
```

### Componentes

| Servicio | Puerto | Función |
|----------|--------|---------|
| Frontend | 3000 | UI React |
| Backend | 3000 | REST API + CORS |
| Gateway | 4000 | Orquestador principal |
| SQL Connector | 5000 | Conexión a SQL Server |
| Context Resolver | 6000 | Resolución de contexto (server/db) |

---

## 📡 APIs

### Gateway `/execute` (Main Entry Point)

**POST** `/execute`

**Request:**
```json
{
  "message": "¿Cuántos clientes hay en sql-03?",
  "context": {
    "history": [
      { "role": "user", "content": "..." },
      { "role": "assistant", "content": "..." }
    ]
  }
}
```

**Response (Success - SQL Query):**
```json
{
  "type": "success",
  "response": "📊 **Resultado de la consulta:**\n\nSe encontraron 42 registros.\n\n| Cliente | Cantidad |\n|---|---|\n| Acme Corp | 150 |\n...",
  "source": "sql",
  "data": [...],
  "wantsChart": false,
  "metadata": {
    "query": "SELECT ...",
    "database": "prueba_mcp",
    "rowCount": 42
  }
}
```

**Response (Success - Chat):**
```json
{
  "type": "success",
  "response": "Hola! Soy Novachat, tu asistente de infraestructura...",
  "source": "chat"
}
```

**Response (Success - Admin Fast-Path):**
```json
{
  "type": "success",
  "response": "📊 **Servidores y bases de datos disponibles:**\n\n**sql-01**: db1, db2\n**sql-02**: db3, db4\n**sql-03**: prueba_mcp\n",
  "source": "admin"
}
```

**Response (Ambiguity):**
```json
{
  "type": "ambiguity",
  "message": "¿En cuál servidor deseas consultar?",
  "options": ["sql-01", "sql-02", "sql-03"]
}
```

**Response (Error):**
```json
{
  "type": "error",
  "message": "Error interno en el gateway",
  "details": "..."
}
```

---

### SQL Connector

**GET** `/health`
```json
{ "ok": true, "service": "mcp-sql" }
```

**GET** `/databases/all`
```json
{
  "servers": {
    "sql-01": ["db1", "db2"],
    "sql-02": ["db3", "db4"],
    "sql-03": ["prueba_mcp"]
  }
}
```

**GET** `/databases?server=sql-03`
```json
{
  "server": "sql-03",
  "databases": ["prueba_mcp", "master", "msdb"]
}
```

**GET** `/schema?server=sql-03&database=prueba_mcp`
```json
{
  "success": true,
  "schema": {
    "clientes": [
      { "name": "Id", "type": "int" },
      { "name": "Nombre", "type": "nvarchar" }
    ],
    "pedidos": [...]
  }
}
```

**POST** `/query`
```json
{
  "query": "SELECT TOP 10 * FROM clientes",
  "connection": {
    "server": "sql-03",
    "database": "prueba_mcp"
  }
}
```

Response:
```json
{
  "success": true,
  "data": [
    { "Id": 1, "Nombre": "Acme Corp" },
    { "Id": 2, "Nombre": "Tech Inc" }
  ],
  "rowCount": 2
}
```

---

### Context Resolver

**GET** `/health`
```json
{ "ok": true, "service": "context-resolver" }
```

**POST** `/resolve`

Request:
```json
{
  "message": "¿Cuántos clientes hay en sql-03?",
  "context": {}
}
```

Response (Resolved):
```json
{
  "resolved": true,
  "target": {
    "server": "sql-03",
    "database": "prueba_mcp",
    "table": "clientes"
  }
}
```

Response (Ambiguous):
```json
{
  "resolved": false,
  "ambiguity": true,
  "message": "¿En cuál servidor deseas consultar?",
  "options": ["sql-01", "sql-02", "sql-03"]
}
```

---

## 🧪 Testing

### Script Rápido (PowerShell)

```bash
.\test.ps1
```

Verifica:
- ✅ Health checks (todos los servicios)
- ✅ SQL Connector (listar bases de datos)
- ✅ Fast-path router (queries admin)
- ✅ SQL queries (generación y ejecución)
- ✅ Chat (conversación general)

### Manual con curl/Postman

**1. Verificar servicios**
```bash
curl http://localhost:5000/health
curl http://localhost:6000/health
curl http://localhost:4000/health
curl http://localhost:3000/health
```

**2. Listar todas las bases de datos**
```bash
curl http://localhost:5000/databases/all
```

**3. Listar bases de un servidor específico**
```bash
curl "http://localhost:5000/databases?server=sql-03"
```

**4. Prueba fast-path (sin OpenAI, respuesta rápida)**
```bash
curl -X POST http://localhost:4000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Cuáles son las bases de datos disponibles?",
    "context": {}
  }'
```

**5. Prueba SQL query**
```bash
curl -X POST http://localhost:4000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Cuántos clientes hay?",
    "context": {"history": []}
  }'
```

**6. Prueba chat (conversación general)**
```bash
curl -X POST http://localhost:4000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hola, ¿cómo estás?",
    "context": {"history": []}
  }'
```

---

## 🐳 Docker (Producción)

### Build & Run

```bash
# Build todas las imágenes
docker compose build

# Iniciar todos los servicios
docker compose up -d

# Ver logs
docker compose logs -f

# Detener
docker compose down
```

### Servicios en Docker

- **backend**: localhost:3000
- **gateway**: localhost:4000
- **mcp-sql**: localhost:5000
- **context-resolver**: localhost:6000
- **frontend**: Accesible via backend (CORS habilitado)

---

## 🔧 Troubleshooting

### Error: "Cannot find module"

**Solución:**
```bash
# Limpiar e instalar de nuevo
rm -r node_modules package-lock.json
npm install
```

### Error: "ECONNREFUSED localhost:5000"

**Verificar:**
- ¿SQL Connector está corriendo? `npm start` en `mcp-sql/`
- ¿Puerto 5000 está disponible? `netstat -ano | findstr :5000` (Windows)

### Error: "Azure OpenAI timeout"

**Verificar:**
- ¿Variables de entorno `.env` están correctas?
- ¿API Key es válida?
- ¿Endpoint responde? `curl https://your-instance.openai.azure.com/`

### Error: "SQL Server authentication failed"

**Verificar:**
- Credenciales en `mcp-sql/.env` correctas
- SQL Server accesible desde tu máquina
- Puerto 1433 abierto (si es remoto)

### Chat lento o timeout

**Posibles causas:**
- Azure OpenAI respondiendo lentamente → aumenta timeout en fetch (ahora: 10s)
- Query SQL compleja → añade índices en BD
- Red lenta → testea conexión a SQL Server directamente

---

## 📚 Documentación Adicional

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Diseño escalable, próximos pasos (AD, DevOps)
- **[Postman Collection](./Postman_Collection.json)**: Requests pre-configuradas para probar
- **[dependences.md](./dependences.md)**: Stack técnico y versiones

---

## ✅ Checklist de Despliegue

- [ ] Todas las variables `.env` configuradas
- [ ] SQL Server accesible y credenciales verificadas
- [ ] Azure OpenAI API key funciona
- [ ] Node.js 20+ instalado
- [ ] Todos los servicios inician sin errores
- [ ] Health checks responden en `localhost:**** /health`
- [ ] Test script (`test.ps1`) pasa
- [ ] Frontend carga en navegador
- [ ] Chat responde (ambos modos: SQL y general)

---

## 🚀 Próximos Pasos

1. ✅ **Ahora**: Correr localmente sin Docker, validar flujo completo
2. 🔄 **Fase 2**: Agregar AD Connector para gestión de usuarios
3. 🔄 **Fase 3**: Agregar DevOps Connector para releases/pipelines
4. 🔄 **Fase 4**: Authorization layer (qué usuario puede acceder a qué servidor)
5. 🔄 **Fase 5**: Desplegar en Kubernetes (escalabilidad)

---

**Última actualización:** 2024
**Versión:** 1.0-enterprise-ready

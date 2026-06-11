# MCP Novasoft

Aplicación de chat inteligente con integración de Azure OpenAI y acceso a bases de datos SQL Server. Arquitectura de microservicios con frontend React y backends Node.js.

## 📋 Tabla de Contenidos

- [Descripción](#descripción)
- [Requisitos Previos](#requisitos-previos)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Instalación y Configuración](#instalación-y-configuración)
- [Uso](#uso)
- [Variables de Entorno](#variables-de-entorno)
- [Servicios](#servicios)
- [Desarrollo](#desarrollo)

## Descripción

MCP Novasoft es una plataforma de chat inteligente que integra:

- **Azure OpenAI**: Para procesamiento de lenguaje natural y generación de respuestas
- **Microsoft Entra ID**: Autenticación empresarial mediante MSAL
- **SQL Server Managment Studio**: Acceso a múltiples servidores de BDs SQL
- **Arquitectura de Microservicios**: Frontend desacoplado, gateway centralizado y escabilidad de agregar otros servicios

## Requisitos Previos

- **Docker** y **Docker Compose** (v1.29+)
- **Node.js** 18+ (para desarrollo local)
- **npm** 9+
- **Credenciales Azure**:
  - Azure OpenAI endpoint y API key
  - Entra ID (Tenant ID, Client ID)
  - Acceso a SQL Server

## Estructura del Proyecto

```
mcp/
├── frontend/              # Aplicación React + Vite
├── gateway/              # API Gateway Express.js
├── mcp-sql/             # Microservicio SQL Server Express.js
├── docker-compose.yml   # Orquestación de servicios
└── package.json         # Dependencias del proyecto
```

### Frontend
- **Tecnologías**: React 19, Vite, Azure MSAL
- **Puerto**: 5173
- **Funcionalidad**: Interfaz de usuario, autenticación con Microsoft Entra ID

### Gateway
- **Tecnologías**: Express.js, OpenAI SDK, JWT
- **Puerto**: 3000
- **Funcionalidad**: Autenticación, orquestación de llamadas a OpenAI, enrutamiento a microservicios

### MCP-SQL
- **Tecnologías**: Express.js, MSSQL
- **Puerto**: 3002
- **Funcionalidad**: Conexión y consultas a bases de datos SQL Server

## Instalación y Configuración

### Paso 1: Clonar el Repositorio

```bash
git clone https://github.com/LaSintaxis/nova-mcp.git
cd nova-mcp
```

### Paso 2: Configurar Variables de Entorno

En el documento de word 'MCP-Doc.docx' se estipulan las variables de entorno con sus valores necesarios para cada microservicio. Copiarlos y pegarlos en un archivo .env en la raiz de cada carpeta


### Paso 4: Levantar los Servicios

```bash
npm run docker:up
```

## Servicios
Los servicios estarán disponibles en:
- ### Frontend: http://localhost:5173:
- Interfaz web del chat
- Autenticación con Azure AD
- Visualización de métricas
- Compatible con Docker y Nginx
- ### Gateway: http://localhost:3000:
- API REST central
- Autenticación y autorización
- Integración con Azure OpenAI
- Middleware de CORS
- ### MCP-SQL: http://localhost:3002:
- Microservicio de consultas SQL
- Soporte para múltiples servidores SQL
- Modelo de conexión escalable

## 📖 Uso

### Ejecución con Docker

```bash
# Iniciar todos los servicios
npm run docker:up

# Detener todos los servicios
npm run docker:down

# Reiniciar (reconstruir imágenes)
npm run docker:up
```

### Ejecución en Desarrollo Local

```bash
# Ejecutar todos los servicios en modo desarrollo
npm run dev:all

# O ejecutar servicios individualmente
npm run dev --prefix frontend
npm run dev --prefix gateway
npm run dev --prefix mcp-sql
```

## Desarrollo

### Estructura de Carpetas - Frontend
```
frontend/src/
├── components/          # Componentes React reutilizables
├── pages/              # Páginas principales
├── auth/              # Configuración Azure MSAL
└── styles/            # CSS modular
```

### Estructura de Carpetas - Gateway
```
gateway/src/
├── middleware/         # Middleware de Express
└── index.js           # Punto de entrada
```

### Instalar Dependencias Locales

```bash
# Frontend
npm install --prefix frontend

# Gateway
npm install --prefix gateway

# MCP-SQL
npm install --prefix mcp-sql
```

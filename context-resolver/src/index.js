import express from "express";
import fetch from "node-fetch";

const MCP_SQL_URL = process.env.MCP_SQL_URL || "http://localhost:5000";
const DEFAULT_SERVER = process.env.DEFAULT_SQL_SERVER || "sql-01";
const DEFAULT_DATABASE = process.env.DEFAULT_SQL_DATABASE || "master";
const CACHE_REFRESH_MS = 10 * 60 * 1000;

const app = express();
app.use(express.json());

let cache = {
  servers: [],
  databasesByServer: new Map(),
  dbToServers: new Map(),
  lastUpdated: 0
};

function normalizeDatabaseList(databases) {
  return databases.map(db => ({
    name: db.name || db.NAME || db.database || db.Database,
    raw: db
  })).filter(db => db.name);
}

//obtiene todas las bases de datos 
async function fetchAllDatabases() {
  const response = await fetch(`${MCP_SQL_URL}/databases/all`);
  const data = await response.json();
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "No se pudo obtener bases de datos");
  }
  return data.servers || [];
}

async function refreshCache() {
  const serversData = await fetchAllDatabases();
  const databasesByServer = new Map();
  const dbToServers = new Map();
  const servers = [];

  serversData.forEach(entry => {
    if (!entry.server) return;
    servers.push(entry.server);
    const normalized = normalizeDatabaseList(entry.databases || []);
    databasesByServer.set(entry.server, normalized);
    normalized.forEach(db => {
      const key = db.name.toLowerCase();
      if (!dbToServers.has(key)) {
        dbToServers.set(key, []);
      }
      dbToServers.get(key).push(entry.server);
    });
  });

  cache = {
    servers,
    databasesByServer,
    dbToServers,
    lastUpdated: Date.now()
  };
}

function findDatabaseInMessage(message) {
  const lower = message.toLowerCase();
  const matches = [];

  for (const [dbName, servers] of cache.dbToServers.entries()) {
    const pattern = new RegExp(`\\b${dbName}\\b`, "i");
    if (pattern.test(lower)) {
      matches.push({ name: dbName, servers });
    }
  }

  return matches;
}

function findServerInMessage(message) {
  const match = message.match(/\bsql-\d+\b/i);
  return match ? match[0].toLowerCase() : null;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "context-resolver" });
});

app.post("/resolve", async (req, res) => {
  const { message, context = {} } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      resolved: false,
      message: "El campo 'message' es obligatorio"
    });
  }

  try {
    if (!cache.lastUpdated || Date.now() - cache.lastUpdated > CACHE_REFRESH_MS) {
      await refreshCache();
    }

    const contextDatabase = context.database?.toString();
    const contextServer = context.server?.toString();

    const serverFromMessage = findServerInMessage(message);
    const dbMatches = findDatabaseInMessage(message);

    const resolvedServer = serverFromMessage || contextServer;
    const resolvedDatabase = dbMatches.length === 1 ? dbMatches[0].name : contextDatabase;

    if (dbMatches.length > 1) {
      return res.json({
        resolved: false,
        ambiguity: true,
        message: "Hay múltiples bases de datos posibles. Sé más específico.",
        options: dbMatches.map(match => ({
          database: match.name,
          servers: match.servers
        }))
      });
    }

    if (resolvedDatabase && cache.dbToServers.has(resolvedDatabase.toLowerCase())) {
      const possibleServers = cache.dbToServers.get(resolvedDatabase.toLowerCase()) || [];
      if (resolvedServer && possibleServers.includes(resolvedServer)) {
        return res.json({
          resolved: true,
          target: {
            server: resolvedServer,
            database: resolvedDatabase,
            table: context.table
          }
        });
      }

      if (possibleServers.length === 1) {
        return res.json({
          resolved: true,
          target: {
            server: possibleServers[0],
            database: resolvedDatabase,
            table: context.table
          }
        });
      }

      if (possibleServers.length > 1) {
        return res.json({
          resolved: false,
          ambiguity: true,
          message: "La base de datos existe en varios servidores. Indica cuál usar.",
          options: possibleServers.map(server => ({
            server,
            database: resolvedDatabase
          }))
        });
      }
    }

    if (resolvedServer && resolvedDatabase) {
      return res.json({
        resolved: true,
        target: {
          server: resolvedServer,
          database: resolvedDatabase,
          table: context.table
        }
      });
    }

    if (resolvedDatabase && !resolvedServer) {
      return res.json({
        resolved: true,
        target: {
          server: DEFAULT_SERVER,
          database: resolvedDatabase,
          table: context.table
        }
      });
    }

    return res.json({
      resolved: true,
      target: {
        server: DEFAULT_SERVER,
        database: DEFAULT_DATABASE,
        table: context.table
      }
    });
  } catch (error) {
    console.error("Error resolviendo contexto:", error);
    res.status(500).json({
      resolved: false,
      message: "Error resolviendo contexto",
      details: error.message
    });
  }
});

refreshCache().catch(error => {
  console.warn("No se pudo inicializar el cache de contexto:", error.message);
});

setInterval(() => {
  refreshCache().catch(error => {
    console.warn("No se pudo refrescar el cache de contexto:", error.message);
  });
}, CACHE_REFRESH_MS);

app.listen(6000, () => {
  console.log("Context-resolver corriendo en puerto 6000");
});
// mcp-sql/index.js
// Microservicio MCP para SQL Server
// Lee todos los servidores del .env con prefijo SQL_SERVER_
// Un mismo usuario/contraseña para todos los servidores

import express from 'express';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import sql from 'mssql';

dotenv.config();

const app = express();
app.use(express.json());

// ─────────────────────────────────────────
// CARGA DINÁMICA DE SERVIDORES DESDE .env
// Detecta automáticamente SQL_SERVER_01, SQL_SERVER_02, etc.
// Para agregar un nuevo servidor: añadir SQL_SERVER_XX=<ip> al .env
// ─────────────────────────────────────────
function loadServersFromEnv() {
  const servers = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('SQL_SERVER_') && value) {
      const alias = key.replace('SQL_SERVER_', '').toLowerCase(); // "01", "02", etc.
      servers[alias] = value.trim();
    }
  }
  return servers;
}

const SQL_SERVERS = loadServersFromEnv(); 
const SQL_USER = process.env.SQL_USER;
const SQL_PASSWORD = process.env.SQL_PASSWORD;

console.log(`[mcp-sql] Servidores cargados: ${JSON.stringify(SQL_SERVERS)}`);

// Pool de conexiones por servidor (lazy init)
const pools = {};

async function getPool(serverAlias) {
  if (pools[serverAlias]) return pools[serverAlias];

  const serverAddress = SQL_SERVERS[serverAlias];
  if (!serverAddress) throw new Error(`Servidor desconocido: ${serverAlias}`);

  const config = {
    user: SQL_USER,
    password: SQL_PASSWORD,
    server: serverAddress,
    options: {
      encrypt: false,           // true si usas Azure SQL
      trustServerCertificate: true,
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    connectionTimeout: 15000,
  };

  // Crear un pool independiente por servidor. Usar sql.connect(config) crea un pool global
  // que puede causar que todas las conexiones apunten al primer servidor conectado.
  const pool = new sql.ConnectionPool(config);
  await pool.connect();
  pools[serverAlias] = pool;
  console.log(`[mcp-sql] Pool creado para servidor: ${serverAlias} (${serverAddress})`);
  return pool;
}

// ─────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mcp-sql',
    servers: Object.keys(SQL_SERVERS),
  });
});

// ─────────────────────────────────────────
// LISTAR SERVIDORES DISPONIBLES
// ─────────────────────────────────────────
app.get('/servers', (req, res) => {
  const list = Object.entries(SQL_SERVERS).map(([alias, address]) => ({
    alias,
    address,
  }));
  res.json({ servers: list });
});

// ─────────────────────────────────────────
// LISTAR BASES DE DATOS DE UN SERVIDOR
// GET /databases?server=01
// ─────────────────────────────────────────
app.get('/databases', async (req, res) => {
  const { server } = req.query;
  if (!server) return res.status(400).json({ error: 'Parámetro server requerido' });

  try {
    const pool = await getPool(server);
    const result = await pool.request().query(`
      SELECT name FROM sys.databases
      WHERE name NOT IN ('master','tempdb','model','msdb')
      ORDER BY name
    `);
    res.json({ server, databases: result.recordset.map(r => r.name) });
  } catch (err) {
    console.error(`[mcp-sql] Error listando DBs en ${server}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// LISTAR TABLAS DE UNA BASE DE DATOS
// GET /tables?server=01&database=MiDB
// ─────────────────────────────────────────
app.get('/tables', async (req, res) => {
  const { server, database } = req.query;
  if (!server || !database) {
    return res.status(400).json({ error: 'Parámetros server y database requeridos' });
  }

  try {
    const pool = await getPool(server);
    const result = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM [${database}].INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    res.json({ server, database, tables: result.recordset });
  } catch (err) {
    console.error(`[mcp-sql] Error listando tablas:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// EJECUTAR QUERY
// POST /query
// Body: { server: "01", database: "MiDB", query: "SELECT TOP 10 * FROM Tabla" }
// ─────────────────────────────────────────
app.post('/query', async (req, res) => {
  const { server, database, query } = req.body;

  if (!server || !database || !query) {
    return res.status(400).json({ error: 'Campos server, database y query son requeridos' });
  }

  // Seguridad básica: solo SELECT permitido (hasta que se implemente autorización por AD)
  // const trimmed = query.trim().toUpperCase();
  // if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
  //   return res.status(403).json({
  //     error: 'Solo consultas SELECT están permitidas en este momento',
  //   });
  // }

  try {
    const pool = await getPool(server);
    const result = await pool
      .request()
      .query(`USE [${database}]; ${query}`);

    res.json({
      success: true,
      server,
      database,
      rowCount: result.recordset?.length ?? 0,
      data: result.recordset ?? [],
    });
  } catch (err) {
    console.error(`[mcp-sql] Error ejecutando query:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// INTROSPECCIÓN: COLUMNAS DE UNA TABLA
// GET /schema?server=01&database=MiDB&table=MiTabla
// ─────────────────────────────────────────
app.get('/schema', async (req, res) => {
  const { server, database, table } = req.query;
  if (!server || !database || !table) {
    return res.status(400).json({ error: 'Parámetros server, database y table requeridos' });
  }

  try {
    const pool = await getPool(server);
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
      FROM [${database}].INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${table.replace(/'/g, "''")}'
      ORDER BY ORDINAL_POSITION
    `);
    res.json({ server, database, table, columns: result.recordset });
  } catch (err) {
    console.error(`[mcp-sql] Error obteniendo schema:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.MCP_SQL_PORT || 3002;
app.listen(PORT, () => {
  console.log(`[mcp-sql] Corriendo en http://localhost:${PORT}`);
  console.log(`[mcp-sql] Servidores disponibles: ${Object.keys(SQL_SERVERS).join(', ')}`);
});
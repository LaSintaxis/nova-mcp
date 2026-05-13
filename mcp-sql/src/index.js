import express from "express";
import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// ============================================
// CONFIGURACIÓN DE CONEXIONES - SQL AUTHENTICATION
// ============================================
// ============================================
// CONFIGURACIÓN DE CONEXIONES - DINÁMICA
// ============================================
// Lee todas las variables que empiezan con SQL_SERVER_
// Ejemplo:
//   SQL_SERVER_01=192.168.1.10
//   SQL_DATABASE_01=ventas
//   SQL_USER_01=mcp_user
//   SQL_PASSWORD_01=***
//
//   SQL_SERVER_02=192.168.1.11
//   SQL_DATABASE_02=crm
//   SQL_USER_02=mcp_user
//   SQL_PASSWORD_02=***
//
//   SQL_SERVER_03=192.168.1.12
//   ...
//
// El alias será "sql-01", "sql-02", "sql-03", etc.

const connectionConfigs = {};

// Recorrer todas las variables de entorno
Object.keys(process.env).forEach(key => {
  // Buscar variables como SQL_SERVER_01, SQL_SERVER_02, etc.
  const match = key.match(/^SQL_SERVER_(\d+)$/);
  if (match) {
    const index = match[1];
    const serverName = process.env[key];
    const databaseName = process.env[`SQL_DATABASE_${index}`] || "master";
    const userName = process.env[`SQL_USER_${index}`];
    const password = process.env[`SQL_PASSWORD_${index}`];
    
    // Solo agregar si tiene usuario y contraseña (o está configurado)
    if (serverName && userName && password) {
      const alias = `sql-${index}`;
      connectionConfigs[alias] = {
        server: serverName,
        database: databaseName,
        user: userName,
        password: password,
        options: {
          trustServerCertificate: true,
          encrypt: false,  // Para red local, false. Para Azure, true
          enableArithAbort: true
        }
      };
      console.log(`✅ Configurado servidor: ${alias} -> ${serverName}/${databaseName}`);
    }
  }
});

// Si no hay servidores configurados, mostrar advertencia
if (Object.keys(connectionConfigs).length === 0) {
  console.warn("⚠️ No se encontraron servidores SQL configurados. Usando configuración por defecto.");
  connectionConfigs["sql-01"] = {
    server: process.env.SQL_SERVER_01 || "localhost",
    database: "master",
    user: process.env.SQL_USER_01 || "sa",
    password: process.env.SQL_PASSWORD_01 || "",
    options: {
      trustServerCertificate: true,
      encrypt: false,
      enableArithAbort: true
    }
  };
}

console.log("═════════════════════════════════════════════");
console.log("🔧 MCP-SQL - SQL Authentication (Múltiples servidores)");
console.log(`📡 Servidores configurados: ${Object.keys(connectionConfigs).length}`);
Object.entries(connectionConfigs).forEach(([alias, config]) => {
  console.log(`   - ${alias}: ${config.server}/${config.database}`);
});
console.log("═════════════════════════════════════════════");

// ============================================
// FUNCIÓN PARA LISTAR BASES DE DATOS
// ============================================
function getServerConfig(serverAlias = "sql-01") {
  return connectionConfigs[serverAlias] || connectionConfigs["sql-01"];
}

async function listDatabases(serverAlias = "sql-01") {
  const config = getServerConfig(serverAlias);

  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT name, database_id, create_date 
      FROM sys.databases 
      WHERE state_desc = 'ONLINE'
      AND name NOT IN ('master', 'tempdb', 'model', 'msdb')
      ORDER BY name
    `);
    await pool.close();
    return result.recordset;
  } catch (error) {
    console.error("Error listando bases de datos:", error.message);
    throw error;
  }
}

// ============================================
// FUNCIÓN PARA EJECUTAR QUERY EN UNA BD ESPECÍFICA
// ============================================
async function executeQueryOnDatabase(databaseName, query, serverAlias = "sql-01") {
  const config = {
    ...getServerConfig(serverAlias),
    database: databaseName
  };

  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(query);
    await pool.close();
    return result;
  } catch (error) {
    console.error(`Error en ${databaseName}:`, error.message);
    throw error;
  }
}

// ============================================
// FUNCIÓN PARA OBTENER ESQUEMA (TABLAS Y COLUMNAS)
// ============================================
async function getSchemaForDatabase(databaseName, serverAlias = "sql-01") {
  const config = {
    ...getServerConfig(serverAlias),
    database: databaseName
  };

  const schemaQuery = `
    SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
  `;

  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(schemaQuery);
    await pool.close();

    const schemaMap = {};
    result.recordset.forEach(row => {
      const tableKey = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`;
      if (!schemaMap[tableKey]) {
        schemaMap[tableKey] = [];
      }
      schemaMap[tableKey].push({
        name: row.COLUMN_NAME,
        type: row.DATA_TYPE
      });
    });

    return schemaMap;
  } catch (error) {
    console.error(`Error obteniendo esquema de ${databaseName}:`, error.message);
    throw error;
  }
}

// ============================================
// VALIDACIÓN DE QUERIES (SEGURIDAD)
// ============================================
// ============================================
// VALIDACIÓN DE QUERIES (SEGURIDAD) - MEJORADA
// ============================================
function isQuerySafe(query) {
  const dangerousKeywords = [
    "DROP", "DELETE", "UPDATE", "INSERT", "ALTER",
    // "CREATE", "TRUNCATE", "EXEC", "EXECUTE", "xp_",
    // "sp_", "INTO", "BACKUP", "RESTORE", "USE",
    // "WAITFOR", "RECEIVE", "ENABLE", "DISABLE", "REVERT"
  ];

  // Limpiar la consulta
  let cleanQuery = query;
  cleanQuery = cleanQuery.replace(/--.*$/gm, "");  // Remover comentarios de línea
  cleanQuery = cleanQuery.replace(/\/\*[\s\S]*?\*\//g, "");  // Remover comentarios bloque
  cleanQuery = cleanQuery.trim();

  const upperQuery = cleanQuery.toUpperCase();

  // 1. Verificar palabras peligrosas
  for (const keyword of dangerousKeywords) {
    if (upperQuery.includes(keyword)) {
      console.log(`🚫 Palabra peligrosa detectada: ${keyword}`);
      return false;
    }
  }

  // 2. Verificar que sea solo SELECT (puede tener WITH antes)
  const selectIndex = upperQuery.indexOf("SELECT");
  if (selectIndex === -1) {
    console.log(`🚫 No se encontró SELECT en la consulta`);
    return false;
  }

  // 3. Verificar que no haya ";" antes del SELECT (posible inyección)
  const beforeSelect = upperQuery.substring(0, selectIndex);
  if (beforeSelect.includes(";")) {
    console.log(`🚫 Posible inyección SQL detectada (; antes de SELECT)`);
    return false;
  }

  // 4. Verificar que no haya más de un statement (separado por ;)
  const statements = upperQuery.split(";").filter(s => s.trim().length > 0);
  if (statements.length > 1) {
    console.log(`🚫 Múltiples statements no permitidos`);
    return false;
  }

  // 5. Verificar que no tenga UNION con INSERT/DELETE/UPDATE
  if (upperQuery.includes("UNION")) {
    const unionPart = statements[0] || upperQuery;
    if (unionPart.includes("INSERT") || unionPart.includes("DELETE") || unionPart.includes("UPDATE")) {
      console.log(`🚫 UNION con operación peligrosa`);
      return false;
    }
  }

  return true;
}

// ============================================
// ENDPOINTS
// ============================================
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "mcp-sql" });
});

// Listar todas las bases de datos del servidor
app.get("/databases", async (req, res) => {
  const server = req.query.server || "sql-01";
  console.log(`📡 Solicitando listado de bases de datos (${server})...`);

  try {
    const databases = await listDatabases(server);
    res.json({
      success: true,
      server,
      databases: databases,
      count: databases.length
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      message: "Error listando bases de datos",
      error: error.message,
      code: error.code
    });
  }
});

// Listar bases de datos de todos los servidores configurados
app.get("/databases/all", async (_req, res) => {
  console.log("📡 Solicitando listado de bases de datos (todos los servidores)...");

  try {
    const results = await Promise.all(
      Object.keys(connectionConfigs).map(async (server) => {
        try {
          const databases = await listDatabases(server);
          return { server, databases, count: databases.length, success: true };
        } catch (error) {
          return { server, databases: [], count: 0, success: false, error: error.message };
        }
      })
    );

    res.json({
      success: true,
      servers: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error listando bases de datos",
      error: error.message
    });
  }
});

// Obtener esquema (tablas/columnas) de una base de datos
app.get("/schema", async (req, res) => {
  const database = req.query.database || "master";
  const server = req.query.server || "sql-01";
  console.log(`📚 Solicitando esquema de: ${server}/${database}`);

  try {
    const schema = await getSchemaForDatabase(database, server);
    res.json({
      success: true,
      server,
      database,
      schema
    });
  } catch (error) {
    console.error("Error obteniendo esquema:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo esquema",
      error: error.message,
      code: error.code
    });
  }
});


// Ejecutar query en una base de datos específica
app.post("/query", async (req, res) => {
  const { query, database, connection } = req.body;

  // La base de datos se especifica en el body, no en el SQL
  const targetDatabase = database || connection?.database || "master";
  const targetServer = connection?.server || "sql-01";

  if (!query || typeof query !== "string") {
    return res.status(400).json({
      success: false,
      message: "El campo 'query' es obligatorio"
    });
  }

  if (!isQuerySafe(query)) {
    console.warn(`🚫 Query bloqueada: ${query.substring(0, 100)}...`);
    return res.status(403).json({
      success: false,
      message: "Solo SELECT está autorizado"
    });
  }

  console.log(`📡 Ejecutando query en: ${targetServer}/${targetDatabase}`);
  console.log(`📝 Query: ${query.substring(0, 150)}...`);

  try {
    const result = await executeQueryOnDatabase(targetDatabase, query, targetServer);

    const columns = result.recordset[0] ? Object.keys(result.recordset[0]) : [];
    const hasNumericColumn = columns.some(col =>
      typeof result.recordset[0]?.[col] === 'number'
    );
    const hasStringColumn = columns.some(col =>
      typeof result.recordset[0]?.[col] === 'string'
    );

    const chartSuggestion = (hasNumericColumn && hasStringColumn) ? {
      possible: true,
      xAxis: columns.find(col => typeof result.recordset[0]?.[col] === 'string'),
      yAxis: columns.find(col => typeof result.recordset[0]?.[col] === 'number'),
      type: "bar"
    } : null;

    res.json({
      success: true,
      server: targetServer,
      database: targetDatabase,
      data: result.recordset,
      rowCount: result.recordset.length,
      columns: columns,
      chartSuggestion: chartSuggestion
    });

  } catch (error) {
    console.error("Error ejecutando query:", error);
    res.status(500).json({
      success: false,
      message: "Error ejecutando la consulta",
      sqlError: error.message,
      code: error.code
    });
  }
});

// Endpoint para probar conexión
app.get("/test-connection", async (req, res) => {
  try {
    const databases = await listDatabases();
    res.json({
      success: true,
      message: "Conexión exitosa",
      databases: databases.map(db => db.name)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error de conexión",
      error: error.message,
      code: error.code
    });
  }
});



// ============================================
// FUNCIÓN PARA OBTENER RELACIONES (FK)
// ============================================
async function getRelationsForDatabase(databaseName, serverAlias = "sql-01") {
  const config = {
    ...getServerConfig(serverAlias),
    database: databaseName
  };

  const relationsQuery = `
    SELECT 
      fk.name AS FK_Name,
      OBJECT_NAME(fk.parent_object_id) AS TableName,
      COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS ColumnName,
      OBJECT_NAME(fk.referenced_object_id) AS ReferencedTableName,
      COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS ReferencedColumnName
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    ORDER BY TableName, ColumnName
  `;

  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(relationsQuery);
    await pool.close();

    const relations = {};
    result.recordset.forEach(row => {
      if (!relations[row.TableName]) {
        relations[row.TableName] = [];
      }
      relations[row.TableName].push({
        column: row.ColumnName,
        references: row.ReferencedTableName,
        referencesColumn: row.ReferencedColumnName
      });
    });

    return relations;
  } catch (error) {
    console.error(`Error obteniendo relaciones de ${databaseName}:`, error.message);
    return {};
  }
}

// Nuevo endpoint para obtener relaciones
app.get("/relations", async (req, res) => {
  const database = req.query.database || "master";
  const server = req.query.server || "sql-01";
  console.log(`🔗 Solicitando relaciones de: ${server}/${database}`);

  try {
    const relations = await getRelationsForDatabase(database, server);
    res.json({
      success: true,
      server,
      database,
      relations
    });
  } catch (error) {
    console.error("Error obteniendo relaciones:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo relaciones",
      error: error.message
    });
  }
});


app.listen(5000, () => {
  console.log("\n🚀 MCP SQL corriendo en puerto 5000");
  console.log("\n📋 Endpoints disponibles:");
  console.log("   GET  /databases        - Listar bases de datos");
  console.log("   GET  /test-connection  - Probar conexión a SQL Server");
  console.log("   POST /query            - Ejecutar consulta SQL");
  console.log("   GET  /health           - Verificar estado");
  console.log("\n💡 Prueba la conexión: http://localhost:5000/test-connection\n");
});
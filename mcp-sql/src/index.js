import express from "express";
import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// ============================================
// CONFIGURACIÓN DE CONEXIONES - WINDOWS AUTH
// ============================================
// Para desarrollo local con Windows Authentication
const connectionConfigs = {
  "sql-01": {
    server: process.env.SQL_SERVER_01 || "E-23YP6S2",
    database: "master",
    user: process.env.SQL_USER_01,
    password: process.env.SQL_PASSWORD_01,
    options: {
      trustServerCertificate: true,
      encrypt: false,
      enableArithAbort: true
    }
  }
};

console.log("═════════════════════════════════════════════");
console.log("🔧 MCP-SQL - Windows Authentication");
console.log(`📡 Servidor: ${connectionConfigs["sql-01"].server}`);
console.log(`🔐 Autenticación: Windows (trustedConnection)`);
console.log("═════════════════════════════════════════════");

// ============================================
// FUNCIÓN PARA LISTAR BASES DE DATOS
// ============================================
async function listDatabases() {
  const config = connectionConfigs["sql-01"];
  
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
async function executeQueryOnDatabase(databaseName, query) {
  const config = {
    ...connectionConfigs["sql-01"],
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
// VALIDACIÓN DE QUERIES (SEGURIDAD)
// ============================================
function isQuerySafe(query) {
  const dangerousKeywords = [
    "DROP", "DELETE", "UPDATE", "INSERT", "ALTER", 
    "CREATE", "TRUNCATE", "EXEC", "EXECUTE", "xp_", 
    "sp_", "INTO", "BACKUP", "RESTORE"
  ];
  
  const upperQuery = query.toUpperCase();
  
  for (const keyword of dangerousKeywords) {
    if (upperQuery.includes(keyword)) {
      return false;
    }
  }
  
  return upperQuery.trim().startsWith("SELECT");
}

// ============================================
// ENDPOINTS
// ============================================
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "mcp-sql" });
});

// Listar todas las bases de datos del servidor
app.get("/databases", async (req, res) => {
  console.log("📡 Solicitando listado de bases de datos...");
  
  try {
    const databases = await listDatabases();
    res.json({
      success: true,
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

// Ejecutar query en una base de datos específica
app.post("/query", async (req, res) => {
  const { query, database, connection } = req.body;
  
  const targetDatabase = database || connection?.database || "master";

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

  console.log(`📡 Ejecutando query en: ${targetDatabase}`);
  console.log(`📝 Query: ${query.substring(0, 150)}...`);

  try {
    const result = await executeQueryOnDatabase(targetDatabase, query);
    
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

app.listen(5000, () => {
  console.log("\n🚀 MCP SQL corriendo en puerto 5000");
  console.log("\n📋 Endpoints disponibles:");
  console.log("   GET  /databases        - Listar bases de datos");
  console.log("   GET  /test-connection  - Probar conexión a SQL Server");
  console.log("   POST /query            - Ejecutar consulta SQL");
  console.log("   GET  /health           - Verificar estado");
  console.log("\n💡 Prueba la conexión: http://localhost:5000/test-connection\n");
});
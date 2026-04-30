import express from "express";
import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// ============================================
// CONFIGURACIÓN ESCALABLE
// ============================================
// Soporta múltiples servidores vía variables de entorno
// Ejemplo: SQL_SERVER_01 = ip o nombre del servidor
// Ejemplo: SQL_SERVER_02 = otra ip

const connectionConfigs = {};

// Leer todas las variables SQL_SERVER_XX
Object.keys(process.env).forEach(key => {
  const match = key.match(/^SQL_SERVER_(.+)$/);
  if (match) {
    const serverKey = match[1].toLowerCase();
    const serverAddress = process.env[key];
    const databaseName = process.env[`SQL_DATABASE_${match[1]}`] || "master";
    
    connectionConfigs[`sql-${serverKey}`] = {
      server: serverAddress,
      database: databaseName,
      options: {
        trustedConnection: true,
        trustServerCertificate: true,
        encrypt: false,
        enableArithAbort: true
      }
    };
    
    console.log(`✅ Configurado servidor: sql-${serverKey} -> ${serverAddress}`);
  }
});

// Si no hay configuraciones, usar valor por defecto (desarrollo local)
if (Object.keys(connectionConfigs).length === 0) {
  console.log("⚠️ No se encontraron variables SQL_SERVER_XX, usando configuración por defecto");
  connectionConfigs["sql-01"] = {
    server: "E-23YP6S2",
    database: "master",
    options: {
      trustedConnection: true,
      trustServerCertificate: true,
      encrypt: false,
      enableArithAbort: true
    }
  };
}

console.log("=================================");

// ============================================
// VALIDACIÓN DE QUERIES
// ============================================
function isQuerySafe(query) {
  const dangerousKeywords = [
    "DROP", "DELETE", "UPDATE", "INSERT", "ALTER", 
    "CREATE", "TRUNCATE", "EXEC", "EXECUTE", "xp_"
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
app.post("/databases", async (req, res) => {
  const { connection } = req.body;
  
  let serverKey = "sql-01";
  if (connection?.server && connectionConfigs[connection.server]) {
    serverKey = connection.server;
  }
  
  const config = {
    ...connectionConfigs[serverKey],
    database: "master"
  };

  console.log(`📡 Conectando a ${config.server} para listar bases de datos`);

  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT name FROM sys.databases 
      WHERE state_desc = 'ONLINE'
      AND name NOT IN ('master', 'tempdb', 'model', 'msdb')
      ORDER BY name
    `);
    await pool.close();

    res.json({
      success: true,
      databases: result.recordset.map(db => db.name),
      count: result.recordset.length
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      message: "Error listando bases de datos",
      sqlError: error.message
    });
  }
});

// Ejecutar query en una base de datos específica
app.post("/query-with-db", async (req, res) => {
  const { query, database, connection } = req.body;

  if (!query || typeof query !== "string") {
    return res.status(400).json({ success: false, message: "Query requerida" });
  }

  if (!database) {
    return res.status(400).json({ success: false, message: "Database requerida" });
  }

  if (!isQuerySafe(query)) {
    return res.status(403).json({ success: false, message: "Solo SELECT está permitido" });
  }

  let serverKey = "sql-01";
  if (connection?.server && connectionConfigs[connection.server]) {
    serverKey = connection.server;
  }

  const config = {
    ...connectionConfigs[serverKey],
    database: database
  };

  console.log(`📡 Conectando a ${config.server}/${database}`);
  console.log(`📝 Query: ${query.substring(0, 100)}...`);

  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(query);
    await pool.close();

    const columns = result.recordset[0] ? Object.keys(result.recordset[0]) : [];
    
    res.json({
      success: true,
      database: database,
      data: result.recordset,
      rowCount: result.recordset.length,
      columns: columns
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      message: "Error ejecutando consulta",
      sqlError: error.message
    });
  }
});

app.listen(5000, () => {
  console.log("🚀 MCP SQL corriendo en puerto 5000");
  console.log(`📊 Servidores configurados: ${Object.keys(connectionConfigs).join(", ")}`);
});
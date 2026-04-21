import express from "express";
import sql from "mssql";

const app = express();
app.use(express.json());

// ============================================
// CONFIGURACIÓN DE CONEXIONES
// ============================================
// Mapa de conexiones permitidas (solo estas pueden usarse)
const connectionConfigs = {
  "sql-01": {
    server: process.env.SQL_SERVER_01 || "servidor1.database.windows.net",
    database: process.env.SQL_DATABASE_01 || "ventas",
    user: process.env.SQL_USER_01,
    password: process.env.SQL_PASSWORD_01,
    options: {
      encrypt: true,
      trustServerCertificate: false,
      enableArithAbort: true
    }
  },
  "sql-02": {
    server: process.env.SQL_SERVER_02 || "servidor2.database.windows.net",
    database: process.env.SQL_DATABASE_02 || "crm",
    user: process.env.SQL_USER_02,
    password: process.env.SQL_PASSWORD_02,
    options: {
      encrypt: true,
      trustServerCertificate: false,
      enableArithAbort: true
    }
  }
};

// ============================================
// VALIDACIÓN DE QUERIES (SEGURIDAD)
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
  
  // Solo permitir SELECT
  if (!upperQuery.trim().startsWith("SELECT")) {
    return false;
  }
  
  return true;
}

// ============================================
// ENDPOINT PRINCIPAL
// ============================================
app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "mcp-sql"
  });
});

app.post("/query", async (req, res) => {
  const { query, connection } = req.body;

  if (!query || typeof query !== "string") {
    return res.status(400).json({
      success: false,
      message: "El campo 'query' es obligatorio"
    });
  }

  // ============================================
  // 1. VALIDAR SEGURIDAD
  // ============================================
  if (!isQuerySafe(query)) {
    console.warn(`Query bloqueada por razones de seguridad: ${query}`);
    return res.status(403).json({
      success: false,
      message: "La consulta contiene operaciones no permitidas. Solo SELECT está autorizado."
    });
  }

  // ============================================
  // 2. OBTENER CONFIGURACIÓN DE CONEXIÓN
  // ============================================
  let config;
  
  if (connection?.server && connectionConfigs[connection.server]) {
    config = connectionConfigs[connection.server];
  } else if (connection?.server) {
    // Si el servidor no está en la lista blanca, rechazar
    return res.status(403).json({
      success: false,
      message: `Servidor '${connection.server}' no está autorizado`
    });
  } else {
    // Usar el primer servidor por defecto
    const defaultServer = Object.keys(connectionConfigs)[0];
    config = connectionConfigs[defaultServer];
  }

  if (!config) {
    return res.status(500).json({
      success: false,
      message: "No hay configuración de conexión disponible"
    });
  }

  console.log("Ejecutando query:", query);
  console.log("En servidor:", config.server, "base de datos:", config.database);

  try {
    // ============================================
    // 3. CONECTAR Y EJECUTAR
    // ============================================
    const pool = await sql.connect(config);
    const result = await pool.request().query(query);
    await pool.close();

    // ============================================
    // 4. FORMATEAR RESPUESTA PARA GRÁFICAS
    // ============================================
    // Detectar si los datos pueden representarse como gráfica
    const columns = result.recordset[0] ? Object.keys(result.recordset[0]) : [];
    
    // Si hay al menos una columna numérica y una categórica, sugerir gráfica
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
      type: "bar" // o "line" dependiendo de los datos
    } : null;

    res.json({
      success: true,
      connection: {
        server: config.server,
        database: config.database
      },
      query: query,
      data: result.recordset,
      rowCount: result.recordset.length,
      columns: columns,
      chartSuggestion: chartSuggestion
    });

  } catch (error) {
    console.error("Error ejecutando query:", error);
    res.status(500).json({
      success: false,
      message: "Error ejecutando la consulta en la base de datos",
      sqlError: error.message
    });
  }
});

app.listen(5000, () => {
  console.log("MCP SQL corriendo en puerto 5000");
  console.log("✅ Conectado a SQL Server real");
});
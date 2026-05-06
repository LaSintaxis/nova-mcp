import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4.1-mini";
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";
const MCP_SQL_URL = process.env.MCP_SQL_URL || "http://localhost:5000";

// Configuración por defecto para SQL (único servidor)
const DEFAULT_SQL_CONFIG = {
  server: "sql-01",
  database: process.env.DEFAULT_SQL_DATABASE || "prueba_mcp",
  defaultTable: "clientes"
};

const app = express();
app.use(express.json());

function isAzureOpenAIConfigured() {
  return Boolean(AZURE_OPENAI_ENDPOINT && AZURE_OPENAI_API_KEY && AZURE_OPENAI_DEPLOYMENT);
}

async function callAzureOpenAIChatCompletion(messages, temperature = 0.2) {
  if (!isAzureOpenAIConfigured()) {
    throw new Error("Azure OpenAI no está configurado. Define AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY y AZURE_OPENAI_DEPLOYMENT");
  }

  const normalizedEndpoint = AZURE_OPENAI_ENDPOINT.replace(/\/$/, "");
  const url = `${normalizedEndpoint}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "api-key": AZURE_OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages,
      temperature
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Error con Azure OpenAI");
  }

  return data?.choices?.[0]?.message?.content?.trim() || "";
}

// ============================================
// CLASIFICADOR DE INTENCIÓN
// ============================================
async function classifyIntent(message) {
  const prompt = `
Eres un clasificador. Determina si el usuario quiere CONSULTAR DATOS (SQL) o es una conversación general.

RESPONDE SOLO con "sql" o "chat". Nada más.

- "sql": si el usuario pregunta sobre: clientes, ventas, productos, reportes, bases de datos, tablas, registros, consultas, datos, información de la empresa.
- "chat": si es un saludo, pregunta sobre ti, conversación general, agradecimiento, despedida, explicaciones, ayuda.

Ejemplos:
- "Hola" → chat
- "¿Cómo estás?" → chat
- "Muéstrame los clientes" → sql
- "¿Cuántas ventas hay?" → sql
- "¿Qué puedes hacer?" → chat
- "Gracias" → chat

Mensaje: "${message}"
`;

  try {
    const content = await callAzureOpenAIChatCompletion([
      { role: "user", content: prompt }
    ], 0.1);

    const result = content.toLowerCase();
    return result === "sql";
  } catch (error) {
    console.error("Error clasificando intención:", error);
    return false;
  }
}

// ============================================
// GENERAR SQL
// ============================================
// ============================================
// GENERAR SQL - PROMPT MEJORADO
// ============================================
async function generateSQL(message, database, table) {
  const prompt = `
Eres un experto en SQL Server (T-SQL). Tu tarea es generar consultas SQL válidas.

CONTEXTO:
- Base de datos: ${database}
- Tabla sugerida: ${table}

REGLAS ESTRICTAS:
1. SOLO devuelve la consulta SQL, sin explicaciones, sin markdown, sin comillas triples
2. Usa sintaxis T-SQL correcta para SQL Server
3. TOP debe ir después de SELECT: SELECT TOP N * FROM tabla
4. NUNCA pongas TOP al final de la consulta
5. Para listar tablas, usa: SELECT * FROM ${database}.INFORMATION_SCHEMA.TABLES
6. Para listar columnas, usa: SELECT * FROM ${database}.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='nombre'
7. Limita resultados con TOP 100 (no LIMIT)
8. Los nombres de tablas pueden tener esquema: [dbo].[Tabla]

EJEMPLOS CORRECTOS:
- SELECT TOP 10 * FROM [dbo].[Clientes]
- SELECT TOP 100 * FROM ${database}.INFORMATION_SCHEMA.TABLES
- SELECT TOP 5 Nombre, Email FROM [dbo].[Usuarios] WHERE Activo = 1

RESPONDE SOLO CON EL SQL. NADA MÁS.

Pregunta del usuario: ${message}
`;

  let sql = await callAzureOpenAIChatCompletion([
    { role: "user", content: prompt }
  ], 0.2);

  // Limpiar posibles markdown
  sql = sql.replace(/```sql\n?/gi, "").replace(/```\n?/g, "").trim();

  return sql;
}

// ============================================
// DETECTAR INTENCIÓN DE GRÁFICA
// ============================================
async function detectChartIntent(message) {
  const prompt = `
Eres un clasificador. Determina si el usuario QUIERE EXPLÍCITAMENTE una gráfica o visualización.

Palabras clave que indican gráfica:
- "gráfica", "gráfico", "grafica", "grafico"
- "chart", "graph", "visualiza", "visualización"
- "dibuja", "plot", "barra", "línea", "pastel"

Responde SOLO con "true" o "false". Nada más.

Mensaje: "${message}"
`;

  const content = await callAzureOpenAIChatCompletion([
    { role: "user", content: prompt }
  ], 0.1);

  const result = content.toLowerCase();
  return result === "true";
}

// ============================================
// CHAT DIRECTO (CONVERSACIÓN GENERAL)
// ============================================
async function chatDirect(message, history = []) {
  const systemPrompt = `
Eres un asistente de infraestructura de TI llamado Novachat.

Eres amable, profesional y respondes en español.
`;

  const normalizedHistory = Array.isArray(history)
    ? history
        .filter(item => item?.role && item?.content)
        .map(({ role, content }) => ({ role, content }))
    : [];

  const messages = [
    { role: "system", content: systemPrompt.trim() },
    ...normalizedHistory,
    { role: "user", content: message }
  ];

  return callAzureOpenAIChatCompletion(messages, 0.7);
}

// ============================================
// HEALTH CHECK
// ============================================
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "gateway" });
});

// ============================================
// ENDPOINT PRINCIPAL: EXECUTE
// ============================================
app.post("/execute", async (req, res) => {
  const { message, context = {} } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      type: "error",
      message: "El campo 'message' es obligatorio"
    });
  }

  try {
    // 1. CLASIFICAR INTENCIÓN
    const isSQLQuery = await classifyIntent(message);

    if (!isSQLQuery) {
      console.log("💬 [GATEWAY] Chat general detectado");
      const response = await chatDirect(message, context?.history);

      return res.json({
        type: "success",
        response: response,
        source: "chat"
      });
    }

    // 2. ES CONSULTA SQL
    console.log("📊 [GATEWAY] Consulta SQL detectada");

    // Extraer base de datos mencionada en el mensaje (ej: "de la base de datos 'empresa1'")
    const dbMatch = message.match(/(?:de la base de datos|en la base de datos|bd|database|db)\s+['\"]?(\w+)['\"]?/i);
    const database = dbMatch ? dbMatch[1] : (context?.database || DEFAULT_SQL_CONFIG.database);
    const table = context?.table || DEFAULT_SQL_CONFIG.defaultTable;

    console.log(`📚 Base de datos detectada: ${database}`);

    // Generar SQL
    const query = await generateSQL(message, database, table);
    console.log("📝 [GATEWAY] SQL generado:", query);

    // Ejecutar en MCP-SQL
    const sqlResponse = await fetch(`${MCP_SQL_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        connection: {
          server: DEFAULT_SQL_CONFIG.server,
          database: database  // Pasar la BD correcta
        }
      })
    });

    if (!sqlResponse.ok) {
      const sqlErrorData = await sqlResponse.json().catch(() => ({}));
      return res.status(sqlResponse.status).json({
        type: "error",
        message: sqlErrorData?.message || "Fallo al ejecutar consulta SQL",
        details: sqlErrorData
      });
    }

    const data = await sqlResponse.json();

    // Detectar si quiere gráfica
    const wantsChart = await detectChartIntent(message);

    // Formatear respuesta
    let formattedResponse = "";
    if (data.data && data.data.length > 0) {
      formattedResponse = `📊 **Resultado de la consulta:**\n\n`;
      formattedResponse += `Se encontraron ${data.data.length} registros.\n\n`;

      const headers = Object.keys(data.data[0]);
      formattedResponse += `| ${headers.join(' | ')} |\n`;
      formattedResponse += `|${headers.map(() => '---').join('|')}|\n`;

      data.data.slice(0, 10).forEach(row => {
        formattedResponse += `| ${headers.map(h => String(row[h] || '-').slice(0, 30)).join(' | ')} |\n`;
      });

      if (data.data.length > 10) {
        formattedResponse += `\n*... y ${data.data.length - 10} registros más.*\n`;
      }
    } else {
      formattedResponse = "✅ Consulta ejecutada correctamente, pero no se encontraron resultados.";
    }

    res.json({
      type: "success",
      response: formattedResponse,
      source: "sql",
      data: data.data,
      wantsChart: wantsChart,
      chartSuggestion: data.chartSuggestion,
      metadata: {
        query: query,
        database: database,
        rowCount: data.rowCount
      }
    });

  } catch (error) {
    console.error("❌ [GATEWAY] Error:", error);
    res.status(500).json({
      type: "error",
      message: "Error interno en el gateway",
      details: error.message
    });
  }
});

app.listen(4000, () => {
  console.log("\n═════════════════════════════════════════════");
  console.log("🚀 MCP Gateway corriendo en puerto 4000");
  console.log("📋 Endpoints:");
  console.log("   POST /execute - Clasifica y ejecuta (chat o SQL)");
  console.log("   GET  /health  - Verificar estado");
  console.log("═════════════════════════════════════════════\n");
});
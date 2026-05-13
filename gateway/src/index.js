import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4.1-mini";
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";
const MCP_SQL_URL = process.env.MCP_SQL_URL || "http://localhost:5000";
const CONTEXT_RESOLVER_URL = process.env.CONTEXT_RESOLVER_URL || "http://localhost:6000";

const SCHEMA_REFRESH_MS = 10 * 60 * 1000;

// Configuración por defecto para SQL (único servidor)
const  DEFAULT_SQL_CONFIG = {
  server: "sql-01",
  database: process.env.DEFAULT_SQL_DATABASE || "prueba_mcp",
  defaultTable: "clientes"
};

const app = express();
app.use(express.json());

const schemaCache = new Map();
const relationsCache = new Map();

function getCacheKey(server, database) {
  return `${server}::${database}`;
}

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
// FAST-PATH ROUTER: DETECTAR CONSULTAS ADMIN
// ============================================
function detectAdminQuery(message) {
  const adminPatterns = [
    /listar\s+bases/i,
    /list\s+databases/i,
    /mostrar\s+servidores/i,
    /show\s+servers/i,
    /que\s+servidores/i,
    /que\s+bases\s+de\s+datos/i,
    /cuales\s+son\s+las\s+bases/i,
    /databases/i,
    /servidores\s+disponibles/i,
    /bases\s+disponibles/i,
    /listar\s+tablas/i,
    /list\s+tables/i,
    /mostrar\s+tablas/i
  ];

  return adminPatterns.some(pattern => pattern.test(message));
}

async function handleAdminQuery(message, context = {}) {
  console.log("⚡ [GATEWAY] Fast-path: Consulta administrativa detectada");

  try {
    // Extraer servidor si viene especificado
    const serverMatch = message.match(/sql-(\d+)|servidor\s+(\w+)/i);
    const server = serverMatch 
      ? `sql-${serverMatch[1] || serverMatch[2]}`
      : null;

    if (!server) {
      // Retornar todos los servidores/bases disponibles
      const dbResponse = await fetch(`${MCP_SQL_URL}/databases/all`, {
        headers: { "Content-Type": "application/json" }
      });

      if (!dbResponse.ok) {
        throw new Error("No se pudieron obtener las bases de datos");
      }

      const dbData = await dbResponse.json();
      let response = "📊 **Servidores y bases de datos disponibles:**\n\n";

      if (dbData.servers && Object.keys(dbData.servers).length > 0) {
        for (const [srv, dbs] of Object.entries(dbData.servers)) {
          response += `**${srv}**: ${dbs.join(", ")}\n\n`;
        }
      } else {
        response = dbData.message || "No hay bases de datos disponibles.";
      }

      return {
        type: "success",
        response: response,
        source: "admin"
      };
    } else {
      // Retornar bases de datos del servidor específico
      const dbResponse = await fetch(
        `${MCP_SQL_URL}/databases?server=${encodeURIComponent(server)}`,
        { headers: { "Content-Type": "application/json" } }
      );

      if (!dbResponse.ok) {
        throw new Error(`No se pudo obtener bases de datos para ${server}`);
      }

      const dbData = await dbResponse.json();
      let response = `📊 **Bases de datos en ${server}:**\n\n`;

      if (Array.isArray(dbData.databases)) {
        response += dbData.databases.map(db => `- ${db}`).join("\n");
      } else {
        response = dbData.message || "No hay bases de datos en este servidor.";
      }

      return {
        type: "success",
        response: response,
        source: "admin"
      };
    }

  } catch (error) {
    console.error("❌ [GATEWAY] Error en fast-path admin:", error);
    return {
      type: "error",
      message: `Error al obtener información: ${error.message}`,
      source: "admin"
    };
  }
}

async function fetchSchema(server, database) {
  const url = `${MCP_SQL_URL}/schema?server=${encodeURIComponent(server)}&database=${encodeURIComponent(database)}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || "No se pudo obtener el esquema");
  }

  return data.schema || {};
}

async function fetchRelations(server, database) {
  const url = `${MCP_SQL_URL}/relations?server=${encodeURIComponent(server)}&database=${encodeURIComponent(database)}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || !data?.success) {
    return {};
  }

  return data.relations || {};
}

// ============================================
// FORMATO DE ESQUEMA CON DETECCIÓN DE RELACIONES
// ============================================
async function getSchemaWithRelations(server, database) {
  // Obtener esquema
  const schema = await getSchemaForDatabase(server, database);

  // Obtener relaciones (FK) desde caché o fetch
  const cacheKey = getCacheKey(server, database);
  let relations = relationsCache.get(cacheKey);
  if (!relations) {
    relations = await fetchRelations(server, database);
    relationsCache.set(cacheKey, relations);
  }

  // Formatear esquema incluyendo relaciones
  let schemaText = "";
  for (const [table, columns] of Object.entries(schema)) {
    const cols = columns.map(col => {
      // Verificar si esta columna es FK
      const isFk = relations[table]?.some(r => r.column === col.name);
      if (isFk) {
        const relation = relations[table].find(r => r.column === col.name);
        return `${col.name} (${col.type}) 🔗 FK → ${relation.references}.${relation.referencesColumn}`;
      }
      // Marcar columnas que podrían ser FK por nombre (Id al final)
      const isPotentialFk = col.name.endsWith('Id') || col.name.endsWith('ID');
      if (isPotentialFk) {
        return `${col.name} (${col.type}) 🔗 probable FK`;
      }
      return `${col.name} (${col.type})`;
    }).join(", ");
    schemaText += `- ${table}: ${cols}\n`;
  }

  // Agregar sugerencias de JOIN basadas en relaciones reales
  const relationsList = Object.entries(relations);
  if (relationsList.length > 0) {
    schemaText += "\n🔗 RELACIONES DETECTADAS (FK):\n";
    for (const [table, fks] of relationsList) {
      for (const fk of fks) {
        schemaText += `  - ${table}.${fk.column} → ${fk.references}.${fk.referencesColumn}\n`;
      }
    }
  }

  return schemaText;
}

async function getSchemaForDatabase(server, database) {
  const cacheKey = getCacheKey(server, database);
  const cached = schemaCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const schema = await fetchSchema(server, database);
  schemaCache.set(cacheKey, schema);
  return schema;
}

async function refreshSchemaForDatabase(server, database) {
  try {
    const schema = await fetchSchema(server, database);
    const relations = await fetchRelations(server, database);
    const cacheKey = getCacheKey(server, database);
    schemaCache.set(cacheKey, schema);
    relationsCache.set(cacheKey, relations);
    console.log(`🔄 [GATEWAY] Esquema actualizado: ${server}/${database} (${Object.keys(schema).length} tablas, ${Object.keys(relations).length} relaciones)`);
  } catch (error) {
    console.warn(`⚠️ [GATEWAY] No se pudo actualizar esquema de ${server}/${database}:`, error.message);
  }
}

setInterval(() => {
  for (const cacheKey of schemaCache.keys()) {
    const [server, database] = cacheKey.split("::");
    refreshSchemaForDatabase(server, database);
  }
}, SCHEMA_REFRESH_MS);

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
// FUNCIÓN PARA CORREGIR SQL AUTOMÁTICAMENTE
// ============================================
function fixSQL(sql) {
  let fixed = sql;

  // Eliminar TOP de consultas de agregación (COUNT, SUM, AVG, MIN, MAX)
  const aggregateRegex = /SELECT\s+TOP\s+\d+\s+(COUNT|SUM|AVG|MIN|MAX|COUNT\s*\(|SUM\s*\()/i;
  if (aggregateRegex.test(fixed)) {
    fixed = fixed.replace(/TOP\s+\d+\s+/i, "");
    console.log("🔧 [FIX] Eliminado TOP de consulta de agregación");
  }

  // Eliminar TOP cuando está después de SELECT pero antes de COUNT
  const topBeforeAggregateRegex = /SELECT\s+TOP\s+\d+\s+(COUNT|SUM|AVG)/i;
  if (topBeforeAggregateRegex.test(fixed)) {
    fixed = fixed.replace(/TOP\s+\d+\s+/i, "");
    console.log("🔧 [FIX] Eliminado TOP antes de función de agregación");
  }

  // Asegurar que comience con SELECT (si no tiene SELECT al inicio)
  const trimmed = fixed.trim().toUpperCase();
  if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH") && !trimmed.startsWith("UNION")) {
    fixed = "SELECT " + fixed;
    console.log("🔧 [FIX] Agregado SELECT al inicio");
  }

  // Eliminar múltiples SELECT anidados (SELECT SELECT)
  fixed = fixed.replace(/SELECT\s+SELECT/i, "SELECT");

  return fixed;
}

// ============================================
// GENERAR SQL - PROMPT CON JOIN AUTOMÁTICOS
// ============================================
async function generateSQL(message, database, table, schemaText, historyText) {
  const prompt = `
Eres un experto en SQL Server (T-SQL). Tu tarea es generar consultas SQL que sean LEGIBLES PARA USUARIOS NO TÉCNICOS.

CONTEXTO:
- Base de datos: ${database}
- Tabla sugerida: ${table}

ESQUEMA REAL (tablas, columnas y relaciones detectadas):
${schemaText}

CONVERSACIÓN RECIENTE:
${historyText}

REGLAS ESTRICTAS PARA HACER LA RESPUESTA LEGIBLE:
1. NUNCA devuelvas columnas que terminen en "Id" o "ID" (ej: ClienteId, ProductoId, PedidoId)
2. En su lugar, usa JOINs para traer el NOMBRE o DESCRIPCIÓN de la tabla relacionada
3. Usa las relaciones detectadas (🔗 FK) para saber qué columnas conectar
4. Siempre intenta reemplazar campos ID por nombres legibles:
   - ClienteId → traer Cliente.Nombre
   - ProductoId → traer Producto.Nombre o Producto.Descripcion
   - PedidoId → no es necesario mostrarlo, mejor muestra Fecha o referencia
5. Los alias deben ser claros: "Cliente" en lugar de "c", "Producto" en lugar de "p"
6. Si hay fecha, muéstrala en formato legible
7. Si no hay un nombre descriptivo, al menos no muestres el ID

EJEMPLO DE LO QUE DEBES GENERAR:
✅ BUENO:
SELECT TOP 10 
    c.Nombre AS Cliente,
    p.Fecha AS FechaPedido,
    pr.Nombre AS Producto,
    d.Cantidad
FROM [dbo].[Pedidos] p
INNER JOIN [dbo].[Clientes] c ON p.ClienteId = c.Id
INNER JOIN [dbo].[DetallePedidos] d ON p.Id = d.PedidoId
INNER JOIN [dbo].[Productos] pr ON d.ProductoId = pr.Id

❌ MALO (MUESTRA IDs):
SELECT TOP 10 ClienteId, ProductoId, PedidoId FROM [dbo].[Pedidos]

RESPONDE SOLO CON EL SQL. NADA MÁS.

Pregunta del usuario: ${message}
`;

  let sql = await callAzureOpenAIChatCompletion([
    { role: "user", content: prompt }
  ], 0.2);

  // Limpiar posibles markdown
  sql = sql.replace(/```sql\n?/gi, "").replace(/```\n?/g, "").trim();

  // Aplicar correcciones automáticas
  sql = fixSQL(sql);

  // Verificar si la consulta contiene IDs sin JOIN (intentar corregir)
  const hasIdColumn = /\b\w*[Ii]d\b/.test(sql);
  const hasJoin = /\bJOIN\b/i.test(sql);

  if (hasIdColumn && !hasJoin && !sql.toUpperCase().includes("COUNT")) {
    console.log("⚠️ [GATEWAY] Posible consulta con IDs sin JOIN, puede ser poco legible");
  }

  return sql;
}

// ============================================
// DETECTAR INTENCIÓN DE GRÁFICA
// ============================================
async function detectChartIntent(message) {
  const prompt = `
Eres un clasificador MUY ESTRICTO. Determina si el usuario QUIERE EXPLÍCITAMENTE una gráfica o visualización.

SOLO responde "true" si el usuario MENCIONA EXPLÍCITAMENTE una de estas palabras:
- "gráfica", "gráfico", "grafica", "grafico"
- "chart", "graph"
- "visualiza", "visualización"
- "dibuja", "plot", "barra", "línea", "pastel", "circular"

Si el usuario solo pregunta por datos, estadísticas, números o listados, responde "false".

Ejemplos:
- "Muéstrame una gráfica de ventas" → true
- "Dame el gráfico de barras" → true
- "¿Cuántos clientes hay?" → false
- "Lista los productos" → false
- "Visualiza los datos en una gráfica" → true

Mensaje del usuario: "${message}"
`;

  const content = await callAzureOpenAIChatCompletion([
    { role: "user", content: prompt }
  ], 0.1);

  const result = content.toLowerCase();
  console.log(`📊 [GATEWAY] detectChartIntent: "${message.substring(0, 50)}..." → ${result}`);
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

async function resolveContext(message, context) {
  const response = await fetch(`${CONTEXT_RESOLVER_URL}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "No se pudo resolver el contexto");
  }

  return data;
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
    // 0. FAST-PATH: DETECTAR CONSULTAS ADMIN
    if (detectAdminQuery(message)) {
      const adminResult = await handleAdminQuery(message, context);
      return res.json(adminResult);
    }

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

    const contextResult = await resolveContext(message, context);
    if (!contextResult.resolved) {
      if (contextResult.ambiguity) {
        return res.json({
          type: "ambiguity",
          message: contextResult.message,
          options: contextResult.options
        });
      }

      return res.json({
        type: "error",
        message: contextResult.message
      });
    }

    const target = contextResult.target || {};
    const server = target.server || DEFAULT_SQL_CONFIG.server;
    const database = target.database || DEFAULT_SQL_CONFIG.database;
    const table = target.table || context?.table || DEFAULT_SQL_CONFIG.defaultTable;

    console.log(`📚 Contexto resuelto: ${server}/${database}`);

    // Obtener esquema real de la BD con relaciones
    const schemaText = await getSchemaWithRelations(server, database);

    const historyItems = Array.isArray(context?.history) ? context.history.slice(-10) : [];
    const historyText = historyItems
      .map(item => `- ${item.role}: ${item.content}`)
      .join("\n");

    // Generar SQL (con correcciones automáticas)
    let query = await generateSQL(message, database, table, schemaText, historyText);
    console.log("📝 [GATEWAY] SQL generado:", query);

    // Ejecutar en MCP-SQL
    const sqlResponse = await fetch(`${MCP_SQL_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        connection: {
          server: server,
          database: database
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

  refreshSchemaForDatabase(DEFAULT_SQL_CONFIG.server, DEFAULT_SQL_CONFIG.database);
});

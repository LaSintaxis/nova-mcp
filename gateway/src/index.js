import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4.1-mini";
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";
const MCP_SQL_URL = process.env.MCP_SQL_URL || "http://localhost:5000";

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


async function generateSQL(message, target, table) {
  const prompt = `
Eres un experto en SQL Server.

Contexto:
- Base de datos: ${target.database}
- Tabla: ${table}

Reglas:
- SOLO devuelve SQL válido
- NO expliques nada
- NO uses markdown
- Usa SELECT
- Limita resultados si aplica

Pregunta:
${message}
`;

  return callAzureOpenAIChatCompletion([
    { role: "user", content: prompt }
  ], 0.2);
}


// Agrega esta función después de generateSQL

async function detectChartIntent(message) {
  const prompt = `
Eres un clasificador. Determina si el usuario QUIERE EXPLÍCITAMENTE una gráfica.

Palabras clave que indican gráfica:
- "gráfica", "gráfico", "grafica", "grafico"
- "chart", "graph"
- "visualiza", "visualización"
- "muéstrame en forma de gráfica"
- "dibuja", "plot"

Responde SOLO con "true" o "false". Nada más.

Mensaje: "${message}"
`;

  const content = await callAzureOpenAIChatCompletion([
    { role: "user", content: prompt }
  ], 0.1);

  const result = content.toLowerCase();
  return result === "true";
}



app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "gateway"
  });
});

app.post("/execute", async (req, res) => {
  const { message, context } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      type: "error",
      message: "El campo 'message' es obligatorio"
    });
  }

  try {
    // 🔹 1. Resolver contexto (a qué servidor/db ir)
    const contextResponse = await fetch("http://localhost:6000/resolve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        context
      })
    });

    if (!contextResponse.ok) {
      const contextErrorData = await contextResponse.json().catch(() => ({}));
      return res.status(contextResponse.status).json({
        type: "error",
        message: contextErrorData?.message || "Fallo al resolver contexto",
        details: contextErrorData
      });
    }

    const contextData = await contextResponse.json();

    // 🔴 Caso: no se pudo resolver
    if (!contextData.resolved) {
      if (contextData.ambiguity) {
        return res.json({
          type: "ambiguity",
          message: "Hay múltiples opciones",
          options: contextData.options
        });
      }

      return res.json({
        type: "error",
        message: contextData.message
      });
    }

    // 🔹 2. Contexto resuelto
    const target = contextData.target;

    console.log("Contexto resuelto:", target);

    // 🔹 3. (Temporal) Generar query simple con contexto
    const table = target.table || context?.table || "clientes";
    const query = await generateSQL(message, target, table);

    // 🔹 4. Llamar al MCP SQL
    const response = await fetch(`${MCP_SQL_URL}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        connection: {
          server: target.server,
          database: target.database
        }
      })
    });

    if (!response.ok) {
      const sqlErrorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        type: "error",
        message: sqlErrorData?.message || "Fallo al ejecutar consulta SQL",
        details: sqlErrorData,
        target
      });
    }

    const data = await response.json();

    const wantsChart = await detectChartIntent(message);

    res.json({
      type: "success",
      target,
      query,
      data: data.data,
      wantsChart: wantsChart,  // ← Agrega esto
      chartSuggestion: data.chartSuggestion  // ← Y esto
    });

  } catch (error) {
    console.error("Error en gateway:", error);

    res.status(500).json({
      type: "error",
      message: "Error en el gateway"
    });
  }
});


// ============================================
// NUEVO ENDPOINT: CHAT DIRECTO CON LA IA (SIN SQL)
// ============================================
app.post("/chat-direct", async (req, res) => {
  const { message, context = {} } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      type: "error",
      message: "El campo 'message' es obligatorio"
    });
  }

  console.log("📝 Chat directo con IA:", message);

  try {
    // Llamar directamente a Azure OpenAI sin pasar por SQL
    const prompt = `
Eres un asistente de infraestructura de TI llamado Novachat.

Eres amable, profesional y respondes en español.

El usuario pregunta: "${message}"

Responde de manera útil y clara.
`;

    const response = await callAzureOpenAIChatCompletion([
      { role: "user", content: prompt }
    ], 0.7);

    res.json({
      type: "success",
      response: response,
      source: "ai-direct"
    });

  } catch (error) {
    console.error("Error en chat-direct:", error);
    res.status(500).json({
      type: "error",
      message: error.message || "Error al comunicarse con la IA"
    });
  }
});


app.listen(4000, () => {
  console.log("MCP Gateway corriendo en puerto 4000 🚀");
});
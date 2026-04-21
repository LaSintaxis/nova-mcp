import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());


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

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Error con OpenAI");
  }

  return data.choices[0].message.content.trim();
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

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1
    })
  });

  const data = await response.json();
  const result = data.choices[0].message.content.trim().toLowerCase();
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
    const contextResponse = await fetch("http://context-resolver:6000/resolve", {
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
    const response = await fetch("http://mcp-sql:5000/query", {
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

app.listen(4000, () => {
  console.log("MCP Gateway corriendo en puerto 4000 🚀");
});
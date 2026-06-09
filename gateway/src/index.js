// gateway/index.js
// Orquestador IA — recibe mensajes del frontend, razona con Azure OpenAI
// y delega acciones al microservicio mcp-sql (y futuros mcp-)

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AzureOpenAI } from 'openai';
// Poner esto:
import { authMiddleware } from './middleware/auth.js';


dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use(authMiddleware);


const MAX_MESSAGE_CHARS = Number(process.env.MAX_MESSAGE_CHARS) || 800;

// ─────────────────────────────────────────
// CLIENTE AZURE OPENAI
// ─────────────────────────────────────────
const openai = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
});

// ─────────────────────────────────────────
// URLS DE MICROSERVICIOS
// Agregar futuros: MCP_AZURE_MONITOR_URL, MCP_DEVOPS_URL, etc.
// ─────────────────────────────────────────
const MCP_SQL_URL = process.env.MCP_SQL_URL || 'http://localhost:3002';

// ─────────────────────────────────────────
// HERRAMIENTAS MCP (Tool Calling para OpenAI)
// Cada herramienta mapea a un endpoint del microservicio
// ─────────────────────────────────────────
const MCP_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_sql_servers',
      description:
        'Lista los servidores SQL Server disponibles. Úsala cuando el usuario pregunte qué servidores hay o antes de hacer consultas si no se especifica servidor.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_databases',
      description: 'Lista las bases de datos disponibles en un servidor SQL Server específico.',
      parameters: {
        type: 'object',
        required: ['server'],
        properties: {
          server: {
            type: 'string',
            description: 'Alias del servidor (ej: "01", "02", "03"). Obtenido de list_sql_servers.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tables',
      description: 'Lista las tablas de una base de datos.',
      parameters: {
        type: 'object',
        required: ['server', 'database'],
        properties: {
          server: { type: 'string', description: 'Alias del servidor.' },
          database: { type: 'string', description: 'Nombre de la base de datos.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_table_schema',
      description: 'Obtiene las columnas y tipos de datos de una tabla. Úsala antes de generar una query para conocer la estructura exacta.',
      parameters: {
        type: 'object',
        required: ['server', 'database', 'table'],
        properties: {
          server: { type: 'string' },
          database: { type: 'string' },
          table: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_sql_query',
      description:
        'Genera el SQL basándote en el schema de las tablas.',
      parameters: {
        type: 'object',
        required: ['server', 'database', 'query'],
        properties: {
          server: { type: 'string', description: 'Alias del servidor.' },
          database: { type: 'string', description: 'Nombre de la base de datos.' },
          query: {
            type: 'string',
            description: 'Query válida en T-SQL. Sin punto y coma al final.',
          },
        },
      },
    },
  },

];

// ─────────────────────────────────────────
// EJECUTORES DE HERRAMIENTAS
// Llaman al microservicio correspondiente
// ─────────────────────────────────────────
async function executeTool(toolName, args) {
  try {
    switch (toolName) {
      case 'list_sql_servers': {
        const res = await fetch(`${MCP_SQL_URL}/servers`);
        return await res.json();
      }
      case 'list_databases': {
        const res = await fetch(`${MCP_SQL_URL}/databases?server=${encodeURIComponent(args.server)}`);
        return await res.json();
      }
      case 'list_tables': {
        const res = await fetch(
          `${MCP_SQL_URL}/tables?server=${encodeURIComponent(args.server)}&database=${encodeURIComponent(args.database)}`
        );
        return await res.json();
      }
      case 'get_table_schema': {
        const res = await fetch(
          `${MCP_SQL_URL}/schema?server=${encodeURIComponent(args.server)}&database=${encodeURIComponent(args.database)}&table=${encodeURIComponent(args.table)}`
        );
        return await res.json();
      }
      case 'execute_sql_query': {
        const res = await fetch(`${MCP_SQL_URL}/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        });
        return await res.json();
      }
      default:
        return { error: `Herramienta desconocida: ${toolName}` };
    }
  } catch (err) {
    console.error(`[gateway] Error ejecutando herramienta ${toolName}:`, err.message);
    return { error: err.message };
  }
}

// ─────────────────────────────────────────
// SYSTEM PROMPT
// Define la personalidad y límites del agente
// ─────────────────────────────────────────
function buildSystemPrompt() {
  return `Eres NovaChat, un asistente profesional de infraestructura de Novasoft.

CAPACIDADES ACTUALES:
- Consultar bases de datos SQL Server usando lenguaje natural
- Listar servidores, bases de datos y tablas disponibles

REGLAS IMPORTANTES:
1. SIEMPRE que el usuario pida datos de una tabla, primero usa get_table_schema para conocer las columnas exactas antes de generar el SQL.
2. Si el usuario no especifica el servidor, usa list_sql_servers y luego pregunta o elige el más apropiado según el contexto.
3. Si el usuario no especifica la base de datos, usa list_databases para listar las disponibles y preguntar.
4. Genera SQL T-SQL válido, sin punto y coma al final.
5. Cuando muestres resultados, sé conciso. Si hay muchas filas, resume los datos más importantes.
6. Responde siempre en español.
7. NO inventes nombres de tablas o columnas — siempre consulta el schema primero.

Fecha actual: ${new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}`;
}

// ─────────────────────────────────────────
// DETECCIÓN DE SI EL RESULTADO PUEDE
// VISUALIZARSE COMO GRÁFICA
// ─────────────────────────────────────────
function analyzeChartPossibility(data) {
  if (!Array.isArray(data) || data.length < 2) return { possible: false };

  const keys = Object.keys(data[0]);
  const numericKeys = keys.filter(k => typeof data[0][k] === 'number');
  const stringKeys = keys.filter(k => typeof data[0][k] === 'string');

  if (numericKeys.length > 0 && stringKeys.length > 0) {
    return {
      possible: true,
      labelKey: stringKeys[0],
      valueKey: numericKeys[0],
      chartType: data.length <= 6 ? 'pie' : 'bar',
    };
  }
  return { possible: false };
}

// ─────────────────────────────────────────
// ENDPOINT PRINCIPAL: POST /chat
// Recibe mensaje + historial del frontend
// ─────────────────────────────────────────
app.post('/chat', async (req, res) => {
  const { message, context } = req.body;

  if (!message) {
    return res.status(400).json({ type: 'error', message: 'Mensaje requerido' });
  }

  // Construir historial de mensajes para OpenAI
  const history = context?.history || [];
  const HISTORY_TURNS = Number(process.env.HISTORY_TURNS) || 3; 
  const SEND_SYSTEM_PROMPT = process.env.SEND_SYSTEM_PROMPT === 'true'; // si Foundry tiene el system prompt, cambiar a false para no enviarlo redundante en cada petición
  // Confiar en el historial enviado por el frontend (ya viene recortado por turnos).
  const messages = [
    ...(SEND_SYSTEM_PROMPT ? [{ role: 'system', content: buildSystemPrompt() }] : []),
    ...(Array.isArray(history) && history.length
      ? history.map(m => ({
          role: m.role,
          content: typeof m.content === 'string' && m.content.length > MAX_MESSAGE_CHARS
            ? m.content.slice(0, MAX_MESSAGE_CHARS) + '...TRUNCATED...'
            : m.content,
        }))
      : []),
  ];

  // Asegurar de que el último mensaje sea el actual
  if (messages[messages.length - 1]?.content !== message) {
    messages.push({ role: 'user', content: message });
  }

  try {
    // ── Agentic loop: el modelo puede llamar herramientas múltiples veces ──
    let iterations = 0;
    const MAX_ITERATIONS = 10; // seguridad anti-loop infinito

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      // Instrumentación por petición: id, tamaño estimado y número de mensajes
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const totalChars = messages.reduce((s, m) => s + ((m.content && typeof m.content === 'string') ? m.content.length : 0), 0);
      const estimatedPromptTokens = Math.ceil(totalChars / 4); // heurística: ~4 chars/token
      console.log(`[gateway][${requestId}] sending to model: messages=${messages.length} turns=${HISTORY_TURNS} chars=${totalChars} est_prompt_tokens=${estimatedPromptTokens}`);

      const completion = await openai.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT,
        messages,
        tools: MCP_TOOLS,
        tool_choice: 'auto',
        max_tokens: Number(process.env.MAX_TOKENS) || 512,
        temperature: 0.1, // bajo para respuestas más deterministas
      });

      console.log(`[gateway][${requestId}] completion.usage:`, completion.usage);
      const u = completion.usage || {};
      console.log(`[gateway][${requestId}] tokens prompt=${u.prompt_tokens} completion=${u.completion_tokens} total=${u.total_tokens}`);

      const choice = completion.choices[0];
      let assistantMessage = choice.message;

      // Truncar la respuesta del asistente si es muy larga para evitar inflar el prompt
      if (assistantMessage?.content && assistantMessage.content.length > MAX_MESSAGE_CHARS) {
        assistantMessage = {
          ...assistantMessage,
          content: assistantMessage.content.slice(0, MAX_MESSAGE_CHARS) + '...TRUNCATED...',
        };
      }

      // Agregar respuesta del asistente al historial de la sesión
      messages.push(assistantMessage);

      // Si no hay tool calls, el modelo terminó — devolver respuesta final
      if (choice.finish_reason !== 'tool_calls' || !assistantMessage.tool_calls?.length) {
        const responseText = assistantMessage.content || 'No se pudo generar una respuesta.';

        // Intentar extraer metadata del último tool call de SQL ejecutado
        const lastSqlCall = [...messages]
          .reverse()
          .find(m => m.role === 'tool' && m.tool_call_type === 'execute_sql_query');

        return res.json({
          type: 'success',
          response: responseText,
          source: 'azure-openai',
          metadata: lastSqlCall?.metadata || null,
        });
      }

      // Procesar cada tool call en paralelo
      const toolResults = await Promise.all(
        assistantMessage.tool_calls.map(async (toolCall) => {
          const toolName = toolCall.function.name;
          let args = {};
          try {
            args = JSON.parse(toolCall.function.arguments || '{}');
          } catch (_) { }

          console.log(`[gateway][${requestId}] Tool call: ${toolName}`, args);
          const result = await executeTool(toolName, args);
          const resultStr = JSON.stringify(result);
          console.log(`[gateway][${requestId}] Tool result: ${toolName} (chars=${resultStr.length})`);

          // Truncar el contenido de la herramienta antes de añadirlo al historial para evitar inflar el prompt
          const truncated = resultStr.length > MAX_MESSAGE_CHARS ? resultStr.slice(0, MAX_MESSAGE_CHARS) + '...TRUNCATED...' : resultStr;

          return {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: truncated,
            // metadata para enriquecer la respuesta final (no se manda a OpenAI como parte del objeto)
            tool_call_type: toolName,
            metadata:
              toolName === 'execute_sql_query'
                ? { server: args.server, database: args.database }
                : null,
          };
        })
      );

      // Agregar resultados de herramientas al historial
      messages.push(...toolResults);
    }

    // Si llega aquí, se agotaron las iteraciones
    return res.json({
      type: 'error',
      message: 'El agente no pudo completar la tarea en el número de pasos permitidos.',
    });
  } catch (err) {
    console.error('[gateway] Error en /chat:', err);
    return res.status(500).json({
      type: 'error',
      message: err.message || 'Error interno del servidor',
    });
  }
});







// ─────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────
app.get('/health', async (req, res) => {
  let sqlStatus = 'unknown';
  try {
    const r = await fetch(`${MCP_SQL_URL}/health`);
    const d = await r.json();
    sqlStatus = d.status;
  } catch (_) {
    sqlStatus = 'unreachable';
  }

  res.json({
    status: 'ok',
    service: 'gateway',
    dependencies: { 'mcp-sql': sqlStatus },
    model: process.env.AZURE_OPENAI_DEPLOYMENT,
  });
});

const PORT = process.env.GATEWAY_PORT || 3000;
app.listen(PORT, () => {
  console.log(`[gateway] Corriendo en http://localhost:${PORT}`);
});
import dotenv from "dotenv";
dotenv.config();

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4.1-mini";
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";

async function callAzureOpenAI(messages, temperature = 0.1) {
  const url = `${AZURE_OPENAI_ENDPOINT.replace(/\/$/, "")}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "api-key": AZURE_OPENAI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ messages, temperature })
  });
  
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message);
  return data.choices[0].message.content.trim();
}

async function detectChartIntent(message) {
  const prompt = `
Eres un clasificador. Determina si el usuario QUIERE EXPLÍCITAMENTE una gráfica.

Palabras clave que indican gráfica:
- "gráfica", "gráfico", "grafica", "grafico"
- "chart", "graph"
- "visualiza", "visualización"

Responde SOLO con "true" o "false". Nada más.

Mensaje: "${message}"
`;

  const content = await callAzureOpenAI([{ role: "user", content: prompt }], 0.1);
  return content.toLowerCase() === "true";
}

async function test() {
  console.log("=== Probando detección de intención de gráfica ===\n");
  
  const tests = [
    { message: "Muéstrame las ventas del mes", expected: false },
    { message: "Dame una gráfica de ventas", expected: true },
    { message: "Visualiza los clientes por región", expected: true },
    { message: "Lista los productos más vendidos", expected: false },
    { message: "Muéstrame un gráfico de barras", expected: true }
  ];
  
  for (const test of tests) {
    const result = await detectChartIntent(test.message);
    const status = result === test.expected ? "✅" : "❌";
    console.log(`${status} "${test.message}" → ${result} (esperado: ${test.expected})`);
  }
}

test();
# 📖 Guía de Uso del Chat - MCP Novasoft

## 🎯 Tipos de Queries que entiende

### 1️⃣ ADMIN QUERIES (Fast-Path - Sin OpenAI)

Estas queries se procesan **instantáneamente** sin pasar por Azure OpenAI.

#### Listar todas las bases de datos
```
"¿Cuáles son las bases de datos disponibles?"
"Lista las bases de datos"
"Mostrar servidores"
"Qué bases tenemos?"
```

**Respuesta:**
```
📊 **Servidores y bases de datos disponibles:**

**sql-01**: empresa1, empresa2
**sql-02**: clientes, ventas
**sql-03**: prueba_mcp
```

#### Listar bases de un servidor específico
```
"Muéstrame las bases del servidor sql-03"
"¿Qué bases hay en sql-03?"
"Lista las bases de datos del servidor sql-03"
```

**Respuesta:**
```
📊 **Bases de datos en sql-03:**

- prueba_mcp
- master
- msdb
```

#### Listar tablas (future - próximamente)
```
"¿Qué tablas hay en prueba_mcp?"
"Lista las tablas de la BD prueba_mcp"
```

---

### 2️⃣ SQL QUERIES (Con Clasificación + Schema + IA)

El sistema **automáticamente**:
1. Detecta que es una query SQL
2. Resuelve cuál servidor/BD basado en el mensaje
3. Fetcha el esquema con relaciones (FK)
4. Pide a IA que genere SQL legible (con JOINs)
5. Ejecuta en SQL Server
6. Formatea como tabla en markdown

#### Consultas simples
```
"¿Cuántos clientes hay?"
"Muéstrame los clientes"
"Dame los primeros 10 clientes"
"¿Cuál es el cliente con más pedidos?"
```

#### Especificando servidor
```
"¿Cuántos clientes hay en sql-03?"
"Lista los productos del servidor sql-01"
"¿Cuáles son los pedidos pendientes en empresa1?"
```

#### Con filtros
```
"Clientes de la ciudad de Bogotá"
"Pedidos del mes de diciembre"
"Productos con precio mayor a 100"
```

#### Con agregaciones
```
"Total de ventas por mes"
"Promedio de edad de clientes"
"Producto más vendido"
```

#### Con JOINs (automático)
```
"¿Quién es el cliente con más pedidos y cuál es el total?"
"Muéstrame cada pedido con el nombre del cliente y el producto"
"Clientes y sus productos comprados"
```

**Respuesta (ejemplo):**
```
📊 **Resultado de la consulta:**

Se encontraron 5 registros.

| Cliente | Fecha Pedido | Producto | Cantidad |
|---------|--------------|----------|----------|
| Acme Corp | 2024-01-15 | Widget A | 50 |
| Tech Inc | 2024-01-16 | Widget B | 25 |
| Global SA | 2024-01-17 | Widget C | 100 |
| ... | ... | ... | ... |

*... y 1 registros más.*
```

---

### 3️⃣ CHART REQUESTS (Detección Estricta)

Solo genera gráfica si mencionas EXPLÍCITAMENTE estas palabras:
- **gráfica**, **gráfico**, **grafica**, **grafico**
- **chart**, **graph**
- **visualiza**, **visualización**
- **barra**, **línea**, **pastel**, **circular**, **plot**

#### ✅ Genera gráfica
```
"Muéstrame una gráfica de ventas por mes"
"Dame el gráfico de barras de clientes"
"Visualiza los datos en un gráfico"
"Dibuja un gráfico de pie"
```

#### ❌ NO genera gráfica (solo datos)
```
"¿Cuántos clientes hay?"              → tabla
"Dame el total de ventas"             → número
"Productos más vendidos"              → tabla
"¿Cuál es el cliente favorito?"       → tabla
```

**Respuesta (con gráfica):**
```
📊 **Resultado de la consulta:**

Se encontraron 12 registros.

| Mes | Total Ventas |
|-----|--------------|
| Enero | 5000 |
| Febrero | 7500 |
...

💡 Se detectó que quieres visualizar esto en una gráfica.
[Frontend renderiza gráfico aquí]
```

---

### 4️⃣ CHAT GENERAL (Sin SQL)

Conversación normal, sin acceso a BD. Responde usando IA general.

#### Saludos
```
"Hola"
"¿Cómo estás?"
"Buenos días"
"Gracias"
```

#### Preguntas sobre el sistema
```
"¿Qué puedes hacer?"
"¿Cuáles son tus capacidades?"
"¿Cómo funcionas?"
"¿Qué es MCP?"
```

#### Ayuda general
```
"Ayuda"
"¿Cómo consulto datos?"
"¿Qué puedo preguntar?"
```

**Respuesta:**
```
💬 Soy Novachat, tu asistente de infraestructura de TI.

Puedo ayudarte a:
- 📊 Consultar datos de SQL Server (multi-servidor)
- 📈 Visualizar datos en gráficas
- 👥 Gestionar usuarios en Active Directory (próximamente)
- 🚀 Ver status de releases en DevOps (próximamente)

¿Qué necesitas?
```

---

## 🔄 Flujo Completo: Step-by-Step

### Ejemplo: "¿Cuántos clientes hay en sql-03?"

```
1️⃣ Usuario escribe mensaje
   └─> "¿Cuántos clientes hay en sql-03?"

2️⃣ Frontend envía a Backend
   POST http://localhost:3000/execute
   
3️⃣ Backend forwarda a Gateway
   POST http://localhost:4000/execute
   
4️⃣ Gateway detecta admin query? NO
   └─> Continúa...
   
5️⃣ Gateway clasifica intención
   └─> "sql" (no es chat general)
   
6️⃣ Gateway llama a Context Resolver
   POST http://localhost:6000/resolve
   └─> Extrae: server="sql-03", database="prueba_mcp", table="clientes"
   
7️⃣ Gateway fetcha schema (con cache)
   GET http://localhost:5000/schema?server=sql-03&database=prueba_mcp
   └─> Obtiene tablas, columnas, FK
   
8️⃣ Gateway llama a OpenAI
   └─> Genera: "SELECT COUNT(*) AS Total FROM clientes"
   
9️⃣ Gateway ejecuta en SQL Connector
   POST http://localhost:5000/query
   └─> Conecta a sql-03, ejecuta query
   
🔟 SQL Connector retorna datos
    └─> { data: [{ Total: 42 }], rowCount: 1 }
    
1️⃣1️⃣ Gateway formatea respuesta
    └─> Crea tabla markdown
    
1️⃣2️⃣ Frontend recibe y renderiza
    └─> Usuario ve: "Se encontraron 42 registros"
```

---

## 💡 Tips & Tricks

### ✅ Buenas prácticas

1. **Especifica servidor si no estás seguro**
   ```
   ❌ "¿Cuántos clientes?"  (ambiguo)
   ✅ "¿Cuántos clientes en sql-03?"  (claro)
   ```

2. **Usa palabras naturales**
   ```
   ❌ "SELECT * FROM clientes WHERE edad > 30"  (SQL puro)
   ✅ "Clientes mayores de 30 años"  (natural)
   ```

3. **Sé específico con fechas**
   ```
   ❌ "Ventas recientes"  (ambiguo)
   ✅ "Ventas de los últimos 30 días"  (específico)
   ```

4. **Agrupa queries relacionadas**
   ```
   Consulta 1: "¿Cuántos clientes hay?"
   Consulta 2: "¿Cuál es el cliente con más compras?"  ← Usa contexto anterior
   ```

### ⚡ Performance

- **Fast-path queries**: < 500ms (admin: list databases)
- **Simple SQL queries**: < 2s (con OpenAI)
- **Complex queries with JOINs**: < 5s (depende de BD)
- **Chat responses**: < 3s (solo OpenAI)

### 🔒 Limitaciones

1. **No puedes ver SQL Server directamente**
   - Todo pasa por la IA, que genera SQL seguro

2. **Solo 20 últimos mensajes se guardan**
   - localStorage tiene límite de 5MB

3. **No puedes ejecutar procedimientos almacenados (stored procs)**
   - Solo SELECT queries por ahora

4. **No hay gráficas en tiempo real**
   - Frontend puede agregar si el sistema crece

---

## 🚨 Errores Comunes & Soluciones

### Error: "No se pudo resolver el contexto"

**Causa:** No se puede determinar cuál servidor/BD usar

**Solución:**
```
❌ "Muéstrame clientes"
✅ "Muéstrame clientes de sql-03"
✅ "Muéstrame clientes de la BD empresa1"
```

### Error: "Fallo al ejecutar consulta SQL"

**Posibles causas:**
1. Tabla no existe → Verifica con "¿Qué tablas hay?"
2. Columna incorrecta → IA generó SQL malo
3. SQL Server sin respuesta → Verifica conectividad

### Error: "Azure OpenAI timeout"

**Solución:**
- Espera unos segundos e intenta de nuevo
- Si persiste, verifica conexión a internet

### Tabla aparece vacía

**Puede ser normal si:**
- No hay datos que coincidan el filtro
- La query es correcta pero sin resultados

**Verifica:**
```
"¿Cuántos registros hay en clientes?"  ← Primero confirma que hay datos
```

---

## 📊 Ejemplos Reales

### Caso 1: Reporte de Ventas

```
User: "¿Cuáles son las ventas totales por mes en el servidor sql-03?"

Bot: 
📊 **Resultado de la consulta:**

Se encontraron 12 registros.

| Mes | Año | Total Ventas |
|-----|-----|--------------|
| Enero | 2024 | $45,000 |
| Febrero | 2024 | $52,300 |
| ... | ... | ... |

Metadata: 12 registros de Ventas por mes
```

### Caso 2: Búsqueda de Cliente

```
User: "¿Qué pedidos ha hecho el cliente Acme Corp?"

Bot (after resolving):
📊 **Resultado de la consulta:**

Se encontraron 7 registros.

| Pedido ID | Fecha | Producto | Cantidad | Total |
|-----------|-------|----------|----------|-------|
| PED-001 | 2024-01-15 | Widget A | 50 | $5,000 |
| PED-002 | 2024-02-10 | Widget B | 25 | $2,500 |
| ... | ... | ... | ... | ... |

Cliente: Acme Corp (ID: 123) | Total gastado: $67,500
```

### Caso 3: Análisis Comparativo

```
User: "¿Cómo se comparan las ventas entre sql-01 y sql-02?"

Bot:
📊 **Comparativa de Ventas:**

**SQL-01 (empresa1)**: $245,000 (15 pedidos)
**SQL-02 (clientes)**: $189,500 (12 pedidos)

Diferencia: +$55,500 para sql-01 (+29%)
```

---

## 🎓 Aprendiendo el Sistema

1. **Comienza simple**: "Hola" → "¿Cuántos clientes hay?"
2. **Añade detalles**: "¿Cuántos clientes en sql-03?"
3. **Intenta agregaciones**: "Clientes por ciudad"
4. **Experimenta con JOINs**: "Clientes y sus pedidos"
5. **Pide visualizaciones**: "Gráfica de ventas por mes"

---

**¡Buena suerte explorando el sistema!**

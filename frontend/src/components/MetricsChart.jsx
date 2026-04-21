import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MetricsChart = ({ data, isUser = false }) => {
  if (!data || !data.data || data.data.length === 0) return null;
  
  // Determinar qué columnas usar para la gráfica
  const chartSuggestion = data.chartSuggestion;
  const chartData = data.data;
  
  // Si hay sugerencia del backend, usarla
  let xAxisKey = chartSuggestion?.xAxis || Object.keys(chartData[0])[0];
  let yAxisKey = chartSuggestion?.yAxis || Object.keys(chartData[0])[1];
  let chartType = chartSuggestion?.type || 'bar';
  
  // Verificar que las columnas existan
  if (!chartData[0][xAxisKey]) xAxisKey = Object.keys(chartData[0])[0];
  if (!chartData[0][yAxisKey]) yAxisKey = Object.keys(chartData[0])[1];
  
  // Transformar datos para recharts
  const formattedData = chartData.map(row => ({
    name: String(row[xAxisKey]).length > 20 ? String(row[xAxisKey]).slice(0, 20) + '...' : String(row[xAxisKey]),
    value: typeof row[yAxisKey] === 'number' ? row[yAxisKey] : 0
  }));
  
  // Si hay muchos datos, limitar a 20
  const displayData = formattedData.slice(0, 20);
  
  return (
    <div className="chart-container">
      <div className="chart-title">{data.title || 'Resultados'}</div>
      <ResponsiveContainer width="100%" height={300}>
        {chartType === 'bar' ? (
          <BarChart data={displayData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0} fontSize={10} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill={isUser ? '#81c784' : '#4caf50'} name={yAxisKey} />
          </BarChart>
        ) : (
          <LineChart data={displayData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0} fontSize={10} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke={isUser ? '#81c784' : '#4caf50'} name={yAxisKey} />
          </LineChart>
        )}
      </ResponsiveContainer>
      <div className="text-small" style={{ textAlign: 'center', marginTop: '8px' }}>
        Mostrando {displayData.length} de {chartData.length} registros | Eje X: {xAxisKey} | Eje Y: {yAxisKey}
      </div>
    </div>
  );
};

export default MetricsChart;
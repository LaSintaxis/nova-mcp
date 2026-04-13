const MetricsChart = ({ data, isUser = false }) => {
  if (!data) return null
  
  return (
    <div className="chart-container">
      {data.title && <div className="chart-title">{data.title}</div>}
      <div className="chart-placeholder">
        📊 Aquí aparecerá la gráfica cuando el backend envíe datos reales
        {data.metric_name && <div className="text-small">Métrica: {data.metric_name}</div>}
      </div>
    </div>
  )
}

export default MetricsChart
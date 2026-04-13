import MetricsChart from './MetricsChart'

const MessageBubble = ({ message }) => {
  const isUser = message.role === 'user'
  
  // Formatear el contenido (soporta saltos de línea básicos)
  const formattedContent = message.content.split('\n').map((line, i) => (
    <span key={i}>
      {line}
      {i < message.content.split('\n').length - 1 && <br />}
    </span>
  ))
  
  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-content">
        <div className="message-text">
          {formattedContent}
        </div>
        
        {/* Placeholder para gráficas (cuando el backend las envíe) */}
        {message.chartData && (
          <MetricsChart data={message.chartData} isUser={isUser} />
        )}
        
        {/* Metadata opcional */}
        {message.metadata && (
          <div className="message-metadata">
            {message.metadata.tool_used && <span>🔧 {message.metadata.tool_used}</span>}
            {message.metadata.duration_ms && <span>⏱️ {message.metadata.duration_ms}ms</span>}
          </div>
        )}
      </div>
    </div>
  )
}

export default MessageBubble
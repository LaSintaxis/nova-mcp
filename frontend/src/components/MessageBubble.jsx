import MetricsChart from './MetricsChart'
import '../styles/MessageBubble.css'

const MessageBubble = ({ message }) => {
  const isUser = message.role === 'user'

  const parseRow = (line) => {
    const trimmed = line.trim()
    const parts = trimmed.split('|').map(cell => cell.trim())
    if (parts.length <= 2) return []
    const start = trimmed.startsWith('|') ? 1 : 0
    const end = trimmed.endsWith('|') ? parts.length - 1 : parts.length
    return parts.slice(start, end)
  }

  const parseContentBlocks = (content) => {
    const lines = content.split('\n')
    const blocks = []
    let i = 0

    while (i < lines.length) {
      const line = lines[i]
      const nextLine = lines[i + 1]

      const isTableHeader = line?.includes('|')
      const isSeparator = nextLine && /^\s*\|?\s*[-:]+[\s|-]*\|?\s*$/.test(nextLine)

      if (isTableHeader && isSeparator) {
        const headerCells = parseRow(line)
        const rows = []
        i += 2
        while (i < lines.length && lines[i].includes('|')) {
          const rowCells = parseRow(lines[i])
          if (rowCells.length > 0) {
            rows.push(rowCells)
          }
          i += 1
        }

        blocks.push({ type: 'table', headers: headerCells, rows })
        continue
      }

      blocks.push({ type: 'text', content: line })
      i += 1
    }

    return blocks
  }

  const blocks = parseContentBlocks(message.content)
  
  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-content">
        <div className="message-text">
          {blocks.map((block, index) => {
            if (block.type === 'table') {
              return (
                <div className="message-table-wrapper" key={`table-${index}`}>
                  <table className="message-table">
                    <thead>
                      <tr>
                        {block.headers.map((header, headerIndex) => (
                          <th key={`header-${index}-${headerIndex}`}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, rowIndex) => (
                        <tr key={`row-${index}-${rowIndex}`}>
                          {row.map((cell, cellIndex) => (
                            <td key={`cell-${index}-${rowIndex}-${cellIndex}`}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }

            return (
              <span key={`text-${index}`}>
                {block.content}
                {index < blocks.length - 1 && <br />}
              </span>
            )
          })}
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
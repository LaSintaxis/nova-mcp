import '../styles/ChatHeader.css';
const ChatHeader = () => {
  const loggedUserName = 'Pepito Perez'
  const [firstName = '', firstLastName = ''] = loggedUserName.trim().split(/\s+/)
  const userInitials = `${firstName.charAt(0)}${firstLastName.charAt(0)}`.toUpperCase()
  return (
    <header className="chat-header">
      <div>
        <h1>
          Asistente Virtual
        </h1>
        <p>Conectado a MCP Server • Preview</p>
      </div>
      <div className="user-info">
        <span className="user-avatar" title={loggedUserName} aria-label={`Usuario: ${loggedUserName}`}>
          {userInitials}
        </span>
        <span>Pepito Perez</span>
      </div>
    </header>
  )
}

export default ChatHeader;
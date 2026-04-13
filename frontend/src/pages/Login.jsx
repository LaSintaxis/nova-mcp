import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

const Login = () => {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  const handleMicrosoftLogin = async () => {
    setIsLoading(true)
    // Aquí irá la autenticación de Microsoft Entra ID
    // Por ahora solo simula la carga
    setTimeout(() => {
      navigate('/chat')
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div className="login-container">
      {/* Fondo decorativo con gradiente */}
      <div className="login-background">
        <div className="gradient-orb gradient-orb-1"></div>
        <div className="gradient-orb gradient-orb-2"></div>
      </div>

      {/* Contenedor principal */}
      <div className="login-content">
        {/* Card de Login */}
        <div className="login-card">
          {/* Header con logo/titulo */}
          <div className="login-header">
            <img className="login-logo" src="../public/nova-logo.jpg" alt="" />
            
            <p className="login-subtitle">Asistente Virtual de Infraestructura</p>
          </div>

          {/* Divider */}
          <div className="login-divider"></div>

          {/* Contenido principal */}
          <div className="login-body">
            <p className="login-description">
              Accede con tu cuenta corporativa de Microsoft Entra ID para comenzar
            </p>

            {/* Botón Microsoft Login */}
            <button 
              className="microsoft-login-button"
              onClick={handleMicrosoftLogin}
              disabled={isLoading}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="7" height="7" fill="currentColor"/>
                <rect x="10" y="1" width="7" height="7" fill="currentColor"/>
                <rect x="1" y="10" width="7" height="7" fill="currentColor"/>
                <rect x="10" y="10" width="7" height="7" fill="currentColor"/>
              </svg>
              {isLoading ? 'Conectando...' : 'Iniciar sesión con Microsoft'}
            </button>

            {/* Info de seguridad */}
            <div className="login-security-info">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1L2 4v4c0 3.31 4 6 6 6s6-2.69 6-6V4l-6-3z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Tus datos están protegidos por Azure AD</span>
            </div>
          </div>

          {/* Footer */}
          <div className="login-footer">
            <p>© 2026 Novasoft. Todos los derechos reservados.</p>
          </div>
        </div>

        {/* Panel informativo derecho */}
        <div className="login-features">
          <h2>Características</h2>
          <div className="features-list">
            <div className="feature-item">
              <div className="feature-icon">📊</div>
              <div>
                <h3>Consultas SQL</h3>
                <p>Accede a datos en tiempo real</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🖥️</div>
              <div>
                <h3>VM Management</h3>
                <p>Gestiona máquinas virtuales</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📈</div>
              <div>
                <h3>Análisis</h3>
                <p>Visualiza métricas y reportes</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login

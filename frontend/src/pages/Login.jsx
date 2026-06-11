import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { employeeLoginRequest } from '../auth/msalConfig';
import '../styles/Login.css';

const Login = () => {
  const navigate = useNavigate();
  const { instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // efecto para cuando la autenticación sea exitosa
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/chat');
    }
  }, [isAuthenticated, navigate]);

  // ── SSO ─────────────
  const handleMicrosoftLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      await instance.loginRedirect(employeeLoginRequest);
    } catch (e) {
      setError('Error al conectar con Microsoft. Intenta de nuevo.');
      setIsLoading(false);
    }
  };


  return (
    <div className="login-container">
      <div className="login-background">
        <div className="gradient-orb gradient-orb-1"></div>
        <div className="gradient-orb gradient-orb-2"></div>
      </div>

      <div className="login-content">
        <div className="login-card">
          <div className="login-header">
            <img className="login-logo" src="/nova-logo.jpg" alt="Nova Logo" />
            <p className="login-subtitle">Asistente Virtual de Infraestructura</p>
          </div>

          <br />

          <div className="login-body">
            <p className="login-description">
              Acceda con su cuenta corporativa de Microsoft para comenzar
            </p>

            {error && (
              <p style={{ color: '#e53e3e', fontSize: '0.875rem', marginBottom: '12px' }}>
                {error}
              </p>
            )}

            <button
              className="microsoft-login-button"
              disabled={isLoading}
              onClick={handleMicrosoftLogin}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="1" width="7" height="7" fill="currentColor" />
                <rect x="10" y="1" width="7" height="7" fill="currentColor" />
                <rect x="1" y="10" width="7" height="7" fill="currentColor" />
                <rect x="10" y="10" width="7" height="7" fill="currentColor" />
              </svg>
              {isLoading ? 'Conectando...' : 'Iniciar sesión con Microsoft'}
            </button>




            <div className="login-security-info">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L2 4v4c0 3.31 4 6 6 6s6-2.69 6-6V4l-6-3z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Sus datos están protegidos por Azure AD</span>
            </div>
          </div>

          <div className="login-footer">
            <p>© 2026 Novasoft. Todos los derechos reservados.</p>
          </div>
        </div>

        <div className="login-features">
          <h2>Asistente IA</h2>
          <div className="features-list">
            <div className="feature-item">
              <div className="feature-icon">📊</div>
              <div>
                <h3>Consultas SQL</h3>
                <p>Obtenga información e interpretaciones de bases de datos</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🖥️</div>
              <div>
                <h3>Gestión de VMs</h3>
                <p>Monitoree máquinas virtuales</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
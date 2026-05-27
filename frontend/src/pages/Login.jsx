import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('employees');
  const [clientUser, setClientUser] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [clientLoading, setClientLoading] = useState(false);


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
            {/* Pestañas: Cliente / Empleado */}
            <div className="login-tabs" role="tablist" aria-label="Tipo de acceso">
              <button
                type="button"
                className={`login-tab ${activeTab === 'clients' ? 'active' : ''}`}
                role="tab"
                aria-selected={activeTab === 'clients'}
                onClick={() => setActiveTab('clients')}
              >
                Cliente
              </button>
              <button
                type="button"
                className={`login-tab ${activeTab === 'employees' ? 'active' : ''}`}
                role="tab"
                aria-selected={activeTab === 'employees'}
                onClick={() => setActiveTab('employees')}
              >
                Empleado
              </button>
            </div>

            <p className="login-description">
              {activeTab === 'employees'
                ? 'Acceda con su cuenta corporativa de Microsoft para comenzar'
                : 'Ingrese sus credenciales de dominio para continuar'}
            </p>

            {/* EMPLEADO: SSO Microsoft */}
            {activeTab === 'employees' && (
              <button
                className="microsoft-login-button"
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
            )}

            {/* CLIENTE: Usuario/contraseña */}
            {activeTab === 'clients' && (
              <form className="client-login">
                <input
                  type="text"
                  className="client-input"
                  placeholder="Usuario de dominio (ej: empresa\usuario)"
                  value={clientUser}
                  onChange={(event) => setClientUser(event.target.value)}
                  disabled={clientLoading}
                />
                <input
                  type="password"
                  className="client-input"
                  placeholder="Contraseña"
                  value={clientPassword}
                  onChange={(event) => setClientPassword(event.target.value)}
                  disabled={clientLoading}
                />
                <button 
                  className="microsoft-login-button" 
                  type="submit"
                  disabled={clientLoading}
                >
                  {clientLoading ? 'Validando...' : 'Iniciar sesión'}
                </button>
              </form>
            )}

            <div className="login-security-info">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1L2 4v4c0 3.31 4 6 6 6s6-2.69 6-6V4l-6-3z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
                <p>Accede a tus bases de datos en lenguaje natural</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🖥️</div>
              <div>
                <h3>Gestión de VMs</h3>
                <p>Controla tus máquinas virtuales</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📈</div>
              <div>
                <h3>Reportes SSRS</h3>
                <p>Consulta tus reportes empresariales</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
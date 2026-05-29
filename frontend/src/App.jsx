// frontend/src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Chat from './pages/Chat'
import ProtectedRoute from './components/ProtectedRoute' // <-- Importa el guardián

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route 
          path="/chat" 
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  )
}

export default App
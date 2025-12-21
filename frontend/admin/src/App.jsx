import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import BusinessInfo from './pages/BusinessInfo';
import Tools from './pages/Tools';
import Plans from './pages/Plans';
import Conversations from './pages/Conversations';
import ConversationDetail from './pages/ConversationDetail';
import Escalations from './pages/Escalations';
import Integrations from './pages/Integrations';
import TestChat from './pages/TestChat';
import Billing from './pages/Billing';
import UsageReports from './pages/UsageReports';
import Settings from './pages/Settings';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/clients/:id" element={<ClientDetail />} />
                <Route path="/clients/:id/business-info" element={<BusinessInfo />} />
                <Route path="/tools" element={<Tools />} />
                <Route path="/plans" element={<Plans />} />
                <Route path="/conversations" element={<Conversations />} />
                <Route path="/conversations/:id" element={<ConversationDetail />} />
                <Route path="/escalations" element={<Escalations />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/test-chat" element={<TestChat />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/usage" element={<UsageReports />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;

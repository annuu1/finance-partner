import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AuthForm from './components/AuthForm';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import DailySales from './components/DailySales';
import Partners from './components/Partners';
import Expenses from './components/Expenses';
import Reports from './components/Reports';
import PersonalSpace from './components/PersonalSpace';
import UserProfile from './components/UserProfile';
import PersonalChat from './components/PersonalChat';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'sales':
        return <DailySales />;
      case 'partners':
        return <Partners />;
      case 'expenses':
        return <Expenses />;
      case 'reports':
        return <Reports />;
      case 'personal':
        return <PersonalSpace />;
      case 'profile':
        return <UserProfile />;
      case 'chat':
        return <PersonalChat />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
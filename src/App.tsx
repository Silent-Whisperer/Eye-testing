import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import AdminDashboard from './components/AdminDashboard';
import AuthPage from './components/AuthPage';

export type AppUser = {
  email: string;
};

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);

  const handleLogin = (userData: AppUser) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {user ? (
        <AdminDashboard user={user} onLogout={handleLogout} />
      ) : (
        <AuthPage onLogin={handleLogin} />
      )}
      <Toaster position="top-right" />
    </div>
  );
}

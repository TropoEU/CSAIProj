/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('customerToken');
    if (token) {
      // Token exists, consider user authenticated
      // We'll get client info from dashboard overview
      const storedClient = localStorage.getItem('customerInfo');
      if (storedClient) {
        setClient(JSON.parse(storedClient));
      }
    }
    setLoading(false);
  }, []);

  const login = async (accessCode, rememberMe = false) => {
    const response = await auth.login(accessCode, rememberMe);
    const { token, client } = response.data;
    localStorage.setItem('customerToken', token);
    localStorage.setItem('customerInfo', JSON.stringify(client));
    setClient(client);
    return client;
  };

  const logout = () => {
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerInfo');
    setClient(null);
  };

  return (
    <AuthContext.Provider
      value={{
        client,
        isAuthenticated: !!client,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

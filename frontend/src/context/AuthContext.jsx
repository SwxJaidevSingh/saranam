/**
 * Authentication Context
 */
import React, { createContext, useState, useContext, useEffect } from 'react';
import { authApi } from '../api/auth';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if user is already logged in
    const initAuth = async () => {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('access_token');

      if (storedUser && token) {
        try {
          // Verify token by fetching user data
          const response = await authApi.getMe();
          setUser(response.user);
        } catch (err) {
          // Token invalid, clear storage
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await authApi.login({ email, password });

      // Store tokens and user data
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);
      localStorage.setItem('user', JSON.stringify(response.user));

      setUser(response.user);
      return { success: true };
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // Ignore errors during logout
    } finally {
      // Clear local storage
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      const response = await authApi.register(userData);
      return { success: true, user: response.user };
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Registration failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const hasRole = (role) => {
    return user?.role === role;
  };

  const hasPermission = (permission) => {
    // Map permissions based on role
    const rolePermissions = {
      admin: [
        'view_analytics', 'manage_users', 'view_patients',
        'create_patients', 'view_all_assessments', 'manage_prescriptions',
        'manage_scheduling', 'view_physio_assessment', 'view_psych_assessment'
      ],
      doctor: [
        'view_patients',
        'create_patients', 'view_all_assessments', 'manage_prescriptions',
        'manage_scheduling'
      ],
      nurse: [
        'view_patients',
        'create_patients', 'view_all_assessments', 'manage_scheduling'
      ],
      physiotherapist: [
        'view_patients',
        'create_patients', 'view_all_assessments', 'manage_scheduling', 'view_physio_assessment'
      ],
      counsellor: [
        'view_patients',
        'create_patients', 'view_all_assessments', 'manage_scheduling', 'view_psych_assessment'
      ],
      data_entry: [
        'create_patients', 'manage_scheduling', 'view_patients'
      ]
    };

    return rolePermissions[user?.role]?.includes(permission) || false;
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    register,
    hasRole,
    hasPermission
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
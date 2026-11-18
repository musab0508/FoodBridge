import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const RoleGuard = ({ allowedRoles, children }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin superuser override
  if (user.is_superuser || user.role === 'ADMIN') {
    return children;
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect to proper role dashboard
    if (user.role === 'NGO') return <Navigate to="/dashboard/ngo" replace />;
    if (user.role === 'DONOR') return <Navigate to="/dashboard/donor" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
};

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useEmployee } from '../contexts/EmployeeContext';
import LoadingSpinner from './LoadingSpinner';

interface ProtectedEmployeeRouteProps {
  children: React.ReactNode;
}

const ProtectedEmployeeRoute: React.FC<ProtectedEmployeeRouteProps> = ({ children }) => {
  const { isAuthenticated, loading } = useEmployee();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/employee/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedEmployeeRoute;


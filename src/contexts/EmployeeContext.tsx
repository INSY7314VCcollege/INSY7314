import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { employeeAPI } from '../services/api';
import { Employee, EmployeeLoginCredentials } from '../types/employee';
import toast from 'react-hot-toast';

interface EmployeeContextType {
  employee: Employee | null;
  token: string | null;
  loading: boolean;
  login: (credentials: EmployeeLoginCredentials) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

export const useEmployee = () => {
  const context = useContext(EmployeeContext);
  if (!context) {
    throw new Error('useEmployee must be used within an EmployeeProvider');
  }
  return context;
};

interface EmployeeProviderProps {
  children: ReactNode;
}

export const EmployeeProvider: React.FC<EmployeeProviderProps> = ({ children }) => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing employee session
    const storedToken = localStorage.getItem('employeeToken');
    const storedEmployee = localStorage.getItem('employee');
    const storedRefreshToken = localStorage.getItem('employeeRefreshToken');

    if (storedToken && storedEmployee) {
      try {
        setToken(storedToken);
        setEmployee(JSON.parse(storedEmployee));
        
        // Verify token is still valid
        employeeAPI.getCurrentEmployee()
          .then((response) => {
            if (response.success && response.data) {
              setEmployee(response.data.employee);
            }
          })
          .catch(() => {
            // Token invalid, try refresh
            if (storedRefreshToken) {
              employeeAPI.refreshToken(storedRefreshToken)
                .then((refreshResponse) => {
                  if (refreshResponse.success && refreshResponse.data) {
                    const { token: newToken, refreshToken: newRefreshToken, employee: newEmployee } = refreshResponse.data;
                    setToken(newToken);
                    setEmployee(newEmployee);
                    localStorage.setItem('employeeToken', newToken);
                    localStorage.setItem('employeeRefreshToken', newRefreshToken);
                    localStorage.setItem('employee', JSON.stringify(newEmployee));
                  } else {
                    // Refresh failed, clear session
                    logout();
                  }
                })
                .catch(() => {
                  logout();
                });
            } else {
              logout();
            }
          });
      } catch (error) {
        console.error('Error loading employee session:', error);
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = async (credentials: EmployeeLoginCredentials) => {
    try {
      setLoading(true);
      const response = await employeeAPI.login(
        credentials.username,
        credentials.employeeId,
        credentials.password
      );

      if (response.success && response.data) {
        const { employee: employeeData, token: authToken, refreshToken } = response.data;
        setEmployee(employeeData);
        setToken(authToken);
        
        // Store in localStorage
        localStorage.setItem('employeeToken', authToken);
        localStorage.setItem('employeeRefreshToken', refreshToken);
        localStorage.setItem('employee', JSON.stringify(employeeData));
        
        toast.success('Login successful');
      } else {
        throw new Error(response.error || 'Login failed');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Login failed';
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setEmployee(null);
    setToken(null);
    localStorage.removeItem('employeeToken');
    localStorage.removeItem('employeeRefreshToken');
    localStorage.removeItem('employee');
    
    // Call logout API
    employeeAPI.logout().catch(() => {
      // Ignore errors on logout
    });
  };

  const value: EmployeeContextType = {
    employee,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!employee && !!token,
  };

  return <EmployeeContext.Provider value={value}>{children}</EmployeeContext.Provider>;
};


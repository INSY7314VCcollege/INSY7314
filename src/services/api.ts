import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { AuthResponse, RegisterData } from '../types/auth';
import { PaymentData, PaymentResponse, TransactionsResponse, Currency, PaymentProvider, PaymentLimits } from '../types/payment';
import { EmployeeAuthResponse, TransactionStatistics } from '../types/employee';

// Create axios instance with default config
const createAPIInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor to add auth token
  instance.interceptors.request.use(
    (config) => {
      // Check if this is an employee route
      const isEmployeeRoute = config.url?.includes('/employees');
      const token = isEmployeeRoute 
        ? localStorage.getItem('employeeToken') 
        : localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor for error handling
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // Handle 401 errors (token expired)
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const isEmployeeRoute = originalRequest.url?.includes('/employees');
          const refreshToken = isEmployeeRoute
            ? localStorage.getItem('employeeRefreshToken')
            : localStorage.getItem('refreshToken');
          
          if (refreshToken) {
            const response = isEmployeeRoute
              ? await employeeAPI.refreshToken(refreshToken)
              : await authAPI.refreshToken(refreshToken);
              
            if (response.success && response.data) {
              const { token, refreshToken: newRefreshToken } = response.data;
              
              if (isEmployeeRoute) {
                localStorage.setItem('employeeToken', token);
                localStorage.setItem('employeeRefreshToken', newRefreshToken);
              } else {
                localStorage.setItem('authToken', token);
                localStorage.setItem('refreshToken', newRefreshToken);
              }
              
              // Retry original request with new token
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return instance(originalRequest);
            }
          }
        } catch (refreshError) {
          // Refresh failed, redirect to appropriate login
          const isEmployeeRoute = originalRequest.url?.includes('/employees');
          if (isEmployeeRoute) {
            localStorage.removeItem('employeeToken');
            localStorage.removeItem('employeeRefreshToken');
            localStorage.removeItem('employee');
            window.location.href = '/employee/login';
          } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

const api = createAPIInstance();

// Auth API
export const authAPI = {
  login: async (username: string, accountNumber: string, password: string): Promise<AuthResponse> => {
    const response: AxiosResponse<AuthResponse> = await api.post('/auth/login', {
      username,
      accountNumber,
      password,
    });
    return response.data;
  },

  register: async (userData: RegisterData): Promise<AuthResponse> => {
    const response: AxiosResponse<AuthResponse> = await api.post('/auth/register', userData);
    return response.data;
  },

  logout: async (token: string): Promise<{ success: boolean }> => {
    const response: AxiosResponse<{ success: boolean }> = await api.post('/auth/logout', {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  refreshToken: async (refreshToken: string): Promise<AuthResponse> => {
    const response: AxiosResponse<AuthResponse> = await api.post('/auth/refresh', {
      refreshToken,
    });
    return response.data;
  },

  getCurrentUser: async (token: string): Promise<AuthResponse> => {
    const response: AxiosResponse<AuthResponse> = await api.get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response: AxiosResponse<{ success: boolean; message?: string; error?: string }> = await api.put('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  forgotPassword: async (username: string, accountNumber: string): Promise<{ success: boolean; message?: string }> => {
    const response: AxiosResponse<{ success: boolean; message?: string }> = await api.post('/auth/forgot-password', {
      username,
      accountNumber,
    });
    return response.data;
  },
};

// Payment API
export const paymentAPI = {
  makePayment: async (paymentData: PaymentData): Promise<PaymentResponse> => {
    const response: AxiosResponse<PaymentResponse> = await api.post('/payments/make-payment', paymentData);
    return response.data;
  },

  getTransactions: async (page: number = 1, limit: number = 20, status?: string): Promise<TransactionsResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (status) {
      params.append('status', status);
    }

    const response: AxiosResponse<TransactionsResponse> = await api.get(`/payments/transactions?${params}`);
    return response.data;
  },

  getTransaction: async (id: string): Promise<PaymentResponse> => {
    const response: AxiosResponse<PaymentResponse> = await api.get(`/payments/transactions/${id}`);
    return response.data;
  },

  cancelTransaction: async (id: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response: AxiosResponse<{ success: boolean; message?: string; error?: string }> = await api.put(`/payments/transactions/${id}/cancel`);
    return response.data;
  },

  getCurrencies: async (): Promise<{ success: boolean; data: { currencies: Currency[] } }> => {
    const response: AxiosResponse<{ success: boolean; data: { currencies: Currency[] } }> = await api.get('/payments/currencies');
    return response.data;
  },

  getProviders: async (): Promise<{ success: boolean; data: { providers: PaymentProvider[] } }> => {
    const response: AxiosResponse<{ success: boolean; data: { providers: PaymentProvider[] } }> = await api.get('/payments/providers');
    return response.data;
  },

  getLimits: async (): Promise<{ success: boolean; data: { limits: PaymentLimits } }> => {
    const response: AxiosResponse<{ success: boolean; data: { limits: PaymentLimits } }> = await api.get('/payments/limits');
    return response.data;
  },

  validateSwiftCode: async (swiftCode: string): Promise<{ success: boolean; data?: any; error?: string }> => {
    const response: AxiosResponse<{ success: boolean; data?: any; error?: string }> = await api.post('/payments/validate-swift', {
      swiftCode,
    });
    return response.data;
  },
};

// User API
export const userAPI = {
  getProfile: async (): Promise<{ success: boolean; data: { user: any } }> => {
    const response: AxiosResponse<{ success: boolean; data: { user: any } }> = await api.get('/users/profile');
    return response.data;
  },

  updateProfile: async (userData: any): Promise<{ success: boolean; message?: string; data?: { user: any } }> => {
    const response: AxiosResponse<{ success: boolean; message?: string; data?: { user: any } }> = await api.put('/users/profile', userData);
    return response.data;
  },

  getSecurityStatus: async (): Promise<{ success: boolean; data: { securityStatus: any } }> => {
    const response: AxiosResponse<{ success: boolean; data: { securityStatus: any } }> = await api.get('/users/security-status');
    return response.data;
  },

  enable2FA: async (): Promise<{ success: boolean; data?: any }> => {
    const response: AxiosResponse<{ success: boolean; data?: any }> = await api.post('/users/enable-2fa');
    return response.data;
  },

  verify2FA: async (token: string): Promise<{ success: boolean; message?: string }> => {
    const response: AxiosResponse<{ success: boolean; message?: string }> = await api.post('/users/verify-2fa', { token });
    return response.data;
  },

  disable2FA: async (token: string): Promise<{ success: boolean; message?: string }> => {
    const response: AxiosResponse<{ success: boolean; message?: string }> = await api.post('/users/disable-2fa', { token });
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message?: string }> => {
    const response: AxiosResponse<{ success: boolean; message?: string }> = await api.put('/users/change-password', { 
      currentPassword, 
      newPassword 
    });
    return response.data;
  },

  getActivity: async (page: number = 1, limit: number = 20): Promise<{ success: boolean; data: { activities: any[]; pagination: any } }> => {
    const response: AxiosResponse<{ success: boolean; data: { activities: any[]; pagination: any } }> = await api.get(`/users/activity?page=${page}&limit=${limit}`);
    return response.data;
  },
};

// Health check
export const healthAPI = {
  check: async (): Promise<{ status: string; timestamp: string; uptime: number; environment: string }> => {
    const response: AxiosResponse<{ status: string; timestamp: string; uptime: number; environment: string }> = await api.get('/health');
    return response.data;
  },
};

// Employee API
export const employeeAPI = {
  login: async (username: string, employeeId: string, password: string): Promise<EmployeeAuthResponse> => {
    const response: AxiosResponse<EmployeeAuthResponse> = await api.post('/employees/login', {
      username,
      employeeId,
      password,
    });
    return response.data;
  },

  logout: async (): Promise<{ success: boolean }> => {
    const response: AxiosResponse<{ success: boolean }> = await api.post('/employees/logout');
    return response.data;
  },

  refreshToken: async (refreshToken: string): Promise<EmployeeAuthResponse> => {
    const response: AxiosResponse<EmployeeAuthResponse> = await api.post('/employees/refresh', {
      refreshToken,
    });
    return response.data;
  },

  getCurrentEmployee: async (): Promise<{ success: boolean; data?: { employee: any } }> => {
    const response: AxiosResponse<{ success: boolean; data?: { employee: any } }> = await api.get('/employees/me');
    return response.data;
  },

  getTransactions: async (page: number = 1, limit: number = 20, status?: string): Promise<TransactionsResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (status) {
      params.append('status', status);
    }

    const response: AxiosResponse<TransactionsResponse> = await api.get(`/employees/transactions?${params}`);
    return response.data;
  },

  getTransaction: async (id: string): Promise<PaymentResponse> => {
    const response: AxiosResponse<PaymentResponse> = await api.get(`/employees/transactions/${id}`);
    return response.data;
  },

  verifyTransaction: async (id: string, verified: boolean, notes?: string): Promise<{ success: boolean; message?: string; error?: string; data?: any }> => {
    const response: AxiosResponse<{ success: boolean; message?: string; error?: string; data?: any }> = await api.post(`/employees/transactions/${id}/verify`, {
      verified,
      notes,
    });
    return response.data;
  },

  submitToSwift: async (transactionIds: string[]): Promise<{ success: boolean; message?: string; error?: string; data?: any }> => {
    const response: AxiosResponse<{ success: boolean; message?: string; error?: string; data?: any }> = await api.post('/employees/transactions/submit-to-swift', {
      transactionIds,
    });
    return response.data;
  },

  getStatistics: async (): Promise<{ success: boolean; data?: { statistics: TransactionStatistics } }> => {
    const response: AxiosResponse<{ success: boolean; data?: { statistics: TransactionStatistics } }> = await api.get('/employees/statistics');
    return response.data;
  },
};

export default api;

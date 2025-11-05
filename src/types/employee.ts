export interface Employee {
  id: string;
  employeeId: string;
  fullName: string;
  username: string;
  email: string;
  role: 'EMPLOYEE' | 'ADMIN' | 'SUPERVISOR';
  department: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface EmployeeLoginCredentials {
  username: string;
  employeeId: string;
  password: string;
}

export interface EmployeeAuthResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    employee: Employee;
    token: string;
    refreshToken: string;
  };
}

export interface TransactionStatistics {
  pending: number;
  verified: number;
  processing: number;
  completed: number;
  rejected: number;
  totalToday: number;
  totalAmountToday: number;
}

export interface TransactionVerification {
  verified: boolean;
  notes?: string;
}


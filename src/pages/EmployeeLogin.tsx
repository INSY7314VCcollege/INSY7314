import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployee } from '../contexts/EmployeeContext';
import { Lock, User, Building2, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

const EmployeeLogin: React.FC = () => {
  const navigate = useNavigate();
  const { login, loading } = useEmployee();
  const [formData, setFormData] = useState({
    username: '',
    employeeId: '',
    password: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // RegEx validation patterns
  const patterns = {
    username: /^[a-zA-Z0-9_-]{3,30}$/,
    employeeId: /^[A-Z0-9]{6,10}$/,
    // Note: Password format validation removed from login
    // Password format validation should only apply to password creation/change, not login
  };

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.username || !patterns.username.test(formData.username)) {
      newErrors.username = 'Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens';
    }

    if (!formData.employeeId || !patterns.employeeId.test(formData.employeeId.toUpperCase())) {
      newErrors.employeeId = 'Employee ID must be 6-10 uppercase alphanumeric characters';
    }

    // Password validation for login - just check it's not empty
    // Password format validation should only be for password creation/change
    if (!formData.password || formData.password.length === 0) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    try {
      await login({
        username: formData.username,
        employeeId: formData.employeeId.toUpperCase(),
        password: formData.password,
      });
      navigate('/employee/dashboard');
    } catch (error) {
      // Error is handled in the context
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Sanitize input - remove any potential XSS characters
    const sanitizedValue = value.replace(/[<>]/g, '');
    
    setFormData((prev) => ({
      ...prev,
      [name]: sanitizedValue,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-2xl">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-indigo-600 p-3 rounded-full">
              <Shield className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Employee Portal</h2>
          <p className="mt-2 text-sm text-gray-600">
            International Payments Verification System
          </p>
          <p className="mt-1 text-xs text-gray-500">
            No registration required - Employees are pre-registered
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className={`appearance-none relative block w-full pl-10 pr-3 py-2 border ${
                    errors.username ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
                  placeholder="Enter your username"
                />
              </div>
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username}</p>
              )}
            </div>

            {/* Employee ID */}
            <div>
              <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700 mb-1">
                Employee ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="employeeId"
                  name="employeeId"
                  type="text"
                  autoComplete="off"
                  required
                  value={formData.employeeId}
                  onChange={handleChange}
                  className={`appearance-none relative block w-full pl-10 pr-3 py-2 border ${
                    errors.employeeId ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent uppercase`}
                  placeholder="Enter your Employee ID"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              {errors.employeeId && (
                <p className="mt-1 text-sm text-red-600">{errors.employeeId}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className={`appearance-none relative block w-full pl-10 pr-3 py-2 border ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
                  placeholder="Enter your password"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647A7.962 7.962 0 0112 20c2.209 0 4.209-.896 5.657-2.343L13.414 15l2.829-2.828a9.928 9.928 0 00-2.828-2.829L10.586 15z"></path>
                  </svg>
                  Logging in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              Secure access for authorized bank employees only
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeLogin;


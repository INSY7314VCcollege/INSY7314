import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { SecurityProvider } from './contexts/SecurityContext';
import { EmployeeProvider } from './contexts/EmployeeContext';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedEmployeeRoute from './components/ProtectedEmployeeRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MakePayment from './pages/MakePayment';
import Transactions from './pages/Transactions';
import Profile from './pages/Profile';
import SecuritySettings from './pages/SecuritySettings';
import EmployeeLogin from './pages/EmployeeLogin';
import EmployeeDashboard from './pages/EmployeeDashboard';
import EmployeeTransactionDetail from './pages/EmployeeTransactionDetail';
import NotFound from './pages/NotFound';
import './index.css';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SecurityProvider>
          <EmployeeProvider>
            <Router>
              <Routes>
                {/* Customer routes */}
                <Route path="/" element={
                  <div className="min-h-screen bg-gray-50">
                    <Navbar />
                    <main className="container mx-auto px-4 py-8">
                      <Navigate to="/login" replace />
                    </main>
                  </div>
                } />
                <Route path="/login" element={
                  <div className="min-h-screen bg-gray-50">
                    <Navbar />
                    <main className="container mx-auto px-4 py-8">
                      <Login />
                    </main>
                  </div>
                } />
                <Route path="/register" element={
                  <div className="min-h-screen bg-gray-50">
                    <Navbar />
                    <main className="container mx-auto px-4 py-8">
                      <Register />
                    </main>
                  </div>
                } />
                
                {/* Customer protected routes */}
                <Route
                  path="/dashboard"
                  element={
                    <div className="min-h-screen bg-gray-50">
                      <Navbar />
                      <main className="container mx-auto px-4 py-8">
                        <ProtectedRoute>
                          <Dashboard />
                        </ProtectedRoute>
                      </main>
                    </div>
                  }
                />
                <Route
                  path="/make-payment"
                  element={
                    <div className="min-h-screen bg-gray-50">
                      <Navbar />
                      <main className="container mx-auto px-4 py-8">
                        <ProtectedRoute>
                          <MakePayment />
                        </ProtectedRoute>
                      </main>
                    </div>
                  }
                />
                <Route
                  path="/transactions"
                  element={
                    <div className="min-h-screen bg-gray-50">
                      <Navbar />
                      <main className="container mx-auto px-4 py-8">
                        <ProtectedRoute>
                          <Transactions />
                        </ProtectedRoute>
                      </main>
                    </div>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <div className="min-h-screen bg-gray-50">
                      <Navbar />
                      <main className="container mx-auto px-4 py-8">
                        <ProtectedRoute>
                          <Profile />
                        </ProtectedRoute>
                      </main>
                    </div>
                  }
                />
                <Route
                  path="/security"
                  element={
                    <div className="min-h-screen bg-gray-50">
                      <Navbar />
                      <main className="container mx-auto px-4 py-8">
                        <ProtectedRoute>
                          <SecuritySettings />
                        </ProtectedRoute>
                      </main>
                    </div>
                  }
                />
                
                {/* Employee routes (no Navbar) */}
                <Route path="/employee/login" element={<EmployeeLogin />} />
                <Route
                  path="/employee/dashboard"
                  element={
                    <ProtectedEmployeeRoute>
                      <EmployeeDashboard />
                    </ProtectedEmployeeRoute>
                  }
                />
                <Route
                  path="/employee/transactions/:id"
                  element={
                    <ProtectedEmployeeRoute>
                      <EmployeeTransactionDetail />
                    </ProtectedEmployeeRoute>
                  }
                />
                
                {/* 404 page */}
                <Route path="*" element={
                  <div className="min-h-screen bg-gray-50">
                    <Navbar />
                    <main className="container mx-auto px-4 py-8">
                      <NotFound />
                    </main>
                  </div>
                } />
              </Routes>
              
              {/* Global toast notifications */}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                  success: {
                    duration: 3000,
                    iconTheme: {
                      primary: '#10b981',
                      secondary: '#fff',
                    },
                  },
                  error: {
                    duration: 5000,
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#fff',
                    },
                  },
                }}
              />
            </Router>
          </EmployeeProvider>
        </SecurityProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

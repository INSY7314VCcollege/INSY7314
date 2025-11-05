import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployee } from '../contexts/EmployeeContext';
import { employeeAPI } from '../services/api';
import { TransactionStatistics } from '../types/employee';
import { Transaction } from '../types/payment';
import { 
  Shield, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye,
  LogOut,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

const EmployeeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { employee, logout, isAuthenticated } = useEmployee();
  const [statistics, setStatistics] = useState<TransactionStatistics | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/employee/login');
      return;
    }
    loadData();
  }, [isAuthenticated, navigate, statusFilter, page]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsResponse, transactionsResponse] = await Promise.all([
        employeeAPI.getStatistics(),
        employeeAPI.getTransactions(page, 20, statusFilter),
      ]);

      if (statsResponse.success && statsResponse.data) {
        setStatistics(statsResponse.data.statistics);
      }

      if (transactionsResponse.success && transactionsResponse.data) {
        setTransactions(transactionsResponse.data.transactions || []);
        setTotalPages(transactionsResponse.data.pagination?.totalPages || 1);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (transactionId: string, verified: boolean) => {
    try {
      setSubmitting(true);
      const response = await employeeAPI.verifyTransaction(transactionId, verified);
      
      if (response.success) {
        toast.success(response.message || (verified ? 'Transaction verified' : 'Transaction rejected'));
        loadData();
      } else {
        toast.error(response.error || 'Failed to verify transaction');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to verify transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectTransaction = (transactionId: string) => {
    setSelectedTransactions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedTransactions.size === transactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(transactions.filter(t => t.status === 'VERIFIED').map(t => t.id)));
    }
  };

  const handleSubmitToSwift = async () => {
    const verifiedTransactions = Array.from(selectedTransactions).filter(id => {
      const transaction = transactions.find(t => t.id === id);
      return transaction?.status === 'VERIFIED';
    });

    if (verifiedTransactions.length === 0) {
      toast.error('Please select verified transactions to submit');
      return;
    }

    try {
      setSubmitting(true);
      const response = await employeeAPI.submitToSwift(verifiedTransactions);
      
      if (response.success) {
        toast.success(response.message || 'Transactions submitted to SWIFT successfully');
        setSelectedTransactions(new Set());
        loadData();
      } else {
        toast.error(response.error || 'Failed to submit transactions');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit transactions');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/employee/login');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'VERIFIED':
        return 'bg-blue-100 text-blue-800';
      case 'PROCESSING':
        return 'bg-purple-100 text-purple-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-indigo-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Employee Portal</h1>
                <p className="text-sm text-gray-500">
                  {employee?.fullName} - {employee?.department}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Pending</p>
                  <p className="text-3xl font-bold text-yellow-600">{statistics.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Verified</p>
                  <p className="text-3xl font-bold text-blue-600">{statistics.verified}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Processing</p>
                  <p className="text-3xl font-bold text-purple-600">{statistics.processing}</p>
                </div>
                <RefreshCw className="h-8 w-8 text-purple-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Today's Total</p>
                  <p className="text-3xl font-bold text-green-600">
                    ${statistics.totalAmountToday.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </div>
        )}

        {/* Filters and Actions */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="PENDING">Pending</option>
                <option value="VERIFIED">Verified</option>
                <option value="PROCESSING">Processing</option>
                <option value="COMPLETED">Completed</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            {statusFilter === 'VERIFIED' && selectedTransactions.size > 0 && (
              <button
                onClick={handleSubmitToSwift}
                disabled={submitting}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Submitting...' : `Submit ${selectedTransactions.size} to SWIFT`}
              </button>
            )}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {statusFilter === 'VERIFIED' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedTransactions.size === transactions.filter(t => t.status === 'VERIFIED').length && transactions.filter(t => t.status === 'VERIFIED').length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SWIFT Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recipient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  {statusFilter === 'PENDING' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={statusFilter === 'PENDING' ? 8 : statusFilter === 'VERIFIED' ? 9 : 7} className="px-6 py-4 text-center text-gray-500">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction: any) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      {statusFilter === 'VERIFIED' && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedTransactions.has(transaction.id)}
                            onChange={() => handleSelectTransaction(transaction.id)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {transaction.id.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.userId?.fullName || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.currency} {transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.swiftCode}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.recipientName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(transaction.status)}`}>
                          {transaction.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </td>
                      {statusFilter === 'PENDING' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleVerify(transaction.id, true)}
                              disabled={submitting}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                              title="Verify"
                            >
                              <CheckCircle className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleVerify(transaction.id, false)}
                              disabled={submitting}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                              title="Reject"
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => navigate(`/employee/transactions/${transaction.id}`)}
                              className="text-blue-600 hover:text-blue-900"
                              title="View Details"
                            >
                              <Eye className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;


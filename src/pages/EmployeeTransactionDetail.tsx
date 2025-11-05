import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEmployee } from '../contexts/EmployeeContext';
import { employeeAPI } from '../services/api';
import { ArrowLeft, CheckCircle, XCircle, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

const EmployeeTransactionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useEmployee();
  const [transaction, setTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/employee/login');
      return;
    }
    loadTransaction();
  }, [id, isAuthenticated, navigate]);

  const loadTransaction = async () => {
    try {
      setLoading(true);
      const response = await employeeAPI.getTransaction(id!);
      
      if (response.success && response.data) {
        setTransaction(response.data.transaction);
      } else {
        toast.error('Transaction not found');
        navigate('/employee/dashboard');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load transaction');
      navigate('/employee/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (verified: boolean) => {
    try {
      setSubmitting(true);
      const response = await employeeAPI.verifyTransaction(id!, verified, notes || undefined);
      
      if (response.success) {
        toast.success(response.message || (verified ? 'Transaction verified' : 'Transaction rejected'));
        navigate('/employee/dashboard');
      } else {
        toast.error(response.error || 'Failed to verify transaction');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to verify transaction');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Transaction not found</p>
          <button
            onClick={() => navigate('/employee/dashboard')}
            className="mt-4 text-indigo-600 hover:text-indigo-800"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/employee/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <Shield className="h-8 w-8 text-indigo-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Transaction Details</h1>
                <p className="text-sm text-gray-500">ID: {transaction.id}</p>
              </div>
            </div>
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
              transaction.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
              transaction.status === 'VERIFIED' ? 'bg-blue-100 text-blue-800' :
              transaction.status === 'PROCESSING' ? 'bg-purple-100 text-purple-800' :
              transaction.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
              'bg-red-100 text-red-800'
            }`}>
              {transaction.status}
            </span>
          </div>
        </div>

        {/* Transaction Information */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Payment Information</h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Amount</label>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {transaction.currency} {transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Fees</label>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {transaction.currency} {transaction.fees?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Total Amount</label>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {transaction.currency} {transaction.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Provider</label>
                <p className="mt-1 text-sm text-gray-900">{transaction.provider}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Customer Information</h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Name</label>
                <p className="mt-1 text-sm text-gray-900">{transaction.userId?.fullName || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Account Number</label>
                <p className="mt-1 text-sm text-gray-900">{transaction.userId?.accountNumber || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recipient Information */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recipient Information</h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Recipient Name</label>
                <p className="mt-1 text-sm text-gray-900">{transaction.recipientName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Account Number</label>
                <p className="mt-1 text-sm text-gray-900">{transaction.recipientAccountNumber}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">SWIFT Code</label>
                <p className="mt-1 text-sm font-semibold text-gray-900">{transaction.swiftCode}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Bank Name</label>
                <p className="mt-1 text-sm text-gray-900">{transaction.recipientBankName}</p>
              </div>
              {transaction.recipientBankAddress && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-500">Bank Address</label>
                  <p className="mt-1 text-sm text-gray-900">{transaction.recipientBankAddress}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Additional Information */}
        {(transaction.purpose || transaction.reference) && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Additional Information</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              {transaction.purpose && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Purpose</label>
                  <p className="mt-1 text-sm text-gray-900">{transaction.purpose}</p>
                </div>
              )}
              {transaction.reference && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Reference</label>
                  <p className="mt-1 text-sm text-gray-900">{transaction.reference}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Verification Actions (only for PENDING transactions) */}
        {transaction.status === 'PENDING' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Verification</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Add verification notes..."
                />
                <p className="mt-1 text-xs text-gray-500">{notes.length}/500 characters</p>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => handleVerify(true)}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Verify Transaction
                </button>
                <button
                  onClick={() => handleVerify(false)}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <XCircle className="h-5 w-5 mr-2" />
                  Reject Transaction
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transaction Timeline */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
          <div className="space-y-3">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100">
                  <span className="text-blue-600 text-xs font-medium">C</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Created</p>
                <p className="text-sm text-gray-500">{new Date(transaction.createdAt).toLocaleString()}</p>
              </div>
            </div>
            {transaction.verifiedAt && (
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">Verified</p>
                  <p className="text-sm text-gray-500">{new Date(transaction.verifiedAt).toLocaleString()}</p>
                </div>
              </div>
            )}
            {transaction.processedAt && (
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-purple-100">
                    <span className="text-purple-600 text-xs font-medium">P</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">Processed</p>
                  <p className="text-sm text-gray-500">{new Date(transaction.processedAt).toLocaleString()}</p>
                </div>
              </div>
            )}
            {transaction.completedAt && (
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">Completed</p>
                  <p className="text-sm text-gray-500">{new Date(transaction.completedAt).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeTransactionDetail;


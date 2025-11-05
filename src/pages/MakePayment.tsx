import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSecurity } from '../contexts/SecurityContext';
import { paymentAPI } from '../services/api';
import { PaymentData, Currency, PaymentLimits } from '../types/payment';
import { 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle,
  Building,
  User,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

const MakePayment: React.FC = () => {
  const { validateInput, isSecureConnection } = useSecurity();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<PaymentData>({
    amount: '',
    currency: 'USD',
    provider: 'SWIFT', // Default provider, not shown to user
    recipientName: '',
    recipientAccountNumber: '',
    swiftCode: '',
    recipientBankName: '',
    recipientBankAddress: '',
    purpose: '',
    reference: '',
  });
  
  // Supported currencies: EUR, USD, GBP, ZAR
  const supportedCurrencies: Currency[] = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R' }
  ];
  
  const [limits, setLimits] = useState<PaymentLimits | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calculatedFees, setCalculatedFees] = useState(0);

  useEffect(() => {
    const loadPaymentData = async () => {
      try {
        setIsLoading(true);
        
        // Load limits only (currencies are hardcoded, provider is removed)
        const limitsRes = await paymentAPI.getLimits();
        
        if (limitsRes.success) {
          setLimits(limitsRes.data.limits);
        }
      } catch (error) {
        console.error('Error loading payment data:', error);
        toast.error('Failed to load payment information');
      } finally {
        setIsLoading(false);
      }
    };

    loadPaymentData();
  }, []);

  // Calculate fees when amount changes
  useEffect(() => {
    if (formData.amount && limits) {
      const amount = parseFloat(formData.amount);
      let fees = 0;
      
      if (amount <= 1000) {
        fees = limits.fees.upTo1000;
      } else if (amount <= 10000) {
        fees = limits.fees.upTo10000;
      } else {
        fees = limits.fees.over10000;
      }
      
      setCalculatedFees(fees);
    }
  }, [formData.amount, limits]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    // Amount validation
    const amountValidation = validateInput(formData.amount, 'amount');
    if (!amountValidation.isValid) {
      newErrors.amount = amountValidation.errors[0];
    } else if (limits) {
      const amount = parseFloat(formData.amount);
      if (amount < limits.minAmount) {
        newErrors.amount = `Minimum amount is $${limits.minAmount}`;
      } else if (amount > limits.maxAmount) {
        newErrors.amount = `Maximum amount is $${limits.maxAmount}`;
      }
    }

    // Currency validation
    if (!formData.currency) {
      newErrors.currency = 'Currency is required';
    }

    // Recipient name validation
    const nameValidation = validateInput(formData.recipientName, 'name');
    if (!nameValidation.isValid) {
      newErrors.recipientName = nameValidation.errors[0];
    }

    // Account number validation
    if (!formData.recipientAccountNumber) {
      newErrors.recipientAccountNumber = 'Recipient account number is required';
    } else if (!/^[A-Za-z0-9]{8,20}$/.test(formData.recipientAccountNumber)) {
      newErrors.recipientAccountNumber = 'Account number must be 8-20 alphanumeric characters';
    }

    // SWIFT code validation
    const swiftValidation = validateInput(formData.swiftCode, 'swiftCode');
    if (!swiftValidation.isValid) {
      newErrors.swiftCode = swiftValidation.errors[0];
    }

    // Bank name validation
    const bankNameValidation = validateInput(formData.recipientBankName, 'name');
    if (!bankNameValidation.isValid) {
      newErrors.recipientBankName = bankNameValidation.errors[0];
    }

    // Purpose validation (optional)
    if (formData.purpose && formData.purpose.trim()) {
      if (!/^[A-Za-z0-9\s]{0,100}$/.test(formData.purpose)) {
        newErrors.purpose = 'Purpose must contain only letters, numbers, and spaces';
      }
    }

    // Reference validation (optional)
    if (formData.reference && formData.reference.trim()) {
      if (!/^[A-Za-z0-9]{0,50}$/.test(formData.reference)) {
        newErrors.reference = 'Reference must contain only letters and numbers';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await paymentAPI.makePayment(formData);
      
      if (response.success) {
        toast.success('Payment created successfully!');
        navigate('/transactions');
      } else {
        toast.error(response.error || 'Failed to create payment');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.response?.data?.error || 'Failed to create payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Loading payment information..." />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5 mr-1" />
          Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Make Payment</h1>
          <p className="text-gray-600">Send money internationally with secure banking</p>
        </div>
      </div>

      {/* Security Alert */}
      {!isSecureConnection && (
        <div className="security-alert error">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold">Insecure Connection</h3>
            <p className="text-sm">You are not using a secure HTTPS connection. Please use HTTPS for your security.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Amount and Currency */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="input-field">
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                    Amount *
                  </label>
                  <input
                    type="text"
                    id="amount"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    className={`mt-1 block w-full px-3 py-2 border ${
                      errors.amount ? 'border-red-300' : 'border-gray-300'
                    } rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                  />
                  {errors.amount && (
                    <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
                  )}
                </div>

                <div className="input-field">
                  <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                    Currency *
                  </label>
                  <select
                    id="currency"
                    name="currency"
                    value={formData.currency}
                    onChange={handleInputChange}
                    className={`mt-1 block w-full px-3 py-2 border ${
                      errors.currency ? 'border-red-300' : 'border-gray-300'
                    } rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                  >
                    {supportedCurrencies.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name} ({currency.symbol})
                      </option>
                    ))}
                  </select>
                  {errors.currency && (
                    <p className="mt-1 text-sm text-red-600">{errors.currency}</p>
                  )}
                </div>
              </div>

              {/* Recipient Information */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Recipient Information
                </h3>
                
                <div className="space-y-4">
                  <div className="input-field">
                    <label htmlFor="recipientName" className="block text-sm font-medium text-gray-700">
                      Recipient Name *
                    </label>
                    <input
                      type="text"
                      id="recipientName"
                      name="recipientName"
                      value={formData.recipientName}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full px-3 py-2 border ${
                        errors.recipientName ? 'border-red-300' : 'border-gray-300'
                      } rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                      placeholder="Enter recipient's full name"
                    />
                    {errors.recipientName && (
                      <p className="mt-1 text-sm text-red-600">{errors.recipientName}</p>
                    )}
                  </div>

                  <div className="input-field">
                    <label htmlFor="recipientAccountNumber" className="block text-sm font-medium text-gray-700">
                      Account Number *
                    </label>
                    <input
                      type="text"
                      id="recipientAccountNumber"
                      name="recipientAccountNumber"
                      value={formData.recipientAccountNumber}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full px-3 py-2 border ${
                        errors.recipientAccountNumber ? 'border-red-300' : 'border-gray-300'
                      } rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                      placeholder="Enter recipient's account number"
                    />
                    {errors.recipientAccountNumber && (
                      <p className="mt-1 text-sm text-red-600">{errors.recipientAccountNumber}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bank Information */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Building className="w-5 h-5 mr-2" />
                  Bank Information
                </h3>
                
                <div className="space-y-4">
                  <div className="input-field">
                    <label htmlFor="swiftCode" className="block text-sm font-medium text-gray-700">
                      SWIFT Code *
                    </label>
                    <input
                      type="text"
                      id="swiftCode"
                      name="swiftCode"
                      value={formData.swiftCode}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full px-3 py-2 border ${
                        errors.swiftCode ? 'border-red-300' : 'border-gray-300'
                      } rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                      placeholder="Enter SWIFT code (e.g., CHASUS33)"
                    />
                    {errors.swiftCode && (
                      <p className="mt-1 text-sm text-red-600">{errors.swiftCode}</p>
                    )}
                  </div>

                  <div className="input-field">
                    <label htmlFor="recipientBankName" className="block text-sm font-medium text-gray-700">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      id="recipientBankName"
                      name="recipientBankName"
                      value={formData.recipientBankName}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full px-3 py-2 border ${
                        errors.recipientBankName ? 'border-red-300' : 'border-gray-300'
                      } rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                      placeholder="Enter bank name"
                    />
                    {errors.recipientBankName && (
                      <p className="mt-1 text-sm text-red-600">{errors.recipientBankName}</p>
                    )}
                  </div>

                  <div className="input-field">
                    <label htmlFor="recipientBankAddress" className="block text-sm font-medium text-gray-700">
                      Bank Address
                    </label>
                    <textarea
                      id="recipientBankAddress"
                      name="recipientBankAddress"
                      rows={3}
                      value={formData.recipientBankAddress}
                      onChange={handleInputChange}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter bank address (optional)"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Additional Information
                </h3>
                
                <div className="space-y-4">
                  <div className="input-field">
                    <label htmlFor="purpose" className="block text-sm font-medium text-gray-700">
                      Purpose of Payment
                    </label>
                    <input
                      type="text"
                      id="purpose"
                      name="purpose"
                      value={formData.purpose}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full px-3 py-2 border ${
                        errors.purpose ? 'border-red-300' : 'border-gray-300'
                      } rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                      placeholder="Enter purpose of payment (optional)"
                    />
                    {errors.purpose && (
                      <p className="mt-1 text-sm text-red-600">{errors.purpose}</p>
                    )}
                  </div>

                  <div className="input-field">
                    <label htmlFor="reference" className="block text-sm font-medium text-gray-700">
                      Reference Number
                    </label>
                    <input
                      type="text"
                      id="reference"
                      name="reference"
                      value={formData.reference}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full px-3 py-2 border ${
                        errors.reference ? 'border-red-300' : 'border-gray-300'
                      } rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                      placeholder="Enter reference number (optional)"
                    />
                    {errors.reference && (
                      <p className="mt-1 text-sm text-red-600">{errors.reference}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-6">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <LoadingSpinner size="small" text="" />
                      <span className="ml-2">Processing...</span>
                    </>
                  ) : (
                    'Create Payment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="lg:col-span-1">
          <div className="banking-card sticky top-6">
            <div className="banking-card-header">
              <h3 className="text-lg font-semibold">Payment Summary</h3>
            </div>
            <div className="banking-card-body space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Amount</span>
                <span className="font-semibold">
                  {formData.currency} {formData.amount || '0.00'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fees</span>
                <span className="font-semibold">
                  {formData.currency} {calculatedFees.toFixed(2)}
                </span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>
                    {formData.currency} {formData.amount ? (parseFloat(formData.amount) + calculatedFees).toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>
              
              {limits && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Limits</h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>Min: {formData.currency} {limits.minAmount}</div>
                    <div>Max: {formData.currency} {limits.maxAmount}</div>
                    <div>Daily: {formData.currency} {limits.dailyLimit.toLocaleString()}</div>
                  </div>
                </div>
              )}

              <div className="security-alert info">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold">Secure Payment</h4>
                  <p className="text-xs text-gray-600">
                    Your payment is protected by bank-grade security and encryption.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MakePayment;

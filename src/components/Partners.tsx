import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  ArrowUpDown, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Users,
  UserPlus,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Bell
} from 'lucide-react';

interface Partner {
  id: string;
  email: string;
  full_name: string;
  current_balance: number;
  created_at: string;
  updated_at: string;
}

interface Transaction {
  id: string;
  from_partner_id: string;
  to_partner_id: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  from_partner: { full_name: string };
  to_partner: { full_name: string };
}

interface TransactionForm {
  from_partner_id: string;
  to_partner_id: string;
  amount: number;
  description: string;
  transaction_date: string;
}

interface PartnerForm {
  email: string;
  full_name: string;
  initial_balance: number;
  password: string;
}

export default function Partners() {
  const { user } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [processingApproval, setProcessingApproval] = useState<string | null>(null);
  
  const transactionForm = useForm<TransactionForm>({
    defaultValues: {
      from_partner_id: '',
      to_partner_id: '',
      amount: 0,
      description: '',
      transaction_date: format(new Date(), 'yyyy-MM-dd')
    }
  });

  const partnerForm = useForm<PartnerForm>({
    defaultValues: {
      email: '',
      full_name: '',
      initial_balance: 0,
      password: 'partner123' // Default password
    }
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch partners
      const { data: partnersData, error: partnersError } = await supabase
        .from('partners')
        .select('*')
        .order('full_name');

      if (partnersError) throw partnersError;

      // Fetch business transactions (partner_transactions table)
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('partner_transactions')
        .select(`
          *,
          from_partner:partners!from_partner_id(full_name),
          to_partner:partners!to_partner_id(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (transactionsError) throw transactionsError;

      // Fetch pending transactions for current user
      const { data: pendingData, error: pendingError } = await supabase
        .from('partner_transactions')
        .select(`
          *,
          from_partner:partners!from_partner_id(full_name),
          to_partner:partners!to_partner_id(full_name)
        `)
        .eq('to_partner_id', user?.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (pendingError) throw pendingError;

      setPartners(partnersData || []);
      setTransactions(transactionsData || []);
      setPendingTransactions(pendingData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePartnerSubmit = async (data: PartnerForm) => {
    try {
      // First, create the user account in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          alert('A user with this email already exists. Please use a different email.');
        } else {
          alert(`Error creating user account: ${authError.message}`);
        }
        return;
      }

      if (!authData.user) {
        alert('Failed to create user account. Please try again.');
        return;
      }

      // Create partner profile
      const { error: partnerError } = await supabase
        .from('partners')
        .insert({
          id: authData.user.id,
          email: data.email,
          full_name: data.full_name,
          current_balance: data.initial_balance,
        });

      if (partnerError) {
        console.error('Error creating partner profile:', partnerError);
        alert('Error creating partner profile. Please try again.');
        return;
      }

      partnerForm.reset({
        email: '',
        full_name: '',
        initial_balance: 0,
        password: 'partner123'
      });
      setShowPartnerForm(false);
      fetchData();
      
      alert(`Partner added successfully!\n\nLogin Credentials:\nEmail: ${data.email}\nPassword: ${data.password}\n\nPlease share these credentials with the new partner.`);
    } catch (error) {
      console.error('Error creating partner:', error);
      alert('Error creating partner. Please try again.');
    }
  };

  const handleTransactionSubmit = async (data: TransactionForm) => {
    if (!user) return;

    if (data.from_partner_id === data.to_partner_id) {
      alert('Cannot transfer money to the same partner');
      return;
    }

    try {
      const { error } = await supabase
        .from('partner_transactions')
        .insert({
          from_partner_id: data.from_partner_id,
          to_partner_id: data.to_partner_id,
          amount: data.amount,
          description: data.description || null,
          transaction_date: data.transaction_date,
          status: 'pending' // All new transactions start as pending
        });

      if (error) throw error;

      transactionForm.reset({
        from_partner_id: '',
        to_partner_id: '',
        amount: 0,
        description: '',
        transaction_date: format(new Date(), 'yyyy-MM-dd')
      });
      setShowTransactionForm(false);
      fetchData();
      
      alert('Transaction created and sent for approval!');
    } catch (error) {
      console.error('Error creating transaction:', error);
      alert('Error creating transaction. Please try again.');
    }
  };

  const handleApproveTransaction = async (transactionId: string, action: 'approve' | 'reject', rejectionReason?: string) => {
    if (!user) return;

    setProcessingApproval(transactionId);

    try {
      // Fetch the transaction details
      const { data: transaction, error: fetchError } = await supabase
        .from('partner_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (fetchError) throw fetchError;

      const updateData: any = {
        status: action === 'approve' ? 'approved' : 'rejected',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      };
      if (action === 'reject' && rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      const { error: updateError } = await supabase
        .from('partner_transactions')
        .update(updateData)
        .eq('id', transactionId);

      if (updateError) throw updateError;

      // If approved, update balances
      if (action === 'approve') {
        // Fetch current balances for sender and receiver
        console.log('Approving transaction:', transactionId);
        console.log('Sender ID:', transaction.from_partner_id);
        console.log('Receiver ID:', transaction.to_partner_id);
        const { data: sender, error: senderFetchError } = await supabase
          .from('partners')
          .select('current_balance')
          .eq('id', transaction.from_partner_id)
          .single();
        if (senderFetchError) {
          console.error('Sender fetch error:', senderFetchError);
          throw senderFetchError;
        }
        console.log('Sender current_balance:', sender.current_balance);

        const { data: receiver, error: receiverFetchError } = await supabase
          .from('partners')
          .select('current_balance')
          .eq('id', transaction.to_partner_id)
          .single();
        if (receiverFetchError) {
          console.error('Receiver fetch error:', receiverFetchError);
          throw receiverFetchError;
        }
        console.log('Receiver current_balance:', receiver.current_balance);

        // Calculate new balances
        const newSenderBalance = (sender.current_balance ?? 0) - transaction.amount;
        const newReceiverBalance = (receiver.current_balance ?? 0) + transaction.amount;
        console.log('New sender balance:', newSenderBalance);
        console.log('New receiver balance:', newReceiverBalance);

        // Update sender balance
        const { error: senderError } = await supabase
          .from('partners')
          .update({ current_balance: newSenderBalance })
          .eq('id', transaction.from_partner_id);
        if (senderError) {
          console.error('Sender update error:', senderError);
          throw senderError;
        }

        // Update receiver balance
        const { error: receiverError } = await supabase
          .from('partners')
          .update({ current_balance: newReceiverBalance })
          .eq('id', transaction.to_partner_id);
        if (receiverError) {
          console.error('Receiver update error:', receiverError);
          throw receiverError;
        }

        alert('Transaction approved and balances updated!');
      } else {
        alert('Transaction rejected.');
      }

      fetchData();
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Error processing transaction. Please try again.');
    } finally {
      setProcessingApproval(null);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      const { error } = await supabase
        .from('partner_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleDeletePartner = async (partnerId: string, partnerName: string) => {
    if (!confirm(`Are you sure you want to remove ${partnerName} from the system? This will delete all their transactions and cannot be undone.`)) return;

    try {
      // Delete the partner (this will cascade delete transactions due to foreign key constraints)
      const { error } = await supabase
        .from('partners')
        .delete()
        .eq('id', partnerId);

      if (error) throw error;
      fetchData();
      alert(`${partnerName} has been removed from the system.`);
    } catch (error) {
      console.error('Error deleting partner:', error);
      alert('Error removing partner. They may have existing transactions that prevent deletion.');
    }
  };

  const totalBalance = partners.reduce((sum, partner) => sum + partner.current_balance, 0);
  const positiveBalances = partners.filter(p => p.current_balance > 0);
  const negativeBalances = partners.filter(p => p.current_balance < 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Partner Management</h1>
          {pendingTransactions.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <Bell className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-orange-600">
                {pendingTransactions.length} transaction{pendingTransactions.length > 1 ? 's' : ''} awaiting your approval
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowPartnerForm(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Add Partner
          </button>
          <button
            onClick={() => setShowTransactionForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <ArrowUpDown className="h-4 w-4" />
            New Business Transaction
          </button>
        </div>
      </div>

      {/* Pending Approvals */}
      {pendingTransactions.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-orange-900">Pending Approvals</h2>
          </div>
          
          <div className="space-y-3">
            {pendingTransactions.map((transaction) => (
              <div key={transaction.id} className="bg-white border border-orange-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {transaction.from_partner.full_name}
                      </span>
                      <ArrowUpDown className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900">You</span>
                      <span className="text-lg font-bold text-blue-600">
                        ₹{transaction.amount.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {transaction.description || 'No description'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(transaction.created_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveTransaction(transaction.id, 'approve')}
                      disabled={processingApproval === transaction.id}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      <CheckCircle className="h-3 w-3" />
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('Rejection reason (optional):');
                        handleApproveTransaction(transaction.id, 'reject', reason || undefined);
                      }}
                      disabled={processingApproval === transaction.id}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      <XCircle className="h-3 w-3" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Partners</p>
              <p className="text-2xl font-bold text-gray-900">{partners.length}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-full">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Business Balance</p>
              <p className="text-2xl font-bold text-gray-900">₹{totalBalance.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-full">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Positive Balances</p>
              <p className="text-2xl font-bold text-green-600">{positiveBalances.length}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
              <p className="text-2xl font-bold text-orange-600">{pendingTransactions.length}</p>
            </div>
            <div className="bg-orange-50 p-3 rounded-full">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Add Partner Form Modal */}
      {showPartnerForm && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Add New Partner</h2>
              <button
                onClick={() => setShowPartnerForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={partnerForm.handleSubmit(handlePartnerSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  {...partnerForm.register('full_name', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter partner's full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  {...partnerForm.register('email', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter partner's email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Initial Business Balance (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...partnerForm.register('initial_balance', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...partnerForm.register('password', { required: true })}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  The partner can change this password after first login
                </p>
              </div>

              <div className="bg-blue-50 p-3 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This creates a business partner account with the specified initial balance from sales revenue.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Add Partner
                </button>
                <button
                  type="button"
                  onClick={() => setShowPartnerForm(false)}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Form Modal */}
      {showTransactionForm && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">New Business Transaction</h2>
              <button
                onClick={() => setShowTransactionForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={transactionForm.handleSubmit(handleTransactionSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Partner
                </label>
                <select
                  {...transactionForm.register('from_partner_id', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select partner</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.full_name} (₹{partner.current_balance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To Partner
                </label>
                <select
                  {...transactionForm.register('to_partner_id', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select partner</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.full_name} (₹{partner.current_balance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...transactionForm.register('amount', { required: true, min: 0.01 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  {...transactionForm.register('transaction_date', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  {...transactionForm.register('description')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Business transaction description..."
                />
              </div>

              <div className="bg-orange-50 p-3 rounded-md">
                <p className="text-sm text-orange-800">
                  <strong>Note:</strong> This transaction will require approval from the receiving partner before the balances are updated.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Create Transaction
                </button>
                <button
                  type="button"
                  onClick={() => setShowTransactionForm(false)}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Partners List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Business Partner Balances</h2>
          <p className="text-sm text-gray-600">Current balances from sales revenue and approved business transactions</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Partner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Business Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {partners.map((partner) => (
                <tr key={partner.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {partner.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{partner.full_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {partner.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-semibold ${
                      partner.current_balance >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ₹{partner.current_balance.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {format(new Date(partner.created_at), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => handleDeletePartner(partner.id, partner.full_name)}
                      className="text-red-600 hover:text-red-800"
                      title="Remove Partner"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Business Transactions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Business Transactions</h2>
          <p className="text-sm text-gray-600">Business-related money transfers between partners</p>
        </div>

        {transactions.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No business transactions found. Create your first transaction to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    From
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(transaction.transaction_date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.from_partner.full_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.to_partner.full_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                      ₹{transaction.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        transaction.status === 'approved' ? 'bg-green-100 text-green-800' :
                        transaction.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {transaction.status === 'approved' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {transaction.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                        {transaction.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                        {transaction.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {transaction.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => handleDeleteTransaction(transaction.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
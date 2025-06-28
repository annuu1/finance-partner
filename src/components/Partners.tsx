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
  Users
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

export default function Partners() {
  const { user } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  
  const form = useForm<TransactionForm>({
    defaultValues: {
      from_partner_id: '',
      to_partner_id: '',
      amount: 0,
      description: '',
      transaction_date: format(new Date(), 'yyyy-MM-dd')
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

      // Fetch transactions
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

      setPartners(partnersData || []);
      setTransactions(transactionsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
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
          transaction_date: data.transaction_date
        });

      if (error) throw error;

      form.reset({
        from_partner_id: '',
        to_partner_id: '',
        amount: 0,
        description: '',
        transaction_date: format(new Date(), 'yyyy-MM-dd')
      });
      setShowTransactionForm(false);
      fetchData();
    } catch (error) {
      console.error('Error creating transaction:', error);
      alert('Error creating transaction. Please try again.');
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
        <h1 className="text-2xl font-bold text-gray-900">Partner Management</h1>
        <button
          onClick={() => setShowTransactionForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <ArrowUpDown className="h-4 w-4" />
          New Transaction
        </button>
      </div>

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
              <p className="text-sm font-medium text-gray-600">Total Balance</p>
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
              <p className="text-sm font-medium text-gray-600">Negative Balances</p>
              <p className="text-2xl font-bold text-red-600">{negativeBalances.length}</p>
            </div>
            <div className="bg-red-50 p-3 rounded-full">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Form Modal */}
      {showTransactionForm && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">New Transaction</h2>
              <button
                onClick={() => setShowTransactionForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={form.handleSubmit(handleTransactionSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Partner
                </label>
                <select
                  {...form.register('from_partner_id', { required: true })}
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
                  {...form.register('to_partner_id', { required: true })}
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
                  {...form.register('amount', { required: true, min: 0.01 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  {...form.register('transaction_date', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  {...form.register('description')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Transaction description..."
                />
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
          <h2 className="text-lg font-semibold text-gray-900">Partner Balances</h2>
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
                  Current Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
        </div>

        {transactions.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No transactions found. Create your first transaction to get started.
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
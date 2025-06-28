import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';
import { Plus, Edit2, Trash2, Save, X, User, Users } from 'lucide-react';

interface Partner {
  id: string;
  full_name: string;
  email: string;
}

interface SalesEntry {
  id: string;
  date: string;
  total_amount: number;
  online_amount: number;
  cash_amount: number;
  notes: string | null;
  partner_id: string | null;
  created_at: string;
  partner?: { full_name: string };
}

interface SalesForm {
  date: string;
  total_amount: number;
  online_amount: number;
  cash_amount: number;
  notes: string;
  partner_id: string;
}

export default function DailySales() {
  const { user } = useAuth();
  const [sales, setSales] = useState<SalesEntry[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const form = useForm<SalesForm>({
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      total_amount: 0,
      online_amount: 0,
      cash_amount: 0,
      notes: '',
      partner_id: ''
    }
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Watch for changes in online and cash amounts to calculate total
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'online_amount' || name === 'cash_amount') {
        const onlineAmount = parseFloat(value.online_amount?.toString() || '0') || 0;
        const cashAmount = parseFloat(value.cash_amount?.toString() || '0') || 0;
        const total = onlineAmount + cashAmount;
        form.setValue('total_amount', total);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const fetchData = async () => {
    try {
      // Fetch partners
      const { data: partnersData, error: partnersError } = await supabase
        .from('partners')
        .select('id, full_name, email')
        .order('full_name');

      if (partnersError) throw partnersError;

      // Fetch sales with partner information - explicitly specify the foreign key relationship
      const { data: salesData, error: salesError } = await supabase
        .from('daily_sales')
        .select(`
          *,
          partner:partners!daily_sales_partner_id_fkey(full_name)
        `)
        .order('date', { ascending: false });

      if (salesError) throw salesError;

      setPartners(partnersData || []);
      setSales(salesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkDateExists = async (date: string, excludeId?: string) => {
    const { data } = await supabase
      .from('daily_sales')
      .select('id')
      .eq('date', date)
      .neq('id', excludeId || '');
    
    return (data?.length || 0) > 0;
  };

  const updatePartnerBalance = async (partnerId: string, amount: number) => {
    try {
      // First, get the current balance
      const { data: partnerData, error: fetchError } = await supabase
        .from('partners')
        .select('current_balance')
        .eq('id', partnerId)
        .single();

      if (fetchError) throw fetchError;

      const currentBalance = partnerData.current_balance || 0;
      const newBalance = currentBalance + amount;

      // Update the partner's balance
      const { error: updateError } = await supabase
        .from('partners')
        .update({ current_balance: newBalance })
        .eq('id', partnerId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error updating partner balance:', error);
      throw error;
    }
  };

  const handleSubmit = async (data: SalesForm) => {
    if (!user) return;

    try {
      // Ensure amounts are numbers
      const onlineAmount = parseFloat(data.online_amount.toString()) || 0;
      const cashAmount = parseFloat(data.cash_amount.toString()) || 0;
      const totalAmount = onlineAmount + cashAmount;

      // Validate partner selection
      if (!data.partner_id) {
        alert('Please select a partner responsible for this sale.');
        return;
      }

      // Check for duplicate date
      const dateExists = await checkDateExists(data.date, editingId);
      if (dateExists) {
        alert('An entry for this date already exists. Please choose a different date.');
        return;
      }

      if (editingId) {
        // Update existing entry
        const { error } = await supabase
          .from('daily_sales')
          .update({
            date: data.date,
            total_amount: totalAmount,
            online_amount: onlineAmount,
            cash_amount: cashAmount,
            notes: data.notes || null,
            partner_id: data.partner_id
          })
          .eq('id', editingId);

        if (error) throw error;
        setEditingId(null);
      } else {
        // Create new entry
        const { error } = await supabase
          .from('daily_sales')
          .insert({
            date: data.date,
            total_amount: totalAmount,
            online_amount: onlineAmount,
            cash_amount: cashAmount,
            notes: data.notes || null,
            partner_id: data.partner_id,
            created_by: user.id
          });

        if (error) throw error;

        // Update partner's current balance
        await updatePartnerBalance(data.partner_id, totalAmount);
      }

      form.reset({
        date: format(new Date(), 'yyyy-MM-dd'),
        total_amount: 0,
        online_amount: 0,
        cash_amount: 0,
        notes: '',
        partner_id: ''
      });
      setShowForm(false);
      fetchData();
    } catch (error) {
      console.error('Error saving sales entry:', error);
      alert('Error saving sales entry. Please try again.');
    }
  };

  const handleEdit = (sale: SalesEntry) => {
    form.setValue('date', sale.date);
    form.setValue('total_amount', sale.total_amount);
    form.setValue('online_amount', sale.online_amount);
    form.setValue('cash_amount', sale.cash_amount);
    form.setValue('notes', sale.notes || '');
    form.setValue('partner_id', sale.partner_id || '');
    setEditingId(sale.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sales entry?')) return;

    try {
      const { error } = await supabase
        .from('daily_sales')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error deleting sales entry:', error);
    }
  };

  const handleCancel = () => {
    form.reset({
      date: format(new Date(), 'yyyy-MM-dd'),
      total_amount: 0,
      online_amount: 0,
      cash_amount: 0,
      notes: '',
      partner_id: ''
    });
    setShowForm(false);
    setEditingId(null);
  };

  // Calculate partner-wise sales summary
  const partnerSummary = partners.map(partner => {
    const partnerSales = sales.filter(sale => sale.partner_id === partner.id);
    const totalSales = partnerSales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const salesCount = partnerSales.length;
    return {
      ...partner,
      totalSales,
      salesCount
    };
  });

  const totalSales = sales.reduce((sum, sale) => sum + sale.total_amount, 0);

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
        <h1 className="text-2xl font-bold text-gray-900">Daily Sales</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Sales Entry
        </button>
      </div>

      {/* Partner Sales Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Partner Sales Summary</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {partnerSummary.map((partner) => (
            <div key={partner.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{partner.full_name}</h3>
                  <p className="text-sm text-gray-500">{partner.salesCount} sales</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-600">₹{partner.totalSales.toLocaleString()}</p>
                <p className="text-xs text-gray-500">
                  {totalSales > 0 ? ((partner.totalSales / totalSales) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 pt-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Total Sales</span>
            <span className="text-xl font-bold text-blue-600">₹{totalSales.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit Sales Entry' : 'Add Sales Entry'}
              </h2>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  {...form.register('date', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Partner Responsible *
                </label>
                <select
                  {...form.register('partner_id', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select partner</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.full_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Choose the partner who made this sale
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Online Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...form.register('online_amount', { 
                    required: true, 
                    min: 0,
                    valueAsNumber: true 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cash Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...form.register('cash_amount', { 
                    required: true, 
                    min: 0,
                    valueAsNumber: true 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...form.register('total_amount')}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  {...form.register('notes')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Any additional notes..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {editingId ? 'Update' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sales List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Sales Entries</h2>
        </div>

        {sales.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No sales entries found. Add your first entry to get started.
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
                    Partner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Online
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cash
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(sale.date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-3 w-3 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {sale.partner?.full_name || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      ₹{sale.total_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      ₹{sale.online_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                      ₹{sale.cash_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {sale.notes || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(sale)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(sale.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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
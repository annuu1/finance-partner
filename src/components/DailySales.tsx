import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';

interface SalesEntry {
  id: string;
  date: string;
  total_amount: number;
  online_amount: number;
  cash_amount: number;
  notes: string | null;
  created_at: string;
}

interface SalesForm {
  date: string;
  total_amount: number;
  online_amount: number;
  cash_amount: number;
  notes: string;
}

export default function DailySales() {
  const { user } = useAuth();
  const [sales, setSales] = useState<SalesEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const form = useForm<SalesForm>({
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      total_amount: 0,
      online_amount: 0,
      cash_amount: 0,
      notes: ''
    }
  });

  useEffect(() => {
    fetchSales();
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

  const fetchSales = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_sales')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setSales(data || []);
    } catch (error) {
      console.error('Error fetching sales:', error);
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

  const handleSubmit = async (data: SalesForm) => {
    if (!user) return;

    try {
      // Ensure amounts are numbers
      const onlineAmount = parseFloat(data.online_amount.toString()) || 0;
      const cashAmount = parseFloat(data.cash_amount.toString()) || 0;
      const totalAmount = onlineAmount + cashAmount;

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
            notes: data.notes || null
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
            created_by: user.id
          });

        if (error) throw error;
      }

      form.reset({
        date: format(new Date(), 'yyyy-MM-dd'),
        total_amount: 0,
        online_amount: 0,
        cash_amount: 0,
        notes: ''
      });
      setShowForm(false);
      fetchSales();
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
      fetchSales();
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
      notes: ''
    });
    setShowForm(false);
    setEditingId(null);
  };

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
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
  Receipt,
  DollarSign,
  Calendar,
  Tag,
  FileText
} from 'lucide-react';

interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface Expense {
  id: string;
  category_id: string;
  amount: number;
  description: string;
  expense_date: string;
  receipt_url: string | null;
  created_by: string;
  created_at: string;
  expense_categories: { name: string };
}

interface ExpenseForm {
  category_id: string;
  amount: number;
  description: string;
  expense_date: string;
  receipt_url: string;
}

interface CategoryForm {
  name: string;
  description: string;
}

export default function Expenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  
  const expenseForm = useForm<ExpenseForm>({
    defaultValues: {
      category_id: '',
      amount: 0,
      description: '',
      expense_date: format(new Date(), 'yyyy-MM-dd'),
      receipt_url: ''
    }
  });

  const categoryForm = useForm<CategoryForm>({
    defaultValues: {
      name: '',
      description: ''
    }
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('expense_categories')
        .select('*')
        .order('name');

      if (categoriesError) throw categoriesError;

      // Fetch expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*, expense_categories(name)')
        .order('expense_date', { ascending: false });

      if (expensesError) throw expensesError;

      setCategories(categoriesData || []);
      setExpenses(expensesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExpenseSubmit = async (data: ExpenseForm) => {
    if (!user) return;

    try {
      if (editingExpenseId) {
        // Update existing expense
        const { error } = await supabase
          .from('expenses')
          .update({
            category_id: data.category_id,
            amount: data.amount,
            description: data.description,
            expense_date: data.expense_date,
            receipt_url: data.receipt_url || null
          })
          .eq('id', editingExpenseId);

        if (error) throw error;
        setEditingExpenseId(null);
      } else {
        // Create new expense
        const { error } = await supabase
          .from('expenses')
          .insert({
            category_id: data.category_id,
            amount: data.amount,
            description: data.description,
            expense_date: data.expense_date,
            receipt_url: data.receipt_url || null,
            created_by: user.id
          });

        if (error) throw error;
      }

      expenseForm.reset({
        category_id: '',
        amount: 0,
        description: '',
        expense_date: format(new Date(), 'yyyy-MM-dd'),
        receipt_url: ''
      });
      setShowExpenseForm(false);
      fetchData();
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Error saving expense. Please try again.');
    }
  };

  const handleCategorySubmit = async (data: CategoryForm) => {
    try {
      const { error } = await supabase
        .from('expense_categories')
        .insert({
          name: data.name,
          description: data.description || null
        });

      if (error) throw error;

      categoryForm.reset({
        name: '',
        description: ''
      });
      setShowCategoryForm(false);
      fetchData();
    } catch (error) {
      console.error('Error creating category:', error);
      alert('Error creating category. Please try again.');
    }
  };

  const handleEditExpense = (expense: Expense) => {
    expenseForm.setValue('category_id', expense.category_id);
    expenseForm.setValue('amount', expense.amount);
    expenseForm.setValue('description', expense.description);
    expenseForm.setValue('expense_date', expense.expense_date);
    expenseForm.setValue('receipt_url', expense.receipt_url || '');
    setEditingExpenseId(expense.id);
    setShowExpenseForm(true);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? This will affect all related expenses.')) return;

    try {
      const { error } = await supabase
        .from('expense_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Cannot delete category. It may be in use by existing expenses.');
    }
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const expensesByCategory = categories.map(category => {
    const categoryExpenses = expenses.filter(expense => expense.category_id === category.id);
    const total = categoryExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    return {
      ...category,
      total,
      count: categoryExpenses.length
    };
  });

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
        <h1 className="text-2xl font-bold text-gray-900">Expense Management</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCategoryForm(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Tag className="h-4 w-4" />
            Add Category
          </button>
          <button
            onClick={() => setShowExpenseForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Expenses</p>
              <p className="text-2xl font-bold text-gray-900">₹{totalExpenses.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 p-3 rounded-full">
              <DollarSign className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Categories</p>
              <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-full">
              <Tag className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Records</p>
              <p className="text-2xl font-bold text-gray-900">{expenses.length}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-full">
              <Receipt className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Category Form Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Add Category</h2>
              <button
                onClick={() => setShowCategoryForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={categoryForm.handleSubmit(handleCategorySubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  {...categoryForm.register('name', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Office Supplies, Utilities"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  {...categoryForm.register('description')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Category description..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
                >
                  Create Category
                </button>
                <button
                  type="button"
                  onClick={() => setShowCategoryForm(false)}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Form Modal */}
      {showExpenseForm && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingExpenseId ? 'Edit Expense' : 'Add Expense'}
              </h2>
              <button
                onClick={() => {
                  setShowExpenseForm(false);
                  setEditingExpenseId(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={expenseForm.handleSubmit(handleExpenseSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  {...expenseForm.register('category_id', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
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
                  {...expenseForm.register('amount', { required: true, min: 0.01 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  {...expenseForm.register('expense_date', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  {...expenseForm.register('description', { required: true })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Expense description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Receipt URL (Optional)
                </label>
                <input
                  type="url"
                  {...expenseForm.register('receipt_url')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {editingExpenseId ? 'Update' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExpenseForm(false);
                    setEditingExpenseId(null);
                  }}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Categories Overview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Categories Overview</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {expensesByCategory.map((category) => (
            <div key={category.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">{category.name}</h3>
                <button
                  onClick={() => handleDeleteCategory(category.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-3">{category.description || 'No description'}</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{category.count} expenses</span>
                <span className="font-semibold text-gray-900">₹{category.total.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Expenses</h2>
        </div>

        {expenses.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No expenses found. Add your first expense to get started.
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
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receipt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(expense.expense_date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {expense.expense_categories.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {expense.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">
                      ₹{expense.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {expense.receipt_url ? (
                        <a
                          href={expense.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <FileText className="h-4 w-4" />
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditExpense(expense)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
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
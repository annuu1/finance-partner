import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Receipt,
  Calendar,
  ArrowUpIcon,
  ArrowDownIcon
} from 'lucide-react';

interface DashboardData {
  totalSales: number;
  totalExpenses: number;
  netSavings: number;
  partnerCount: number;
  salesTrend: Array<{ date: string; amount: number; online: number; cash: number }>;
  expenseBreakdown: Array<{ name: string; value: number; color: string }>;
  partnerBalances: Array<{ name: string; balance: number }>;
  recentTransactions: Array<{ id: string; type: string; amount: number; description: string; date: string }>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'7' | '30' | '90'>('30');

  useEffect(() => {
    fetchDashboardData();
  }, [timeframe]);

  const fetchDashboardData = async () => {
    setLoading(true);
    
    const days = parseInt(timeframe);
    const startDate = startOfDay(subDays(new Date(), days));
    const endDate = endOfDay(new Date());

    try {
      // Fetch sales data
      const { data: salesData } = await supabase
        .from('daily_sales')
        .select('*')
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      // Fetch expenses data
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('*, expense_categories(name)')
        .gte('expense_date', format(startDate, 'yyyy-MM-dd'))
        .lte('expense_date', format(endDate, 'yyyy-MM-dd'));

      // Fetch partners data
      const { data: partnersData } = await supabase
        .from('partners')
        .select('full_name, current_balance');

      // Fetch recent transactions
      const { data: transactionsData } = await supabase
        .from('partner_transactions')
        .select('*, from_partner:partners!from_partner_id(full_name), to_partner:partners!to_partner_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(5);

      // Process data
      const totalSales = salesData?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
      const totalExpenses = expensesData?.reduce((sum, expense) => sum + expense.amount, 0) || 0;
      const netSavings = totalSales - totalExpenses;

      // Process sales trend
      const salesTrend = salesData?.map(sale => ({
        date: format(new Date(sale.date), 'MMM dd'),
        amount: sale.total_amount,
        online: sale.online_amount,
        cash: sale.cash_amount
      })) || [];

      // Process expense breakdown
      const expensesByCategory = expensesData?.reduce((acc: Record<string, number>, expense: any) => {
        const categoryName = expense.expense_categories?.name || 'Other';
        acc[categoryName] = (acc[categoryName] || 0) + expense.amount;
        return acc;
      }, {}) || {};

      const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
      const expenseBreakdown = Object.entries(expensesByCategory).map(([name, value], index) => ({
        name,
        value: value as number,
        color: colors[index % colors.length]
      }));

      // Process partner balances
      const partnerBalances = partnersData?.map(partner => ({
        name: partner.full_name,
        balance: partner.current_balance
      })) || [];

      // Process recent transactions
      const recentTransactions = transactionsData?.map(transaction => ({
        id: transaction.id,
        type: 'Transfer',
        amount: transaction.amount,
        description: `${(transaction as any).from_partner?.full_name} → ${(transaction as any).to_partner?.full_name}`,
        date: format(new Date(transaction.created_at), 'MMM dd, yyyy')
      })) || [];

      setData({
        totalSales,
        totalExpenses,
        netSavings,
        partnerCount: partnersData?.length || 0,
        salesTrend,
        expenseBreakdown,
        partnerBalances,
        recentTransactions
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    {
      name: 'Total Sales',
      value: `₹${data.totalSales.toLocaleString()}`,
      icon: DollarSign,
      change: '+12%',
      changeType: 'increase' as const,
    },
    {
      name: 'Total Expenses',
      value: `₹${data.totalExpenses.toLocaleString()}`,
      icon: Receipt,
      change: '+8%',
      changeType: 'increase' as const,
    },
    {
      name: 'Net Savings',
      value: `₹${data.netSavings.toLocaleString()}`,
      icon: TrendingUp,
      change: data.netSavings >= 0 ? '+15%' : '-5%',
      changeType: data.netSavings >= 0 ? 'increase' : 'decrease' as const,
    },
    {
      name: 'Active Partners',
      value: data.partnerCount.toString(),
      icon: Users,
      change: '0%',
      changeType: 'neutral' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as '7' | '30' | '90')}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-full">
                  <Icon className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                {stat.changeType === 'increase' ? (
                  <ArrowUpIcon className="h-4 w-4 text-green-500" />
                ) : stat.changeType === 'decrease' ? (
                  <ArrowDownIcon className="h-4 w-4 text-red-500" />
                ) : null}
                <span className={`text-sm font-medium ${
                  stat.changeType === 'increase' ? 'text-green-600' : 
                  stat.changeType === 'decrease' ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {stat.change}
                </span>
                <span className="text-sm text-gray-500 ml-1">vs last period</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.salesTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString()}`, '']} />
              <Line type="monotone" dataKey="amount" stroke="#3B82F6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.salesTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString()}`, '']} />
              <Bar dataKey="online" fill="#10B981" name="Online" />
              <Bar dataKey="cash" fill="#F59E0B" name="Cash" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Expense Breakdown */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Breakdown</h3>
          {data.expenseBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data.expenseBreakdown}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={(entry) => `${entry.name}: ₹${entry.value.toLocaleString()}`}
                >
                  {data.expenseBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString()}`, '']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-8">No expenses recorded</p>
          )}
        </div>

        {/* Partner Balances */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Partner Balances</h3>
          <div className="space-y-3">
            {data.partnerBalances.map((partner, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{partner.name}</span>
                <span className={`text-sm font-semibold ${
                  partner.balance >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ₹{partner.balance.toLocaleString()}
                </span>
              </div>
            ))}
            {data.partnerBalances.length === 0 && (
              <p className="text-gray-500 text-center py-4">No partner data available</p>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            {data.recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{transaction.description}</p>
                  <p className="text-xs text-gray-500">{transaction.date}</p>
                </div>
                <span className="text-sm font-semibold text-blue-600">
                  ₹{transaction.amount.toLocaleString()}
                </span>
              </div>
            ))}
            {data.recentTransactions.length === 0 && (
              <p className="text-gray-500 text-center py-4">No recent transactions</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
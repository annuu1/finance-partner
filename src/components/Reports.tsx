import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
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
  Line,
  Area,
  AreaChart
} from 'recharts';
import { 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Receipt,
  Users,
  FileText
} from 'lucide-react';

interface ReportData {
  salesSummary: {
    totalSales: number;
    totalExpenses: number;
    netProfit: number;
    transactionCount: number;
  };
  salesTrend: Array<{ date: string; sales: number; expenses: number; profit: number }>;
  expenseBreakdown: Array<{ name: string; value: number; color: string }>;
  partnerPerformance: Array<{ name: string; balance: number; transactions: number }>;
  dailyComparison: Array<{ date: string; online: number; cash: number; total: number }>;
}

export default function Reports() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter'>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const today = new Date();
    let start: Date, end: Date;

    switch (dateRange) {
      case 'week':
        start = startOfWeek(today);
        end = endOfWeek(today);
        break;
      case 'month':
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case 'quarter':
        start = startOfMonth(subDays(today, 90));
        end = endOfMonth(today);
        break;
      default:
        start = startOfMonth(today);
        end = endOfMonth(today);
    }

    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  }, [dateRange]);

  useEffect(() => {
    if (startDate && endDate) {
      fetchReportData();
    }
  }, [startDate, endDate]);

  const fetchReportData = async () => {
    setLoading(true);
    
    try {
      // Fetch sales data
      const { data: salesData } = await supabase
        .from('daily_sales')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');

      // Fetch expenses data
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('*, expense_categories(name)')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      // Fetch partners data
      const { data: partnersData } = await supabase
        .from('partners')
        .select('*');

      // Fetch transactions data
      const { data: transactionsData } = await supabase
        .from('partner_transactions')
        .select('*, from_partner:partners!from_partner_id(full_name), to_partner:partners!to_partner_id(full_name)')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);

      // Process data
      const totalSales = salesData?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
      const totalExpenses = expensesData?.reduce((sum, expense) => sum + expense.amount, 0) || 0;
      const netProfit = totalSales - totalExpenses;
      const transactionCount = transactionsData?.length || 0;

      // Sales trend data
      const salesTrend = salesData?.map(sale => {
        const dayExpenses = expensesData?.filter(expense => 
          expense.expense_date === sale.date
        ).reduce((sum, expense) => sum + expense.amount, 0) || 0;
        
        return {
          date: format(new Date(sale.date), 'MMM dd'),
          sales: sale.total_amount,
          expenses: dayExpenses,
          profit: sale.total_amount - dayExpenses
        };
      }) || [];

      // Expense breakdown
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

      // Partner performance
      const partnerPerformance = partnersData?.map(partner => {
        const partnerTransactions = transactionsData?.filter(transaction => 
          transaction.from_partner_id === partner.id || transaction.to_partner_id === partner.id
        ).length || 0;

        return {
          name: partner.full_name,
          balance: partner.current_balance,
          transactions: partnerTransactions
        };
      }) || [];

      // Daily comparison (online vs cash)
      const dailyComparison = salesData?.map(sale => ({
        date: format(new Date(sale.date), 'MMM dd'),
        online: sale.online_amount,
        cash: sale.cash_amount,
        total: sale.total_amount
      })) || [];

      setData({
        salesSummary: {
          totalSales,
          totalExpenses,
          netProfit,
          transactionCount
        },
        salesTrend,
        expenseBreakdown,
        partnerPerformance,
        dailyComparison
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    if (!data) return;

    const reportContent = `
Business Partner Finance Report
Generated: ${format(new Date(), 'PPP')}
Period: ${format(new Date(startDate), 'PPP')} - ${format(new Date(endDate), 'PPP')}

SUMMARY
=======
Total Sales: ₹${data.salesSummary.totalSales.toLocaleString()}
Total Expenses: ₹${data.salesSummary.totalExpenses.toLocaleString()}
Net Profit: ₹${data.salesSummary.netProfit.toLocaleString()}
Transactions: ${data.salesSummary.transactionCount}

EXPENSE BREAKDOWN
================
${data.expenseBreakdown.map(item => `${item.name}: ₹${item.value.toLocaleString()}`).join('\n')}

PARTNER PERFORMANCE
==================
${data.partnerPerformance.map(partner => `${partner.name}: ₹${partner.balance.toLocaleString()} (${partner.transactions} transactions)`).join('\n')}
    `;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-report-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as 'week' | 'month' | 'quarter')}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">Last 3 Months</option>
          </select>
          <button
            onClick={exportReport}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-green-600">₹{data.salesSummary.totalSales.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600">₹{data.salesSummary.totalExpenses.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 p-3 rounded-full">
              <Receipt className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Net Profit</p>
              <p className={`text-2xl font-bold ${data.salesSummary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{data.salesSummary.netProfit.toLocaleString()}
              </p>
            </div>
            <div className={`p-3 rounded-full ${data.salesSummary.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              {data.salesSummary.netProfit >= 0 ? (
                <TrendingUp className="h-6 w-6 text-green-600" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-600" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Transactions</p>
              <p className="text-2xl font-bold text-blue-600">{data.salesSummary.transactionCount}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-full">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales vs Expenses Trend */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales vs Expenses Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.salesTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString()}`, '']} />
              <Area type="monotone" dataKey="sales" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
              <Area type="monotone" dataKey="expenses" stackId="2" stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Profit Trend */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Profit Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.salesTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Profit']} />
              <Line 
                type="monotone" 
                dataKey="profit" 
                stroke="#3B82F6" 
                strokeWidth={3}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Breakdown</h3>
          {data.expenseBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.expenseBreakdown}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
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
            <p className="text-gray-500 text-center py-12">No expense data available</p>
          )}
        </div>

        {/* Payment Method Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.dailyComparison}>
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

      {/* Partner Performance Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Partner Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Partner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transactions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.partnerPerformance.map((partner, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {partner.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{partner.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-semibold ${
                      partner.balance >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ₹{partner.balance.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {partner.transactions}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      partner.balance >= 0 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {partner.balance >= 0 ? 'Positive' : 'Negative'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Summary</h3>
        <div className="prose max-w-none">
          <p className="text-gray-600 mb-4">
            This report covers the period from <strong>{format(new Date(startDate), 'PPP')}</strong> to <strong>{format(new Date(endDate), 'PPP')}</strong>.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Key Insights:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Total revenue generated: ₹{data.salesSummary.totalSales.toLocaleString()}</li>
                <li>• Total expenses incurred: ₹{data.salesSummary.totalExpenses.toLocaleString()}</li>
                <li>• Net profit margin: {data.salesSummary.totalSales > 0 ? ((data.salesSummary.netProfit / data.salesSummary.totalSales) * 100).toFixed(1) : 0}%</li>
                <li>• Partner transactions processed: {data.salesSummary.transactionCount}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Recommendations:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {data.salesSummary.netProfit < 0 && (
                  <li>• Consider reviewing expense categories to identify cost reduction opportunities</li>
                )}
                {data.expenseBreakdown.length > 0 && (
                  <li>• Monitor {data.expenseBreakdown[0]?.name} expenses as they represent the largest category</li>
                )}
                <li>• Maintain regular partner balance reviews to ensure fair distribution</li>
                <li>• Continue tracking daily sales to identify trends and patterns</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
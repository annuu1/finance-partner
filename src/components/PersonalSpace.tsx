import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { format, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  MessageCircle,
  FileText,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Send,
  Paperclip,
  StickyNote,
  Calendar,
  Repeat,
  User,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface PersonalTransaction {
  id: string;
  from_partner_id: string;
  to_partner_id: string;
  amount: number;
  transaction_type: 'borrow' | 'lend' | 'payment' | 'transfer';
  description: string | null;
  category: string;
  transaction_date: string;
  is_recurring: boolean;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  from_partner: { full_name: string };
  to_partner: { full_name: string };
}

interface AutomatedRule {
  id: string;
  from_partner_id: string;
  to_partner_id: string;
  amount: number;
  transaction_type: 'borrow' | 'lend' | 'payment' | 'transfer';
  description: string;
  category: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  end_date: string | null;
  next_execution_date: string;
  is_active: boolean;
  created_by: string;
  from_partner: { full_name: string };
  to_partner: { full_name: string };
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  sender: { full_name: string };
  receiver: { full_name: string };
}

interface Note {
  id: string;
  partner_id: string;
  title: string;
  content: string;
  category: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

interface PersonalBalance {
  partner_a_id: string;
  partner_b_id: string;
  balance_amount: number;
  last_updated: string;
  partner_name: string;
}

interface Partner {
  id: string;
  full_name: string;
  email: string;
}

interface TransactionForm {
  from_partner_id: string;
  to_partner_id: string;
  amount: number;
  transaction_type: 'borrow' | 'lend' | 'payment' | 'transfer';
  description: string;
  category: string;
  transaction_date: string;
}

interface RuleForm {
  to_partner_id: string;
  amount: number;
  transaction_type: 'borrow' | 'lend' | 'payment' | 'transfer';
  description: string;
  category: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  end_date: string;
}

interface MessageForm {
  receiver_id: string;
  message_text: string;
}

interface NoteForm {
  title: string;
  content: string;
  category: string;
  is_private: boolean;
}

export default function PersonalSpace() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'transactions' | 'automation' | 'messages' | 'notes'>('transactions');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [personalTransactions, setPersonalTransactions] = useState<PersonalTransaction[]>([]);
  const [automatedRules, setAutomatedRules] = useState<AutomatedRule[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [personalBalances, setPersonalBalances] = useState<PersonalBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<string>('');

  const transactionForm = useForm<TransactionForm>({
    defaultValues: {
      from_partner_id: '',
      to_partner_id: '',
      amount: 0,
      transaction_type: 'payment',
      description: '',
      category: 'general',
      transaction_date: format(new Date(), 'yyyy-MM-dd')
    }
  });

  const ruleForm = useForm<RuleForm>({
    defaultValues: {
      to_partner_id: '',
      amount: 0,
      transaction_type: 'payment',
      description: '',
      category: 'general',
      frequency: 'monthly',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: ''
    }
  });

  const messageForm = useForm<MessageForm>({
    defaultValues: {
      receiver_id: '',
      message_text: ''
    }
  });

  const noteForm = useForm<NoteForm>({
    defaultValues: {
      title: '',
      content: '',
      category: 'general',
      is_private: true
    }
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch partners
      const { data: partnersData } = await supabase
        .from('partners')
        .select('id, full_name, email')
        .neq('id', user.id)
        .order('full_name');

      // Fetch personal transactions
      const { data: transactionsData } = await supabase
        .from('personal_transactions')
        .select(`
          *,
          from_partner:partners!from_partner_id(full_name),
          to_partner:partners!to_partner_id(full_name)
        `)
        .or(`from_partner_id.eq.${user.id},to_partner_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      // Fetch automated rules
      const { data: rulesData } = await supabase
        .from('automated_transaction_rules')
        .select(`
          *,
          from_partner:partners!from_partner_id(full_name),
          to_partner:partners!to_partner_id(full_name)
        `)
        .or(`from_partner_id.eq.${user.id},to_partner_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      // Fetch messages
      const { data: messagesData } = await supabase
        .from('partner_messages')
        .select(`
          *,
          sender:partners!sender_id(full_name),
          receiver:partners!receiver_id(full_name)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      // Fetch notes
      const { data: notesData } = await supabase
        .from('partner_notes')
        .select('*')
        .eq('partner_id', user.id)
        .order('updated_at', { ascending: false });

      // Fetch personal balances
      const { data: balancesData } = await supabase
        .from('personal_balances')
        .select(`
          *,
          partner_a:partners!partner_a_id(full_name),
          partner_b:partners!partner_b_id(full_name)
        `)
        .or(`partner_a_id.eq.${user.id},partner_b_id.eq.${user.id}`);

      // Process balances to show partner names correctly
      const processedBalances = balancesData?.map((balance: any) => {
        const isPartnerA = balance.partner_a_id === user.id;
        return {
          ...balance,
          partner_name: isPartnerA ? balance.partner_b.full_name : balance.partner_a.full_name,
          balance_amount: isPartnerA ? balance.balance_amount : -balance.balance_amount
        };
      }) || [];

      setPartners(partnersData || []);
      setPersonalTransactions(transactionsData || []);
      setAutomatedRules(rulesData || []);
      setMessages(messagesData || []);
      setNotes(notesData || []);
      setPersonalBalances(processedBalances);
    } catch (error) {
      console.error('Error fetching personal space data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionSubmit = async (data: TransactionForm) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('personal_transactions')
        .insert({
          from_partner_id: data.from_partner_id,
          to_partner_id: data.to_partner_id,
          amount: data.amount,
          transaction_type: data.transaction_type,
          description: data.description || null,
          category: data.category,
          transaction_date: data.transaction_date,
          status: 'pending' // All new transactions start as pending
        });

      if (error) throw error;

      transactionForm.reset();
      setShowTransactionForm(false);
      fetchData();
    } catch (error) {
      console.error('Error creating personal transaction:', error);
      alert('Error creating transaction. Please try again.');
    }
  };

  const handleTransactionApproval = async (transactionId: string, action: 'approve' | 'reject', rejectionReason?: string) => {
    if (!user) return;

    try {
      const updateData: any = {
        status: action === 'approve' ? 'approved' : 'rejected',
        approved_by: user.id
      };

      if (action === 'reject' && rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      const { error } = await supabase
        .from('personal_transactions')
        .update(updateData)
        .eq('id', transactionId);

      if (error) throw error;

      fetchData();
    } catch (error) {
      console.error('Error updating transaction status:', error);
      alert('Error updating transaction. Please try again.');
    }
  };

  const handleRuleSubmit = async (data: RuleForm) => {
    if (!user) return;

    try {
      const nextExecution = calculateNextExecution(data.start_date, data.frequency);
      
      const { error } = await supabase
        .from('automated_transaction_rules')
        .insert({
          from_partner_id: user.id,
          to_partner_id: data.to_partner_id,
          amount: data.amount,
          transaction_type: data.transaction_type,
          description: data.description,
          category: data.category,
          frequency: data.frequency,
          start_date: data.start_date,
          end_date: data.end_date || null,
          next_execution_date: nextExecution,
          created_by: user.id
        });

      if (error) throw error;

      ruleForm.reset();
      setShowRuleForm(false);
      fetchData();
    } catch (error) {
      console.error('Error creating automation rule:', error);
      alert('Error creating automation rule. Please try again.');
    }
  };

  const handleMessageSubmit = async (data: MessageForm) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('partner_messages')
        .insert({
          sender_id: user.id,
          receiver_id: data.receiver_id,
          message_text: data.message_text
        });

      if (error) throw error;

      messageForm.reset();
      setShowMessageForm(false);
      fetchData();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message. Please try again.');
    }
  };

  const handleNoteSubmit = async (data: NoteForm) => {
    if (!user) return;

    try {
      if (editingNote) {
        const { error } = await supabase
          .from('partner_notes')
          .update({
            title: data.title,
            content: data.content,
            category: data.category,
            is_private: data.is_private
          })
          .eq('id', editingNote.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('partner_notes')
          .insert({
            partner_id: user.id,
            title: data.title,
            content: data.content,
            category: data.category,
            is_private: data.is_private
          });

        if (error) throw error;
      }

      noteForm.reset();
      setShowNoteForm(false);
      setEditingNote(null);
      fetchData();
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Error saving note. Please try again.');
    }
  };

  const calculateNextExecution = (startDate: string, frequency: string): string => {
    const start = new Date(startDate);
    const today = new Date();
    
    if (start > today) return startDate;

    switch (frequency) {
      case 'daily':
        return format(addDays(today, 1), 'yyyy-MM-dd');
      case 'weekly':
        return format(addWeeks(today, 1), 'yyyy-MM-dd');
      case 'monthly':
        return format(addMonths(today, 1), 'yyyy-MM-dd');
      case 'yearly':
        return format(addYears(today, 1), 'yyyy-MM-dd');
      default:
        return format(addMonths(today, 1), 'yyyy-MM-dd');
    }
  };

  const toggleRuleStatus = async (ruleId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('automated_transaction_rules')
        .update({ is_active: !currentStatus })
        .eq('id', ruleId);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error updating rule status:', error);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;

    try {
      const { error } = await supabase
        .from('automated_transaction_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      const { error } = await supabase
        .from('partner_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const markMessageAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('partner_messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const totalOwed = personalBalances.reduce((sum, balance) => 
    balance.balance_amount < 0 ? sum + Math.abs(balance.balance_amount) : sum, 0
  );
  
  const totalReceivable = personalBalances.reduce((sum, balance) => 
    balance.balance_amount > 0 ? sum + balance.balance_amount : sum, 0
  );

  const unreadMessages = messages.filter(msg => !msg.is_read && msg.receiver_id === user?.id).length;
  const pendingApprovals = personalTransactions.filter(tx => tx.status === 'pending' && tx.to_partner_id === user?.id).length;

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
        <h1 className="text-2xl font-bold text-gray-900">Personal Space</h1>
        <div className="flex gap-3">
          {activeTab === 'transactions' && (
            <button
              onClick={() => setShowTransactionForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Transaction
            </button>
          )}
          {activeTab === 'automation' && (
            <button
              onClick={() => setShowRuleForm(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Repeat className="h-4 w-4" />
              Add Rule
            </button>
          )}
          {activeTab === 'messages' && (
            <button
              onClick={() => setShowMessageForm(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Send Message
            </button>
          )}
          {activeTab === 'notes' && (
            <button
              onClick={() => setShowNoteForm(true)}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Note
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Amount Owed</p>
              <p className="text-2xl font-bold text-red-600">₹{totalOwed.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 p-3 rounded-full">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Amount Receivable</p>
              <p className="text-2xl font-bold text-green-600">₹{totalReceivable.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Rules</p>
              <p className="text-2xl font-bold text-blue-600">{automatedRules.filter(r => r.is_active).length}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-full">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Unread Messages</p>
              <p className="text-2xl font-bold text-purple-600">{unreadMessages}</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-full">
              <MessageCircle className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'transactions', label: 'Transactions', icon: DollarSign },
              { id: 'automation', label: 'Automation', icon: Repeat },
              { id: 'messages', label: 'Messages', icon: MessageCircle },
              { id: 'notes', label: 'Notes', icon: StickyNote }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {tab.id === 'messages' && unreadMessages > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center">
                      {unreadMessages}
                    </span>
                  )}
                  {tab.id === 'transactions' && pendingApprovals > 0 && (
                    <span className="bg-orange-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center">
                      {pendingApprovals}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="space-y-6">
              {/* Personal Balances */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Balances</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {personalBalances.map((balance, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-blue-600" />
                          </div>
                          <span className="font-medium text-gray-900">{balance.partner_name}</span>
                        </div>
                        <span className={`font-semibold ${
                          balance.balance_amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {balance.balance_amount >= 0 ? '+' : ''}₹{balance.balance_amount.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {balance.balance_amount >= 0 
                          ? `${balance.partner_name} owes you` 
                          : `You owe ${balance.partner_name}`
                        }
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Transactions */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
                {personalTransactions.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No personal transactions found.</p>
                ) : (
                  <div className="space-y-4">
                    {personalTransactions.map((transaction) => (
                      <div 
                        key={transaction.id} 
                        className={`border rounded-lg p-4 ${
                          transaction.status === 'pending' ? 'border-orange-200 bg-orange-50' :
                          transaction.status === 'approved' ? 'border-green-200 bg-green-50' :
                          'border-red-200 bg-red-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                transaction.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                                transaction.status === 'approved' ? 'bg-green-100 text-green-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {transaction.status}
                              </span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                transaction.transaction_type === 'borrow' ? 'bg-red-100 text-red-800' :
                                transaction.transaction_type === 'lend' ? 'bg-green-100 text-green-800' :
                                transaction.transaction_type === 'payment' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {transaction.transaction_type}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mb-2">
                              <p>
                                <strong>{transaction.from_partner.full_name}</strong> → <strong>{transaction.to_partner.full_name}</strong>
                              </p>
                              <p>Amount: ₹{transaction.amount.toLocaleString()}</p>
                              <p>Date: {format(new Date(transaction.transaction_date), 'MMM dd, yyyy')}</p>
                              {transaction.description && <p>Description: {transaction.description}</p>}
                              {transaction.rejection_reason && (
                                <p className="text-red-600">Rejection reason: {transaction.rejection_reason}</p>
                              )}
                            </div>
                          </div>
                          
                          {/* Action buttons for pending transactions */}
                          {transaction.status === 'pending' && transaction.to_partner_id === user?.id && (
                            <div className="flex items-center gap-2 ml-4">
                              <button
                                onClick={() => handleTransactionApproval(transaction.id, 'approve')}
                                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center gap-1"
                              >
                                <CheckCircle className="h-3 w-3" />
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  const reason = prompt('Rejection reason (optional):');
                                  handleTransactionApproval(transaction.id, 'reject', reason || undefined);
                                }}
                                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 flex items-center gap-1"
                              >
                                <XCircle className="h-3 w-3" />
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Automation Tab */}
          {activeTab === 'automation' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Automated Transaction Rules</h3>
              {automatedRules.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No automation rules found.</p>
              ) : (
                <div className="space-y-4">
                  {automatedRules.map((rule) => (
                    <div key={rule.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              rule.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {rule.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              {rule.description}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            <p>
                              {rule.transaction_type} ₹{rule.amount.toLocaleString()} 
                              {rule.from_partner_id === user?.id ? ' to ' : ' from '}
                              {rule.from_partner_id === user?.id 
                                ? rule.to_partner.full_name 
                                : rule.from_partner.full_name
                              } - {rule.frequency}
                            </p>
                            <p>Next execution: {format(new Date(rule.next_execution_date), 'MMM dd, yyyy')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleRuleStatus(rule.id, rule.is_active)}
                            className={`px-3 py-1 rounded text-sm font-medium ${
                              rule.is_active 
                                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' 
                                : 'bg-green-100 text-green-800 hover:bg-green-200'
                            }`}
                          >
                            {rule.is_active ? 'Pause' : 'Activate'}
                          </button>
                          <button
                            onClick={() => deleteRule(rule.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Messages</h3>
              {messages.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No messages found.</p>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div 
                      key={message.id} 
                      className={`border rounded-lg p-4 ${
                        !message.is_read && message.receiver_id === user?.id 
                          ? 'border-blue-200 bg-blue-50' 
                          : 'border-gray-200'
                      }`}
                      onClick={() => {
                        if (!message.is_read && message.receiver_id === user?.id) {
                          markMessageAsRead(message.id);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-gray-900">
                              {message.sender_id === user?.id ? 'You' : message.sender.full_name}
                            </span>
                            <span className="text-sm text-gray-500">→</span>
                            <span className="text-sm text-gray-600">
                              {message.receiver_id === user?.id ? 'You' : message.receiver.full_name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {format(new Date(message.created_at), 'MMM dd, yyyy HH:mm')}
                            </span>
                          </div>
                          <p className="text-gray-800">{message.message_text}</p>
                        </div>
                        {!message.is_read && message.receiver_id === user?.id && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Notes</h3>
              {notes.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No notes found.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {notes.map((note) => (
                    <div key={note.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{note.title}</h4>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingNote(note);
                              noteForm.setValue('title', note.title);
                              noteForm.setValue('content', note.content);
                              noteForm.setValue('category', note.category);
                              noteForm.setValue('is_private', note.is_private);
                              setShowNoteForm(true);
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteNote(note.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{note.content}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="bg-gray-100 px-2 py-1 rounded">{note.category}</span>
                        <span>{format(new Date(note.updated_at), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transaction Form Modal */}
      {showTransactionForm && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Add Personal Transaction</h2>
              <button onClick={() => setShowTransactionForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={transactionForm.handleSubmit(handleTransactionSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Partner</label>
                <select
                  {...transactionForm.register('from_partner_id', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select partner</option>
                  <option value={user?.id}>You</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>{partner.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Partner</label>
                <select
                  {...transactionForm.register('to_partner_id', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select partner</option>
                  <option value={user?.id}>You</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>{partner.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                <select
                  {...transactionForm.register('transaction_type', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="payment">Payment</option>
                  <option value="borrow">Borrow</option>
                  <option value="lend">Lend</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  {...transactionForm.register('amount', { required: true, min: 0.01 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  {...transactionForm.register('category')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., rent, utilities, food"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  {...transactionForm.register('transaction_date', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  {...transactionForm.register('description')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Transaction description..."
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-md">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <p className="text-sm text-blue-800">
                    This transaction will require approval from the receiving partner before it affects balances.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Transaction
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

      {/* Rule Form Modal */}
      {showRuleForm && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Add Automation Rule</h2>
              <button onClick={() => setShowRuleForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={ruleForm.handleSubmit(handleRuleSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Partner</label>
                <select
                  {...ruleForm.register('to_partner_id', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select partner</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>{partner.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                <select
                  {...ruleForm.register('transaction_type', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="payment">Payment</option>
                  <option value="borrow">Borrow</option>
                  <option value="lend">Lend</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  {...ruleForm.register('amount', { required: true, min: 0.01 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <select
                  {...ruleForm.register('frequency', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  {...ruleForm.register('start_date', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date (Optional)</label>
                <input
                  type="date"
                  {...ruleForm.register('end_date')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  {...ruleForm.register('description', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Monthly rent payment"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
                >
                  Create Rule
                </button>
                <button
                  type="button"
                  onClick={() => setShowRuleForm(false)}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Message Form Modal */}
      {showMessageForm && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Send Message</h2>
              <button onClick={() => setShowMessageForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={messageForm.handleSubmit(handleMessageSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <select
                  {...messageForm.register('receiver_id', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select partner</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>{partner.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  {...messageForm.register('message_text', { required: true })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Type your message..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Send Message
                </button>
                <button
                  type="button"
                  onClick={() => setShowMessageForm(false)}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Note Form Modal */}
      {showNoteForm && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingNote ? 'Edit Note' : 'Add Note'}
              </h2>
              <button 
                onClick={() => {
                  setShowNoteForm(false);
                  setEditingNote(null);
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={noteForm.handleSubmit(handleNoteSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  {...noteForm.register('title', { required: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Note title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  {...noteForm.register('content', { required: true })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Note content..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  {...noteForm.register('category')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., personal, business, reminders"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  {...noteForm.register('is_private')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Private note (only visible to you)
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {editingNote ? 'Update Note' : 'Save Note'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNoteForm(false);
                    setEditingNote(null);
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
    </div>
  );
}
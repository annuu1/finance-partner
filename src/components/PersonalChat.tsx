import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';
import { 
  Send, 
  User, 
  MessageCircle, 
  Search,
  MoreVertical,
  Circle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Menu
} from 'lucide-react';

interface Partner {
  id: string;
  full_name: string;
  email: string;
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

interface Conversation {
  partner_id: string;
  partner_name: string;
  partner_email: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  is_online: boolean;
}

interface MessageForm {
  message_text: string;
}

export default function PersonalChat() {
  const { user } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typingPartners, setTypingPartners] = useState<Set<string>>(new Set());
  const [showSidebar, setShowSidebar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  const messageForm = useForm<MessageForm>({
    defaultValues: {
      message_text: ''
    }
  });

  useEffect(() => {
    fetchData();
    
    // Set up real-time subscriptions
    const messagesSubscription = supabase
      .channel('messages')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'partner_messages' },
        () => {
          fetchMessages();
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      messagesSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (selectedPartner) {
      fetchMessages();
      markMessagesAsRead();
    }
  }, [selectedPartner]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Auto-select most recent conversation partner
    if (conversations.length > 0 && !selectedPartner) {
      setSelectedPartner(conversations[0].partner_id);
    }
  }, [conversations, selectedPartner]);

  const fetchData = async () => {
    if (!user) return;

    try {
      await Promise.all([
        fetchPartners(),
        fetchConversations()
      ]);
    } catch (error) {
      console.error('Error fetching chat data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPartners = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('partners')
      .select('id, full_name, email')
      .neq('id', user.id)
      .order('full_name');

    if (error) {
      console.error('Error fetching partners:', error);
      return;
    }

    setPartners(data || []);
  };

  const fetchConversations = async () => {
    if (!user) return;

    const { data: messagesData, error } = await supabase
      .from('partner_messages')
      .select(`
        *,
        sender:partners!sender_id(full_name, email),
        receiver:partners!receiver_id(full_name, email)
      `)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return;
    }

    // Group messages by conversation partner
    const conversationMap = new Map<string, Conversation>();

    messagesData?.forEach((message: any) => {
      const isFromCurrentUser = message.sender_id === user.id;
      const partnerId = isFromCurrentUser ? message.receiver_id : message.sender_id;
      const partnerName = isFromCurrentUser ? message.receiver.full_name : message.sender.full_name;
      const partnerEmail = isFromCurrentUser ? message.receiver.email : message.sender.email;

      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          partner_id: partnerId,
          partner_name: partnerName,
          partner_email: partnerEmail,
          last_message: message.message_text,
          last_message_time: message.created_at,
          unread_count: 0,
          is_online: Math.random() > 0.5 // Simulate online status
        });
      }

      // Count unread messages from this partner
      if (!message.is_read && message.sender_id === partnerId) {
        const conversation = conversationMap.get(partnerId)!;
        conversation.unread_count++;
      }
    });

    const conversationsList = Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime());

    setConversations(conversationsList);
  };

  const fetchMessages = async () => {
    if (!user || !selectedPartner) return;

    const { data, error } = await supabase
      .from('partner_messages')
      .select(`
        *,
        sender:partners!sender_id(full_name),
        receiver:partners!receiver_id(full_name)
      `)
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedPartner}),and(sender_id.eq.${selectedPartner},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    setMessages(data || []);
  };

  const markMessagesAsRead = async () => {
    if (!user || !selectedPartner) return;

    const { error } = await supabase
      .from('partner_messages')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('sender_id', selectedPartner)
      .eq('receiver_id', user.id)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleSendMessage = async (data: MessageForm) => {
    if (!user || !selectedPartner || !data.message_text.trim()) return;

    setSending(true);

    try {
      const { error } = await supabase
        .from('partner_messages')
        .insert({
          sender_id: user.id,
          receiver_id: selectedPartner,
          message_text: data.message_text.trim()
        });

      if (error) throw error;

      messageForm.reset();
      fetchMessages();
      fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      messageForm.handleSubmit(handleSendMessage)();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const filteredConversations = conversations.filter(conv =>
    conv.partner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.partner_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedPartnerData = partners.find(p => p.id === selectedPartner);

  const handleSelectPartner = (partnerId: string) => {
    setSelectedPartner(partnerId);
    setShowSidebar(false);
    messageForm.reset();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] bg-white rounded-lg shadow-sm border border-gray-200 flex relative">
      {/* Mobile Sidebar Overlay */}
      {showSidebar && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Conversations Sidebar */}
      <div className={`
        ${showSidebar ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:relative
        fixed inset-y-0 left-0 z-50
        w-80 lg:w-1/3 
        border-r border-gray-200 
        flex flex-col 
        bg-white
        transition-transform duration-300 ease-in-out
      `}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
            <button
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              onClick={() => setShowSidebar(false)}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No conversations found</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.partner_id}
                  onClick={() => handleSelectPartner(conversation.partner_id)}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    selectedPartner === conversation.partner_id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="relative flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        {conversation.is_online && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <span className="font-medium text-gray-900 truncate">
                        {conversation.partner_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {conversation.unread_count > 0 && (
                        <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center">
                          {conversation.unread_count}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {format(new Date(conversation.last_message_time), 'HH:mm')}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    {conversation.last_message}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedPartner ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                    onClick={() => setShowSidebar(true)}
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <div className="relative">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    {conversations.find(c => c.partner_id === selectedPartner)?.is_online && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {selectedPartnerData?.full_name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {conversations.find(c => c.partner_id === selectedPartner)?.is_online ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
                <button className="p-2 hover:bg-gray-200 rounded-lg">
                  <MoreVertical className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No messages yet. Start a conversation!</p>
                </div>
              ) : (
                <>
                  {messages.map((message, index) => {
                    const isFromCurrentUser = message.sender_id === user?.id;
                    const showTimestamp = index === 0 || 
                      new Date(message.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() > 300000; // 5 minutes

                    return (
                      <div key={message.id}>
                        {showTimestamp && (
                          <div className="text-center text-xs text-gray-500 my-4">
                            {format(new Date(message.created_at), 'MMM dd, yyyy HH:mm')}
                          </div>
                        )}
                        <div className={`flex ${isFromCurrentUser ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-xs sm:max-w-sm lg:max-w-md px-4 py-2 rounded-lg ${
                            isFromCurrentUser
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}>
                            <p className="text-sm break-words">{message.message_text}</p>
                            <div className={`flex items-center justify-end gap-1 mt-1 ${
                              isFromCurrentUser ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              <span className="text-xs">
                                {format(new Date(message.created_at), 'HH:mm')}
                              </span>
                              {isFromCurrentUser && (
                                <>
                                  {message.is_read ? (
                                    <CheckCircle2 className="h-3 w-3" />
                                  ) : (
                                    <Circle className="h-3 w-3" />
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {typingPartners.has(selectedPartner) && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg">
                        <div className="flex items-center gap-1">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                          <span className="text-xs text-gray-500 ml-2">typing...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200">
              <form onSubmit={messageForm.handleSubmit(handleSendMessage)} className="flex gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={messageInputRef}
                    {...messageForm.register('message_text', { required: true })}
                    placeholder="Type a message..."
                    onKeyPress={handleKeyPress}
                    rows={1}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    style={{ minHeight: '40px', maxHeight: '120px' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending || !messageForm.watch('message_text')?.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <button
                className="lg:hidden mb-4 p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                onClick={() => setShowSidebar(true)}
              >
                <Menu className="h-6 w-6" />
              </button>
              <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p className="hidden lg:block">Choose a partner from the sidebar to start chatting</p>
              <p className="lg:hidden">Tap the menu button to see your conversations</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
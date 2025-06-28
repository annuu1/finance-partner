import { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { 
  BarChart3, 
  DollarSign, 
  Users, 
  Receipt, 
  Settings, 
  LogOut,
  Menu,
  X,
  Heart,
  User,
  MessageCircle
} from 'lucide-react';
import { useState } from 'react';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
}

export default function Layout({ children, currentPage, onPageChange }: LayoutProps) {
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', id: 'dashboard', icon: BarChart3 },
    { name: 'Daily Sales', id: 'sales', icon: DollarSign },
    { name: 'Partners', id: 'partners', icon: Users },
    { name: 'Expenses', id: 'expenses', icon: Receipt },
    { name: 'Personal Space', id: 'personal', icon: Heart },
    { name: 'Personal Chat', id: 'chat', icon: MessageCircle },
    { name: 'Reports', id: 'reports', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile menu overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 lg:flex lg:flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 bg-white">
          <h1 className="text-xl font-bold text-gray-900">FinancePartner</h1>
          <button
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onPageChange(item.id);
                  setSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200
                  ${currentPage === item.id 
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* User Profile Section */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center mb-3 px-2">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-blue-600">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
              <p className="text-xs text-gray-500">Business Partner</p>
            </div>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => {
                onPageChange('profile');
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                currentPage === 'profile'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900'
              }`}
            >
              <User className="h-4 w-4 mr-3 flex-shrink-0" />
              <span>Profile Settings</span>
            </button>
            <button
              onClick={signOut}
              className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-white hover:text-gray-900 transition-colors"
            >
              <LogOut className="h-4 w-4 mr-3 flex-shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top navigation bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 lg:shadow-none">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <div className="flex items-center">
              <button
                className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <h2 className="ml-2 lg:ml-0 text-lg font-semibold text-gray-900 capitalize">
                {navigation.find(item => item.id === currentPage)?.name || 
                 (currentPage === 'profile' ? 'Profile Settings' : 'Dashboard')}
              </h2>
            </div>
            
            {/* Optional: Add user avatar or other header actions */}
            <div className="flex items-center space-x-4">
              <div className="hidden sm:block">
                <span className="text-sm text-gray-500">Welcome back!</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
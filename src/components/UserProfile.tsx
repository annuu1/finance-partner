import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { 
  User, 
  Mail, 
  Lock, 
  Save, 
  Eye, 
  EyeOff,
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react';

interface ProfileForm {
  full_name: string;
  email: string;
}

interface PasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

interface UserProfileData {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export default function UserProfile() {
  const { user, signOut } = useAuth();
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const profileForm = useForm<ProfileForm>();
  const passwordForm = useForm<PasswordForm>();

  useEffect(() => {
    fetchProfileData();
  }, [user]);

  const fetchProfileData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setProfileData(data);
      profileForm.setValue('full_name', data.full_name);
      profileForm.setValue('email', data.email);
    } catch (error) {
      console.error('Error fetching profile data:', error);
      setMessage({ type: 'error', text: 'Failed to load profile data' });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (data: ProfileForm) => {
    if (!user || !profileData) return;

    setUpdating(true);
    setMessage(null);

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new Error('Please enter a valid email address');
      }

      // Validate name
      if (data.full_name.trim().length < 2) {
        throw new Error('Full name must be at least 2 characters long');
      }

      // Update profile in partners table
      const { error: profileError } = await supabase
        .from('partners')
        .update({
          full_name: data.full_name.trim(),
          email: data.email.toLowerCase().trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update email in auth if it changed
      if (data.email.toLowerCase().trim() !== profileData.email) {
        const { error: authError } = await supabase.auth.updateUser({
          email: data.email.toLowerCase().trim()
        });

        if (authError) {
          // Revert the profile update if auth update fails
          await supabase
            .from('partners')
            .update({
              email: profileData.email,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);
          
          throw new Error('Failed to update email. Please try again.');
        }
      }

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      fetchProfileData();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
    } finally {
      setUpdating(false);
    }
  };

  const handlePasswordUpdate = async (data: PasswordForm) => {
    if (!user) return;

    setUpdating(true);
    setMessage(null);

    try {
      // Validate password requirements
      if (data.new_password.length < 6) {
        throw new Error('New password must be at least 6 characters long');
      }

      if (data.new_password !== data.confirm_password) {
        throw new Error('New passwords do not match');
      }

      if (data.current_password === data.new_password) {
        throw new Error('New password must be different from current password');
      }

      // Verify current password by attempting to sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: data.current_password
      });

      if (verifyError) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.new_password
      });

      if (updateError) throw updateError;

      setMessage({ type: 'success', text: 'Password updated successfully!' });
      passwordForm.reset();
      setShowPasswordForm(false);
    } catch (error: any) {
      console.error('Error updating password:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update password' });
    } finally {
      setUpdating(false);
    }
  };

  const clearMessage = () => {
    setMessage(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Failed to load profile data</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="h-10 w-10 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">User Profile</h1>
        <p className="text-gray-600">Manage your personal information and account settings</p>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center justify-between ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <span className={`text-sm font-medium ${
              message.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}>
              {message.text}
            </span>
          </div>
          <button
            onClick={clearMessage}
            className={`${
              message.type === 'success' ? 'text-green-600 hover:text-green-800' : 'text-red-600 hover:text-red-800'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Profile Information Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
        </div>

        <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              {...profileForm.register('full_name', { 
                required: 'Full name is required',
                minLength: { value: 2, message: 'Name must be at least 2 characters' },
                validate: value => value.trim().length >= 2 || 'Name cannot be empty or just spaces'
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your full name"
            />
            {profileForm.formState.errors.full_name && (
              <p className="text-red-600 text-sm mt-1">{profileForm.formState.errors.full_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              {...profileForm.register('email', { 
                required: 'Email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Please enter a valid email address'
                }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your email address"
            />
            {profileForm.formState.errors.email && (
              <p className="text-red-600 text-sm mt-1">{profileForm.formState.errors.email.message}</p>
            )}
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={updating}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {updating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="h-4 w-4" />
              )}
              {updating ? 'Updating...' : 'Update Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Account Security Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Account Security</h2>
        </div>

        {!showPasswordForm ? (
          <div>
            <p className="text-gray-600 mb-4">
              Keep your account secure by using a strong password and updating it regularly.
            </p>
            <button
              onClick={() => setShowPasswordForm(true)}
              className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Change Password
            </button>
          </div>
        ) : (
          <form onSubmit={passwordForm.handleSubmit(handlePasswordUpdate)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Password *
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  {...passwordForm.register('current_password', { 
                    required: 'Current password is required' 
                  })}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {passwordForm.formState.errors.current_password && (
                <p className="text-red-600 text-sm mt-1">{passwordForm.formState.errors.current_password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password *
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  {...passwordForm.register('new_password', { 
                    required: 'New password is required',
                    minLength: { value: 6, message: 'Password must be at least 6 characters' }
                  })}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {passwordForm.formState.errors.new_password && (
                <p className="text-red-600 text-sm mt-1">{passwordForm.formState.errors.new_password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password *
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...passwordForm.register('confirm_password', { 
                    required: 'Please confirm your new password',
                    validate: value => value === passwordForm.watch('new_password') || 'Passwords do not match'
                  })}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Confirm your new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {passwordForm.formState.errors.confirm_password && (
                <p className="text-red-600 text-sm mt-1">{passwordForm.formState.errors.confirm_password.message}</p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={updating}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {updating ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {updating ? 'Updating...' : 'Update Password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false);
                  passwordForm.reset();
                }}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Account Information */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Account Information</h2>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-600">Account ID</span>
            <span className="text-sm text-gray-900 font-mono">{profileData.id.slice(0, 8)}...</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-600">Member Since</span>
            <span className="text-sm text-gray-900">
              {new Date(profileData.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm font-medium text-gray-600">Last Updated</span>
            <span className="text-sm text-gray-900">
              {new Date(profileData.updated_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
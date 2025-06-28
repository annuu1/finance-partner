import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const initializeAuth = async () => {
      if (!mounted) return;

      try {
        console.log('Initializing auth...');
        
        // Get fresh session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (error) {
          console.error('Error getting session:', error);
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying auth initialization (${retryCount}/${maxRetries})...`);
            setTimeout(() => initializeAuth(), 1000 * retryCount);
            return;
          }
        }

        console.log('Session initialized:', session?.user?.email || 'No user');
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Only create partner profile if we have a user and haven't initialized yet
        if (session?.user && !initialized) {
          try {
            await ensurePartnerProfile(session.user);
          } catch (profileError) {
            console.error('Error ensuring partner profile:', profileError);
            // Don't block the app if profile creation fails
          }
        }
        
        setInitialized(true);
      } catch (error) {
        console.error('Error in auth initialization:', error);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(() => initializeAuth(), 1000 * retryCount);
          return;
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('Auth state changed:', event, session?.user?.email || 'No user');

        try {
          setSession(session);
          setUser(session?.user ?? null);
          
          // Only handle profile creation for actual sign-in events
          if (session?.user && event === 'SIGNED_IN' && initialized) {
            try {
              await ensurePartnerProfile(session.user);
            } catch (profileError) {
              console.error('Error ensuring partner profile:', profileError);
            }
          }
          
          // Handle sign out
          if (event === 'SIGNED_OUT') {
            setUser(null);
            setSession(null);
          }
        } catch (error) {
          console.error('Error in auth state change:', error);
        }
      }
    );

    // Initialize auth
    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array to run only once

  const ensurePartnerProfile = async (user: User) => {
    try {
      console.log('Checking partner profile for:', user.email);
      
      // Check if partner profile exists
      const { data: existingPartner, error: fetchError } = await supabase
        .from('partners')
        .select('id')
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle to avoid errors when no rows found

      if (fetchError) {
        console.error('Error checking partner profile:', fetchError);
        throw fetchError;
      }

      // If partner doesn't exist, create one
      if (!existingPartner) {
        console.log('Creating partner profile for:', user.email);
        
        const { error: insertError } = await supabase
          .from('partners')
          .insert({
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            current_balance: 0,
          });

        if (insertError) {
          console.error('Error creating partner profile:', insertError);
          throw insertError;
        }
        
        console.log('Partner profile created successfully');
      } else {
        console.log('Partner profile already exists');
      }
    } catch (error) {
      console.error('Error ensuring partner profile:', error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting sign in for:', email);
      
      // Clear any existing session first
      await supabase.auth.signOut();
      
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: email.trim().toLowerCase(), 
        password 
      });
      
      if (error) {
        console.error('Sign in error:', error);
      } else {
        console.log('Sign in successful for:', email);
      }
      
      return { error };
    } catch (error) {
      console.error('Error in signIn:', error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      console.log('Attempting sign up for:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim()
          }
        }
      });

      if (!error && data.user) {
        // Create partner profile
        const { error: profileError } = await supabase.from('partners').insert({
          id: data.user.id,
          email: email.trim().toLowerCase(),
          full_name: fullName.trim(),
          current_balance: 0,
        });

        if (profileError) {
          console.error('Error creating partner profile during signup:', profileError);
          // Don't fail the signup if profile creation fails
        }
      }

      return { error };
    } catch (error) {
      console.error('Error in signUp:', error);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      console.log('Signing out...');
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setInitialized(false);
      
      // Clear any cached data
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
      
      console.log('Sign out successful');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signIn,
      signUp,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
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

  useEffect(() => {
    let mounted = true;

    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (error) {
          console.error('Error getting session:', error);
        }

        setSession(session);
        setUser(session?.user ?? null);
        
        // Only try to ensure partner profile if we have a user and no error
        if (session?.user && !error) {
          try {
            await ensurePartnerProfile(session.user);
          } catch (profileError) {
            console.error('Error ensuring partner profile:', profileError);
            // Don't block the app if profile creation fails
          }
        }
      } catch (error) {
        console.error('Error in getSession:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        try {
          setSession(session);
          setUser(session?.user ?? null);
          
          // Only try to ensure partner profile for sign in events
          if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
            try {
              await ensurePartnerProfile(session.user);
            } catch (profileError) {
              console.error('Error ensuring partner profile:', profileError);
              // Don't block the app if profile creation fails
            }
          }
        } catch (error) {
          console.error('Error in auth state change:', error);
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      }
    );

    getSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const ensurePartnerProfile = async (user: User) => {
    try {
      // Check if partner profile exists
      const { data: existingPartner, error: fetchError } = await supabase
        .from('partners')
        .select('id')
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors when no record exists

      // If partner doesn't exist, create one
      if (!existingPartner && !fetchError) {
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
      } else if (fetchError) {
        console.error('Error checking partner profile:', fetchError);
        throw fetchError;
      }
    } catch (error) {
      console.error('Error ensuring partner profile:', error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (!error && data.user) {
        // Create partner profile
        const { error: profileError } = await supabase.from('partners').insert({
          id: data.user.id,
          email,
          full_name: fullName,
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
      await supabase.auth.signOut();
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
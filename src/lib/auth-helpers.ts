import { supabase } from '@/integrations/supabase/client';

/**
 * Get the current user's JWT access token for authenticated edge function calls.
 * Returns null if no active session.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

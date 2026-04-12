import { supabase } from './client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export type InvokeWithAuthResult<T> = {
  data: T | null;
  error: Error | null;
};

/**
 * Invoke a Supabase Edge Function with an explicit JWT using direct fetch().
 *
 * Why: supabase.functions.invoke() in supabase-js v2.99.3 overrides custom
 * Authorization headers with the anon key, causing 401s when edge functions
 * decode the JWT to extract the user's `sub` field. Using fetch() directly
 * gives us full control over the Authorization header.
 */
export async function invokeWithAuth<T = unknown>(
  functionName: string,
  body?: Record<string, unknown>,
): Promise<InvokeWithAuthResult<T>> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    return { data: null, error: sessionError };
  }

  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { data: null, error: new Error('Not authenticated') };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      try {
        const j = JSON.parse(errorText);
        errorMessage = j.error || errorMessage;
      } catch {}
      return {
        data: null,
        error: Object.assign(new Error(errorMessage), { status: response.status }),
      };
    }

    const data = await response.json();
    return { data: data as T, error: null };
  } catch (fetchError) {
    return { data: null, error: fetchError as Error };
  }
}

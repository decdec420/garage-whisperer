import { supabase } from './client';

export type InvokeWithAuthResult<T> = {
  data: T | null;
  error: Error | null;
};

/**
 * Invoke a Supabase Edge Function with an explicit JWT.
 *
 * Why: when Edge Functions require `verify_jwt=true`, requests must include an
 * Authorization header. Relying on implicit auth headers can be brittle across
 * environments; this makes it deterministic.
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

  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return {
    data: (data ?? null) as T | null,
    error: (error as Error | null) ?? null,
  };
}

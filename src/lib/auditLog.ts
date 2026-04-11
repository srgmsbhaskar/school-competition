import { supabase } from '@/integrations/supabase/client';

export const logAudit = async (action: string, details?: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.rpc('log_audit' as any, {
      _action: action,
      _details: details || null,
    });
  } catch (e) {
    console.error('Audit log error:', e);
  }
};

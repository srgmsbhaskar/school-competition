import { supabase } from '@/integrations/supabase/client';

export const logAudit = async (action: string, details?: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase as any).from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      action,
      details,
    });
  } catch (e) {
    console.error('Audit log error:', e);
  }
};

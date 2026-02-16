import { supabase } from '@/integrations/supabase/client';

export const logAudit = async (action: string, details?: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let ip = '';
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      ip = data.ip;
    } catch {
      // ignore IP fetch errors
    }

    await (supabase as any).from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      action,
      details,
      ip_address: ip,
    });
  } catch (e) {
    console.error('Audit log error:', e);
  }
};

import PanelShell from '@/components/panel/PanelShell';
import { PanelProvider } from '@/components/panel/PanelContext';
import { requireStaff } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import type { Settings } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PanelAppLayout({ children }: { children: React.ReactNode }) {
  const { profile, email } = await requireStaff();
  const { data: settings } = await supabaseServer().from('settings').select('*').eq('id', 1).single();
  return (
    <PanelProvider staff={{ ...profile, email: profile.email || email }} initialSettings={settings as Settings}>
      <PanelShell>{children}</PanelShell>
    </PanelProvider>
  );
}

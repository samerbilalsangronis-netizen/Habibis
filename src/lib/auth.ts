import 'server-only';
import { redirect } from 'next/navigation';
import { supabaseServer } from './supabase/server';
import type { StaffProfile, StaffRole } from './types';

export async function getStaff(): Promise<{ profile: StaffProfile; email: string } | null> {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('staff_profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (!data || !data.active) return null;
  return { profile: data as StaffProfile, email: user.email ?? '' };
}

/** Para páginas del panel: exige sesión y (opcionalmente) ciertos roles. */
export async function requireStaff(roles?: StaffRole[]) {
  const staff = await getStaff();
  if (!staff) redirect('/panel/login?error=sin-acceso');
  if (roles && !roles.includes(staff.profile.role)) redirect('/panel');
  return staff;
}

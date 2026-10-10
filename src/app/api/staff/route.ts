import { z } from 'zod';
import { getStaff } from '@/lib/auth';
import { json } from '@/lib/server-utils';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const createSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  full_name: z.string().trim().min(2, 'Escribe el nombre').max(80),
  phone: z.string().trim().max(25).optional().nullable(),
  role: z.enum(['admin', 'operador', 'repartidor']),
});

const updateSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(25).optional().nullable(),
  role: z.enum(['admin', 'operador', 'repartidor']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').optional(),
});

async function requireAdmin() {
  const s = await getStaff();
  return s && s.profile.role === 'admin' ? s : null;
}

/** Crear usuario del panel (solo admin). */
export async function POST(req: Request) {
  const me = await requireAdmin();
  if (!me) return json({ error: 'No autorizado' }, 403);
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message }, 400);
  const { email, password, full_name, phone, role } = parsed.data;
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error) {
    return json({ error: error.message.includes('already') ? 'Ya existe un usuario con ese correo' : error.message }, 400);
  }
  const { error: pErr } = await admin
    .from('staff_profiles')
    .insert({ user_id: data.user.id, email, full_name, phone: phone || null, role, active: true });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    return json({ error: pErr.message }, 400);
  }
  return json({ ok: true, user_id: data.user.id }, 201);
}

/** Editar rol, nombre, estado o contraseña (solo admin). */
export async function PATCH(req: Request) {
  const me = await requireAdmin();
  if (!me) return json({ error: 'No autorizado' }, 403);
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message }, 400);
  const { user_id, password, ...rest } = parsed.data;
  const admin = supabaseAdmin();

  if (user_id === me.profile.user_id && (rest.active === false || (rest.role && rest.role !== 'admin'))) {
    return json({ error: 'No puedes quitarte el rol de administrador ni desactivarte a ti mismo' }, 400);
  }
  if (password) {
    const { error } = await admin.auth.admin.updateUserById(user_id, { password });
    if (error) return json({ error: error.message }, 400);
  }
  if (Object.keys(rest).length) {
    const { error } = await admin.from('staff_profiles').update(rest).eq('user_id', user_id);
    if (error) return json({ error: error.message }, 400);
    if (rest.active === false) {
      // Sin perfil activo, la base le niega acceso a todo; además se quitan sus notificaciones
      await admin.from('push_subscriptions').delete().eq('user_id', user_id);
    }
  }
  return json({ ok: true });
}

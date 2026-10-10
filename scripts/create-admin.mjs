// Crea (o promueve) un usuario administrador del panel.
// Uso:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   npm run create-admin -- correo@ejemplo.com "ContraseñaSegura123" "Nombre"
// (o con las variables ya cargadas en .env.local: node --env-file=.env.local scripts/create-admin.mjs ...)
import { createClient } from '@supabase/supabase-js';

const [email, password, name = 'Administrador'] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!email || !password || password.length < 8) {
  console.error('Uso: npm run create-admin -- correo@ejemplo.com "Contraseña (mín. 8)" "Nombre"');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

let userId;
const { data, error } = await sb.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: name },
});
if (error) {
  // ¿Ya existe? lo buscamos y le cambiamos la contraseña
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existing) {
    console.error('No se pudo crear el usuario:', error.message);
    process.exit(1);
  }
  userId = existing.id;
  await sb.auth.admin.updateUserById(userId, { password });
  console.log('El usuario ya existía: se actualizó la contraseña.');
} else {
  userId = data.user.id;
}

const { error: pErr } = await sb
  .from('staff_profiles')
  .upsert({ user_id: userId, full_name: name, email, role: 'admin', active: true });
if (pErr) {
  console.error('No se pudo asignar el rol admin:', pErr.message);
  process.exit(1);
}
console.log(`✓ Admin listo: ${email}`);

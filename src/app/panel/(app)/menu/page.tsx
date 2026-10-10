import MenuManager from '@/components/panel/MenuManager';
import { requireStaff } from '@/lib/auth';

export const metadata = { title: 'Menú' };

export default async function MenuPage() {
  await requireStaff(['admin', 'operador']);
  return <MenuManager />;
}

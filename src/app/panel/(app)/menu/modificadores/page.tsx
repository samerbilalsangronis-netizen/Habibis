import ModifiersManager from '@/components/panel/ModifiersManager';
import { requireStaff } from '@/lib/auth';

export const metadata = { title: 'Opciones y extras' };

export default async function ModifiersPage() {
  await requireStaff(['admin', 'operador']);
  return <ModifiersManager />;
}

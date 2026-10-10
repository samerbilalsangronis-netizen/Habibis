import ManualOrder from '@/components/panel/ManualOrder';
import { requireStaff } from '@/lib/auth';
import { loadMenu } from '@/lib/menu';

export const metadata = { title: 'Pedido manual' };
export const dynamic = 'force-dynamic';

export default async function NewManualOrderPage() {
  await requireStaff(['admin', 'operador']);
  const data = await loadMenu();
  return <ManualOrder data={data} />;
}

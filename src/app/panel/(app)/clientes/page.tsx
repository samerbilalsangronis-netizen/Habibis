import Customers from '@/components/panel/Customers';
import { requireStaff } from '@/lib/auth';

export const metadata = { title: 'Clientes' };

export default async function CustomersPage() {
  await requireStaff(['admin', 'operador']);
  return <Customers />;
}

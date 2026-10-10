import Reports from '@/components/panel/Reports';
import { requireStaff } from '@/lib/auth';

export const metadata = { title: 'Reportes' };

export default async function ReportsPage() {
  await requireStaff(['admin']);
  return <Reports />;
}

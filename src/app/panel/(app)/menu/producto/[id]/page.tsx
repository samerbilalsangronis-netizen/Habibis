import ProductEditor from '@/components/panel/ProductEditor';
import { requireStaff } from '@/lib/auth';

export const metadata = { title: 'Producto' };

export default async function ProductPage({ params, searchParams }: { params: { id: string }; searchParams: { categoria?: string } }) {
  await requireStaff(['admin']);
  return <ProductEditor id={params.id} defaultCategory={searchParams.categoria} />;
}

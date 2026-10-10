import type { Metadata } from 'next';
import CheckoutView from '@/components/shop/CheckoutView';
import { loadMenu } from '@/lib/menu';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Finalizar pedido', robots: { index: false } };

export default async function CheckoutPage() {
  const data = await loadMenu();
  return <CheckoutView data={data} />;
}

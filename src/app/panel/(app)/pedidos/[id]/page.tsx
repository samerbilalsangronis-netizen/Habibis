import OrderDetail from '@/components/panel/OrderDetail';

export const metadata = { title: 'Pedido' };

export default function OrderPage({ params }: { params: { id: string } }) {
  return <OrderDetail id={params.id} />;
}

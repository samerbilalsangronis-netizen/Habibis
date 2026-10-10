import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import TrackingView from '@/components/shop/TrackingView';
import { supabasePublic } from '@/lib/supabase/server';
import type { Settings, TrackingOrder } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Seguimiento de pedido', robots: { index: false, follow: false } };

export default async function TrackingPage({ params }: { params: { token: string } }) {
  const sb = supabasePublic();
  const [{ data: order }, { data: settings }] = await Promise.all([
    sb.rpc('get_order_tracking', { p_token: params.token }),
    sb.from('settings').select('*').eq('id', 1).single(),
  ]);
  if (!order || !settings) notFound();
  return <TrackingView token={params.token} initial={order as TrackingOrder} settings={settings as Settings} />;
}

import MenuView from '@/components/shop/MenuView';
import { loadMenu } from '@/lib/menu';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const data = await loadMenu();
  return <MenuView data={data} />;
}

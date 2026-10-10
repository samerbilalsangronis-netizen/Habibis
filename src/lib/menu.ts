import 'server-only';
import { supabasePublic } from './supabase/server';
import { isOpenNow } from './hours';
import type {
  BusinessHour,
  Category,
  DeliveryZone,
  MenuCategory,
  MenuData,
  MenuProduct,
  ModifierGroup,
  ModifierOption,
  Product,
  Settings,
} from './types';

/** Carga todo lo que la web pública necesita en una sola pasada. */
export async function loadMenu(): Promise<MenuData> {
  const sb = supabasePublic();
  const [settingsQ, rateQ, hoursQ, zonesQ, catsQ, prodsQ, groupsQ, optsQ, pmgQ, comboQ] = await Promise.all([
    sb.from('settings').select('*').eq('id', 1).single(),
    sb.from('exchange_rates').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1),
    sb.from('business_hours').select('*').order('day_of_week'),
    sb.from('delivery_zones').select('*').eq('active', true).order('sort'),
    sb.from('categories').select('*').eq('active', true).order('sort'),
    sb.from('products').select('*').eq('active', true).order('sort'),
    sb.from('modifier_groups').select('*').order('sort'),
    sb.from('modifier_options').select('*').order('sort'),
    sb.from('product_modifier_groups').select('*').order('sort'),
    sb.from('combo_items').select('*'),
  ]);

  if (settingsQ.error) throw new Error(`No se pudo cargar la configuración: ${settingsQ.error.message}`);
  const settings = settingsQ.data as Settings;
  const rateRow = rateQ.data?.[0];
  const hours = (hoursQ.data ?? []) as BusinessHour[];
  const products = (prodsQ.data ?? []) as Product[];
  const productById = new Map(products.map((p) => [p.id, p]));

  const options = (optsQ.data ?? []) as ModifierOption[];
  const groups = ((groupsQ.data ?? []) as Omit<ModifierGroup, 'options'>[]).map((g) => ({
    ...g,
    options: options.filter((o) => o.group_id === g.id),
  }));
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const pmg = (pmgQ.data ?? []) as { product_id: string; group_id: string; sort: number }[];
  const combos = (comboQ.data ?? []) as { combo_id: string; product_id: string; quantity: number }[];

  const menuProducts: MenuProduct[] = products.map((p) => ({
    ...p,
    groups: pmg
      .filter((x) => x.product_id === p.id)
      .sort((a, b) => a.sort - b.sort)
      .map((x) => groupById.get(x.group_id))
      .filter(Boolean) as ModifierGroup[],
    combo: combos
      .filter((c) => c.combo_id === p.id)
      .map((c) => {
        const cp = productById.get(c.product_id);
        return { product_id: c.product_id, name: cp?.name ?? '—', quantity: c.quantity, available: !!cp?.available };
      }),
  }));

  const categories: MenuCategory[] = ((catsQ.data ?? []) as Category[])
    .map((c) => ({ ...c, products: menuProducts.filter((p) => p.category_id === c.id) }))
    .filter((c) => c.products.length > 0);

  return {
    settings,
    rate: rateRow ? { cop_per_usdt: Number(rateRow.cop_per_usdt), bs_per_usdt: Number(rateRow.bs_per_usdt) } : null,
    rateId: rateRow?.id ?? null,
    rateUpdatedAt: rateRow?.created_at ?? null,
    hours,
    zones: (zonesQ.data ?? []) as DeliveryZone[],
    categories,
    isOpen: isOpenNow(settings, hours),
  };
}

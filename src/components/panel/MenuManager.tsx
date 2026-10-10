'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { usePanel } from './PanelContext';
import Switch from '@/components/ui/Switch';
import { SortableList } from '@/components/ui/Sortable';
import { IconEdit, IconTrash } from '@/components/ui/Icons';
import { formatCop } from '@/lib/money';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Category, Product } from '@/lib/types';

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `cat-${Date.now()}`;

export default function MenuManager() {
  const { staff } = usePanel();
  const isAdmin = staff.role === 'admin';
  const sb = supabaseBrowser();
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sel, setSel] = useState<string>('');
  const [newCat, setNewCat] = useState('');
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([
      sb.from('categories').select('*').order('sort'),
      sb.from('products').select('*').order('sort'),
    ]);
    setCats((c.data ?? []) as Category[]);
    setProducts((p.data ?? []) as Product[]);
    setSel((s) => s || c.data?.[0]?.id || '');
  }, [sb]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2500);
  };

  const setAvailable = async (p: Product, v: boolean) => {
    setProducts((ps) => ps.map((x) => (x.id === p.id ? { ...x, available: v } : x)));
    const { error } = await sb.rpc('set_product_available', { p_id: p.id, p_available: v });
    if (error) {
      flash(error.message);
      load();
    } else flash(v ? `${p.name}: disponible` : `${p.name}: AGOTADO`);
  };

  const reorderCats = async (next: Category[]) => {
    setCats(next);
    await Promise.all(next.map((c, i) => sb.from('categories').update({ sort: i + 1 }).eq('id', c.id)));
  };
  const reorderProducts = async (next: Product[]) => {
    setProducts((ps) => [...ps.filter((p) => p.category_id !== sel), ...next.map((p, i) => ({ ...p, sort: i + 1 }))]);
    await Promise.all(next.map((p, i) => sb.from('products').update({ sort: i + 1 }).eq('id', p.id)));
  };

  const addCat = async () => {
    const name = newCat.trim();
    if (!name) return;
    const { data, error } = await sb
      .from('categories')
      .insert({ name, slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`, sort: cats.length + 1 })
      .select()
      .single();
    if (error) return flash(error.message);
    setNewCat('');
    setCats((c) => [...c, data as Category]);
    setSel((data as Category).id);
  };
  const renameCat = async (c: Category, name: string) => {
    setEditingCat(null);
    if (!name.trim() || name === c.name) return;
    await sb.from('categories').update({ name: name.trim() }).eq('id', c.id);
    setCats((cs) => cs.map((x) => (x.id === c.id ? { ...x, name: name.trim() } : x)));
  };
  const toggleCat = async (c: Category, active: boolean) => {
    setCats((cs) => cs.map((x) => (x.id === c.id ? { ...x, active } : x)));
    await sb.from('categories').update({ active }).eq('id', c.id);
  };
  const deleteCat = async (c: Category) => {
    if (products.some((p) => p.category_id === c.id)) return flash('Primero mueve o borra los productos de esta categoría');
    if (!confirm(`¿Borrar la categoría "${c.name}"?`)) return;
    const { error } = await sb.from('categories').delete().eq('id', c.id);
    if (error) return flash(error.message);
    setCats((cs) => cs.filter((x) => x.id !== c.id));
    setSel(cats.find((x) => x.id !== c.id)?.id ?? '');
  };

  const query = q.trim().toLowerCase();
  const list = query
    ? products.filter((p) => p.name.toLowerCase().includes(query))
    : products.filter((p) => p.category_id === sel).sort((a, b) => a.sort - b.sort);

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl text-gold-300 mr-auto">Menú</h1>
        <Link href="/panel/menu/modificadores" className="btn-ghost btn-sm">
          Opciones y extras
        </Link>
        {isAdmin && (
          <Link href={`/panel/menu/producto/nuevo${sel ? `?categoria=${sel}` : ''}`} className="btn-primary btn-sm">
            + Producto
          </Link>
        )}
      </div>
      <p className="text-sm text-sand-400">
        Usa el interruptor para marcar <b className="text-sand-200">Agotado</b> al instante. {isAdmin && 'Arrastra ⋮⋮ para cambiar el orden.'}
      </p>

      <div className="grid md:grid-cols-[260px,1fr] gap-4 items-start">
        {/* Categorías */}
        <aside className="card p-2">
          <SortableList
            items={cats}
            disabled={!isAdmin}
            onReorder={reorderCats}
            render={(c, handle) => (
              <div
                className={`flex items-center gap-1 rounded-xl pr-1 ${sel === c.id && !query ? 'bg-gold-500/15 ring-1 ring-gold-500/50' : ''} ${!c.active ? 'opacity-50' : ''}`}
              >
                {handle}
                {editingCat === c.id ? (
                  <input
                    autoFocus
                    defaultValue={c.name}
                    className="input py-1.5 text-sm"
                    onBlur={(e) => renameCat(c, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && renameCat(c, (e.target as HTMLInputElement).value)}
                  />
                ) : (
                  <button
                    className="flex-1 text-left py-2.5 font-semibold text-sm"
                    onClick={() => {
                      setQ('');
                      setSel(c.id);
                    }}
                  >
                    {c.name}
                    <span className="text-sand-500 font-normal"> · {products.filter((p) => p.category_id === c.id).length}</span>
                  </button>
                )}
                {isAdmin && sel === c.id && editingCat !== c.id && (
                  <>
                    <button className="p-1.5 text-sand-400" onClick={() => setEditingCat(c.id)} aria-label="Renombrar">
                      <IconEdit className="w-4 h-4" />
                    </button>
                    <Switch size="sm" checked={c.active} onChange={(v) => toggleCat(c, v)} label="Visible" />
                    <button className="p-1.5 text-terra-400" onClick={() => deleteCat(c)} aria-label="Borrar categoría">
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            )}
          />
          {isAdmin && (
            <div className="flex gap-1 p-1 mt-2 border-t border-ink-700 pt-3">
              <input className="input py-2 text-sm" placeholder="Nueva categoría" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCat()} />
              <button className="btn-primary btn-sm" onClick={addCat}>
                +
              </button>
            </div>
          )}
        </aside>

        {/* Productos */}
        <section className="space-y-2">
          <input className="input" placeholder="Buscar producto en todo el menú…" value={q} onChange={(e) => setQ(e.target.value)} />
          {list.length === 0 && <p className="text-sand-500 text-center py-10">No hay productos aquí.</p>}
          <SortableList
            items={list}
            disabled={!isAdmin || !!query}
            onReorder={reorderProducts}
            render={(p, handle) => (
              <div className={`card flex items-center gap-3 p-2.5 mb-2 ${!p.available ? 'border-red-500/40' : ''}`}>
                {handle}
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <span className="w-12 h-12 rounded-lg bg-ink-700 grid place-items-center font-display text-gold-300">{p.name[0]}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold truncate ${!p.available ? 'line-through text-sand-400' : ''}`}>{p.name}</p>
                  <p className="text-xs text-sand-400">
                    {formatCop(p.price_cop)}
                    {!p.active && <span className="ml-2 chip bg-ink-700 text-sand-300">Oculto</span>}
                    {p.is_combo && <span className="ml-2 chip bg-gold-500/20 text-gold-300">Combo</span>}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <Switch checked={p.available} onChange={(v) => setAvailable(p, v)} label="Disponible" />
                  <span className={`text-[10px] font-semibold ${p.available ? 'text-emerald-300' : 'text-red-300'}`}>{p.available ? 'Disponible' : 'Agotado'}</span>
                </div>
                {isAdmin && (
                  <Link href={`/panel/menu/producto/${p.id}`} className="p-2 rounded-lg hover:bg-ink-800 text-sand-200" aria-label="Editar">
                    <IconEdit />
                  </Link>
                )}
              </div>
            )}
          />
        </section>
      </div>

      {msg && (
        <div className="fixed bottom-20 lg:bottom-6 inset-x-0 z-40 flex justify-center px-4">
          <div className="card px-4 py-3 text-sm shadow-2xl">{msg}</div>
        </div>
      )}
    </div>
  );
}

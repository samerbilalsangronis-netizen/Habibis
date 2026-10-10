'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Switch from '@/components/ui/Switch';
import { IconBack, IconTrash, IconUpload } from '@/components/ui/Icons';
import { TAGS } from '@/components/shop/ProductCard';
import { compressImage } from '@/lib/image';
import { formatCop } from '@/lib/money';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Category, ModifierGroup, Product } from '@/lib/types';

type Draft = Omit<Product, 'id' | 'sort'> & { id?: string; sort?: number };

export default function ProductEditor({ id, defaultCategory }: { id: string; defaultCategory?: string }) {
  const router = useRouter();
  const sb = supabaseBrowser();
  const isNew = id === 'nuevo';
  const [cats, setCats] = useState<Category[]>([]);
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [p, setP] = useState<Draft | null>(null);
  const [linked, setLinked] = useState<string[]>([]);
  const [combo, setCombo] = useState<{ product_id: string; quantity: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [c, g, o, ap] = await Promise.all([
        sb.from('categories').select('*').order('sort'),
        sb.from('modifier_groups').select('*').order('sort'),
        sb.from('modifier_options').select('*').order('sort'),
        sb.from('products').select('*').order('name'),
      ]);
      const categories = (c.data ?? []) as Category[];
      setCats(categories);
      setGroups(((g.data ?? []) as ModifierGroup[]).map((gr) => ({ ...gr, options: (o.data ?? []).filter((x) => x.group_id === gr.id) })));
      setAllProducts((ap.data ?? []) as Product[]);
      if (isNew) {
        setP({
          category_id: defaultCategory || categories[0]?.id || '',
          name: '',
          description: '',
          price_cop: 0,
          image_url: null,
          tags: [],
          available: true,
          active: true,
          is_combo: false,
        });
      } else {
        const [prod, pmg, ci] = await Promise.all([
          sb.from('products').select('*').eq('id', id).single(),
          sb.from('product_modifier_groups').select('*').eq('product_id', id).order('sort'),
          sb.from('combo_items').select('*').eq('combo_id', id),
        ]);
        if (prod.error) return setError('Producto no encontrado');
        setP(prod.data as Product);
        setLinked((pmg.data ?? []).map((x) => x.group_id));
        setCombo((ci.data ?? []).map((x) => ({ product_id: x.product_id, quantity: x.quantity })));
      }
    })();
  }, [id, isNew, defaultCategory, sb]);

  if (error && !p) return <p className="p-8 text-center text-sand-400">{error}</p>;
  if (!p) return <p className="p-8 text-center text-sand-400">Cargando…</p>;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setP((x) => (x ? { ...x, [k]: v } : x));

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    const img = await compressImage(file, { maxSize: 1200, quality: 0.85, type: 'image/webp' });
    const ext = img.type === 'image/webp' ? 'webp' : img.type === 'image/png' ? 'png' : 'jpg';
    const path = `productos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from('productos').upload(path, img, { contentType: img.type, cacheControl: '31536000' });
    setUploading(false);
    if (error) return setError(`No se pudo subir la foto: ${error.message}`);
    set('image_url', sb.storage.from('productos').getPublicUrl(path).data.publicUrl);
  };

  const save = async () => {
    setError(null);
    if (!p.name.trim()) return setError('Escribe el nombre');
    if (!p.category_id) return setError('Elige la categoría');
    if (!(p.price_cop >= 0)) return setError('Precio inválido');
    setBusy(true);
    const row = {
      category_id: p.category_id,
      name: p.name.trim(),
      description: p.description.trim(),
      price_cop: Math.round(p.price_cop),
      image_url: p.image_url,
      tags: p.tags,
      available: p.available,
      active: p.active,
      is_combo: p.is_combo,
    };
    let productId = p.id;
    if (isNew) {
      const { data: last } = await sb.from('products').select('sort').eq('category_id', p.category_id).order('sort', { ascending: false }).limit(1);
      const { data, error } = await sb
        .from('products')
        .insert({ ...row, sort: (last?.[0]?.sort ?? 0) + 1 })
        .select()
        .single();
      if (error) {
        setBusy(false);
        return setError(error.message);
      }
      productId = data.id;
    } else {
      const { error } = await sb.from('products').update(row).eq('id', p.id!);
      if (error) {
        setBusy(false);
        return setError(error.message);
      }
    }
    // Grupos de opciones
    await sb.from('product_modifier_groups').delete().eq('product_id', productId!);
    if (linked.length) {
      await sb.from('product_modifier_groups').insert(linked.map((g, i) => ({ product_id: productId, group_id: g, sort: i + 1 })));
    }
    // Componentes del combo
    await sb.from('combo_items').delete().eq('combo_id', productId!);
    if (p.is_combo && combo.length) {
      await sb.from('combo_items').insert(
        combo.filter((c) => c.product_id && c.product_id !== productId).map((c) => ({ combo_id: productId, product_id: c.product_id, quantity: c.quantity })),
      );
    }
    setBusy(false);
    router.push('/panel/menu');
    router.refresh();
  };

  const remove = async () => {
    if (!p.id || !confirm(`¿Borrar "${p.name}"? Si solo quieres esconderlo, desactiva "Visible en el menú".`)) return;
    const { error } = await sb.from('products').delete().eq('id', p.id);
    if (error) return setError(error.message);
    router.push('/panel/menu');
  };

  const moveGroup = (gid: string, dir: -1 | 1) =>
    setLinked((l) => {
      const i = l.indexOf(gid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= l.length) return l;
      const n = l.slice();
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/panel/menu" className="p-2 -ml-2 rounded-full hover:bg-ink-800" aria-label="Volver">
          <IconBack />
        </Link>
        <h1 className="font-display text-2xl text-gold-300">{isNew ? 'Nuevo producto' : 'Editar producto'}</h1>
        {!isNew && (
          <button className="ml-auto p-2 text-terra-400" onClick={remove} aria-label="Borrar producto">
            <IconTrash />
          </button>
        )}
      </div>

      <section className="card p-4 space-y-4">
        <div className="flex gap-4 items-start">
          <label className="relative w-28 h-28 shrink-0 rounded-2xl overflow-hidden bg-ink-800 border-2 border-dashed border-ink-600 grid place-items-center cursor-pointer hover:border-gold-500">
            {p.image_url ? (
              <img src={p.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <span className="text-center text-xs text-sand-400 px-2">
                <IconUpload className="w-6 h-6 mx-auto mb-1" />
                {uploading ? 'Subiendo…' : 'Subir foto'}
              </span>
            )}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          <div className="flex-1 space-y-3">
            <div>
              <label className="label">Nombre</label>
              <input className="input" value={p.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Precio (COP)</label>
                <input className="input" inputMode="numeric" value={p.price_cop || ''} onChange={(e) => set('price_cop', Number(e.target.value.replace(/\D/g, '')) || 0)} />
                <p className="text-xs text-sand-500 mt-1">{formatCop(p.price_cop)}</p>
              </div>
              <div>
                <label className="label">Categoría</label>
                <select className="input" value={p.category_id} onChange={(e) => set('category_id', e.target.value)}>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
        {p.image_url && (
          <button className="text-xs text-terra-400" onClick={() => set('image_url', null)}>
            Quitar foto
          </button>
        )}
        <div>
          <label className="label">Descripción corta</label>
          <textarea className="input" rows={2} maxLength={220} value={p.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div>
          <label className="label">Etiquetas</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TAGS).map(([k, t]) => {
              const on = p.tags.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => set('tags', on ? p.tags.filter((x) => x !== k) : [...p.tags, k])}
                  className={`chip text-xs py-1.5 px-3 border ${on ? `${t.cls} border-current` : 'border-ink-600 text-sand-400'}`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="flex items-center justify-between gap-2 rounded-xl bg-ink-800 p-3">
            <span className="text-sm font-semibold">Disponible</span>
            <Switch checked={p.available} onChange={(v) => set('available', v)} />
          </label>
          <label className="flex items-center justify-between gap-2 rounded-xl bg-ink-800 p-3">
            <span className="text-sm font-semibold">Visible en el menú</span>
            <Switch checked={p.active} onChange={(v) => set('active', v)} />
          </label>
          <label className="flex items-center justify-between gap-2 rounded-xl bg-ink-800 p-3">
            <span className="text-sm font-semibold">Es un combo</span>
            <Switch checked={p.is_combo} onChange={(v) => set('is_combo', v)} />
          </label>
        </div>
      </section>

      {p.is_combo && (
        <section className="card p-4 space-y-3">
          <h2 className="font-semibold">¿Qué incluye el combo?</h2>
          <p className="text-xs text-sand-400">Se muestra al cliente y, si algún componente se agota, el combo aparece agotado. El precio es el del combo.</p>
          {combo.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input w-20"
                inputMode="numeric"
                value={c.quantity}
                onChange={(e) => setCombo((cs) => cs.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x)))}
              />
              <select className="input flex-1" value={c.product_id} onChange={(e) => setCombo((cs) => cs.map((x, j) => (j === i ? { ...x, product_id: e.target.value } : x)))}>
                <option value="">Producto…</option>
                {allProducts
                  .filter((x) => x.id !== p.id && !x.is_combo)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
              <button className="p-2 text-terra-400" onClick={() => setCombo((cs) => cs.filter((_, j) => j !== i))} aria-label="Quitar">
                <IconTrash />
              </button>
            </div>
          ))}
          <button className="btn-ghost btn-sm" onClick={() => setCombo((cs) => [...cs, { product_id: '', quantity: 1 }])}>
            + Agregar componente
          </button>
        </section>
      )}

      <section className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Opciones del producto</h2>
          <Link href="/panel/menu/modificadores" className="text-sm text-gold-300">
            Administrar opciones
          </Link>
        </div>
        <p className="text-xs text-sand-400">Marca los grupos que aplican (tamaño, pan, salsas…). El orden de abajo es el que verá el cliente.</p>
        {linked.length > 0 && (
          <ol className="space-y-1">
            {linked.map((gid, i) => {
              const g = groups.find((x) => x.id === gid);
              if (!g) return null;
              return (
                <li key={gid} className="flex items-center gap-2 rounded-xl bg-gold-500/10 border border-gold-500/30 px-3 py-2 text-sm">
                  <span className="font-semibold flex-1">
                    {i + 1}. {g.name} {g.internal_name && <span className="text-sand-400">({g.internal_name})</span>}
                  </span>
                  <button className="px-2" disabled={i === 0} onClick={() => moveGroup(gid, -1)} aria-label="Subir">
                    ↑
                  </button>
                  <button className="px-2" disabled={i === linked.length - 1} onClick={() => moveGroup(gid, 1)} aria-label="Bajar">
                    ↓
                  </button>
                  <button className="px-2 text-terra-400" onClick={() => setLinked((l) => l.filter((x) => x !== gid))} aria-label="Quitar">
                    ✕
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        <div className="flex flex-wrap gap-2">
          {groups
            .filter((g) => !linked.includes(g.id))
            .map((g) => (
              <button key={g.id} className="chip border border-ink-600 py-1.5 px-3 text-xs" onClick={() => setLinked((l) => [...l, g.id])}>
                + {g.name}
                {g.internal_name && <span className="text-sand-500"> ({g.internal_name})</span>}
              </button>
            ))}
        </div>
      </section>

      {error && <p className="rounded-xl bg-red-600/15 border border-red-500/40 text-red-200 text-sm p-3">{error}</p>}
      <div className="sticky bottom-20 lg:bottom-4">
        <button className="btn-primary w-full text-base shadow-glow" disabled={busy || uploading} onClick={save}>
          {busy ? 'Guardando…' : 'Guardar producto'}
        </button>
      </div>
    </div>
  );
}

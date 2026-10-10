'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { usePanel } from './PanelContext';
import Switch from '@/components/ui/Switch';
import { IconBack, IconTrash } from '@/components/ui/Icons';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { ModifierGroup, ModifierOption } from '@/lib/types';

type OptDraft = Omit<ModifierOption, 'id' | 'group_id'> & { id?: string; _deleted?: boolean };
type GroupDraft = Omit<ModifierGroup, 'id' | 'options'> & { id?: string; options: OptDraft[] };

const emptyGroup = (): GroupDraft => ({
  name: '',
  internal_name: null,
  selection_type: 'single',
  is_required: false,
  min_select: 0,
  max_select: 1,
  sort: 0,
  options: [{ name: '', price_cop: 0, available: true, sort: 1 }],
});

export default function ModifiersManager() {
  const { staff } = usePanel();
  const isAdmin = staff.role === 'admin';
  const sb = supabaseBrowser();
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [usage, setUsage] = useState<Record<string, string[]>>({});
  const [edit, setEdit] = useState<GroupDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [g, o, pmg, p] = await Promise.all([
      sb.from('modifier_groups').select('*').order('sort'),
      sb.from('modifier_options').select('*').order('sort'),
      sb.from('product_modifier_groups').select('product_id, group_id'),
      sb.from('products').select('id, name'),
    ]);
    setGroups(((g.data ?? []) as ModifierGroup[]).map((gr) => ({ ...gr, options: ((o.data ?? []) as ModifierOption[]).filter((x) => x.group_id === gr.id) })));
    const names = new Map((p.data ?? []).map((x) => [x.id, x.name]));
    const u: Record<string, string[]> = {};
    for (const r of pmg.data ?? []) (u[r.group_id] ??= []).push(names.get(r.product_id) ?? '?');
    setUsage(u);
  }, [sb]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleOption = async (o: ModifierOption, v: boolean) => {
    setGroups((gs) => gs.map((g) => ({ ...g, options: g.options.map((x) => (x.id === o.id ? { ...x, available: v } : x)) })));
    const { error } = await sb.rpc('set_option_available', { p_id: o.id, p_available: v });
    if (error) {
      setError(error.message);
      load();
    }
  };

  const save = async () => {
    if (!edit) return;
    setError(null);
    if (!edit.name.trim()) return setError('Escribe el nombre del grupo');
    const opts = edit.options.filter((o) => !o._deleted && o.name.trim());
    if (!opts.length) return setError('Agrega al menos una opción');
    const single = edit.selection_type === 'single';
    const min = edit.is_required ? Math.max(1, edit.min_select) : edit.min_select;
    const max = single ? 1 : Math.max(edit.max_select, min, 1);
    setBusy(true);
    const row = {
      name: edit.name.trim(),
      internal_name: edit.internal_name?.trim() || null,
      selection_type: edit.selection_type,
      is_required: edit.is_required,
      min_select: single ? (edit.is_required ? 1 : 0) : min,
      max_select: max,
    };
    let gid = edit.id;
    if (gid) {
      const { error } = await sb.from('modifier_groups').update(row).eq('id', gid);
      if (error) {
        setBusy(false);
        return setError(error.message);
      }
    } else {
      const { data, error } = await sb
        .from('modifier_groups')
        .insert({ ...row, sort: groups.length + 1 })
        .select()
        .single();
      if (error) {
        setBusy(false);
        return setError(error.message);
      }
      gid = data.id;
    }
    const toDelete = edit.options.filter((o) => o._deleted && o.id).map((o) => o.id!);
    if (toDelete.length) await sb.from('modifier_options').delete().in('id', toDelete);
    for (const [i, o] of opts.entries()) {
      const r = { name: o.name.trim(), price_cop: Math.round(Number(o.price_cop) || 0), available: o.available, sort: i + 1 };
      if (o.id) await sb.from('modifier_options').update(r).eq('id', o.id);
      else await sb.from('modifier_options').insert({ ...r, group_id: gid });
    }
    setBusy(false);
    setEdit(null);
    load();
  };

  const removeGroup = async (g: ModifierGroup) => {
    if (!confirm(`¿Borrar el grupo "${g.name}"? Se quitará de ${usage[g.id]?.length ?? 0} producto(s).`)) return;
    await sb.from('modifier_groups').delete().eq('id', g.id);
    load();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/panel/menu" className="p-2 -ml-2 rounded-full hover:bg-ink-800" aria-label="Volver">
          <IconBack />
        </Link>
        <h1 className="font-display text-2xl text-gold-300 mr-auto">Opciones y extras</h1>
        {isAdmin && (
          <button className="btn-primary btn-sm" onClick={() => setEdit(emptyGroup())}>
            + Grupo
          </button>
        )}
      </div>
      <p className="text-sm text-sand-400">Grupos reutilizables (tamaño, tipo de pan, salsas, quitar ingredientes…). Apaga una opción para marcarla agotada.</p>
      {error && <p className="rounded-xl bg-red-600/15 border border-red-500/40 text-red-200 text-sm p-3">{error}</p>}

      {edit && (
        <section className="card p-4 space-y-3 border-gold-500/50">
          <h2 className="font-semibold">{edit.id ? 'Editar grupo' : 'Nuevo grupo'}</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="label">Nombre (lo ve el cliente)</label>
              <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Ej.: Tipo de pan" />
            </div>
            <div>
              <label className="label">Nombre interno (opcional)</label>
              <input className="input" value={edit.internal_name ?? ''} onChange={(e) => setEdit({ ...edit, internal_name: e.target.value })} placeholder="Para distinguir grupos" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
            <div className="col-span-2">
              <label className="label">Tipo</label>
              <div className="flex rounded-xl bg-ink-800 border border-ink-600 p-1">
                <button
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold ${edit.selection_type === 'single' ? 'bg-gold-500 text-ink-950' : ''}`}
                  onClick={() => setEdit({ ...edit, selection_type: 'single', max_select: 1 })}
                >
                  Elige una
                </button>
                <button
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold ${edit.selection_type === 'multiple' ? 'bg-gold-500 text-ink-950' : ''}`}
                  onClick={() => setEdit({ ...edit, selection_type: 'multiple', max_select: Math.max(2, edit.max_select) })}
                >
                  Varias
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 rounded-xl bg-ink-800 p-3 text-sm font-semibold">
              <Switch size="sm" checked={edit.is_required} onChange={(v) => setEdit({ ...edit, is_required: v, min_select: v ? Math.max(1, edit.min_select) : 0 })} />
              Obligatorio
            </label>
            {edit.selection_type === 'multiple' && (
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="label text-xs">Mín.</label>
                  <input className="input py-2" inputMode="numeric" value={edit.min_select} onChange={(e) => setEdit({ ...edit, min_select: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label text-xs">Máx.</label>
                  <input className="input py-2" inputMode="numeric" value={edit.max_select} onChange={(e) => setEdit({ ...edit, max_select: Number(e.target.value) || 1 })} />
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="label">Opciones</label>
            {edit.options.map((o, i) =>
              o._deleted ? null : (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    className="input py-2 flex-1"
                    placeholder="Nombre"
                    value={o.name}
                    onChange={(e) => setEdit({ ...edit, options: edit.options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                  />
                  <input
                    className="input py-2 w-28"
                    inputMode="numeric"
                    placeholder="+ COP"
                    value={o.price_cop || ''}
                    onChange={(e) =>
                      setEdit({ ...edit, options: edit.options.map((x, j) => (j === i ? { ...x, price_cop: Number(e.target.value.replace(/[^\d-]/g, '')) || 0 } : x)) })
                    }
                  />
                  <Switch size="sm" checked={o.available} onChange={(v) => setEdit({ ...edit, options: edit.options.map((x, j) => (j === i ? { ...x, available: v } : x)) })} />
                  <button
                    className="p-1.5 text-terra-400"
                    onClick={() => setEdit({ ...edit, options: edit.options.map((x, j) => (j === i ? { ...x, _deleted: true } : x)) })}
                    aria-label="Quitar opción"
                  >
                    <IconTrash className="w-4 h-4" />
                  </button>
                </div>
              ),
            )}
            <button className="btn-ghost btn-sm" onClick={() => setEdit({ ...edit, options: [...edit.options, { name: '', price_cop: 0, available: true, sort: edit.options.length + 1 }] })}>
              + Opción
            </button>
            <p className="text-xs text-sand-500">Precio adicional en COP. Usa 0 para opciones sin costo (ej. “Sin cebolla”).</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setEdit(null)}>
              Cancelar
            </button>
            <button className="btn-primary flex-1" disabled={busy} onClick={save}>
              {busy ? 'Guardando…' : 'Guardar grupo'}
            </button>
          </div>
        </section>
      )}

      <div className="space-y-3">
        {groups.map((g) => (
          <section key={g.id} className="card p-4">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <h3 className="font-semibold">
                  {g.name} {g.internal_name && <span className="text-sand-400 font-normal">({g.internal_name})</span>}
                </h3>
                <p className="text-xs text-sand-400">
                  {g.selection_type === 'single' ? 'Elige una' : `Varias (${g.min_select}–${g.max_select})`} · {g.is_required ? 'Obligatorio' : 'Opcional'}
                  {usage[g.id]?.length ? ` · En: ${usage[g.id].join(', ')}` : ' · Sin productos'}
                </p>
              </div>
              {isAdmin && (
                <>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() =>
                      setEdit({
                        ...g,
                        options: g.options.map((o) => ({ id: o.id, name: o.name, price_cop: o.price_cop, available: o.available, sort: o.sort })),
                      })
                    }
                  >
                    Editar
                  </button>
                  <button className="p-2 text-terra-400" onClick={() => removeGroup(g)} aria-label="Borrar grupo">
                    <IconTrash className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            <ul className="mt-3 grid sm:grid-cols-2 gap-2">
              {g.options.map((o) => (
                <li key={o.id} className={`flex items-center gap-2 rounded-xl bg-ink-800 px-3 py-2 ${!o.available ? 'opacity-60' : ''}`}>
                  <span className={`flex-1 text-sm ${!o.available ? 'line-through' : ''}`}>{o.name}</span>
                  {o.price_cop !== 0 && <span className="text-xs text-gold-300">+{o.price_cop.toLocaleString('es-CO')}</span>}
                  <Switch size="sm" checked={o.available} onChange={(v) => toggleOption(o, v)} label="Disponible" />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

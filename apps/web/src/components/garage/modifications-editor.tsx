'use client';

import type { ModificationCategory, ModificationItem, VehicleDetail } from '@vogn/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { useErrorMessage } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';

const uid = () => Math.random().toString(36).slice(2, 10);

/** Edit the categorised parts list, including custom categories and custom key/value fields. */
export function ModificationsEditor({ vehicle }: { vehicle: VehicleDetail }) {
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const [categories, setCategories] = useState<ModificationCategory[]>(vehicle.categories);
  const [mods, setMods] = useState<ModificationItem[]>(vehicle.modifications);
  const [newCategory, setNewCategory] = useState('');

  const save = useMutation({
    mutationFn: () => api.vehicles.setModifications(vehicle.id, { categories, modifications: mods }),
    onSuccess: (v) => {
      qc.setQueryData(queryKeys.vehicle(v.id), v);
      toast.success('Modifications saved');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const update = (id: string, patch: Partial<ModificationItem>) => setMods((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  return (
    <section className="grid gap-5 rounded-xl border border-line bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Modifications</h2>
          <p className="text-sm text-muted">Group parts by category. Add custom categories and fields for anything special.</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setMods((list) => [...list, { id: uid(), categoryId: categories[0]?.id ?? 'other', name: '', brand: null, notes: null, installedAt: null, fields: [] }])}
        >
          <Plus aria-hidden="true" /> Add modification
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {categories.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-sunken px-3 py-1 text-xs">
            {c.name}
            {!c.builtIn && !mods.some((m) => m.categoryId === c.id) && (
              <button type="button" aria-label={`Remove ${c.name}`} onClick={() => setCategories((list) => list.filter((x) => x.id !== c.id))}>
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newCategory.trim();
            if (!name) return;
            setCategories((list) => [...list, { id: uid(), name, builtIn: null }]);
            setNewCategory('');
          }}
        >
          <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category" className="h-8 w-40 text-xs" maxLength={40} />
          <Button type="submit" size="xs" variant="ghost">
            Add
          </Button>
        </form>
      </div>

      <div className="grid gap-3">
        {mods.length === 0 && <p className="text-sm text-muted">No modifications logged yet.</p>}
        {mods.map((m) => (
          <div key={m.id} className="grid gap-3 rounded-lg border border-line bg-sunken p-3">
            <div className="grid gap-2 sm:grid-cols-[160px_1fr_160px_auto]">
              <NativeSelect aria-label="Category" value={m.categoryId} onChange={(e) => update(m.id, { categoryId: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
              <Input aria-label="Part" value={m.name} onChange={(e) => update(m.id, { name: e.target.value })} placeholder="Part or modification" maxLength={120} />
              <Input aria-label="Brand" value={m.brand ?? ''} onChange={(e) => update(m.id, { brand: e.target.value || null })} placeholder="Brand" maxLength={60} />
              <Button type="button" variant="danger-ghost" size="icon" aria-label="Remove modification" onClick={() => setMods((list) => list.filter((x) => x.id !== m.id))}>
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            <Textarea aria-label="Notes" rows={2} value={m.notes ?? ''} onChange={(e) => update(m.id, { notes: e.target.value || null })} placeholder="Notes" className="min-h-14" />
            <div className="grid gap-2">
              {m.fields.map((f, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input aria-label="Field name" value={f.key} onChange={(e) => update(m.id, { fields: m.fields.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)) })} placeholder="Field (e.g. Boost)" className="h-8 text-xs" />
                  <Input aria-label="Field value" value={f.value} onChange={(e) => update(m.id, { fields: m.fields.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} placeholder="Value (e.g. 1.6 bar)" className="h-8 text-xs" />
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove field" onClick={() => update(m.id, { fields: m.fields.filter((_, j) => j !== i) })}>
                    <X aria-hidden="true" />
                  </Button>
                </div>
              ))}
              {m.fields.length < 12 && (
                <Button type="button" variant="ghost" size="xs" className="w-fit" onClick={() => update(m.id, { fields: [...m.fields, { key: '', value: '' }] })}>
                  <Plus aria-hidden="true" /> Custom field
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          loading={save.isPending}
          onClick={() => {
            const cleaned = mods.filter((m) => m.name.trim()).map((m) => ({ ...m, fields: m.fields.filter((f) => f.key.trim()) }));
            setMods(cleaned);
            save.mutate();
          }}
        >
          Save modifications
        </Button>
      </div>
    </section>
  );
}

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { isApiError } from '@vogn/api-client';
import type { VehicleDetail } from '@vogn/types';
import { COUNTRY_CODES, countryName } from '@vogn/utils';
import { vehicleCreateSchema } from '@vogn/validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Checkbox, RadioCard, RadioGroup, SwitchRow } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { useErrorMessage } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';
import { useMyCrews } from '@/lib/hooks';
import { ASPIRATION_LABELS, DRIVETRAIN_LABELS, FUEL_LABELS, TRANSMISSION_LABELS } from '@/lib/labels';
import { mediaUrl } from '@/lib/media';
import { vehicleAutofill } from '@/lib/vehicle-autofill';
import { MediaUploader } from '../app/media-uploader';

type FormIn = z.input<typeof vehicleCreateSchema>;

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-5 rounded-xl border border-line bg-surface p-5 md:grid-cols-[220px_1fr] md:p-6">
      <div className="grid content-start gap-1">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

const num = { setValueAs: (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v)) };
const str = { setValueAs: (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v) };

export function VehicleEditor({ vehicle }: { vehicle?: VehicleDetail }) {
  const t = useTranslations('garage');
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const { data: crews } = useMyCrews();
  const [cover, setCover] = useState(vehicle?.coverImage ?? null);
  const [plate, setPlate] = useState('');
  const [identifierMode, setIdentifierMode] = useState<'keep' | 'set' | 'remove'>(vehicle?.viewer.hasPrivateIdentifiers ? 'keep' : 'set');

  const form = useForm<FormIn>({
    resolver: zodResolver(vehicleCreateSchema),
    defaultValues: {
      make: vehicle?.make ?? '',
      model: vehicle?.model ?? '',
      generation: vehicle?.generation ?? null,
      year: vehicle?.year ?? null,
      trim: vehicle?.trim ?? null,
      nickname: vehicle?.nickname ?? null,
      description: vehicle?.description ?? null,
      color: vehicle?.color ?? null,
      drivetrain: vehicle?.drivetrain ?? null,
      transmission: vehicle?.transmission ?? null,
      specs: vehicle?.specs ?? {},
      wheels: vehicle?.wheels ?? {},
      suspension: vehicle?.suspension ?? null,
      exhaust: vehicle?.exhaust ?? null,
      ecuTuning: vehicle?.ecuTuning ?? null,
      turbo: vehicle?.turbo ?? null,
      interior: vehicle?.interior ?? null,
      audio: vehicle?.audio ?? null,
      visibility: vehicle?.visibility ?? 'public',
      visibleCrewIds: vehicle?.visibleCrewIds ?? [],
      likesEnabled: vehicle?.likesEnabled ?? true,
      commentsEnabled: vehicle?.commentsEnabled ?? true,
      showExpenses: vehicle?.showExpenses ?? false,
      identifiers: null,
    },
  });
  const errors = form.formState.errors;

  const lookup = useMutation({
    mutationFn: () => api.vehicles.lookup({ countryCode: 'NO', registrationNumber: plate }),
    onSuccess: (data) => {
      const patch = vehicleAutofill(data);
      const options = { shouldDirty: true, shouldValidate: true };
      if (patch.make) form.setValue('make', patch.make, options);
      if (patch.model) form.setValue('model', patch.model, options);
      if (patch.year) form.setValue('year', patch.year, options);
      if (patch.color) form.setValue('color', patch.color, options);
      if (patch.drivetrain) form.setValue('drivetrain', patch.drivetrain, options);
      if (patch.transmission) form.setValue('transmission', patch.transmission, options);
      if (patch.specs?.engine) form.setValue('specs.engine', patch.specs.engine, options);
      if (patch.specs?.displacementCc) form.setValue('specs.displacementCc', patch.specs.displacementCc, options);
      if (patch.specs?.fuel) form.setValue('specs.fuel', patch.specs.fuel, options);
      if (patch.specs?.originalHp) form.setValue('specs.originalHp', patch.specs.originalHp, options);
      if (patch.specs?.weightKg) form.setValue('specs.weightKg', patch.specs.weightKg, options);
      if (identifierMode === 'set') {
        form.setValue('identifiers.countryCode', 'NO');
        form.setValue('identifiers.registrationNumber', plate.replace(/[\s-]/g, '').toUpperCase(), options);
      }
    },
  });

  const save = useMutation({
    mutationFn: async (values: FormIn) => {
      const payload = { ...values, coverMediaId: cover?.id ?? null };
      if (identifierMode === 'keep') delete payload.identifiers;
      if (identifierMode === 'remove') payload.identifiers = null;
      if (identifierMode === 'set' && !values.identifiers?.registrationNumber && !values.identifiers?.vin) {
        if (vehicle) delete payload.identifiers;
        else payload.identifiers = null;
      }
      return vehicle ? api.vehicles.update(vehicle.id, payload) : api.vehicles.create(payload);
    },
    onSuccess: (saved) => {
      qc.setQueryData(queryKeys.vehicle(saved.id), saved);
      void qc.invalidateQueries({ queryKey: queryKeys.home });
      toast.success(vehicle ? 'Vehicle updated' : 'Vehicle added to your garage');
      router.push(`/v/${saved.id}`);
    },
    onError: (error) => {
      if (isApiError(error)) for (const [f, m] of Object.entries(error.fieldErrors)) form.setError(f as never, { message: m });
      toast.error(errorMessage(error));
    },
  });

  const visibility = form.watch('visibility');
  const visibleCrewIds = form.watch('visibleCrewIds') ?? [];

  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-5" noValidate>
      <Section title="Find your car" description="Enter a Norwegian registration number to fill in the vehicle details. You can edit everything afterwards.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Norwegian registration number">
            {(p) => <Input {...p} value={plate} onChange={(event) => { setPlate(event.target.value.toUpperCase()); lookup.reset(); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (plate.trim() && !lookup.isPending) lookup.mutate(); } }} autoComplete="off" autoCapitalize="characters" maxLength={12} placeholder="AB 12345" disabled={lookup.isPending} />}
          </Field>
          <Button type="button" variant="secondary" loading={lookup.isPending} disabled={!plate.trim() || save.isPending} onClick={() => lookup.mutate()}>Find vehicle</Button>
        </div>
        {lookup.error && <p role="alert" className="text-sm text-danger">{isApiError(lookup.error) && lookup.error.code === 'NOT_FOUND' ? 'No vehicle found. Check the registration number or enter the details manually below.' : errorMessage(lookup.error)}</p>}
        {lookup.isSuccess && <p role="status" className="text-sm text-success">Details filled in from Statens vegvesen. Review or edit the fields below before saving.</p>}
        <p className="text-xs text-muted">Source: Statens vegvesen. If the model year is unavailable, the year is filled from first registration. You can also enter the car manually.</p>
      </Section>
      <Section title="Basics" description="What is it? Make and model are required.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('make')} error={errors.make?.message}>
            {(p) => <Input {...p} {...form.register('make')} placeholder="Toyota" />}
          </Field>
          <Field label={t('model')} error={errors.model?.message}>
            {(p) => <Input {...p} {...form.register('model')} placeholder="Supra" />}
          </Field>
          <Field label={t('generation')} optional error={errors.generation?.message}>
            {(p) => <Input {...p} {...form.register('generation', str)} placeholder="A80" />}
          </Field>
          <Field label={t('year')} optional error={errors.year?.message}>
            {(p) => <Input {...p} type="number" inputMode="numeric" {...form.register('year', num)} placeholder="1997" />}
          </Field>
          <Field label={t('trim')} optional>
            {(p) => <Input {...p} {...form.register('trim', str)} placeholder="RZ" />}
          </Field>
          <Field label={t('nickname')} optional>
            {(p) => <Input {...p} {...form.register('nickname', str)} />}
          </Field>
          <Field label={t('color')} optional>
            {(p) => <Input {...p} {...form.register('color', str)} />}
          </Field>
        </div>
        <Field label={t('description')} optional help="Markdown supported.">
          {(p) => <Textarea {...p} rows={5} {...form.register('description', str)} />}
        </Field>
        <div className="grid gap-2">
          <p className="text-[13px] font-medium">{t('cover')}</p>
          <div className="flex items-center gap-4">
            {cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(cover, { width: 240, height: 160, crop: 'fill' })} alt="" className="h-20 w-30 rounded-lg object-cover" />
            )}
            <MediaUploader purpose="vehicle" onUploaded={(m) => setCover(m)} className="h-20 w-40" label={cover ? 'Replace' : 'Upload cover'} />
          </div>
        </div>
      </Section>

      <Section title={t('specs')} description={t('ownerClaimNote')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('engine')} optional>
            {(p) => <Input {...p} {...form.register('specs.engine', str)} placeholder="2JZ-GTE" />}
          </Field>
          <Field label={t('displacement')} optional>
            {(p) => <Input {...p} type="number" {...form.register('specs.displacementCc', num)} />}
          </Field>
          <Field label={t('aspiration')} optional>
            {(p) => (
              <NativeSelect {...p} {...form.register('specs.aspiration', str)}>
                <option value="">—</option>
                {Object.entries(ASPIRATION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label={t('fuel')} optional>
            {(p) => (
              <NativeSelect {...p} {...form.register('specs.fuel', str)}>
                <option value="">—</option>
                {Object.entries(FUEL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label={t('drivetrain')} optional>
            {(p) => (
              <NativeSelect {...p} {...form.register('drivetrain', str)}>
                <option value="">—</option>
                {Object.entries(DRIVETRAIN_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label={t('transmission')} optional>
            {(p) => (
              <NativeSelect {...p} {...form.register('transmission', str)}>
                <option value="">—</option>
                {Object.entries(TRANSMISSION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label={t('originalHp')} optional>
            {(p) => <Input {...p} type="number" {...form.register('specs.originalHp', num)} />}
          </Field>
          <Field label={t('currentHp')} optional help="Shown as owner-reported.">
            {(p) => <Input {...p} type="number" {...form.register('specs.currentHp', num)} />}
          </Field>
          <Field label={t('torque')} optional>
            {(p) => <Input {...p} type="number" {...form.register('specs.torqueNm', num)} />}
          </Field>
          <Field label={t('weight')} optional>
            {(p) => <Input {...p} type="number" {...form.register('specs.weightKg', num)} />}
          </Field>
        </div>
      </Section>

      <Section title="Chassis & key mods" description="Quick summary fields. Use the modifications list for the detailed parts log.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('wheelsFront')} optional>
            {(p) => <Input {...p} {...form.register('wheels.front', str)} placeholder="18x9.5 +22" />}
          </Field>
          <Field label={t('wheelsRear')} optional>
            {(p) => <Input {...p} {...form.register('wheels.rear', str)} />}
          </Field>
          <Field label={t('tires')} optional>
            {(p) => <Input {...p} {...form.register('wheels.tires', str)} />}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['suspension', 'exhaust', 'ecuTuning', 'turbo', 'interior', 'audio'] as const).map((key) => (
            <Field key={key} label={t(key)} optional>
              {(p) => <Textarea {...p} rows={2} {...form.register(key, str)} />}
            </Field>
          ))}
        </div>
      </Section>

      <Section title={t('visibility')} description="Share individual cars without exposing your whole garage.">
        <Controller
          control={form.control}
          name="visibility"
          render={({ field }) => (
            <RadioGroup value={field.value ?? 'public'} onValueChange={field.onChange} className="sm:grid-cols-2">
              <RadioCard value="public" title={t('visibilityPublic')} description="Anyone, including people without an account." />
              <RadioCard value="connections" title={t('visibilityConnections')} description="Only accepted friends." />
              <RadioCard value="crews" title={t('visibilityCrews')} description="Members of the crews you choose." />
              <RadioCard value="private" title={t('visibilityPrivate')} description="Only you." />
            </RadioGroup>
          )}
        />
        {visibility === 'crews' && (
          <div className="grid gap-2 rounded-lg border border-line bg-sunken p-3">
            {crews?.length ? (
              crews.map((c) => (
                <label key={c.id} className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={visibleCrewIds.includes(c.id)}
                    onCheckedChange={(v) => form.setValue('visibleCrewIds', v ? [...visibleCrewIds, c.id] : visibleCrewIds.filter((x) => x !== c.id))}
                  />
                  {c.name}
                </label>
              ))
            ) : (
              <p className="text-sm text-muted">Join a crew to share vehicles with it.</p>
            )}
          </div>
        )}
        <Controller control={form.control} name="likesEnabled" render={({ field }) => <SwitchRow label="Allow likes" checked={field.value ?? true} onCheckedChange={field.onChange} />} />
        <Controller control={form.control} name="commentsEnabled" render={({ field }) => <SwitchRow label="Allow comments" checked={field.value ?? true} onCheckedChange={field.onChange} />} />
        <Controller control={form.control} name="showExpenses" render={({ field }) => <SwitchRow label={t('showExpenses')} checked={field.value ?? false} onCheckedChange={field.onChange} />} />
      </Section>

      <Section
        title={t('privateIdentifiers')}
        description={
          <span className="flex gap-2">
            <Lock className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden="true" />
            {t('privateIdentifiersHelp')}
          </span>
        }
      >
        {vehicle?.viewer.hasPrivateIdentifiers && (
          <RadioGroup value={identifierMode} onValueChange={(v) => setIdentifierMode(v as typeof identifierMode)} className="sm:grid-cols-3">
            <RadioCard value="keep" title="Keep stored" icon={<ShieldCheck />} />
            <RadioCard value="set" title="Replace" />
            <RadioCard value="remove" title="Remove" icon={<EyeOff />} />
          </RadioGroup>
        )}
        {identifierMode === 'set' && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Country" optional>
              {(p) => (
                <NativeSelect {...p} {...form.register('identifiers.countryCode')} defaultValue="NO">
                  {[...COUNTRY_CODES]
                    .map((c) => ({ c, n: countryName(c, locale) }))
                    .sort((a, b) => a.n.localeCompare(b.n, locale))
                    .map(({ c, n }) => (
                      <option key={c} value={c}>
                        {n}
                      </option>
                    ))}
                </NativeSelect>
              )}
            </Field>
            <Field label={t('registrationNumber')} optional error={errors.identifiers?.registrationNumber?.message}>
              {(p) => <Input {...p} autoComplete="off" {...form.register('identifiers.registrationNumber', str)} />}
            </Field>
            <Field label={t('vin')} optional error={errors.identifiers?.vin?.message}>
              {(p) => <Input {...p} autoComplete="off" {...form.register('identifiers.vin', str)} />}
            </Field>
          </div>
        )}
      </Section>

      <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 flex justify-end gap-2 rounded-xl border border-line bg-[color-mix(in_srgb,var(--vogn-surface)_92%,transparent)] p-3 backdrop-blur md:bottom-4">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending} disabled={lookup.isPending}>
          {vehicle ? 'Save changes' : t('addVehicle')}
        </Button>
      </div>
    </form>
  );
}

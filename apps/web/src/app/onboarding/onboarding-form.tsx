'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { isApiError } from '@vogn/api-client';
import { LOCALE_LABELS, SUPPORTED_LOCALES } from '@vogn/i18n';
import { COUNTRY_CODES, countryName } from '@vogn/utils';
import { AUTOMOTIVE_INTERESTS, onboardingSchema } from '@vogn/validation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Lock, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Logo } from '@/components/brand/logo';
import { setLocaleCookie } from '@/components/marketing/locale-switcher';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { useErrorMessage } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';
import { cn } from '@/lib/cn';
import { isOnboarding, useDebounced, useMe } from '@/lib/hooks';
import { INTEREST_LABELS } from '@/lib/labels';

type FormIn = z.input<typeof onboardingSchema>;
type FormOut = z.output<typeof onboardingSchema>;

export function OnboardingForm() {
  const t = useTranslations('onboarding');
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const { data: me } = useMe();
  const [brandsText, setBrandsText] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { username: '', displayName: '', country: null, language: locale as FormIn['language'], interests: [], favoriteBrands: [] },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (me && !isOnboarding(me)) router.replace('/home');
    if (isOnboarding(me) && me.suggestedUsername && !form.getValues('username')) form.setValue('username', me.suggestedUsername);
  }, [me, router, form]);

  const username = form.watch('username');
  const debounced = useDebounced(username, 350);
  const availability = useQuery({
    queryKey: ['username-available', debounced],
    queryFn: () => api.me.usernameAvailable(debounced),
    enabled: debounced.length >= 3,
    staleTime: 10_000,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const brands = brandsText.split(',').map((b) => b.trim()).filter(Boolean).slice(0, 20);
      await api.me.onboard({ ...values, favoriteBrands: brands, acceptTerms: true });
      setLocaleCookie(values.language);
      await qc.invalidateQueries({ queryKey: queryKeys.me });
      router.replace('/home');
    } catch (error) {
      if (isApiError(error)) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          form.setError(field as keyof FormIn, { message });
        }
      }
      setSubmitError(errorMessage(error));
    }
  });

  const interests = form.watch('interests') ?? [];

  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto grid max-w-xl gap-8 px-5 py-12 md:py-16">
        <Logo variant="lockup" height={20} />
        <div className="grid gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-muted">{t('subtitle')}</p>
        </div>
        <form onSubmit={onSubmit} className="grid gap-6" noValidate>
          <Field label={t('username')} help={t('usernameHelp')} error={form.formState.errors.username?.message}>
            {(p) => (
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-subtle">@</span>
                <Input {...p} {...form.register('username')} autoComplete="username" autoCapitalize="none" spellCheck={false} className="pl-7" />
                <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs" aria-live="polite">
                  {debounced.length >= 3 &&
                    (availability.isFetching ? (
                      <Loader2 className="size-4 animate-spin text-subtle" aria-label="Checking" />
                    ) : availability.data?.available ? (
                      <span className="flex items-center gap-1 text-success">
                        <Check className="size-4" aria-hidden="true" /> {t('usernameAvailable')}
                      </span>
                    ) : availability.data ? (
                      <span className="flex items-center gap-1 text-danger">
                        <X className="size-4" aria-hidden="true" /> {t('usernameTaken')}
                      </span>
                    ) : null)}
                </span>
              </div>
            )}
          </Field>

          <Field label={t('displayName')} help={t('displayNameHelp')} error={form.formState.errors.displayName?.message}>
            {(p) => <Input {...p} {...form.register('displayName')} autoComplete="nickname" />}
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label={t('country')} help={t('countryHelp')} optional error={form.formState.errors.country?.message}>
              {(p) => (
                <Controller
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <NativeSelect {...p} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value || null)}>
                      <option value="">—</option>
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
                />
              )}
            </Field>
            <Field label={t('language')}>
              {(p) => (
                <NativeSelect {...p} {...form.register('language')}>
                  {SUPPORTED_LOCALES.map((l) => (
                    <option key={l} value={l}>
                      {LOCALE_LABELS[l].native}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          </div>

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-[13px] font-medium">{t('interests')}</legend>
            <div className="flex flex-wrap gap-2">
              {AUTOMOTIVE_INTERESTS.map((interest) => {
                const on = interests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      form.setValue('interests', on ? interests.filter((i) => i !== interest) : [...interests, interest], { shouldDirty: true })
                    }
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm transition',
                      on ? 'border-accent-text bg-accent-muted text-accent-text' : 'border-line text-muted hover:border-line-strong hover:text-fg',
                    )}
                  >
                    {INTEREST_LABELS[interest]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Field label={t('brands')} optional>
            {(p) => <Input {...p} value={brandsText} onChange={(e) => setBrandsText(e.target.value)} placeholder={t('brandsPlaceholder')} />}
          </Field>

          <div className="flex items-start gap-2 rounded-lg border border-line bg-surface p-3 text-sm text-muted">
            <Lock className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden="true" />
            {t('privacyNote')}
          </div>

          <Controller
            control={form.control}
            name="acceptTerms"
            render={({ field, fieldState }) => (
              <div className="grid gap-1">
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <Checkbox checked={field.value === true} onCheckedChange={(v) => field.onChange(v === true ? true : undefined)} className="mt-0.5" />
                  <span>
                    {t('terms')}{' '}
                    <a href="/legal/terms" target="_blank" className="text-accent-text underline">
                      Terms
                    </a>{' '}
                    ·{' '}
                    <a href="/legal/privacy" target="_blank" className="text-accent-text underline">
                      Privacy
                    </a>
                  </span>
                </label>
                {fieldState.error && <p className="text-xs font-medium text-danger">{fieldState.error.message ? 'You need to accept the terms to continue.' : null}</p>}
              </div>
            )}
          />

          {submitError && (
            <p role="alert" className="rounded-lg border border-danger/40 bg-[color-mix(in_srgb,var(--vogn-danger)_10%,transparent)] p-3 text-sm text-danger">
              {submitError}
            </p>
          )}

          <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
            {t('finish')}
          </Button>
        </form>
      </div>
    </div>
  );
}

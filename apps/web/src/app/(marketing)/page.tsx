import { LOCALE_LABELS, SUPPORTED_LOCALES } from '@vogn/i18n';
import { ArrowRight, BellRing, Clock3, EyeOff, Globe2, Languages, Layers, LayoutGrid, MessagesSquare, Palette, Ruler, ShieldCheck, Sparkles, Wifi } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { PrimaryCta } from '@/components/marketing/auth-buttons';
import { GarageShowcase, PhonePreview, Pill, ProductPreview, VerificationShowcase } from '@/components/marketing/showcases';
import { StudioShowcase } from '@/components/marketing/studio-showcase';
import { Button } from '@/components/ui/button';

function Section({ id, eyebrow, title, body, children, className }: { id?: string; eyebrow: string; title: string; body: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-20 border-t border-line py-20 md:py-28 ${className ?? ''}`}>
      <div className="mx-auto grid max-w-[1240px] gap-12 px-5 md:px-8">
        <div className="grid max-w-2xl gap-4">
          <p className="text-xs font-semibold tracking-[0.18em] text-accent-text uppercase">{eyebrow}</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-balance md:text-[44px] md:leading-[1.05]">{title}</h2>
          <p className="text-base text-muted md:text-lg">{body}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

function Feature({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="grid content-start gap-2">
      <span className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-accent-text [&_svg]:size-[18px]">{icon}</span>
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted">{body}</p>
    </div>
  );
}

export default async function LandingPage() {
  const t = await getTranslations('landing');
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 70% 0%, color-mix(in srgb, var(--vogn-accent) 10%, transparent), transparent 70%), radial-gradient(40% 40% at 10% 20%, rgb(108 182 255 / 0.06), transparent 70%)',
          }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 right-[-10%] hidden h-[520px] w-[720px] rotate-[-28deg] opacity-[0.07] md:block">
          <div className="absolute inset-y-0 left-0 w-24 bg-accent" />
          <div className="absolute inset-y-0 left-36 w-10 bg-accent" />
          <div className="absolute inset-y-0 left-56 w-24 bg-fg" />
        </div>
        <div className="relative mx-auto grid max-w-[1240px] gap-14 px-5 pt-16 pb-20 md:px-8 md:pt-24 md:pb-28">
          <div className="grid max-w-3xl gap-6">
            <p className="animate-slide-up text-xs font-semibold tracking-[0.2em] text-accent-text uppercase">{t('heroEyebrow')}</p>
            <h1 className="animate-slide-up font-display text-[44px] leading-[0.98] font-semibold tracking-[-0.035em] text-balance sm:text-6xl md:text-[84px]">
              {t('heroTitle')}
            </h1>
            <p className="max-w-xl animate-slide-up text-lg text-muted md:text-xl">{t('heroBody')}</p>
            <div className="flex animate-slide-up flex-wrap items-center gap-3">
              <PrimaryCta label={t('ctaPrimary')} />
              <Button asChild variant="secondary" size="lg">
                <Link href="/discover">{t('ctaSecondary')}</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Pill>Free to join</Pill>
              <Pill>Apple, Google or email</Pill>
              <Pill>6 languages</Pill>
            </div>
          </div>
          <div className="relative">
            <span className="sr-only">{t('previewLabel')}: a crew channel with messages, reactions, a shared build and a member list.</span>
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="border-t border-line">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-16 md:grid-cols-4 md:px-8">
          <Feature icon={<Palette />} title="Crew Studio" body="Themes, layouts, widgets and pages — designed by your crew, rendered safely." />
          <Feature icon={<LayoutGrid />} title="Digital garage" body="Builds documented properly: specs, mods, timelines and galleries." />
          <Feature icon={<MessagesSquare />} title="Realtime chat" body="Channels, DMs and group chats with threads, reactions and mentions." />
          <Feature icon={<ShieldCheck />} title="Honest verification" body="Precisely labelled, optional checks. Crews see outcomes, not documents." />
        </div>
      </section>

      <Section id="studio" eyebrow="Crew Studio" title={t('crewsTitle')} body={t('crewsBody')}>
        <StudioShowcase />
        <div className="grid gap-8 md:grid-cols-3">
          <Feature icon={<Sparkles />} title="Five distinctive presets" body="Tokyo Midnight, Euro Atelier, American Iron, Offroad Expedition and VOGN Minimal — or start from scratch." />
          <Feature icon={<Layers />} title="Drag-and-drop layouts" body="Pages, sections and 21 widget types on a responsive grid with separate desktop and mobile behaviour." />
          <Feature icon={<Clock3 />} title="Drafts, versions, rollback" body="Preview changes privately, publish when ready and restore any earlier version." />
        </div>
      </Section>

      <Section id="garage" eyebrow="Digital garage" title={t('garageTitle')} body={t('garageBody')}>
        <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_1fr]">
          <GarageShowcase />
          <div className="grid gap-8">
            <Feature icon={<Ruler />} title="Owner claims vs. official data" body="Tuned figures are always labelled as owner-reported. Official technical data is shown separately and never implies ownership." />
            <Feature icon={<EyeOff />} title="Plates stay private" body="Registration numbers and VINs are encrypted and never displayed. Share individual cars without exposing your whole garage." />
            <Feature icon={<BellRing />} title="Follow the build" body="Timelines, before/after shots and build updates keep your crew in the loop." />
          </div>
        </div>
      </Section>

      <Section id="chat" eyebrow="Messaging" title={t('messagingTitle')} body={t('messagingBody')}>
        <div className="grid gap-8 md:grid-cols-3">
          <Feature icon={<Wifi />} title="Survives bad signal" body="Optimistic sending, retries and automatic reconciliation after reconnecting — nothing silently disappears." />
          <Feature icon={<MessagesSquare />} title="Threads & replies" body="Keep build questions organised with threads, replies, pins, mentions and reactions." />
          <Feature icon={<ShieldCheck />} title="Honest about privacy" body="Encrypted in transit and at rest with our providers. We do not claim end-to-end encryption we haven't built." />
        </div>
      </Section>

      <Section id="safety" eyebrow="Verification & privacy" title={t('verificationTitle')} body={t('verificationBody')}>
        <VerificationShowcase />
        <div className="rounded-2xl border border-line bg-surface p-6 md:p-8">
          <p className="font-display text-xl font-semibold">{t('privacyTitle')}</p>
          <p className="mt-2 max-w-3xl text-muted">{t('privacyBody')}</p>
        </div>
      </Section>

      <Section eyebrow="Global" title={t('globalTitle')} body={t('globalBody')}>
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_auto]">
          <div className="grid gap-8 sm:grid-cols-3">
            <Feature icon={<Languages />} title="Six languages" body={SUPPORTED_LOCALES.map((l) => LOCALE_LABELS[l].native).join(' · ')} />
            <Feature icon={<Ruler />} title="Your units" body="Metric or imperial — hp/kW, Nm/lb-ft, km/mi." />
            <Feature icon={<Globe2 />} title="Your time zone" body="Events show local times, with calendar links for every meet." />
          </div>
          <div className="grid justify-items-center gap-3">
            <PhonePreview />
            <p className="text-sm text-muted">{t('mobileTitle')} — iOS & Android</p>
          </div>
        </div>
      </Section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-[1240px] justify-items-start gap-6 px-5 py-24 md:px-8 md:py-32">
          <h2 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-balance md:text-6xl">{t('finalTitle')}</h2>
          <p className="max-w-xl text-lg text-muted">{t('finalBody')}</p>
          <div className="flex flex-wrap gap-3">
            <PrimaryCta label={t('ctaPrimary')} />
            <Button asChild variant="ghost" size="lg">
              <Link href="/studio/playground">
                Try Crew Studio <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

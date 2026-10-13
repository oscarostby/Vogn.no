import { VERIFICATION_LEVEL_INFO, type VerificationLevel } from '@vogn/types';
import {
  Bell,
  CalendarDays,
  Car,
  Check,
  CornerDownRight,
  Gauge,
  Hash,
  Home,
  KeyRound,
  Lock,
  MessagesSquare,
  Mic,
  Plus,
  Search,
  ShieldCheck,
  SmilePlus,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

function Dot({ color }: { color: string }) {
  return <span className="size-2 rounded-full" style={{ background: color }} aria-hidden="true" />;
}

function Avatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-[#101114]"
      style={{ width: size, height: size, background: color }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

/** Static, non-interactive product preview composed from real UI patterns. */
export function ProductPreview() {
  const crews = [
    { l: 'W', c: '#FF2E88', active: true },
    { l: 'B', c: '#FF5A1F' },
    { l: 'A', c: '#E9E3D7' },
    { l: 'F', c: '#4B652B' },
  ];
  return (
    <div inert className="relative overflow-hidden rounded-2xl border border-line-strong bg-[#0C0D0F] text-left shadow-[0_50px_140px_-40px_rgb(0_0_0/0.9)]">
      <div className="flex h-[440px] text-[13px] md:h-[500px]">
        {/* rail */}
        <div className="flex w-16 shrink-0 flex-col items-center gap-2 border-r border-line bg-[#0C0D0F] py-3">
          <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/vogn-mark-lime.png" alt="" className="h-3.5 w-auto" />
          </span>
          {[Home, MessagesSquare, Car, CalendarDays].map((Icon, i) => (
            <span key={i} className={cn('flex size-10 items-center justify-center rounded-xl', i === 0 ? 'text-fg' : 'text-subtle')}>
              <Icon className="size-[18px]" aria-hidden="true" />
            </span>
          ))}
          <span className="my-1 h-px w-8 bg-line" />
          {crews.map((c, i) => (
            <span key={i} className="relative flex size-10 items-center justify-center">
              {c.active && <span className="absolute -left-3 h-6 w-1 rounded-r-full bg-accent" />}
              <span className={cn('flex size-10 items-center justify-center font-bold text-[#101114]', c.active ? 'rounded-xl' : 'rounded-2xl')} style={{ background: c.c }}>
                {c.l}
              </span>
            </span>
          ))}
          <span className="flex size-10 items-center justify-center rounded-2xl border border-dashed border-line-strong text-subtle">
            <Plus className="size-4" aria-hidden="true" />
          </span>
        </div>
        {/* channels */}
        <div className="hidden w-56 shrink-0 flex-col border-r border-line bg-surface sm:flex">
          <div className="relative h-24 overflow-hidden border-b border-line" style={{ background: 'radial-gradient(120% 120% at 20% 0%, #3A1458 0%, #130C22 55%, #0A0612 100%)' }}>
            <div className="absolute inset-x-0 bottom-0 h-1/2 opacity-40" style={{ backgroundImage: 'linear-gradient(#FF2E88 1px, transparent 1px), linear-gradient(90deg, #00E5FF 1px, transparent 1px)', backgroundSize: '18px 18px', transform: 'perspective(200px) rotateX(55deg)', transformOrigin: 'bottom' }} />
            <p className="absolute bottom-2 left-3 font-display text-[15px] font-bold tracking-wide text-white">WANGAN NIGHTS</p>
          </div>
          <div className="grid gap-0.5 p-2 text-muted">
            <p className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-widest text-subtle uppercase">Channels</p>
            {['announcements', 'general', 'builds', 'night-runs'].map((c, i) => (
              <span key={c} className={cn('flex items-center gap-2 rounded-md px-2 py-1.5', i === 1 && 'bg-elevated text-fg')}>
                <Hash className="size-3.5" aria-hidden="true" /> {c}
                {i === 2 && <span className="ml-auto rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-fg">3</span>}
              </span>
            ))}
            <span className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <Mic className="size-3.5" aria-hidden="true" /> garage-talk
            </span>
            <div className="ml-6 grid gap-1 pb-1">
              {[['Aiko', '#6CB6FF'], ['Kaito', '#FF2E88']].map(([n, c]) => (
                <span key={n} className="flex items-center gap-2 text-xs">
                  <Avatar name={n!} color={c!} size={18} /> {n}
                </span>
              ))}
            </div>
          </div>
        </div>
        {/* chat */}
        <div className="flex min-w-0 flex-1 flex-col bg-bg">
          <div className="flex h-12 items-center gap-2 border-b border-line px-4">
            <Hash className="size-4 text-subtle" aria-hidden="true" />
            <span className="font-semibold">general</span>
            <span className="hidden truncate text-subtle md:inline">· Say hi and introduce your car</span>
            <span className="ml-auto flex items-center gap-3 text-subtle">
              <Search className="size-4" aria-hidden="true" />
              <Bell className="size-4" aria-hidden="true" />
              <Users className="size-4" aria-hidden="true" />
            </span>
          </div>
          <div className="flex flex-1 flex-col justify-end gap-4 overflow-hidden px-4 pb-3">
            <div className="flex gap-3">
              <Avatar name="Ingrid" color="#00E5FF" />
              <div className="grid gap-1">
                <p className="text-xs">
                  <span className="font-semibold text-fg">Ingrid</span> <span className="text-subtle">21:42</span>
                </p>
                <p className="text-muted">Harbour loop tonight? Meet point is the north lot, quiet arrivals 🙏</p>
                <div className="flex gap-1.5">
                  <span className="rounded-md border border-[color-mix(in_srgb,var(--vogn-accent)_40%,transparent)] bg-accent-muted px-1.5 py-0.5 text-[11px] text-accent-text">🔥 12</span>
                  <span className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] text-muted">🙌 4</span>
                  <span className="rounded-md border border-line bg-surface px-1 py-0.5 text-muted">
                    <SmilePlus className="size-3.5" aria-hidden="true" />
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Avatar name="Kaito" color="#FF2E88" />
              <div className="grid min-w-0 gap-1.5">
                <p className="text-xs">
                  <span className="font-semibold text-fg">Kaito</span> <span className="text-subtle">21:44</span>
                </p>
                <p className="text-muted">In. Finally finished the R34 refresh — specs are up in my garage.</p>
                <div className="flex max-w-sm overflow-hidden rounded-lg border border-line bg-surface">
                  <div className="w-1 bg-accent" />
                  <div className="flex items-center gap-3 p-3">
                    <span className="flex size-12 items-center justify-center rounded-md" style={{ background: 'linear-gradient(135deg,#1d3a8a,#0b1530)' }}>
                      <Car className="size-5 text-white/80" aria-hidden="true" />
                    </span>
                    <div className="grid gap-0.5">
                      <p className="font-semibold text-fg">1999 Nissan Skyline GT-R</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted">
                        <Gauge className="size-3.5" aria-hidden="true" /> 540 hp · owner-reported
                      </p>
                      <p className="flex items-center gap-1 text-[11px] text-success">
                        <ShieldCheck className="size-3" aria-hidden="true" /> Specs confirmed
                      </p>
                    </div>
                  </div>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-accent-text">
                  <CornerDownRight className="size-3.5" aria-hidden="true" /> 6 replies in thread
                </p>
              </div>
            </div>
            <p className="text-xs text-subtle">
              <span className="inline-flex gap-0.5 align-middle">
                <span className="size-1 animate-pulse-soft rounded-full bg-subtle" />
                <span className="size-1 animate-pulse-soft rounded-full bg-subtle [animation-delay:200ms]" />
                <span className="size-1 animate-pulse-soft rounded-full bg-subtle [animation-delay:400ms]" />
              </span>{' '}
              Marco is typing…
            </p>
          </div>
          <div className="px-4 pb-4">
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-subtle">
              <Plus className="size-4" aria-hidden="true" />
              Message #general
            </div>
          </div>
        </div>
        {/* members */}
        <div className="hidden w-48 shrink-0 border-l border-line bg-surface p-3 xl:block">
          <p className="mb-2 text-[10px] font-semibold tracking-widest text-subtle uppercase">Online — 148</p>
          {[
            ['Kaito', '#FF2E88', 'Owner'],
            ['Ingrid', '#00E5FF', 'Moderator'],
            ['Aiko', '#6CB6FF', null],
            ['Marco', '#F2C14E', null],
            ['Saga', '#7B5CFF', null],
          ].map(([n, c, r]) => (
            <div key={n} className="flex items-center gap-2 py-1.5">
              <Avatar name={n!} color={c!} size={26} />
              <span className="grid">
                <span className="text-fg">{n}</span>
                {r && <span className="text-[10px] text-subtle">{r}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GarageShowcase() {
  return (
    <div inert className="grid gap-4 rounded-2xl border border-line bg-surface p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <p className="text-xs font-semibold tracking-[0.14em] text-subtle uppercase">Build page</p>
          <p className="font-display text-2xl font-semibold tracking-tight">1989 BMW M3 · E30</p>
          <p className="text-sm text-muted">“Evo tribute” · @marco_e30</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--vogn-success)_14%,transparent)] px-2 py-1 text-[11px] font-semibold text-success">
          <ShieldCheck className="size-3.5" aria-hidden="true" /> Specs confirmed
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2 row-span-2 aspect-[4/3] rounded-xl" style={{ background: 'linear-gradient(135deg,#2a2d33 0%,#191b20 60%), radial-gradient(circle at 30% 30%, #C8FF5F22, transparent 60%)' }} />
        <div className="aspect-square rounded-xl" style={{ background: 'linear-gradient(160deg,#30333a,#191b20)' }} />
        <div className="aspect-square rounded-xl" style={{ background: 'linear-gradient(200deg,#22252b,#101114)' }} />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        {[
          ['Engine', 'S14B23', 'official'],
          ['Power', '238 hp', 'owner'],
          ['Drivetrain', 'RWD', 'official'],
          ['Gearbox', '5-speed manual', 'official'],
        ].map(([k, v, src]) => (
          <div key={k} className="grid gap-1 rounded-lg border border-line bg-sunken p-3">
            <dt className="text-[11px] text-subtle">{k}</dt>
            <dd className="font-semibold">{v}</dd>
            <dd className={cn('text-[10px] font-semibold tracking-wide uppercase', src === 'official' ? 'text-info' : 'text-warning')}>
              {src === 'official' ? 'Official data' : 'Owner-reported'}
            </dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-3 border-t border-line pt-4">
        {[
          ['Coilovers & alignment', 'Suspension', '2 weeks ago'],
          ['Paint correction, ceramic coat', 'Exterior', '1 month ago'],
          ['Bought it. Rust check passed.', 'Milestone', '2 years ago'],
        ].map(([title, tag, when], i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="mt-1.5 flex size-2.5 shrink-0 rounded-full" style={{ background: i === 0 ? 'var(--vogn-accent)' : 'var(--vogn-line-strong)' }} />
            <div className="grid flex-1 gap-0.5">
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-subtle">
                <Wrench className="mr-1 inline size-3" aria-hidden="true" />
                {tag} · {when}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VerificationShowcase() {
  const levels: VerificationLevel[] = ['vehicle_specs_confirmed', 'vehicle_access_reviewed', 'ownership_evidence_reviewed', 'identity_checked'];
  const icons: Record<string, ReactNode> = {
    vehicle_specs_confirmed: <Car className="size-4" aria-hidden="true" />,
    vehicle_access_reviewed: <KeyRound className="size-4" aria-hidden="true" />,
    ownership_evidence_reviewed: <ShieldCheck className="size-4" aria-hidden="true" />,
    identity_checked: <Lock className="size-4" aria-hidden="true" />,
  };
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {levels.map((level) => {
        const info = VERIFICATION_LEVEL_INFO[level];
        return (
          <div key={level} className="grid gap-3 rounded-xl border border-line bg-surface p-5">
            <p className="flex items-center gap-2 font-semibold">
              <span className="flex size-8 items-center justify-center rounded-lg bg-accent-muted text-accent-text">{icons[level]}</span>
              {info.label}
            </p>
            <p className="flex gap-2 text-sm text-muted">
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              {info.proves}
            </p>
            <p className="flex gap-2 text-sm text-muted">
              <X className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden="true" />
              {info.doesNotProve}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function PhonePreview() {
  return (
    <div inert className="relative mx-auto w-[260px] rounded-[2.6rem] border border-line-strong bg-[#0C0D0F] p-2.5 shadow-[0_40px_100px_-30px_rgb(0_0_0/0.9)]">
      <div className="overflow-hidden rounded-[2.1rem] bg-bg">
        <div className="flex items-center justify-between px-5 pt-3 pb-2 text-[10px] text-muted">
          <span>21:44</span>
          <span className="h-4 w-16 rounded-full bg-black" />
          <span>5G</span>
        </div>
        <div className="relative h-28" style={{ background: 'linear-gradient(120deg,#FF5A1F99,#B3122B66,#121010)' }}>
          <p className="absolute bottom-2 left-4 font-display text-lg font-bold tracking-wide text-white uppercase">Big Block Society</p>
        </div>
        <div className="grid gap-2 p-3">
          {[['Cruise-in Friday', 'Fri 19:00 · 64 going'], ['Dyno day', 'Sat 10:00 · 21 going']].map(([t, s]) => (
            <div key={t} className="rounded-lg border border-line bg-surface p-3">
              <p className="text-[13px] font-semibold">{t}</p>
              <p className="text-[11px] text-muted">{s}</p>
            </div>
          ))}
          <div className="rounded-lg border border-line bg-surface p-3">
            <p className="text-[11px] text-muted">
              <span className="font-semibold text-fg">Lukas</span> · #builds
            </p>
            <p className="text-[12px]">LS swap is running! 🎉</p>
          </div>
        </div>
        <div className="flex justify-around border-t border-line px-2 py-3 text-subtle">
          {[Home, Users, MessagesSquare, Car, Bell].map((Icon, i) => (
            <Icon key={i} className={cn('size-5', i === 1 && 'text-accent')} aria-hidden="true" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
      <Dot color="var(--vogn-accent)" />
      {children}
    </span>
  );
}

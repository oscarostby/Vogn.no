'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LOCALE_LABELS, SUPPORTED_LOCALES } from '@vogn/i18n';
import type { MeProfile, UserSettings } from '@vogn/types';
import { profileUpdateSchema, type SettingsUpdateInput } from '@vogn/validation';
import { Download, Settings } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { UploadButton, useUploadPicker } from '@/components/app/media-uploader';
import { PageContainer } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { SwitchRow, Tabs, TabsList, TabsTrigger } from '@/components/ui/controls';
import { Avatar } from '@/components/ui/display';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { ErrorState, ListSkeleton, PageHeader, useErrorMessage } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';
import { cn } from '@/lib/cn';
import { LOCALE_COOKIE, MOTION_COOKIE, THEME_COOKIE } from '@/lib/config';
import { isOnboarding, useMe } from '@/lib/hooks';

const AUDIENCES = [['public', 'Everyone'], ['members', 'Signed-in members'], ['connections', 'Friends'], ['private', 'Only me']] as const;
const NOTIFICATION_LABELS = { directMessages: 'Direct messages', mentions: 'Mentions', replies: 'Replies', reactions: 'Reactions', crewInvitations: 'Crew invitations', membership: 'Membership decisions', verification: 'Verification decisions', events: 'Events', announcements: 'Crew announcements', social: 'Friends and followers' } as const;

function applyPreferences(profile: MeProfile) {
  const settings = profile.settings;
  const cookie = (name: string, value: string) => { document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`; };
  cookie(LOCALE_COOKIE, settings.locale);
  cookie(THEME_COOKIE, settings.colorScheme);
  cookie(MOTION_COOKIE, settings.reducedMotion);
  document.documentElement.dataset.theme = settings.colorScheme;
  if (settings.reducedMotion === 'reduce') document.documentElement.dataset.motion = 'reduce';
  else delete document.documentElement.dataset.motion;
}

function SettingsForm({ profile }: { profile: MeProfile }) {
  const params = useParams<{ section?: string }>();
  const initialTab = ['profile', 'privacy', 'appearance', 'notifications', 'account'].includes(params.section ?? '') ? params.section! : 'profile';
  const [tab, setTab] = useState(initialTab);
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [website, setWebsite] = useState(profile.website ?? '');
  const [country, setCountry] = useState(profile.country ?? '');
  const [preferences, setPreferences] = useState<UserSettings>(profile.settings);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const qc = useQueryClient();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const saveProfile = useMutation({ mutationFn: (input: unknown) => api.me.update(profileUpdateSchema.parse(input)), onSuccess: (updated) => { qc.setQueryData(queryKeys.me, updated); void qc.invalidateQueries({ queryKey: ['profile'] }); toast.success('Profile saved'); }, onError: (error) => toast.error(errorMessage(error)) });
  const avatar = useUploadPicker('avatar', (media) => saveProfile.mutate({ avatarMediaId: media.id }));
  const saveSettings = useMutation({ mutationFn: (input: SettingsUpdateInput) => api.me.updateSettings(input), onSuccess: (updated) => { qc.setQueryData(queryKeys.me, updated); setPreferences(updated.settings); applyPreferences(updated); router.refresh(); toast.success('Settings saved'); }, onError: (error) => toast.error(errorMessage(error)) });
  const exportData = useMutation({ mutationFn: () => api.me.exportData(), onSuccess: (data) => { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `vogn-${profile.username}-export.json`; link.click(); URL.revokeObjectURL(url); }, onError: (error) => toast.error(errorMessage(error)) });
  const deleteAccount = useMutation({ mutationFn: () => api.me.deleteAccount({ confirmUsername: deleteConfirmation }), onSuccess: () => { qc.clear(); router.replace('/'); router.refresh(); }, onError: (error) => toast.error(errorMessage(error)) });
  const pref = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => setPreferences((current) => ({ ...current, [key]: value }));
  const saveButton = <div className="flex justify-end"><Button type="submit" loading={saveSettings.isPending}>Save settings</Button></div>;
  const formClass = 'grid gap-5 rounded-xl border border-line bg-surface p-5';
  return <>
    <Tabs value={tab} onValueChange={setTab} className="mb-6"><TabsList><TabsTrigger value="profile">Profile</TabsTrigger><TabsTrigger value="privacy">Privacy</TabsTrigger><TabsTrigger value="appearance">Appearance</TabsTrigger><TabsTrigger value="notifications">Notifications</TabsTrigger><TabsTrigger value="account">Account</TabsTrigger></TabsList></Tabs>
    {tab === 'profile' && <form className={formClass} onSubmit={(e) => { e.preventDefault(); saveProfile.mutate({ username, displayName, bio: bio || null, website: website || null, country: country || null }); }}>
      <div role="group" aria-label="Avatar" {...avatar.dropProps} className={cn('-m-2.5 flex flex-wrap items-center gap-4 rounded-xl border-2 border-dashed border-transparent p-2 transition', avatar.dragging && 'border-accent-text bg-accent-muted')}><Avatar name={profile.displayName} image={profile.avatar} size="xl" /><UploadButton picker={avatar} label="Change avatar" className="p-3" />{profile.avatar && <Button variant="ghost" size="sm" onClick={() => saveProfile.mutate({ avatarMediaId: null })} type="button" disabled={saveProfile.isPending}>Remove avatar</Button>}</div>
      <Field label="Display name">{(p) => <Input {...p} required value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} />}</Field>
      <Field label="Username" help="Usernames can be changed once a week. Your old profile link redirects temporarily.">{(p) => <Input {...p} required minLength={3} maxLength={24} value={username} onChange={(e) => setUsername(e.target.value)} pattern="[A-Za-z0-9_.]+" />}</Field>
      <Field label="Bio" optional>{(p) => <Textarea {...p} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} />}</Field>
      <Field label="Website" optional help="Use a full https:// URL.">{(p) => <Input {...p} type="url" value={website} maxLength={500} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />}</Field>
      <Field label="Country" optional>{(p) => <Input {...p} value={country} maxLength={2} minLength={2} pattern="[A-Z]{2}" onChange={(e) => setCountry(e.target.value.toUpperCase())} placeholder="NO" />}</Field>
      <div className="flex justify-between gap-2"><Button asChild variant="ghost"><Link href={`/u/${profile.username}`}>View profile</Link></Button><Button type="submit" loading={saveProfile.isPending}>Save profile</Button></div>
    </form>}
    {tab === 'privacy' && <form className={formClass} onSubmit={(e) => { e.preventDefault(); saveSettings.mutate({ profileVisibility: preferences.profileVisibility, activityVisibility: preferences.activityVisibility, garageVisibility: preferences.garageVisibility, dmPrivacy: preferences.dmPrivacy, onlineStatusVisibility: preferences.onlineStatusVisibility, friendRequests: preferences.friendRequests, showVerificationBadges: preferences.showVerificationBadges, allowFollowers: preferences.allowFollowers }); }}>
      <Field label="Profile visibility">{(p) => <NativeSelect {...p} value={preferences.profileVisibility} onChange={(e) => pref('profileVisibility', e.target.value as UserSettings['profileVisibility'])}>{AUDIENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>}</Field>
      <Field label="Activity visibility">{(p) => <NativeSelect {...p} value={preferences.activityVisibility} onChange={(e) => pref('activityVisibility', e.target.value as UserSettings['activityVisibility'])}>{AUDIENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>}</Field>
      <Field label="Default garage visibility" help="Individual vehicles have their own visibility setting.">{(p) => <NativeSelect {...p} value={preferences.garageVisibility} onChange={(e) => pref('garageVisibility', e.target.value as UserSettings['garageVisibility'])}><option value="public">Everyone</option><option value="connections">Friends</option><option value="crews">My crews</option><option value="private">Only me</option></NativeSelect>}</Field>
      <Field label="Who can send you direct messages?">{(p) => <NativeSelect {...p} value={preferences.dmPrivacy} onChange={(e) => pref('dmPrivacy', e.target.value as UserSettings['dmPrivacy'])}><option value="everyone">Everyone</option><option value="connections">Friends</option><option value="crew_members">Friends and crew members</option><option value="nobody">Nobody</option></NativeSelect>}</Field>
      <Field label="Online status visibility">{(p) => <NativeSelect {...p} value={preferences.onlineStatusVisibility} onChange={(e) => pref('onlineStatusVisibility', e.target.value as UserSettings['onlineStatusVisibility'])}><option value="everyone">Everyone</option><option value="connections">Friends</option><option value="crew_members">Crew members</option><option value="nobody">Nobody</option></NativeSelect>}</Field>
      <Field label="Friend requests">{(p) => <NativeSelect {...p} value={preferences.friendRequests} onChange={(e) => pref('friendRequests', e.target.value as UserSettings['friendRequests'])}><option value="everyone">Everyone</option><option value="crew_members">Crew members</option><option value="nobody">Nobody</option></NativeSelect>}</Field>
      <SwitchRow label="Show verification badges" checked={preferences.showVerificationBadges} onCheckedChange={(value) => pref('showVerificationBadges', value)} /><SwitchRow label="Allow followers" checked={preferences.allowFollowers} onCheckedChange={(value) => pref('allowFollowers', value)} />{saveButton}
    </form>}
    {tab === 'appearance' && <form className={formClass} onSubmit={(e) => { e.preventDefault(); saveSettings.mutate({ colorScheme: preferences.colorScheme, reducedMotion: preferences.reducedMotion, locale: preferences.locale, units: preferences.units }); }}>
      <Field label="Theme">{(p) => <NativeSelect {...p} value={preferences.colorScheme} onChange={(e) => pref('colorScheme', e.target.value as UserSettings['colorScheme'])}><option value="dark">Dark</option><option value="light">Light</option><option value="system">Follow device</option></NativeSelect>}</Field>
      <Field label="Language">{(p) => <NativeSelect {...p} value={preferences.locale} onChange={(e) => pref('locale', e.target.value as UserSettings['locale'])}>{SUPPORTED_LOCALES.map((value) => <option key={value} value={value}>{LOCALE_LABELS[value].native}</option>)}</NativeSelect>}</Field>
      <Field label="Units">{(p) => <NativeSelect {...p} value={preferences.units} onChange={(e) => pref('units', e.target.value as UserSettings['units'])}><option value="metric">Metric</option><option value="imperial">Imperial</option></NativeSelect>}</Field>
      <Field label="Motion">{(p) => <NativeSelect {...p} value={preferences.reducedMotion} onChange={(e) => pref('reducedMotion', e.target.value as UserSettings['reducedMotion'])}><option value="system">Follow device</option><option value="reduce">Reduce motion</option><option value="no-preference">Default motion</option></NativeSelect>}</Field>{saveButton}
    </form>}
    {tab === 'notifications' && <form className={formClass} onSubmit={(e) => { e.preventDefault(); const { security: _security, ...inApp } = preferences.notifications.inApp; void _security; saveSettings.mutate({ notifications: { inApp } }); }}><p className="text-sm text-muted">Choose which updates appear in the app. Security alerts stay enabled.</p><div className="divide-y divide-line">{Object.entries(NOTIFICATION_LABELS).map(([key, label]) => <SwitchRow key={key} label={label} checked={preferences.notifications.inApp[key as keyof typeof NOTIFICATION_LABELS]} onCheckedChange={(value) => setPreferences((current) => ({ ...current, notifications: { ...current.notifications, inApp: { ...current.notifications.inApp, [key]: value } } }))} />)}</div>{saveButton}</form>}
    {tab === 'account' && <div className="grid gap-6"><section className={formClass}><h2 className="font-semibold">Your data</h2><p className="text-sm text-muted">Download your profile, garage, messages and other account data as JSON.</p><Button variant="secondary" loading={exportData.isPending} onClick={() => exportData.mutate()}><Download />Download my data</Button></section><form className={formClass} onSubmit={(e) => { e.preventDefault(); if (window.confirm('Permanently delete your VOGN account and data? This cannot be undone.')) deleteAccount.mutate(); }}><h2 className="font-semibold text-danger">Delete account</h2><p className="text-sm text-muted">This deletes your VOGN account and associated personal data. Crews you own must be transferred or deleted first.</p><Field label={`Type ${profile.username} to confirm`}>{(p) => <Input {...p} required value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} autoComplete="off" />}</Field><Button type="submit" variant="danger" loading={deleteAccount.isPending} disabled={deleteConfirmation !== profile.username}>Delete my account</Button></form></div>}
  </>;
}

export default function SettingsPage() {
  const me = useMe();
  return <PageContainer width="narrow"><PageHeader title="Settings" description="Your profile, privacy and preferences." eyebrow={<Settings className="size-5" />} />{me.isLoading && <ListSkeleton rows={6} />}{me.error && <ErrorState error={me.error} onRetry={() => void me.refetch()} />}{me.data && !isOnboarding(me.data) && <SettingsForm key={me.data.id} profile={me.data} />}</PageContainer>;
}

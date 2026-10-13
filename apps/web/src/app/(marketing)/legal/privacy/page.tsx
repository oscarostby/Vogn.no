import Link from 'next/link';

export default function PrivacyPage() {
  return <article className="mx-auto grid max-w-3xl gap-6 px-5 py-14 text-sm leading-relaxed">
    <header><p className="mb-2 text-xs font-semibold tracking-wider text-accent-text uppercase">Private test draft · 13 October 2026</p><h1 className="font-display text-3xl font-semibold">Privacy during testing</h1></header>
    <p>This VOGN deployment is a private development test. This draft describes the test app and must be replaced with a reviewed privacy notice, operator details and retention policy before a public launch.</p>
    <section><h2 className="mb-2 text-lg font-semibold">What the test app stores</h2><p>The app stores your profile, garage, crew memberships, messages, event RSVPs, settings, reports and uploaded media. Registration numbers and VINs are encrypted in storage. Access rules limit private profiles, vehicles, crews and conversations to their permitted viewers.</p></section>
    <section><h2 className="mb-2 text-lg font-semibold">Hosting and services</h2><p>The deployment uses Vercel for hosting and MongoDB Atlas for account and app data. Authentication and media providers depend on the deployment configuration. Session cookies keep you signed in; preference cookies store your selected language, theme and motion settings. Do not use real identity documents or sensitive personal information in this test.</p></section>
    <section><h2 className="mb-2 text-lg font-semibold">Your controls</h2><p>You can change privacy settings, download account data and request account deletion in <Link href="/settings/account" className="text-accent-text hover:underline">Settings</Link>. Reports include a limited snapshot of the reported content for review. Test data may be cleared during development. Back up anything you want to keep.</p></section>
    <p className="text-muted">The operator&apos;s legal name, contact details, processing purposes, retention periods and service agreements must be completed before this draft can serve as a public privacy notice.</p>
  </article>;
}

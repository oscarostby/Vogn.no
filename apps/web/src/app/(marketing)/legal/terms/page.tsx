import Link from 'next/link';

export default function TermsPage() {
  return <article className="mx-auto grid max-w-3xl gap-6 px-5 py-14 text-sm leading-relaxed">
    <header><p className="mb-2 text-xs font-semibold tracking-wider text-accent-text uppercase">Private test draft · 13 October 2026</p><h1 className="font-display text-3xl font-semibold">Private testing terms</h1></header>
    <p>This deployment is for invited private testing. Accounts, content and configuration may change or be reset during development. Features are still being tested; keep independent copies of anything you want to retain.</p>
    <section><h2 className="mb-2 text-lg font-semibold">Participation</h2><p>Use an account you control. Only upload content you have permission to share. Respect other testers and their privacy. Do not publish passwords, identity documents, personal addresses, threats, scams or unlawful content. See the <Link href="/legal/guidelines" className="text-accent-text hover:underline">community guidelines</Link>.</p></section>
    <section><h2 className="mb-2 text-lg font-semibold">Vehicles and events</h2><p>Vehicle specifications entered by members are self-reported unless an actual verification result is shown. Event organizers are responsible for their event details and permissions. Follow local traffic rules and the venue&apos;s requirements.</p></section>
    <section><h2 className="mb-2 text-lg font-semibold">Data and account controls</h2><p>Read the <Link href="/legal/privacy" className="text-accent-text hover:underline">test privacy draft</Link> before creating an account. You can export your data and delete your account in Settings.</p></section>
    <p className="text-muted">These are provisional test instructions. Operator details and reviewed public terms must be supplied before a public launch.</p>
  </article>;
}

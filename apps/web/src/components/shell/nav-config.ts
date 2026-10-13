import { Bell, CalendarDays, Car, Compass, Home, MessagesSquare, Settings, Users } from 'lucide-react';

export const PRIMARY_NAV = [
  { href: '/home', key: 'home', icon: Home },
  { href: '/discover', key: 'discover', icon: Compass },
  { href: '/crews', key: 'crews', icon: Users },
  { href: '/messages', key: 'messages', icon: MessagesSquare },
  { href: '/garage', key: 'garage', icon: Car },
  { href: '/events', key: 'events', icon: CalendarDays },
] as const;

export const SECONDARY_NAV = [
  { href: '/notifications', key: 'notifications', icon: Bell },
  { href: '/settings', key: 'settings', icon: Settings },
] as const;

export function isActive(pathname: string, href: string): boolean {
  if (href === '/home') return pathname === '/home';
  if (href === '/crews') return pathname.startsWith('/crews') || pathname.startsWith('/c/');
  return pathname === href || pathname.startsWith(`${href}/`);
}

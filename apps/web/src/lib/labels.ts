import type { AUTOMOTIVE_INTERESTS } from '@vogn/validation';

export const INTEREST_LABELS: Record<(typeof AUTOMOTIVE_INTERESTS)[number], string> = {
  jdm: 'JDM',
  euro: 'European',
  muscle: 'Muscle',
  supercars: 'Supercars',
  classics: 'Classics',
  offroad: 'Off-road',
  motorsport: 'Motorsport',
  drift: 'Drift',
  track_days: 'Track days',
  drag: 'Drag racing',
  rally: 'Rally',
  detailing: 'Detailing',
  car_audio: 'Car audio',
  stance: 'Stance',
  restomod: 'Restomod',
  ev: 'EV',
  photography: 'Photography',
  diy_wrenching: 'DIY wrenching',
  tuning: 'Tuning',
  car_meets: 'Car meets',
};

export const DRIVETRAIN_LABELS = { fwd: 'FWD', rwd: 'RWD', awd: 'AWD', '4wd': '4WD', other: 'Other' } as const;
export const TRANSMISSION_LABELS = {
  manual: 'Manual',
  automatic: 'Automatic',
  dct: 'Dual-clutch',
  cvt: 'CVT',
  sequential: 'Sequential',
  other: 'Other',
} as const;
export const FUEL_LABELS = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  hybrid: 'Hybrid',
  plugin_hybrid: 'Plug-in hybrid',
  electric: 'Electric',
  hydrogen: 'Hydrogen',
  other: 'Other',
} as const;
export const ASPIRATION_LABELS = {
  natural: 'Naturally aspirated',
  turbo: 'Turbocharged',
  twin_turbo: 'Twin-turbo',
  supercharged: 'Supercharged',
  electric: 'Electric',
  other: 'Other',
} as const;

export const BUILD_KIND_LABELS = {
  update: 'Update',
  modification: 'Modification',
  milestone: 'Milestone',
  maintenance: 'Maintenance',
  dyno: 'Dyno',
  event: 'Event',
  purchase: 'Purchase',
} as const;

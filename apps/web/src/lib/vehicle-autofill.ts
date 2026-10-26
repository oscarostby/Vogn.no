import type { OfficialVehicleData } from '@vogn/types';
import type { VehicleCreateInput } from '@vogn/validation';

/** Lookup fills editable owner-reported fields; it does not grant verification badges. */
export function vehicleAutofill(data: OfficialVehicleData): Partial<VehicleCreateInput> {
  const year = data.modelYear ?? (data.firstRegistration ? Number(data.firstRegistration.slice(0, 4)) : null);
  const patch: Partial<VehicleCreateInput> = { specs: {} };
  if (data.make) patch.make = data.make.slice(0, 40);
  if (data.model) patch.model = data.model.slice(0, 60);
  if (data.color) patch.color = data.color.slice(0, 40);
  if (year && year >= 1886 && year <= new Date().getFullYear() + 2) patch.year = year;
  if (data.engine) patch.specs!.engine = data.engine.slice(0, 80);
  if (data.displacementCc && data.displacementCc >= 50 && data.displacementCc <= 20_000) patch.specs!.displacementCc = data.displacementCc;
  if (data.weightKg && data.weightKg >= 100 && data.weightKg <= 20_000) patch.specs!.weightKg = data.weightKg;
  if (data.powerKw && data.powerKw > 0) {
    const hp = Math.round(data.powerKw * 1.3596216173);
    if (hp <= 5_000) patch.specs!.originalHp = hp;
  }
  if (data.fuel && ['petrol', 'diesel', 'hybrid', 'plugin_hybrid', 'electric', 'hydrogen', 'other'].includes(data.fuel)) patch.specs!.fuel = data.fuel as NonNullable<VehicleCreateInput['specs']>['fuel'];
  if (data.gearbox && ['manual', 'automatic', 'dct', 'cvt', 'sequential', 'other'].includes(data.gearbox)) patch.transmission = data.gearbox as VehicleCreateInput['transmission'];
  if (data.drivetrain && ['fwd', 'rwd', 'awd', '4wd', 'other'].includes(data.drivetrain)) patch.drivetrain = data.drivetrain as VehicleCreateInput['drivetrain'];
  return patch;
}

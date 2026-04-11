/**
 * Returns true if this vehicle has a supported Blueprint schematic.
 * Currently only 2008–2012 Honda Accord (K24 engine) is supported.
 * Add entries here as new vehicles are supported.
 */
export function isBlueprintSupported(vehicle: {
  make?: string;
  model?: string;
  year?: number;
}): boolean {
  const make = vehicle.make?.toLowerCase() ?? '';
  const model = vehicle.model?.toLowerCase() ?? '';
  const year = vehicle.year ?? 0;

  if (make === 'honda' && model.includes('accord') && year >= 2008 && year <= 2012) {
    return true;
  }

  return false;
}

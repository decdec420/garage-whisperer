/**
 * Manufacturer-recommended service intervals by category.
 * Used to auto-populate vehicle_service_schedules when a vehicle is added.
 */

export interface ServiceTemplate {
  service_name: string;
  interval_miles: number | null;
  interval_months: number | null;
  priority: 'critical' | 'high' | 'normal' | 'low';
  category: string;
  notes?: string;
}

// Universal schedules that apply to virtually every ICE vehicle
const UNIVERSAL_SCHEDULES: ServiceTemplate[] = [
  { service_name: 'Oil & Filter Change', interval_miles: 5000, interval_months: 6, priority: 'critical', category: 'fluids', notes: 'Synthetic oil may extend to 7,500–10,000 mi' },
  { service_name: 'Tire Rotation', interval_miles: 7500, interval_months: 6, priority: 'high', category: 'tires' },
  { service_name: 'Engine Air Filter', interval_miles: 30000, interval_months: 36, priority: 'normal', category: 'filters' },
  { service_name: 'Cabin Air Filter', interval_miles: 20000, interval_months: 24, priority: 'low', category: 'filters' },
  { service_name: 'Brake Fluid Flush', interval_miles: 30000, interval_months: 36, priority: 'high', category: 'fluids' },
  { service_name: 'Coolant Flush', interval_miles: 50000, interval_months: 60, priority: 'high', category: 'fluids' },
  { service_name: 'Transmission Fluid', interval_miles: 60000, interval_months: 60, priority: 'high', category: 'fluids', notes: 'CVTs may differ — check owner's manual' },
  { service_name: 'Spark Plugs', interval_miles: 60000, interval_months: 72, priority: 'normal', category: 'ignition', notes: 'Iridium/Platinum plugs may last 100k mi' },
  { service_name: 'Serpentine Belt', interval_miles: 60000, interval_months: 60, priority: 'normal', category: 'general' },
  { service_name: 'Battery Inspection', interval_miles: null, interval_months: 12, priority: 'normal', category: 'electrical' },
  { service_name: 'Brake Pads Inspection', interval_miles: 25000, interval_months: 12, priority: 'high', category: 'brakes' },
  { service_name: 'Wiper Blades', interval_miles: null, interval_months: 12, priority: 'low', category: 'general' },
];

// Additional schedules for AWD/4WD vehicles
const AWD_4WD_SCHEDULES: ServiceTemplate[] = [
  { service_name: 'Transfer Case Fluid', interval_miles: 60000, interval_months: 60, priority: 'high', category: 'drivetrain' },
  { service_name: 'Differential Fluid (Front)', interval_miles: 50000, interval_months: 60, priority: 'high', category: 'drivetrain' },
  { service_name: 'Differential Fluid (Rear)', interval_miles: 50000, interval_months: 60, priority: 'high', category: 'drivetrain' },
];

// Timing belt — only for interference engines / belt-driven
const TIMING_BELT: ServiceTemplate = {
  service_name: 'Timing Belt & Water Pump',
  interval_miles: 90000,
  interval_months: 84,
  priority: 'critical',
  category: 'general',
  notes: 'Critical — interference engine failure risk if belt breaks',
};

// Makes that commonly use timing belts (many models, not all)
const TIMING_BELT_MAKES = ['HONDA', 'TOYOTA', 'SUBARU', 'MITSUBISHI', 'HYUNDAI', 'KIA'];

// High-mileage extras
const HIGH_MILEAGE_SCHEDULES: ServiceTemplate[] = [
  { service_name: 'Power Steering Fluid', interval_miles: 75000, interval_months: 72, priority: 'normal', category: 'fluids' },
  { service_name: 'Wheel Bearing Inspection', interval_miles: 75000, interval_months: 72, priority: 'normal', category: 'general' },
];

/**
 * Generates the recommended service schedule templates for a vehicle.
 */
export function getServiceTemplatesForVehicle(vehicle: {
  make: string;
  drivetrain?: string | null;
  mileage?: number | null;
  engine?: string | null;
}): ServiceTemplate[] {
  const templates = [...UNIVERSAL_SCHEDULES];

  // AWD/4WD get drivetrain fluid services
  const dt = vehicle.drivetrain?.toUpperCase() || '';
  if (dt.includes('AWD') || dt.includes('4WD') || dt.includes('4X4')) {
    templates.push(...AWD_4WD_SCHEDULES);
  }

  // Timing belt for relevant makes (simplified heuristic)
  if (TIMING_BELT_MAKES.includes(vehicle.make.toUpperCase())) {
    templates.push(TIMING_BELT);
  }

  // High-mileage vehicles get extra checks
  if (vehicle.mileage && vehicle.mileage > 75000) {
    templates.push(...HIGH_MILEAGE_SCHEDULES);
  }

  return templates;
}

/**
 * Given a service schedule and the last time it was performed,
 * determine its status.
 */
export function getServiceStatus(
  schedule: { interval_miles: number | null; interval_months: number | null },
  lastPerformed: { date: string | null; mileage: number | null } | null,
  currentMileage: number | null,
): 'overdue' | 'due_soon' | 'ok' | 'unknown' {
  if (!lastPerformed) return 'unknown'; // Never performed — flag it

  const now = new Date();

  // Check time-based
  if (schedule.interval_months && lastPerformed.date) {
    const lastDate = new Date(lastPerformed.date);
    const dueDate = new Date(lastDate);
    dueDate.setMonth(dueDate.getMonth() + schedule.interval_months);
    const warningDate = new Date(dueDate);
    warningDate.setMonth(warningDate.getMonth() - 1); // 1 month warning

    if (now > dueDate) return 'overdue';
    if (now > warningDate) return 'due_soon';
  }

  // Check mileage-based
  if (schedule.interval_miles && lastPerformed.mileage != null && currentMileage != null) {
    const dueMileage = lastPerformed.mileage + schedule.interval_miles;
    const warningMileage = dueMileage - Math.round(schedule.interval_miles * 0.1); // 10% warning

    if (currentMileage >= dueMileage) return 'overdue';
    if (currentMileage >= warningMileage) return 'due_soon';
  }

  return 'ok';
}

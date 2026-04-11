import { describe, it, expect } from 'vitest';
import { isBlueprintSupported } from '@/lib/blueprint-support';

describe('isBlueprintSupported', () => {
  // Supported vehicles
  it('returns true for 2008 Honda Accord', () => {
    expect(isBlueprintSupported({ make: 'Honda', model: 'Accord', year: 2008 })).toBe(true);
  });

  it('returns true for 2012 Honda Accord', () => {
    expect(isBlueprintSupported({ make: 'Honda', model: 'Accord', year: 2012 })).toBe(true);
  });

  it('is case-insensitive for make and model', () => {
    expect(isBlueprintSupported({ make: 'HONDA', model: 'ACCORD', year: 2010 })).toBe(true);
    expect(isBlueprintSupported({ make: 'honda', model: 'accord', year: 2010 })).toBe(true);
  });

  // Unsupported — wrong year range
  it('returns false for 2007 Honda Accord (too old)', () => {
    expect(isBlueprintSupported({ make: 'Honda', model: 'Accord', year: 2007 })).toBe(false);
  });

  it('returns false for 2013 Honda Accord (too new)', () => {
    expect(isBlueprintSupported({ make: 'Honda', model: 'Accord', year: 2013 })).toBe(false);
  });

  // Unsupported — wrong make/model
  it('returns false for Toyota Camry', () => {
    expect(isBlueprintSupported({ make: 'Toyota', model: 'Camry', year: 2010 })).toBe(false);
  });

  it('returns false for Honda Civic', () => {
    expect(isBlueprintSupported({ make: 'Honda', model: 'Civic', year: 2010 })).toBe(false);
  });

  it('returns false for Ford F-150', () => {
    expect(isBlueprintSupported({ make: 'Ford', model: 'F-150', year: 2010 })).toBe(false);
  });

  // Edge cases
  it('returns false when make is missing', () => {
    expect(isBlueprintSupported({ model: 'Accord', year: 2010 })).toBe(false);
  });

  it('returns false when year is missing', () => {
    expect(isBlueprintSupported({ make: 'Honda', model: 'Accord' })).toBe(false);
  });
});

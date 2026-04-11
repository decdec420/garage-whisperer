import { describe, it, expect } from 'vitest';
import {
  titleCaseMake,
  matchJobKeyword,
  buildCharmUrls,
  buildCharmUrl,
  componentToJobKeyword,
} from '@/lib/charm-url';

// ─── titleCaseMake ─────────────────────────────────────────────────────────
describe('titleCaseMake', () => {
  it('title-cases a lowercase make', () => {
    expect(titleCaseMake('honda')).toBe('Honda');
  });
  it('title-cases an uppercase make', () => {
    expect(titleCaseMake('TOYOTA')).toBe('Toyota');
  });
  it('preserves short makes (≤3 chars) as uppercase', () => {
    expect(titleCaseMake('bmw')).toBe('BMW');
    expect(titleCaseMake('gmc')).toBe('GMC');
    expect(titleCaseMake('BMW')).toBe('BMW');
  });
  it('handles mixed case', () => {
    expect(titleCaseMake('fOrD')).toBe('Ford');
  });
});

// ─── matchJobKeyword ────────────────────────────────────────────────────────
describe('matchJobKeyword', () => {
  it('returns null for unknown job', () => {
    expect(matchJobKeyword('replace flux capacitor')).toBeNull();
  });
  it('matches spark plugs', () => {
    const result = matchJobKeyword('change the spark plugs');
    expect(typeof result === 'string' ? result : result?.[0]).toContain('Spark%20Plug');
  });
  it('returns array for brake pads (front + rear)', () => {
    const result = matchJobKeyword('replace brake pads');
    expect(Array.isArray(result)).toBe(true);
    expect((result as string[]).length).toBe(2);
  });
  it('prefers more specific match: front brake pad over brake pad', () => {
    const result = matchJobKeyword('replace front brake pad');
    // front brake pad (14 chars) beats brake pad (9 chars) — returns a string (single path)
    expect(typeof result).toBe('string');
    expect(result as string).toContain('Front');
  });
  it('matches alternator', () => {
    const result = matchJobKeyword('replace the alternator');
    expect(result).toContain('Alternator');
  });
  it('is case-insensitive', () => {
    const result = matchJobKeyword('SPARK PLUGS');
    expect(result).not.toBeNull();
  });
});

// ─── buildCharmUrls ─────────────────────────────────────────────────────────
describe('buildCharmUrls', () => {
  const accord = { make: 'Honda', year: 2012, model: 'Accord', engine: '2.4L I4' };

  it('returns empty array for out-of-range year (too new)', () => {
    expect(buildCharmUrls({ ...accord, year: 2020 }, 'replace spark plugs')).toEqual([]);
  });
  it('returns empty array for out-of-range year (too old)', () => {
    expect(buildCharmUrls({ ...accord, year: 1981 }, 'replace spark plugs')).toEqual([]);
  });
  it('returns empty array for unknown job', () => {
    expect(buildCharmUrls(accord, 'replace flux capacitor')).toEqual([]);
  });
  it('returns a valid charm.li URL for a known job', () => {
    const urls = buildCharmUrls(accord, 'replace the spark plugs');
    expect(urls.length).toBeGreaterThan(0);
    expect(urls[0]).toMatch(/^https:\/\/charm\.li\/Honda\/2012\//);
    expect(urls[0]).toContain('Spark%20Plug');
  });
  it('returns two URLs for brake pads (front + rear)', () => {
    const urls = buildCharmUrls(accord, 'replace brake pads');
    expect(urls.length).toBe(2);
    expect(urls[0]).toContain('Front');
    expect(urls[1]).toContain('Rear');
  });
  it('encodes model name with engine in URL', () => {
    const urls = buildCharmUrls(accord, 'replace the alternator');
    // engine "2.4L I4" → "Accord L4-2.4L" → encoded
    expect(urls[0]).toContain('Accord%20L4-2.4L');
  });
  it('falls back gracefully when engine is null', () => {
    const urls = buildCharmUrls({ ...accord, engine: null }, 'replace the alternator');
    expect(urls.length).toBeGreaterThan(0);
    expect(urls[0]).toContain('Accord');
  });
});

// ─── buildCharmUrl (deprecated) ─────────────────────────────────────────────
describe('buildCharmUrl', () => {
  it('returns first URL for a single-path job', () => {
    const url = buildCharmUrl({ make: 'Honda', year: 2012, model: 'Accord' }, 'replace alternator');
    expect(url).not.toBeNull();
    expect(url).toContain('charm.li');
  });
  it('returns null for unknown job', () => {
    expect(buildCharmUrl({ make: 'Honda', year: 2012, model: 'Accord' }, 'fix windshield wiper')).toBeNull();
  });
});

// ─── componentToJobKeyword ──────────────────────────────────────────────────
describe('componentToJobKeyword', () => {
  it('maps VTC Actuator', () => {
    expect(componentToJobKeyword('VTC Actuator')).toBe('vtc actuator');
  });
  it('maps Valve Cover + Gasket', () => {
    expect(componentToJobKeyword('Valve Cover + Gasket')).toBe('valve cover gasket');
  });
  it('maps AC Compressor', () => {
    expect(componentToJobKeyword('AC Compressor')).toBe('ac compressor');
  });
  it('maps Stabilizer Bar Link to sway bar', () => {
    expect(componentToJobKeyword('Stabilizer Bar Link')).toBe('sway bar');
  });
  it('maps Motor Mounts to engine mount', () => {
    expect(componentToJobKeyword('Motor Mounts')).toBe('engine mount');
  });
  it('maps Spark Plug (×4) to spark plugs', () => {
    expect(componentToJobKeyword('Fuel Injectors (×4)')).toBe('fuel injector');
  });
  it('falls back to lowercase component name for unknown components', () => {
    expect(componentToJobKeyword('Widget Assembly')).toBe('widget assembly');
  });
  it('is case-insensitive in input', () => {
    expect(componentToJobKeyword('TIMING CHAIN + TENSIONER')).toBe('timing chain');
  });
  it('maps Brake Pad correctly', () => {
    expect(componentToJobKeyword('Front Brake Pad')).toBe('brake pads');
  });
  it('maps Serpentine Belt to serpentine belt', () => {
    expect(componentToJobKeyword('Serpentine Belt')).toBe('serpentine belt');
  });
});

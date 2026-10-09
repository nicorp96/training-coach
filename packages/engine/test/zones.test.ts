import { describe, expect, it } from 'vitest';
import { emptyThresholds, parsePace, speedFromPace } from '@tc/core';
import { formatZone, hrZones, paceZones, powerZones, wattsPerKg, zonesFor } from '../src/zones';

describe('powerZones', () => {
  it('builds 7 contiguous Coggan zones from FTP', () => {
    const z = powerZones(250);
    expect(z.map((x) => [x.lo, x.hi])).toEqual([
      [null, 139], [140, 189], [190, 227], [228, 264], [265, 302], [303, 377], [378, null],
    ]);
    expect(formatZone(z[1]!, 'power')).toBe('140–189 W');
    expect(formatZone(z[0]!, 'power')).toBe('≤ 139 W');
    expect(formatZone(z[6]!, 'power')).toBe('≥ 378 W');
  });
});

describe('hrZones', () => {
  it('prefers threshold HR (Friel)', () => {
    const r = hrZones({ lthr: 170, maxHr: 190 })!;
    expect(r.basis).toBe('lthr');
    expect(r.zones.map((x) => [x.lo, x.hi])).toEqual([[null, 144], [145, 152], [153, 161], [162, 169], [170, null]]);
  });

  it('falls back to max HR', () => {
    const r = hrZones({ lthr: null, maxHr: 200 })!;
    expect(r.basis).toBe('maxHr');
    expect(r.zones[1]).toMatchObject({ lo: 120, hi: 139 });
  });

  it('returns null without HR data', () => {
    expect(hrZones({ lthr: null, maxHr: null })).toBeNull();
  });
});

describe('paceZones', () => {
  it('derives pace zones from threshold speed, fast end first', () => {
    const z = paceZones(speedFromPace(parsePace('5:00')!)); // 300 s/km
    expect(z.map((x) => [x.lo, x.hi])).toEqual([[387, null], [342, 387], [318, 342], [300, 318], [null, 300]]);
    expect(formatZone(z[1]!, 'pace')).toBe('5:42–6:27 /km');
    expect(formatZone(z[0]!, 'pace')).toBe('slower than 6:27 /km');
    expect(formatZone(z[4]!, 'pace')).toBe('faster than 5:00 /km');
  });
});

describe('zonesFor / wattsPerKg', () => {
  it('only returns zones whose inputs are set', () => {
    const t = { ...emptyThresholds(), ftp: 200 };
    const z = zonesFor(t);
    expect(z.power).toHaveLength(7);
    expect(z.hr).toBeNull();
    expect(z.pace).toBeNull();
  });

  it('computes W/kg', () => {
    expect(wattsPerKg({ ftp: 250, weight: 72 })).toBe(3.47);
    expect(wattsPerKg({ ftp: 250, weight: null })).toBeNull();
  });
});

describe('parsePace', () => {
  it.each([['4:30', 270], ['4.05', 245], [' 10:00 ', 600], ['4:7', null], ['abc', null]])('%s → %s', (s, v) => {
    expect(parsePace(s)).toBe(v);
  });
});

import { describe, expect, test } from 'vitest';
import { pathKind, streetProfile } from './streetProfile';

describe('streetProfile', () => {
  test('reads the path kind from the segment notes', () => {
    expect(pathKind({ notes: 'Residential street: SS 15/8A Road' })).toBe('residential street');
    expect(pathKind({ notes: 'Footpath (covered)' })).toBe('footpath');
    expect(pathKind({})).toBe('');
  });

  test('trees beside a footpath stand just off its edge, and a walkway covers the path itself', () => {
    const profile = streetProfile({ notes: 'Footpath', widthM: 1.8 });
    expect(profile.clearanceM).toBeCloseTo(0.9);
    expect(profile.treeOffsetM).toBeGreaterThan(profile.clearanceM);
    expect(profile.walkwayOffsetM).toBe(0);
  });

  test('trees and walkways beside a road sit past the carriageway', () => {
    const residential = streetProfile({ notes: 'Residential street: SS 15/4 Road', widthM: 2.5 });
    const main = streetProfile({ notes: 'Main road: Jengka Avenue', widthM: 2 });
    expect(residential.treeOffsetM).toBeGreaterThan(residential.clearanceM);
    expect(residential.walkwayOffsetM).toBeGreaterThan(residential.treeOffsetM);
    expect(main.clearanceM).toBeGreaterThan(residential.clearanceM);
  });
});

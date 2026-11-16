import { describe, expect, test } from 'vitest';
import { ComboTable } from '../../../../src/core/combo/ComboTable.js';

describe('ComboTable (indexOf)', () => {
  test('GIVEN every pair of distinct cards WHEN indexed THEN each index is unique and maps back to its cards', () => {
    const seen = new Set<number>();
    for (let a = 0; a < 52; a++) {
      for (let b = a + 1; b < 52; b++) {
        const index = ComboTable.indexOf(a, b);
        expect(ComboTable.indexOf(b, a)).toBe(index);
        expect(ComboTable.first[index]).toBe(a);
        expect(ComboTable.second[index]).toBe(b);
        seen.add(index);
      }
    }
    expect(seen.size).toBe(ComboTable.SIZE);
    expect(Math.max(...seen)).toBe(ComboTable.SIZE - 1);
  });
});

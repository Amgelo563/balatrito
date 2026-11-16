import { describe, expect, test } from 'vitest';
import { hasDraw } from '../../../../src/core/util/hasDraw.js';
import { parseCardIndices } from '../../../util/parseCardIndices.js';

describe('hasDraw', () => {
  test('GIVEN four cards of a suit WHEN checked THEN it is a draw', () => {
    expect(hasDraw(parseCardIndices('Ah 7h 2h Kh 9c'))).toBe(true);
  });

  test('GIVEN four ranks in a row, including the wheel WHEN checked THEN it is a draw', () => {
    expect(hasDraw(parseCardIndices('8c 9d Th Js 2c'))).toBe(true);
    expect(hasDraw(parseCardIndices('Ac 2d 3h 4s 9c'))).toBe(true);
  });

  test('GIVEN scattered cards WHEN checked THEN it is not a draw', () => {
    expect(hasDraw(parseCardIndices('Ac 7d 2h Js 9c'))).toBe(false);
  });
});

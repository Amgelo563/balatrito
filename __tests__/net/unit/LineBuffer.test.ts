import { describe, expect, test } from 'vitest';
import { LineBuffer } from '../../../src/net/LineBuffer.js';

describe('LineBuffer (push)', () => {
  test('GIVEN a line split across chunks WHEN pushed THEN it is returned once complete', () => {
    const buffer = LineBuffer.create();
    expect(buffer.push('{"tipo":"est')).toEqual([]);
    expect(buffer.push('ado"}\n{"tipo":"a"}\n{"ti')).toEqual([
      '{"tipo":"estado"}',
      '{"tipo":"a"}',
    ]);
    expect(buffer.push('po":"b"}\r\n')).toEqual(['{"tipo":"b"}']);
  });

  test('GIVEN a partial line WHEN reset THEN it is dropped', () => {
    const buffer = LineBuffer.create();
    buffer.push('half');
    expect(buffer.reset().push('{"x":1}\n')).toEqual(['{"x":1}']);
  });
});

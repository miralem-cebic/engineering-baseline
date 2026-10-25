import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseJsonc } from '../src/jsonc.js';

describe('parseJsonc', () => {
  it('parses plain JSON', () => {
    assert.deepEqual(parseJsonc('{"a":1,"b":[true,null]}'), { ok: true, value: { a: 1, b: [true, null] } });
  });

  it('ignores line and block comments', () => {
    const text = '{\n  // line\n  "a": 1, /* block */ "b": 2\n}';
    assert.deepEqual(parseJsonc(text), { ok: true, value: { a: 1, b: 2 } });
  });

  it('keeps comment markers inside strings', () => {
    const result = parseJsonc('{"url":"http://x/*y*/","c":"// not a comment"}');
    assert.deepEqual(result, { ok: true, value: { url: 'http://x/*y*/', c: '// not a comment' } });
  });

  it('handles escaped quotes inside strings', () => {
    assert.deepEqual(parseJsonc('{"a":"say \\"hi\\" // ok"}'), { ok: true, value: { a: 'say "hi" // ok' } });
  });

  it('accepts trailing commas', () => {
    assert.deepEqual(parseJsonc('{"a":[1,2,],}'), { ok: true, value: { a: [1, 2] } });
  });

  it('strips a byte order mark', () => {
    assert.deepEqual(parseJsonc('﻿{"a":1}'), { ok: true, value: { a: 1 } });
  });

  it('reports invalid input as an error value, not an exception', () => {
    const result = parseJsonc('{"a":');
    assert.equal(result.ok, false);
  });
});

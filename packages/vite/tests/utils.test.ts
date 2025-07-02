import { describe, expect, test, vi } from 'vitest';
import * as utils from '../src/utils';

describe('utils', () => {
  test('getQuerySuffix returns query string', () => {
    expect(utils.getQuerySuffix('foo?bar=1')).toBe('?bar=1');
    expect(utils.getQuerySuffix('foo')).toBe('');
  });

  test('removeQuerySuffix removes query string', () => {
    expect(utils.removeQuerySuffix('foo?bar=1')).toBe('foo');
    expect(utils.removeQuerySuffix('foo')).toBe('foo');
  });

  test('escapeStringRegexp escapes special characters', () => {
    expect(utils.escapeStringRegexp('a.b*c')).toBe('a\\.b\\*c');
    expect(utils.escapeStringRegexp('abc')).toBe('abc');
  });

  test('createCachedImport caches promise result', async () => {
    const fn = vi.fn(async () => 42);
    const cached = utils.createCachedImport(fn);
    const result1 = await cached();
    const result2 = await cached();
    expect(result1).toBe(42);
    expect(result2).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('tryCatch returns data on success', async () => {
    const result = await utils.tryCatch(Promise.resolve('ok'));
    expect(result).toEqual({ data: 'ok', error: null });
  });

  test('tryCatch returns error on failure', async () => {
    const err = new Error('fail');
    const result = await utils.tryCatch(Promise.reject(err));
    expect(result.data).toBeNull();
    expect(result.error).toBe(err);
  });

  test('addDataQuery and parseDataQuery roundtrip', () => {
    const url = 'foo/bar.css';
    const data = { a: 1, b: 'test' };
    const withQuery = utils.addDataQuery(url, data);
    expect(withQuery).toMatch(/^foo\/bar\.css\?data=/);
    const parsed = utils.parseDataQuery(withQuery);
    expect(parsed).toEqual(data);
  });
});

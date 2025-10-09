import { z } from 'zod';
import { isZodError } from '../src/utils/isZodError';

describe('isZodError', () => {
  test('returns true for a real ZodError', () => {
    let caught: unknown;
    try {
      z.string().parse(123);
    } catch (e) {
      caught = e;
    }
    expect(isZodError(caught)).toBe(true);
  });

  test('returns false for a normal Error', () => {
    const err = new Error('normal');
    expect(isZodError(err)).toBe(false);
  });

  test('returns false for non-Error values', () => {
    expect(isZodError('not an error')).toBe(false);
    expect(isZodError({})).toBe(false);
    expect(isZodError(null)).toBe(false);
    expect(isZodError(undefined)).toBe(false);
  });

  test('returns true when constructor.name is "ZodError"', () => {
    let caught: unknown;
    try {
      z.string().parse(123);
    } catch (e) {
      caught = e;
    }
    expect((caught as any)?.constructor?.name).toBe("ZodError");
    expect(isZodError(caught)).toBe(true);
  });

  test('returns true when Error has an issues array', () => {
    const err = new Error('issues') as any;
    err.issues = [];
    expect(isZodError(err)).toBe(true);
  });
});

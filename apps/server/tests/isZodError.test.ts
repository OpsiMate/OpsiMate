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
});

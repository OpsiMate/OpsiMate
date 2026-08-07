import { describe, expect, test } from 'vitest';
import { toIsoUtc } from '../src/utils/time';

describe('toIsoUtc', () => {
  test('treats SQLite CURRENT_TIMESTAMP as UTC and returns Z suffix', () => {
    expect(toIsoUtc('2024-01-15 12:30:00')).toBe('2024-01-15T12:30:00.000Z');
  });

  test('canonicalises already-ISO values', () => {
    expect(toIsoUtc('2024-01-15T12:30:00.000Z')).toBe('2024-01-15T12:30:00.000Z');
  });

  test('returns empty string unchanged', () => {
    expect(toIsoUtc('')).toBe('');
  });

  test('returns unparseable input unchanged', () => {
    expect(toIsoUtc('not-a-date')).toBe('not-a-date');
  });
});

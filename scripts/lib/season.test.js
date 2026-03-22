import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCurrentSeason } from './season.js';

describe('getCurrentSeason', () => {
  it('returns current-year season before June', () => {
    assert.equal(getCurrentSeason(new Date('2026-01-15')), '2025-2026');
  });
  it('returns current-year season in May', () => {
    assert.equal(getCurrentSeason(new Date('2026-05-31')), '2025-2026');
  });
  it('returns next season from June onwards', () => {
    assert.equal(getCurrentSeason(new Date('2026-06-01')), '2026-2027');
  });
  it('returns next season in August', () => {
    assert.equal(getCurrentSeason(new Date('2026-08-20')), '2026-2027');
  });
});

// scripts/lib/categorize.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { categorizeEvent } from './categorize.js';

describe('categorizeEvent', () => {
  it('returns ehl for regular season game', () => {
    assert.equal(categorizeEvent({ strRound: 'Regular Season', dateEvent: '2025-11-15' }), 'ehl');
  });
  it('returns ehl-sluttspill for round containing playoff', () => {
    assert.equal(categorizeEvent({ strRound: 'Playoff Round 1', dateEvent: '2026-03-10' }), 'ehl-sluttspill');
  });
  it('returns ehl-sluttspill for quarterfinal', () => {
    assert.equal(categorizeEvent({ strRound: 'Quarterfinal', dateEvent: '2026-03-20' }), 'ehl-sluttspill');
  });
  it('returns ehl-sluttspill for semifinal', () => {
    assert.equal(categorizeEvent({ strRound: 'Semifinal', dateEvent: '2026-04-01' }), 'ehl-sluttspill');
  });
  it('returns ehl-sluttspill for final', () => {
    assert.equal(categorizeEvent({ strRound: 'Final', dateEvent: '2026-04-15' }), 'ehl-sluttspill');
  });
  it('is case-insensitive', () => {
    assert.equal(categorizeEvent({ strRound: 'PLAYOFF', dateEvent: '2026-03-05' }), 'ehl-sluttspill');
  });
  it('returns ehl-sluttspill for empty round after March 1', () => {
    assert.equal(categorizeEvent({ strRound: '', dateEvent: '2026-03-15' }), 'ehl-sluttspill');
  });
  it('returns ehl for empty round before March 1', () => {
    assert.equal(categorizeEvent({ strRound: '', dateEvent: '2026-02-28' }), 'ehl');
  });
  it('returns ehl for null round before March 1', () => {
    assert.equal(categorizeEvent({ strRound: null, dateEvent: '2025-12-01' }), 'ehl');
  });
});

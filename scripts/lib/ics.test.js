// scripts/lib/ics.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateIcs, formatDateTime, reminderTrigger } from './ics.js';

describe('formatDateTime', () => {
  it('formats UTC date correctly', () => {
    assert.equal(formatDateTime('2025-10-12', '17:00:00'), '20251012T170000Z');
  });
  it('pads single-digit month and day', () => {
    assert.equal(formatDateTime('2025-01-05', '09:00:00'), '20250105T090000Z');
  });
});

describe('reminderTrigger', () => {
  it('returns null for none', () => assert.equal(reminderTrigger('none'), null));
  it('returns -PT15M for 15m', () => assert.equal(reminderTrigger('15m'), '-PT15M'));
  it('returns -PT1H for 1h', () => assert.equal(reminderTrigger('1h'), '-PT1H'));
  it('returns -PT3H for 3h', () => assert.equal(reminderTrigger('3h'), '-PT3H'));
  it('returns -PT24H for 24h', () => assert.equal(reminderTrigger('24h'), '-PT24H'));
});

describe('generateIcs', () => {
  const events = [{
    idEvent: '123',
    strHomeTeam: 'Storhamar',
    strAwayTeam: 'Sparta',
    dateEvent: '2025-10-12',
    strTime: '17:00:00',
    strVenue: 'Hamar OL-Amfi',
    idHomeTeam: '133919',
    idAwayTeam: '133920',
  }];

  it('generates valid VCALENDAR with one event', () => {
    const ics = generateIcs(events, 'Storhamar', 'ehl', 'none', new Date('2026-03-22T06:00:00Z'));
    assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
    assert.ok(ics.includes('BEGIN:VEVENT'));
    assert.ok(ics.includes('SUMMARY:Storhamar vs Sparta'));
    assert.ok(ics.includes('DTSTART:20251012T170000Z'));
    assert.ok(ics.includes('DTEND:20251012T190000Z'));
    assert.ok(ics.includes('LOCATION:Hamar OL-Amfi'));
    assert.ok(ics.includes('UID:ehl-123@puckplan.no'));
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
    assert.ok(!ics.includes('VALARM'), 'no alarm for none');
  });

  it('includes VALARM when reminder is set', () => {
    const ics = generateIcs(events, 'Storhamar', 'ehl', '1h', new Date('2026-03-22T06:00:00Z'));
    assert.ok(ics.includes('BEGIN:VALARM'));
    assert.ok(ics.includes('TRIGGER:-PT1H'));
  });

  it('generates empty but valid VCALENDAR for empty events', () => {
    const ics = generateIcs([], 'Storhamar', 'chl', 'none', new Date('2026-03-22T06:00:00Z'));
    assert.ok(ics.includes('BEGIN:VCALENDAR'));
    assert.ok(!ics.includes('BEGIN:VEVENT'));
    assert.ok(ics.includes('END:VCALENDAR'));
  });

  it('filters events to only include games for the given team', () => {
    const mixed = [
      ...events,
      { idEvent: '999', strHomeTeam: 'Vålerenga', strAwayTeam: 'Sparta',
        dateEvent: '2025-10-15', strTime: '18:00:00', strVenue: 'Valle Hovin',
        idHomeTeam: '133920', idAwayTeam: '133921' }
    ];
    const ics = generateIcs(mixed, 'Storhamar', 'ehl', 'none', new Date('2026-03-22T06:00:00Z'));
    assert.ok(ics.includes('Storhamar vs Sparta'));
    assert.ok(!ics.includes('Vålerenga vs Sparta'));
  });
});

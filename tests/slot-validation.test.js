const { validateSlot, parseClinicDateTime } = require('../src/utils/booking-rules');

// Rule: future only, within working hours 09:00–17:00 (last slot STARTS 16:30),
// on a 30-minute boundary. Malformed input → 400; well-formed but breaking a rule → 422.

const NOW = '2026-12-01 08:00:00';
const DAY = '2026-12-02';

describe('validateSlot — valid slots', () => {
  test('09:00 (opening time) is accepted', () => {
    expect(validateSlot(`${DAY} 09:00`, NOW)).toEqual({ ok: true, value: `${DAY} 09:00:00` });
  });

  test('16:30 (last slot, ends at 17:00) is accepted', () => {
    expect(validateSlot(`${DAY} 16:30`, NOW).ok).toBe(true);
  });

  test('ISO "T" separator and explicit :00 seconds are accepted and normalised', () => {
    expect(validateSlot(`${DAY}T10:30:00`, NOW)).toEqual({ ok: true, value: `${DAY} 10:30:00` });
  });
});

describe('validateSlot — working hours and slot boundaries (422)', () => {
  test.each([
    ['17:00 exactly (closing time, slot would end 17:30)', '17:00'],
    ['08:30 (before opening)', '08:30'],
    ['23:00 (night)', '23:00'],
  ])('rejects %s', (_label, time) => {
    const result = validateSlot(`${DAY} ${time}`, NOW);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(422);
    expect(result.error).toMatch(/working hours/);
  });

  test.each([
    ['09:15', `${DAY} 09:15`],
    ['10:45', `${DAY} 10:45`],
    ['09:30:01 (seconds not zero)', `${DAY} 09:30:01`],
  ])('rejects %s (not on a 30-minute boundary)', (_label, input) => {
    const result = validateSlot(input, NOW);
    expect(result).toMatchObject({ ok: false, status: 422 });
    expect(result.error).toMatch(/30-minute boundary/);
  });
});

describe('validateSlot — future only (422)', () => {
  test('rejects a time in the past', () => {
    expect(validateSlot('2026-11-30 10:00', NOW)).toMatchObject({ ok: false, status: 422 });
  });

  test('rejects a slot starting exactly now', () => {
    expect(validateSlot('2026-12-01 09:00', '2026-12-01 09:00:00')).toMatchObject({ ok: false, status: 422 });
  });

  test('accepts the next slot one second from now', () => {
    expect(validateSlot('2026-12-01 09:30', '2026-12-01 09:29:59').ok).toBe(true);
  });
});

describe('validateSlot — malformed input (400)', () => {
  test.each([
    ['impossible date 2026-02-30', '2026-02-30 10:00'],
    ['hour 24', `${DAY} 24:00`],
    ['minute 60', `${DAY} 10:60`],
    ['date only', DAY],
    ['free text', 'tomorrow at 10'],
    ['empty string', ''],
    ['number instead of string', 1767600000000],
    ['null', null],
  ])('rejects %s', (_label, input) => {
    expect(validateSlot(input, NOW)).toMatchObject({ ok: false, status: 400 });
  });
});

describe('parseClinicDateTime', () => {
  test('accepts 29 February in a leap year and rejects it otherwise', () => {
    expect(parseClinicDateTime('2028-02-29 10:00')).not.toBeNull();
    expect(parseClinicDateTime('2027-02-29 10:00')).toBeNull();
  });
});

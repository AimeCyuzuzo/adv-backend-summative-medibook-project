const { calculateRefund } = require('../src/utils/booking-rules');

// Policy (documented in README.md):
//   more than 48h notice              → 100%
//   24h to 48h notice, both inclusive → 50%
//   less than 24h notice              → 0%
// `now` is passed in, so every case uses an exact, fixed time — no real clock, no DB.

const APPT = '2026-12-10 10:00:00';
const FEE = 150;

describe('calculateRefund — tiers', () => {
  test('more than 48 hours notice → 100% refund', () => {
    const result = calculateRefund(FEE, APPT, '2026-12-07 10:00:00'); // 72h
    expect(result).toEqual({ hoursNotice: 72, percent: 100, amount: 150 });
  });

  test('between 24 and 48 hours notice → 50% refund', () => {
    const result = calculateRefund(FEE, APPT, '2026-12-08 22:00:00'); // 36h
    expect(result).toEqual({ hoursNotice: 36, percent: 50, amount: 75 });
  });

  test('less than 24 hours notice → no refund', () => {
    const result = calculateRefund(FEE, APPT, '2026-12-10 08:00:00'); // 2h
    expect(result).toEqual({ hoursNotice: 2, percent: 0, amount: 0 });
  });
});

describe('calculateRefund — boundaries', () => {
  test('exactly 48 hours notice → 50% (48h is NOT "more than 48h")', () => {
    const result = calculateRefund(FEE, APPT, '2026-12-08 10:00:00');
    expect(result.hoursNotice).toBe(48);
    expect(result.percent).toBe(50);
    expect(result.amount).toBe(75);
  });

  test('one minute more than 48 hours → 100%', () => {
    expect(calculateRefund(FEE, APPT, '2026-12-08 09:59:00').percent).toBe(100);
  });

  test('exactly 24 hours notice → 50% (24h is inside the 24–48h tier)', () => {
    const result = calculateRefund(FEE, APPT, '2026-12-09 10:00:00');
    expect(result.hoursNotice).toBe(24);
    expect(result.percent).toBe(50);
    expect(result.amount).toBe(75);
  });

  test('one minute less than 24 hours → 0%', () => {
    expect(calculateRefund(FEE, APPT, '2026-12-09 10:01:00').percent).toBe(0);
  });
});

describe('calculateRefund — money', () => {
  test('rounds 50% of an odd amount to whole cents', () => {
    // 50% of 99.99 = 49.995 → 50.00 (rounded half up, in cents)
    expect(calculateRefund(99.99, APPT, '2026-12-08 22:00:00').amount).toBe(50);
  });

  test('works across a month boundary', () => {
    // 2026-11-30 10:00 → 2026-12-02 10:00 is exactly 48h
    expect(calculateRefund(FEE, '2026-12-02 10:00:00', '2026-11-30 10:00:00').percent).toBe(50);
  });
});

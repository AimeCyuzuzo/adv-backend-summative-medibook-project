const { parseId, isMoney } = require('../src/validators/common');
const { validatePatient } = require('../src/validators/patient.validator');
const { validateDoctor } = require('../src/validators/doctor.validator');
const { validateWaitlistJoin, isValidDate } = require('../src/validators/waitlist.validator');
const { toClinicDateTime } = require('../src/utils/clock');

describe('parseId', () => {
  test('accepts positive integer strings', () => {
    expect(parseId('42')).toBe(42);
  });

  test.each(['0', '-1', '1.5', 'abc', '1 OR 1=1', '', '99999999999999999999'])('rejects %p', (value) => {
    expect(parseId(value)).toBeNull();
  });
});

describe('isMoney', () => {
  test.each([0, 80, 150.5, 120.25])('accepts %p', (value) => expect(isMoney(value)).toBe(true));
  test.each([-1, 10.999, '150', NaN, Infinity, 100000000])('rejects %p', (value) => expect(isMoney(value)).toBe(false));
});

describe('validatePatient', () => {
  test('accepts a valid patient and normalises email', () => {
    const { errors, data } = validatePatient({ full_name: ' Ama Mensah ', email: 'AMA@Mail.com', phone: '0244-111-222' });
    expect(errors).toEqual([]);
    expect(data).toEqual({ full_name: 'Ama Mensah', email: 'ama@mail.com', phone: '0244-111-222' });
  });

  test('reports every problem at once, including unknown fields', () => {
    const { errors } = validatePatient({ full_name: '', email: 'nope', role: 'admin' });
    expect(errors).toHaveLength(4); // unknown field, name, email, phone
  });

  test('partial update (PATCH) only checks the fields sent', () => {
    expect(validatePatient({ phone: '0200000000' }, { partial: true }).errors).toEqual([]);
    expect(validatePatient({}, { partial: true }).errors).toEqual(['Provide at least one of: full_name, email, phone']);
  });
});

describe('validateDoctor', () => {
  test('rejects a fee sent as a string', () => {
    const { errors } = validateDoctor({ full_name: 'Dr. X', specialty: 'GP', consultation_fee: '150', room: 'R-1' });
    expect(errors).toEqual(['consultation_fee must be a number >= 0 with at most 2 decimal places']);
  });

  test('allows a fee of 0 in a partial update', () => {
    expect(validateDoctor({ consultation_fee: 0 }, { partial: true })).toEqual({ errors: [], data: { consultation_fee: 0 } });
  });
});

describe('validateWaitlistJoin', () => {
  const TODAY = '2026-12-01';

  test('accepts today and future dates', () => {
    expect(validateWaitlistJoin({ patient_id: 1, doctor_id: 2, date: TODAY }, TODAY).errors).toEqual([]);
  });

  test('rejects past and impossible dates', () => {
    expect(validateWaitlistJoin({ patient_id: 1, doctor_id: 2, date: '2026-11-30' }, TODAY).errors)
      .toEqual(['date must be today or in the future']);
    expect(isValidDate('2026-02-30')).toBe(false);
  });
});

describe('toClinicDateTime', () => {
  test('converts a UTC instant to Africa/Kigali time (UTC+2) in MySQL format', () => {
    const instant = new Date('2026-12-01T22:30:00Z');
    expect(toClinicDateTime(instant, 'Africa/Kigali')).toBe('2026-12-02 00:30:00');
  });
});

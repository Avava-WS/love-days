import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseISO,
  formatISO,
  daysBetween,
  daysTogether,
  nextSolarYearly,
  nextSolarOnce,
  weekdayCn,
  countdownText,
  isLeapYear,
  clampYearDay,
} from '../assets/dates.js';

test('parseISO 严格校验日期', () => {
  assert.deepEqual(parseISO('2024-02-29'), { y: 2024, m: 2, d: 29 });
  assert.equal(parseISO('2023-02-29'), null);
  assert.equal(parseISO('2026-13-01'), null);
  assert.equal(parseISO('2026-04-31'), null);
  assert.equal(parseISO('2026-1-1'), null);
  assert.equal(parseISO('1899-12-31'), null);
  assert.equal(parseISO(''), null);
});

test('formatISO 补零', () => {
  assert.equal(formatISO({ y: 2026, m: 2, d: 3 }), '2026-02-03');
});

test('isLeapYear 与 clampYearDay', () => {
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(1900), false);
  assert.equal(isLeapYear(2000), true);
  assert.deepEqual(clampYearDay(2025, 2, 29), { y: 2025, m: 2, d: 28 });
});

test('daysBetween 跨月、跨年、闰年', () => {
  assert.equal(daysBetween({ y: 2024, m: 2, d: 28 }, { y: 2024, m: 3, d: 1 }), 2);
  assert.equal(daysBetween({ y: 2024, m: 12, d: 31 }, { y: 2025, m: 1, d: 1 }), 1);
  assert.equal(daysBetween({ y: 2026, m: 10, d: 19 }, { y: 2026, m: 10, d: 19 }), 0);
  assert.equal(daysBetween({ y: 2026, m: 10, d: 20 }, { y: 2026, m: 10, d: 19 }), -1);
});

test('daysTogether 起始当天算第 1 天', () => {
  assert.equal(daysTogether({ y: 2026, m: 10, d: 19 }, { y: 2026, m: 10, d: 19 }), 1);
  assert.equal(daysTogether({ y: 2026, m: 10, d: 18 }, { y: 2026, m: 10, d: 19 }), 2);
  assert.equal(daysTogether({ y: 2026, m: 10, d: 20 }, { y: 2026, m: 10, d: 19 }), 0);
});

test('nextSolarYearly：今天、已过、跨年', () => {
  assert.deepEqual(nextSolarYearly(5, 20, { y: 2026, m: 5, d: 20 }), { y: 2026, m: 5, d: 20 });
  assert.deepEqual(nextSolarYearly(5, 20, { y: 2026, m: 5, d: 21 }), { y: 2027, m: 5, d: 20 });
  assert.deepEqual(nextSolarYearly(1, 1, { y: 2026, m: 12, d: 31 }), { y: 2027, m: 1, d: 1 });
  assert.deepEqual(nextSolarYearly(12, 31, { y: 2026, m: 12, d: 31 }), { y: 2026, m: 12, d: 31 });
});

test('nextSolarYearly：2 月 29 日平年按 28 日', () => {
  assert.deepEqual(nextSolarYearly(2, 29, { y: 2025, m: 1, d: 1 }), { y: 2025, m: 2, d: 28 });
  assert.deepEqual(nextSolarYearly(2, 29, { y: 2025, m: 3, d: 1 }), { y: 2026, m: 2, d: 28 });
  assert.deepEqual(nextSolarYearly(2, 29, { y: 2027, m: 12, d: 31 }), { y: 2028, m: 2, d: 29 });
});

test('nextSolarOnce：未来返回日期，过去返回 null', () => {
  assert.deepEqual(nextSolarOnce({ y: 2026, m: 10, d: 19 }, { y: 2026, m: 10, d: 19 }), {
    y: 2026,
    m: 10,
    d: 19,
  });
  assert.equal(nextSolarOnce({ y: 2026, m: 10, d: 18 }, { y: 2026, m: 10, d: 19 }), null);
});

test('weekdayCn 与 countdownText', () => {
  assert.equal(weekdayCn({ y: 2024, m: 2, d: 10 }), '星期六');
  assert.equal(countdownText(0), '就是今天');
  assert.equal(countdownText(3), '还有 3 天');
  assert.equal(countdownText(-2), '已过 2 天');
});

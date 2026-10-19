import test from 'node:test';
import assert from 'node:assert/strict';
import { solarToLunar, lunarLabel, nextLunarYearly, lunarMonthDays } from '../assets/lunar.js';

test('春节的公历日期能正确换算成正月初一', () => {
  const samples = ['2023-01-22', '2024-02-10', '2025-01-29', '2026-02-17'];
  for (const iso of samples) {
    const [y, m, d] = iso.split('-').map(Number);
    const lunar = solarToLunar({ y, m, d });
    assert.deepEqual(
      { year: lunar.lunarYear, month: lunar.month, day: lunar.day },
      { year: y, month: 1, day: 1 },
      iso,
    );
  }
});

test('中文农历标签', () => {
  assert.equal(lunarLabel(1, 1), '农历 正月初一');
  assert.equal(lunarLabel(8, 30), '农历 八月三十');
  assert.equal(lunarLabel(12, 29), '农历 腊月廿九');
});

test('nextLunarYearly：正月初一', () => {
  assert.deepEqual(nextLunarYearly(1, 1, { y: 2026, m: 1, d: 1 }), {
    solar: { y: 2026, m: 2, d: 17 },
    lunarYear: 2026,
    lunarMonth: 1,
    lunarDay: 1,
    clamped: false,
  });
  assert.deepEqual(nextLunarYearly(1, 1, { y: 2026, m: 2, d: 17 }), {
    solar: { y: 2026, m: 2, d: 17 },
    lunarYear: 2026,
    lunarMonth: 1,
    lunarDay: 1,
    clamped: false,
  });
});

test('nextLunarYearly：小月没有三十时按廿九', () => {
  assert.equal(lunarMonthDays(2025, 8), 29);
  assert.deepEqual(nextLunarYearly(8, 30, { y: 2025, m: 1, d: 1 }), {
    solar: { y: 2025, m: 10, d: 20 },
    lunarYear: 2025,
    lunarMonth: 8,
    lunarDay: 29,
    clamped: true,
  });
});

test('nextLunarYearly：大月保留三十', () => {
  assert.equal(lunarMonthDays(2024, 8), 30);
  assert.deepEqual(nextLunarYearly(8, 30, { y: 2024, m: 1, d: 1 }), {
    solar: { y: 2024, m: 10, d: 2 },
    lunarYear: 2024,
    lunarMonth: 8,
    lunarDay: 30,
    clamped: false,
  });
});

test('nextLunarYearly：腊月跨到下一个公历年', () => {
  assert.deepEqual(nextLunarYearly(12, 30, { y: 2026, m: 12, d: 31 }), {
    solar: { y: 2027, m: 2, d: 5 },
    lunarYear: 2026,
    lunarMonth: 12,
    lunarDay: 29,
    clamped: true,
  });
});

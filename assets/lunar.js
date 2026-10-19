// 农历换算：包装 vendored solarlunar（ISC，1900-2100）。
import solarLunar from './vendor/solarlunar.esm.js';
import { dayNumber } from './dates.js';

/** 公历 -> 农历；超出支持范围返回 null。 */
export function solarToLunar(parts) {
  const result = solarLunar.solar2lunar(parts.y, parts.m, parts.d);
  if (!result || result === -1) return null;
  return { lunarYear: result.lYear, month: result.lMonth, day: result.lDay, isLeap: result.isLeap };
}

/** “八月三十”“正月初一”这类中文标签。 */
export function lunarLabel(month, day) {
  return `农历 ${solarLunar.toChinaMonth(month)}${solarLunar.toChinaDay(day)}`;
}

export function lunarMonthName(month) {
  return solarLunar.toChinaMonth(month);
}

export function lunarDayName(day) {
  return solarLunar.toChinaDay(day);
}

export function lunarMonthDays(lunarYear, month) {
  try {
    return solarLunar.monthDays(lunarYear, month) || 0;
  } catch {
    return 0;
  }
}

/**
 * 农历每年纪念日的下一公历日期。
 * - 小月没有“三十”时按当月最后一天算；
 * - 闰月生日统一按普通月份处理（v1 约定）。
 * @returns {null | {solar: {y,m,d}, lunarYear: number, lunarMonth: number, lunarDay: number, clamped: boolean}}
 */
export function nextLunarYearly(month, day, today) {
  const base = solarToLunar(today);
  if (!base) return null;

  const target = dayNumber(today);
  for (let lunarYear = base.lunarYear - 1; lunarYear <= base.lunarYear + 3; lunarYear++) {
    const monthDays = lunarMonthDays(lunarYear, month);
    if (!monthDays) continue;

    const actualDay = Math.min(day, monthDays);
    let solar;
    try {
      solar = solarLunar.lunar2solar(lunarYear, month, actualDay);
    } catch {
      solar = -1;
    }
    if (!solar || solar === -1) continue;

    const candidate = { y: solar.cYear, m: solar.cMonth, d: solar.cDay };
    if (dayNumber(candidate) >= target) {
      return {
        solar: candidate,
        lunarYear,
        lunarMonth: month,
        lunarDay: actualDay,
        clamped: actualDay !== day,
      };
    }
  }
  return null;
}

// 把「纪念日数据」解析成具体的下一次（或已过去）公历日期。
import { parseISO, nextSolarYearly, daysBetween } from './dates.js';
import { nextLunarYearly } from './lunar.js';

/**
 * @returns {null | {solar: {y,m,d}, diff: number, status: 'upcoming'|'past', lunar?: object}}
 * diff 为距离今天的天数：0 = 今天，正数 = 未来，负数 = 已过去。
 */
export function occurrenceFor(event, today) {
  if (!event) return null;

  if (event.calendar === 'lunar') {
    const next = nextLunarYearly(event.lunar.month, event.lunar.day, today);
    if (!next) return null;
    return {
      solar: next.solar,
      diff: daysBetween(today, next.solar),
      status: 'upcoming',
      lunar: { month: next.lunarMonth, day: next.lunarDay, clamped: next.clamped },
    };
  }

  const anchor = parseISO(event.solarDate);
  if (!anchor) return null;

  if (event.repeat === 'once') {
    const diff = daysBetween(today, anchor);
    return { solar: anchor, diff, status: diff >= 0 ? 'upcoming' : 'past' };
  }

  const solar = nextSolarYearly(anchor.m, anchor.d, today);
  return { solar, diff: daysBetween(today, solar), status: 'upcoming' };
}

/** 即将到来的按天数升序在前，已过去的按最近过去在前。 */
export function sortByOccurrence(events, today) {
  return events
    .map((event) => ({ event, occurrence: occurrenceFor(event, today) }))
    .sort((a, b) => {
      const oa = a.occurrence;
      const ob = b.occurrence;
      if (!oa && !ob) return 0;
      if (!oa) return 1;
      if (!ob) return -1;
      const aPast = oa.status === 'past';
      const bPast = ob.status === 'past';
      if (aPast !== bPast) return aPast ? 1 : -1;
      if (aPast) return ob.diff - oa.diff; // 已过去：-1 比 -30 更近
      return oa.diff - ob.diff;
    });
}

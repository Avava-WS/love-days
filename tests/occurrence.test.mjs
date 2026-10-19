import test from 'node:test';
import assert from 'node:assert/strict';
import { occurrenceFor, sortByOccurrence } from '../assets/occurrence.js';

function solarEvent(overrides = {}) {
  return {
    id: 'evt_solar',
    title: '在一起',
    calendar: 'solar',
    solarDate: '2025-05-20',
    repeat: 'yearly',
    ...overrides,
  };
}

test('公历周年：已过、今天、未来', () => {
  assert.equal(occurrenceFor(solarEvent(), { y: 2026, m: 5, d: 21 }).diff, 364);
  assert.equal(occurrenceFor(solarEvent(), { y: 2026, m: 5, d: 20 }).diff, 0);
  assert.equal(occurrenceFor(solarEvent(), { y: 2026, m: 5, d: 19 }).diff, 1);
});

test('一次性纪念日：过期后状态为 past', () => {
  const event = solarEvent({ repeat: 'once', solarDate: '2025-01-01' });
  const result = occurrenceFor(event, { y: 2026, m: 10, d: 19 });
  assert.equal(result.status, 'past');
  assert.equal(result.diff, -656);
});

test('农历纪念日总会给出下一次', () => {
  const event = {
    id: 'evt_lunar',
    title: '她的生日',
    calendar: 'lunar',
    solarDate: null,
    lunar: { month: 1, day: 1 },
    repeat: 'yearly',
  };
  const result = occurrenceFor(event, { y: 2026, m: 10, d: 19 });
  assert.equal(result.status, 'upcoming');
  assert.deepEqual(result.lunar, { month: 1, day: 1, clamped: false });
  assert.deepEqual(result.solar, { y: 2027, m: 2, d: 6 });
});

test('排序：即将到来的在前且按天数升序，过去的按最近在前', () => {
  const today = { y: 2026, m: 10, d: 19 };
  const events = [
    solarEvent({ id: 'future30', title: '30 天后', repeat: 'once', solarDate: '2026-11-18' }),
    solarEvent({ id: 'past2', title: '已过 2 天', repeat: 'once', solarDate: '2026-10-17' }),
    solarEvent({ id: 'today', title: '今天', repeat: 'once', solarDate: '2026-10-19' }),
    solarEvent({ id: 'past10', title: '已过 10 天', repeat: 'once', solarDate: '2026-10-09' }),
  ];
  const sorted = sortByOccurrence(events, today).map((item) => item.event.id);
  assert.deepEqual(sorted, ['today', 'future30', 'past2', 'past10']);
});

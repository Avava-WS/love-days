// 日期工具：全部以本地日历日 (y, m, d) 计算。
// 天数差先归一化到 UTC，避免夏令时导致 ±1 天误差。

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const WEEKDAYS_CN = ['日', '一', '二', '三', '四', '五', '六'];

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y, m) {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** 严格解析 YYYY-MM-DD；非法或超出 1900-2100 返回 null。 */
export function parseISO(value) {
  if (typeof value !== 'string') return null;
  const match = ISO_RE.exec(value.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (y < 1900 || y > 2100 || m < 1 || m > 12) return null;
  if (d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

export function formatISO(parts) {
  return `${parts.y}-${pad2(parts.m)}-${pad2(parts.d)}`;
}

export function todayParts(now = new Date()) {
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

export function todayISO(now = new Date()) {
  return formatISO(todayParts(now));
}

/** 以 1970-01-01 为原点的“日序号”，只用于日期比较。 */
export function dayNumber(parts) {
  return Math.floor(Date.UTC(parts.y, parts.m - 1, parts.d) / 86400000);
}

export function daysBetween(from, to) {
  return dayNumber(to) - dayNumber(from);
}

/** 在一起第 N 天：起始当天算第 1 天。 */
export function daysTogether(start, today) {
  return daysBetween(start, today) + 1;
}

export function compareParts(a, b) {
  return dayNumber(a) - dayNumber(b);
}

/** 把日期夹到该年该月的合法范围（用于 2 月 29 日等边界）。 */
export function clampYearDay(y, m, d) {
  return { y, m, d: Math.min(d, daysInMonth(y, m)) };
}

/** 每年重复的公历纪念日：返回 >= today 的最近一次；2/29 在平年按 2/28。 */
export function nextSolarYearly(month, day, today) {
  const start = today.y;
  for (let y = start; y <= start + 1; y++) {
    const candidate = clampYearDay(y, month, day);
    if (compareParts(candidate, today) >= 0) return candidate;
  }
  // 理论上不会走到这里（次年同日一定 >= 今天），兜底防止死循环。
  return clampYearDay(start + 1, month, day);
}

/** 一次性公历日期：已过去返回 null。 */
export function nextSolarOnce(parts, today) {
  return compareParts(parts, today) >= 0 ? { ...parts } : null;
}

export function weekdayCn(parts) {
  const weekday = new Date(Date.UTC(parts.y, parts.m - 1, parts.d)).getUTCDay();
  return `星期${WEEKDAYS_CN[weekday]}`;
}

export function formatCN(parts) {
  return `${parts.y} 年 ${parts.m} 月 ${parts.d} 日`;
}

/** 倒计时文案：0 天为“就是今天”。 */
export function countdownText(diff) {
  if (diff === 0) return '就是今天';
  if (diff > 0) return `还有 ${diff} 天`;
  return `已过 ${-diff} 天`;
}

// 数据层：localStorage 持久化、校验、导入导出。
// 只依赖 dates.js，方便在 Node 里用内存 storage 做单元测试。
import { formatISO, parseISO } from './dates.js';

export const STORAGE_KEY = 'love-days.v1';
export const SCHEMA_VERSION = 1;
export const THEMES = ['blush', 'peach', 'lilac'];
export const MAX_EVENTS = 200;

const TITLE_MAX = 32;
const NOTE_MAX = 200;

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    settings: { herName: '', myName: '', startDate: '', theme: 'blush', updatedAt: 0 },
    events: [],
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 返回错误描述数组；空数组表示合法。用于严格导入校验。 */
export function validateEvent(event) {
  const errors = [];
  if (!isPlainObject(event)) return ['纪念日数据格式错误'];
  if (typeof event.id !== 'string' || !event.id) errors.push('缺少 id');
  if (typeof event.title !== 'string' || !event.title.trim()) errors.push('标题不能为空');
  if (!['solar', 'lunar'].includes(event.calendar)) errors.push('历法类型无效');
  if (!['yearly', 'once'].includes(event.repeat)) errors.push('重复类型无效');

  if (event.calendar === 'solar') {
    if (!parseISO(event.solarDate)) errors.push('公历日期无效');
  } else if (event.calendar === 'lunar') {
    const lunar = event.lunar;
    if (!isPlainObject(lunar)) {
      errors.push('缺少农历日期');
    } else {
      if (!Number.isInteger(lunar.month) || lunar.month < 1 || lunar.month > 12) errors.push('农历月份无效');
      if (!Number.isInteger(lunar.day) || lunar.day < 1 || lunar.day > 30) errors.push('农历日期无效');
    }
  }

  if (event.calendar === 'lunar' && event.repeat !== 'yearly') errors.push('农历纪念日只能每年重复');
  if (event.repeat === 'once' && event.calendar !== 'solar') errors.push('一次性纪念日只能使用公历');
  return errors;
}

function normalizeEvent(event) {
  const solar = event.calendar === 'solar' ? parseISO(event.solarDate) : null;
  return {
    id: event.id,
    title: event.title.trim().slice(0, TITLE_MAX),
    emoji: typeof event.emoji === 'string' && event.emoji ? event.emoji.slice(0, 8) : '💗',
    calendar: event.calendar,
    solarDate: solar ? formatISO(solar) : null,
    lunar: event.calendar === 'lunar' ? { month: event.lunar.month, day: event.lunar.day } : null,
    repeat: event.repeat,
    note: typeof event.note === 'string' ? event.note.trim().slice(0, NOTE_MAX) : '',
    createdAt: Number.isFinite(event.createdAt) ? event.createdAt : Date.now(),
    updatedAt: Number.isFinite(event.updatedAt) ? event.updatedAt : Date.now(),
  };
}

/** 宽容修复本地数据：丢弃无法修复的条目，不抛异常。 */
export function normalizeState(raw) {
  const state = defaultState();
  if (!isPlainObject(raw)) return state;

  const settings = isPlainObject(raw.settings) ? raw.settings : {};
  state.settings = {
    herName: typeof settings.herName === 'string' ? settings.herName.trim().slice(0, 20) : '',
    myName: typeof settings.myName === 'string' ? settings.myName.trim().slice(0, 20) : '',
    startDate: parseISO(settings.startDate) ? formatISO(parseISO(settings.startDate)) : '',
    theme: THEMES.includes(settings.theme) ? settings.theme : 'blush',
    updatedAt: Number.isFinite(settings.updatedAt) ? settings.updatedAt : 0,
  };

  if (Array.isArray(raw.events)) {
    const seenIds = new Set();
    state.events = raw.events
      .filter((event) => validateEvent(event).length === 0)
      .filter((event) => {
        if (seenIds.has(event.id)) return false;
        seenIds.add(event.id);
        return true;
      })
      .slice(0, MAX_EVENTS)
      .map(normalizeEvent);
  }
  return state;
}

/** 严格解析备份文件；任何一条非法都抛错，便于导入前提示。 */
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('文件不是有效的 JSON');
  }
  if (!isPlainObject(data)) throw new Error('备份文件格式不正确');
  if (Number(data.version) > SCHEMA_VERSION) throw new Error('备份来自更新版本，请先升级应用');
  if (!isPlainObject(data.settings)) throw new Error('备份缺少设置数据');
  if (!Array.isArray(data.events)) throw new Error('备份缺少纪念日列表');
  if (data.settings.startDate && !parseISO(data.settings.startDate)) {
    throw new Error('备份里的在一起日期无效');
  }

  const errors = [];
  const ids = new Set();
  data.events.forEach((event, index) => {
    const eventErrors = validateEvent(event);
    if (eventErrors.length) errors.push(`第 ${index + 1} 条：${eventErrors.join('，')}`);
    if (isPlainObject(event) && typeof event.id === 'string') {
      if (ids.has(event.id)) errors.push(`第 ${index + 1} 条：id 与前面的纪念日重复`);
      ids.add(event.id);
    }
  });
  if (errors.length) throw new Error(errors.join('；'));

  return { state: normalizeState(data), warnings: [] };
}

/**
 * 创建数据仓库。storage 需实现 getItem/setItem/removeItem（Node 测试可注入内存实现）。
 * 存储不可用时保留内存副本，当前会话仍可正常使用。
 */
export function createStore(storage = null) {
  const available = Boolean(
    storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function',
  );
  let memory = null;

  function readRaw() {
    if (available) {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (raw !== null && raw !== undefined) return raw;
      } catch {
        // 读失败时退回内存副本
      }
    }
    return memory;
  }

  function backupCorrupt(raw) {
    if (!available) return;
    try {
      storage.setItem(`${STORAGE_KEY}.corrupt.${Date.now()}`, raw);
    } catch {
      // 备份失败也不阻塞启动
    }
  }

  return {
    available,

    load() {
      const raw = readRaw();
      if (!raw) {
        return {
          state: defaultState(),
          warning: available ? '' : '当前浏览器无法保存数据，本次修改只在当前页面有效',
        };
      }
      try {
        const parsed = JSON.parse(raw);
        if (Number(parsed.version) > SCHEMA_VERSION) {
          return { state: defaultState(), warning: '本地数据来自更新版本，已按空数据启动' };
        }
        const state = normalizeState(parsed);
        const rawCount = Array.isArray(parsed.events) ? parsed.events.length : 0;
        const dropped = rawCount - state.events.length;
        return {
          state,
          warning: dropped > 0 ? `有 ${dropped} 条纪念日数据损坏，已跳过（原始数据仍保留在本机）` : '',
        };
      } catch {
        backupCorrupt(raw);
        return {
          state: defaultState(),
          warning: '本地数据读取失败，原始内容已备份；你可以导入之前的备份恢复',
        };
      }
    },

    save(state) {
      const next = {
        ...state,
        version: SCHEMA_VERSION,
        settings: { ...state.settings, updatedAt: Date.now() },
      };
      const text = JSON.stringify(next);
      memory = text;

      if (!available) return { ok: false, state: next, error: '当前浏览器无法保存数据，请手动导出备份' };
      try {
        storage.setItem(STORAGE_KEY, text);
        return { ok: true, state: next };
      } catch {
        return { ok: false, state: next, error: '保存失败：存储空间不足或被浏览器限制' };
      }
    },

    reset() {
      memory = null;
      if (!available) return { ok: false, error: '当前浏览器无法保存数据' };
      try {
        storage.removeItem(STORAGE_KEY);
        return { ok: true };
      } catch {
        return { ok: false, error: '清除失败，请刷新页面重试' };
      }
    },

    exportJSON(state) {
      return JSON.stringify({ ...state, version: SCHEMA_VERSION }, null, 2);
    },
  };
}

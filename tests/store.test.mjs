import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStore,
  defaultState,
  normalizeState,
  parseImport,
  STORAGE_KEY,
  SCHEMA_VERSION,
} from '../assets/store.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    keys: () => [...map.keys()],
  };
}

function sampleState() {
  return {
    version: SCHEMA_VERSION,
    settings: {
      herName: '小雨',
      myName: '阿泽',
      startDate: '2025-05-20',
      theme: 'peach',
      updatedAt: 0,
    },
    events: [
      {
        id: 'evt_1',
        title: '在一起',
        emoji: '💗',
        calendar: 'solar',
        solarDate: '2025-05-20',
        lunar: null,
        repeat: 'yearly',
        note: '',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'evt_2',
        title: '她的生日',
        emoji: '🎂',
        calendar: 'lunar',
        solarDate: null,
        lunar: { month: 8, day: 30 },
        repeat: 'yearly',
        note: '记得买花',
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  };
}

test('保存后能读回同样的设置与纪念日', () => {
  const store = createStore(memoryStorage());
  const saved = store.save(sampleState());
  assert.equal(saved.ok, true);

  const { state, warning } = store.load();
  assert.equal(warning, '');
  assert.equal(state.settings.herName, '小雨');
  assert.equal(state.settings.theme, 'peach');
  assert.equal(state.events.length, 2);
  assert.equal(state.events[1].lunar.day, 30);
  assert.ok(state.settings.updatedAt > 0);
});

test('normalizeState 丢弃非法条目并修复主题', () => {
  const state = normalizeState({
    version: 1,
    settings: { herName: ' 小雨 ', startDate: '2025/05/20', theme: 'unknown' },
    events: [
      { id: 'ok', title: '合法', calendar: 'solar', solarDate: '2025-01-01', repeat: 'once' },
      { id: 'bad', title: '', calendar: 'solar', solarDate: '2025-01-01', repeat: 'once' },
      { id: 'bad2', title: '农历一次性', calendar: 'lunar', lunar: { month: 1, day: 1 }, repeat: 'once' },
    ],
  });
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].title, '合法');
  assert.equal(state.settings.herName, '小雨');
  assert.equal(state.settings.startDate, '');
  assert.equal(state.settings.theme, 'blush');
});

test('normalizeState 对重复 id 只保留第一条', () => {
  const base = { title: '重复', calendar: 'solar', solarDate: '2025-01-01', repeat: 'once' };
  const state = normalizeState({
    version: 1,
    settings: {},
    events: [
      { ...base, id: 'same' },
      { ...base, id: 'same', title: '后一条' },
    ],
  });
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].title, '重复');
});

test('本地 JSON 损坏时备份原始内容并给提示', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{oops' });
  const store = createStore(storage);

  const { state, warning } = store.load();
  assert.equal(state.events.length, 0);
  assert.match(warning, /读取失败/);
  assert.ok(storage.keys().some((key) => key.startsWith(`${STORAGE_KEY}.corrupt.`)));
});

test('存储不可用时仍能在当前会话保存', () => {
  const store = createStore(null);
  const saved = store.save(sampleState());
  assert.equal(saved.ok, false);
  assert.match(saved.error, /无法保存/);

  const { state } = store.load();
  assert.equal(state.events.length, 2);
});

test('写入失败时保留内存数据并返回错误', () => {
  const storage = memoryStorage();
  storage.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  const store = createStore(storage);

  const saved = store.save(sampleState());
  assert.equal(saved.ok, false);
  assert.match(saved.error, /保存失败/);
  assert.equal(store.load().state.events.length, 2);
});

test('parseImport 接受合法备份', () => {
  const text = JSON.stringify(sampleState());
  const { state } = parseImport(text);
  assert.equal(state.settings.startDate, '2025-05-20');
  assert.equal(state.events.length, 2);
});

test('parseImport 拒绝损坏 / 不兼容的备份', () => {
  assert.throws(() => parseImport('not json'), /JSON/);

  const badTitle = sampleState();
  badTitle.events[0].title = '';
  assert.throws(() => parseImport(JSON.stringify(badTitle)), /标题不能为空/);

  const badStart = sampleState();
  badStart.settings.startDate = '2025-02-30';
  assert.throws(() => parseImport(JSON.stringify(badStart)), /在一起日期无效/);

  const newer = sampleState();
  newer.version = SCHEMA_VERSION + 1;
  assert.throws(() => parseImport(JSON.stringify(newer)), /更新版本/);

  const noEvents = sampleState();
  delete noEvents.events;
  assert.throws(() => parseImport(JSON.stringify(noEvents)), /纪念日列表/);

  const duplicate = sampleState();
  duplicate.events[1].id = duplicate.events[0].id;
  assert.throws(() => parseImport(JSON.stringify(duplicate)), /id 与前面的纪念日重复/);
});

test('reset 清空本地数据', () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  store.save(sampleState());
  assert.equal(store.reset().ok, true);
  assert.equal(store.load().state.events.length, 0);
});

test('defaultState 是可安全修改的空数据', () => {
  const a = defaultState();
  const b = defaultState();
  a.settings.startDate = '2025-01-01';
  assert.equal(b.settings.startDate, '');
});

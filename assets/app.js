// 我们的纪念日 · 应用入口（原生 ES Module，无构建步骤）
import {
  daysBetween,
  formatCN,
  formatISO,
  parseISO,
  todayISO,
  todayParts,
  weekdayCn,
  dayNumber,
} from './dates.js';
import { createStore, defaultState, parseImport } from './store.js';
import { occurrenceFor, sortByOccurrence } from './occurrence.js';
import { lunarLabel, lunarMonthName, lunarDayName } from './lunar.js';
import { createSyncAdapter } from './sync.js';

const appEl = document.getElementById('app');
const toastEl = document.getElementById('toast');

const store = createStore(safeStorage());
const sync = createSyncAdapter();

const EMOJIS = ['💗', '🎂', '🌹', '🎁', '✈️', '🏖️', '🍰', '💍', '🏠', '🐱', '🎬', '⭐'];
const THEMES = [
  { id: 'blush', name: '蜜桃粉' },
  { id: 'peach', name: '暖杏' },
  { id: 'lilac', name: '雾紫' },
];
const QUOTES = [
  '把普通的日子过成值得纪念的日子。',
  '今天也要好好喜欢她。',
  '日子很长，喜欢要慢慢说。',
  '被你记住的小事，都会发光。',
  '一起吃饭、散步、发呆，都算数。',
  '愿每一个「今天」都值得被保存。',
  '不赶时间，我们慢慢来。',
  '爱意藏在每一个准时出现的倒计时里。',
  '以后还有很多很多天。',
  '记得拍一张今天的照片。',
  '小事认真记，大事一起扛。',
  '她开心，比什么都重要。',
];

const loaded = store.load();
let state = loaded.state;
let dayKey = todayISO();
let deferredInstallPrompt = null;
let updateShown = false;
let reloadRequested = false;
let toastTimer = 0;

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function currentRoute() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length) return { name: 'home' };
  if (parts[0] === 'events') return { name: 'events' };
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'event' && parts[1] === 'new') return { name: 'edit', id: null };
  if (parts[0] === 'event' && parts[1]) return { name: 'edit', id: decodeURIComponent(parts[1]) };
  return { name: 'home' };
}

function applyTheme() {
  const theme = THEMES.some((item) => item.id === state.settings.theme) ? state.settings.theme : 'blush';
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'blush' ? '#ff6b8a' : theme === 'peach' ? '#ff8a5b' : '#9b7bff');
}

function persist(nextState) {
  const result = store.save(nextState);
  state = result.state;
  sync.push(state).catch(() => {});
  if (!result.ok) showToast(result.error);
  return result.ok;
}

function showToast(message) {
  if (!message) return;
  toastEl.textContent = message;
  toastEl.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.hidden = true;
  }, 3600);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return '早安';
  if (hour >= 11 && hour < 14) return '午安';
  if (hour >= 14 && hour < 18) return '下午好';
  if (hour >= 18 && hour < 23) return '晚上好';
  return '夜深了';
}

function icon(name) {
  if (name === 'home') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/></svg>';
  }
  if (name === 'calendar') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="15" rx="2.5"/><path d="M8 3.5v3M16 3.5v3M3.5 10.5h17"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
}

function tabbar(active) {
  const item = (name, href, label, iconName) => `
    <a class="tab${active === name ? ' is-active' : ''}" href="${href}">
      ${icon(iconName)}
      <span>${label}</span>
    </a>`;
  return `<nav class="tabbar" aria-label="主导航">
    ${item('home', '#/home', '首页', 'home')}
    ${item('events', '#/events', '纪念日', 'calendar')}
    ${item('settings', '#/settings', '设置', 'settings')}
  </nav>`;
}

function topbar({ eyebrow = '', title = '', right = '', back = null } = {}) {
  const left = back ? `<a class="icon-btn" href="${back}" aria-label="返回">←</a>` : '';
  const copy = back
    ? `<h1 class="topbar-title">${esc(title)}</h1>`
    : `<div class="topbar-copy">${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}<h1 class="topbar-title">${esc(title)}</h1></div>`;
  return `<header class="topbar">${left}${copy}${right || (back ? '<span class="topbar-spacer"></span>' : '')}</header>`;
}

function eventMeta(event, occurrence) {
  if (!occurrence) return '日期无效';
  const shortDate = formatISO(occurrence.solar).replaceAll('-', '.');
  if (event.calendar === 'lunar') {
    return `${lunarLabel(event.lunar.month, event.lunar.day)} · ${shortDate}`;
  }
  if (event.repeat === 'once') {
    return `${shortDate} · ${weekdayCn(occurrence.solar)}`;
  }
  return `每年 ${occurrence.solar.m} 月 ${occurrence.solar.d} 日 · ${weekdayCn(occurrence.solar)}`;
}

function eventCard(event, occurrence) {
  const right =
    occurrence.diff === 0
      ? '<span class="days days--today">今天</span>'
      : occurrence.diff > 0
        ? `<span class="days">${occurrence.diff}</span><span class="days-unit">天后</span>`
        : `<span class="days days--past">${-occurrence.diff}</span><span class="days-unit">天前</span>`;
  return `<a class="event-card" href="#/event/${encodeURIComponent(event.id)}">
    <span class="event-emoji" aria-hidden="true">${esc(event.emoji)}</span>
    <span class="event-body">
      <span class="event-title">${esc(event.title)}</span>
      <span class="event-meta">${esc(eventMeta(event, occurrence))}</span>
    </span>
    <span class="event-right">${right}</span>
  </a>`;
}

function emptyState() {
  return `<div class="empty">
    <div class="empty-emoji" aria-hidden="true">💌</div>
    <p class="empty-title">还没有纪念日</p>
    <p class="empty-text">生日、在一起的日子、第一次旅行……把想记住的小事都放进来。</p>
    <a class="btn btn--primary" href="#/event/new">添加第一个纪念日</a>
  </div>`;
}

function emptyUpcoming() {
  return `<div class="empty">
    <p class="empty-title">接下来没有纪念日</p>
    <p class="empty-text">过去的已经收好，新的日子等你添加。</p>
    <a class="btn btn--soft" href="#/event/new">添加纪念日</a>
  </div>`;
}

function renderHome() {
  const start = parseISO(state.settings.startDate);
  if (!start) {
    renderOnboarding();
    return null;
  }

  const diff = daysBetween(start, todayParts());
  const heroLabel = diff >= 0 ? '我们已经在一起' : '距离开始还有';
  const heroNumber = diff >= 0 ? diff + 1 : -diff;
  const quote = QUOTES[Math.abs(dayNumber(todayParts())) % QUOTES.length];

  const sorted = sortByOccurrence(state.events, todayParts());
  const todays = sorted.filter((item) => item.occurrence && item.occurrence.diff === 0);
  const upcoming = sorted.filter(
    (item) => item.occurrence && item.occurrence.status === 'upcoming' && item.occurrence.diff > 0,
  );
  const next = upcoming.slice(0, 3);

  const title = state.settings.herName ? `${state.settings.herName}的纪念日` : '我们的纪念日';
  const header = topbar({
    eyebrow: `${greeting()}${state.settings.herName ? `，${state.settings.herName}` : ''}`,
    title,
    right: `<a class="icon-btn" href="#/settings" aria-label="设置">${icon('settings')}</a>`,
  });

  const body = `
    <section class="hero">
      <div class="hero-glow"></div>
      <span class="hero-heart" aria-hidden="true">💗</span>
      <p class="hero-label">${heroLabel}</p>
      <p class="hero-days"><span class="hero-number">${heroNumber}</span><span class="hero-unit">天</span></p>
      <p class="hero-meta">${esc(formatCN(start))} 开始 · ${weekdayCn(start)}</p>
      <p class="hero-quote">${esc(quote)}</p>
    </section>
    ${
      todays.length
        ? `<section class="section">
            <div class="section-head"><h2>今天</h2></div>
            <div class="event-list">${todays.map((item) => eventCard(item.event, item.occurrence)).join('')}</div>
          </section>`
        : ''
    }
    <section class="section">
      <div class="section-head">
        <h2>接下来</h2>
        ${state.events.length ? `<a class="text-link" href="#/events">全部 ${state.events.length} 个</a>` : ''}
      </div>
      ${
        !state.events.length
          ? emptyState()
          : next.length
            ? `<div class="event-list">${next.map((item) => eventCard(item.event, item.occurrence)).join('')}</div>`
            : emptyUpcoming()
      }
    </section>`;

  return { header, body, title: `${state.settings.herName || '我们'}的纪念日` };
}

function renderEvents() {
  const sorted = sortByOccurrence(state.events, todayParts());
  const upcoming = sorted.filter((item) => item.occurrence && item.occurrence.status === 'upcoming');
  const past = sorted.filter((item) => item.occurrence && item.occurrence.status === 'past');

  const header = topbar({
    title: '纪念日',
    right: '<a class="icon-btn icon-btn--plus" href="#/event/new" aria-label="添加纪念日">＋</a>',
  });

  let body;
  if (!state.events.length) {
    body = emptyState();
  } else {
    body = `
      ${
        upcoming.length
          ? `<section class="section">
              <div class="section-head"><h2>即将到来</h2><span class="pill">${upcoming.length}</span></div>
              <div class="event-list">${upcoming.map((item) => eventCard(item.event, item.occurrence)).join('')}</div>
            </section>`
          : `<section class="section">${emptyUpcoming()}</section>`
      }
      ${
        past.length
          ? `<section class="section">
              <div class="section-head"><h2>已经过去</h2><span class="pill">${past.length}</span></div>
              <div class="event-list">${past.map((item) => eventCard(item.event, item.occurrence)).join('')}</div>
            </section>`
          : ''
      }`;
  }

  return { header, body, title: '纪念日' };
}

function optionList(values, selected, formatter) {
  return values
    .map((value) => `<option value="${value}"${value === selected ? ' selected' : ''}>${esc(formatter(value))}</option>`)
    .join('');
}

function renderEdit(id) {
  const existing = id ? state.events.find((event) => event.id === id) : null;
  if (id && !existing) {
    window.location.hash = '#/events';
    return null;
  }

  const emoji = existing?.emoji || EMOJIS[0];
  const calendar = existing?.calendar || 'solar';
  const repeat = existing?.repeat || 'yearly';
  const lunar = existing?.lunar || { month: 1, day: 1 };
  const solarDate = existing?.solarDate || todayISO();

  const header = topbar({
    title: existing ? '编辑纪念日' : '新建纪念日',
    back: '#/events',
  });

  const body = `
    <form class="form" id="eventForm" data-event-id="${esc(existing?.id || '')}" novalidate>
      <label class="field">
        <span class="field-label">标题</span>
        <input class="input" name="title" maxlength="32" placeholder="例如：她生日、第一次旅行" value="${esc(existing?.title || '')}" autocomplete="off" />
      </label>

      <fieldset class="field">
        <legend class="field-label">图标</legend>
        <div class="emoji-grid">
          ${EMOJIS.map(
            (item) =>
              `<button type="button" class="emoji-option${item === emoji ? ' is-selected' : ''}" data-emoji="${esc(item)}" aria-label="图标 ${esc(item)}" aria-pressed="${item === emoji}">${esc(item)}</button>`,
          ).join('')}
        </div>
      </fieldset>

      <fieldset class="field">
        <legend class="field-label">历法</legend>
        <div class="segmented">
          <label><input type="radio" name="calendar" value="solar"${calendar === 'solar' ? ' checked' : ''} /><span>公历</span></label>
          <label><input type="radio" name="calendar" value="lunar"${calendar === 'lunar' ? ' checked' : ''} /><span>农历</span></label>
        </div>
      </fieldset>

      <fieldset class="field">
        <legend class="field-label">重复</legend>
        <div class="segmented">
          <label><input type="radio" name="repeat" value="yearly"${repeat === 'yearly' ? ' checked' : ''} /><span>每年</span></label>
          <label><input type="radio" name="repeat" value="once"${repeat === 'once' ? ' checked' : ''} /><span>仅一次</span></label>
        </div>
      </fieldset>

      <div class="field" id="solarField"${calendar === 'lunar' ? ' hidden' : ''}>
        <label class="field-label" for="solarDate">日期</label>
        <input class="input" type="date" id="solarDate" name="solarDate" min="1900-01-01" max="2100-12-31" value="${esc(solarDate)}" />
        <p class="hint">每年重复只取「月」和「日」；选「仅一次」时需要完整日期。</p>
      </div>

      <div class="field" id="lunarField"${calendar === 'lunar' ? '' : ' hidden'}>
        <span class="field-label">农历日期</span>
        <div class="row">
          <select class="input" name="lunarMonth" aria-label="农历月份">
            ${optionList([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], lunar.month, lunarMonthName)}
          </select>
          <select class="input" name="lunarDay" aria-label="农历日期">
            ${optionList(Array.from({ length: 30 }, (_, index) => index + 1), lunar.day, lunarDayName)}
          </select>
        </div>
        <p class="hint">闰月生日按普通月份算；遇到小月没有三十时自动按廿九。</p>
      </div>

      <label class="field">
        <span class="field-label">备注（可选）</span>
        <textarea class="input" name="note" maxlength="200" placeholder="想对她说的话、礼物灵感、那天的安排……">${esc(existing?.note || '')}</textarea>
      </label>

      <div class="form-actions btn-row">
        <button class="btn btn--primary" type="submit">保存</button>
        ${existing ? '<button class="btn btn--danger" type="button" data-action="delete">删除</button>' : ''}
      </div>
    </form>`;

  return { header, body, title: existing ? '编辑纪念日' : '新建纪念日' };
}

function renderSettings() {
  const header = topbar({ title: '设置', back: '#/home' });
  const themeButtons = THEMES.map(
    (theme) => `<button type="button" class="theme-swatch${state.settings.theme === theme.id ? ' is-active' : ''}" data-theme-choice="${theme.id}" aria-pressed="${state.settings.theme === theme.id}">
      <span class="swatch-dot" aria-hidden="true"></span>${theme.name}
    </button>`,
  ).join('');

  const installed =
    window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const installArea = installed
    ? '<p class="hint">已经安装到主屏幕了。</p>'
    : deferredInstallPrompt
      ? '<button class="btn btn--soft btn--block" type="button" data-action="install">添加到主屏幕</button><p class="hint">安装后会像普通 App 一样从桌面打开，也能离线使用。</p>'
      : '<p class="hint">用 Android Chrome 打开本页，点右上角菜单（三个点）→「添加到主屏幕」即可安装；安装后可离线使用。</p>';

  const body = `
    <section class="card">
      <h2>你们</h2>
      <form class="form" id="settingsForm" novalidate>
        <label class="field">
          <span class="field-label">她的昵称</span>
          <input class="input" name="herName" maxlength="20" value="${esc(state.settings.herName)}" placeholder="她" autocomplete="off" />
        </label>
        <label class="field">
          <span class="field-label">你的昵称</span>
          <input class="input" name="myName" maxlength="20" value="${esc(state.settings.myName)}" placeholder="我" autocomplete="off" />
        </label>
        <label class="field">
          <span class="field-label">在一起的日期</span>
          <input class="input" type="date" name="startDate" min="1900-01-01" max="2100-12-31" value="${esc(state.settings.startDate)}" />
        </label>
        <button class="btn btn--primary" type="submit">保存资料</button>
      </form>
    </section>

    <section class="card">
      <h2>主题</h2>
      <div class="theme-grid">${themeButtons}</div>
    </section>

    <section class="card">
      <h2>安装</h2>
      ${installArea}
    </section>

    <section class="card">
      <h2>数据</h2>
      <div class="btn-row">
        <button class="btn btn--soft" type="button" data-action="export">导出备份</button>
        <button class="btn btn--soft" type="button" data-action="import">导入备份</button>
      </div>
      <input type="file" id="importFile" accept="application/json,.json" hidden />
      <button class="btn btn--danger btn--block" type="button" data-action="clear">清空所有数据</button>
      <p class="hint">所有数据只保存在这台手机的浏览器里，不会上传。清理浏览器数据会导致丢失，建议偶尔导出一次备份。</p>
    </section>

    <section class="card about">
      <p>我们的纪念日 · v1.0</p>
      <p>${state.events.length} 个纪念日 · 数据仅存本机</p>
    </section>`;

  return { header, body, title: '设置' };
}

function renderOnboarding() {
  appEl.innerHTML = `
    <div class="onboarding">
      <div class="onboarding-card">
        <div class="onboarding-logo" aria-hidden="true">💗</div>
        <h1>先告诉我一点你们的事</h1>
        <p class="hint">这些只保存在这台手机里，不会上传到任何地方。</p>
        <form class="form" id="onboardingForm" novalidate>
          <label class="field">
            <span class="field-label">她的昵称（可选）</span>
            <input class="input" name="herName" maxlength="20" placeholder="她" autocomplete="off" />
          </label>
          <label class="field">
            <span class="field-label">你的昵称（可选）</span>
            <input class="input" name="myName" maxlength="20" placeholder="我" autocomplete="off" />
          </label>
          <label class="field">
            <span class="field-label">在一起的日期</span>
            <input class="input" type="date" name="startDate" min="1900-01-01" max="2100-12-31" required />
          </label>
          <button class="btn btn--primary btn--block" type="submit">开始记录</button>
        </form>
      </div>
    </div>`;

  document.getElementById('onboardingForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const startDate = String(data.get('startDate') || '');
    if (!parseISO(startDate)) {
      showToast('请选择在一起日期');
      return;
    }
    if (
      !persist({
        ...state,
        settings: {
          ...state.settings,
          herName: String(data.get('herName') || '').trim().slice(0, 20),
          myName: String(data.get('myName') || '').trim().slice(0, 20),
          startDate,
        },
      })
    ) {
      return;
    }
    window.location.hash = '#/home';
    render();
    showToast('开始记录吧');
  });
}

function bindEdit(id) {
  const form = document.getElementById('eventForm');
  if (!form) return;

  const solarField = document.getElementById('solarField');
  const lunarField = document.getElementById('lunarField');
  const calendarInputs = [...form.querySelectorAll('input[name="calendar"]')];
  const repeatInputs = [...form.querySelectorAll('input[name="repeat"]')];

  const syncVisibility = () => {
    let calendar = calendarInputs.find((input) => input.checked)?.value || 'solar';
    let repeat = repeatInputs.find((input) => input.checked)?.value || 'yearly';

    if (repeat === 'once' && calendar === 'lunar') {
      calendar = 'solar';
      calendarInputs.forEach((input) => (input.checked = input.value === 'solar'));
    }
    if (calendar === 'lunar') {
      repeat = 'yearly';
      repeatInputs.forEach((input) => (input.checked = input.value === 'yearly'));
    }

    solarField.hidden = calendar === 'lunar';
    lunarField.hidden = calendar !== 'lunar';
  };

  calendarInputs.forEach((input) => input.addEventListener('change', syncVisibility));
  repeatInputs.forEach((input) => input.addEventListener('change', syncVisibility));
  syncVisibility();

  form.querySelectorAll('.emoji-option').forEach((button) => {
    button.addEventListener('click', () => {
      form.querySelectorAll('.emoji-option').forEach((item) => {
        item.classList.remove('is-selected');
        item.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('is-selected');
      button.setAttribute('aria-pressed', 'true');
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    if (!title) {
      showToast('给这个日子起个名字吧');
      form.querySelector('input[name="title"]').focus();
      return;
    }

    const existing = id ? state.events.find((item) => item.id === id) : null;
    const calendar = String(data.get('calendar') || 'solar');
    const repeat = String(data.get('repeat') || 'yearly');
    const selectedEmoji = form.querySelector('.emoji-option.is-selected')?.dataset.emoji || EMOJIS[0];
    const note = String(data.get('note') || '').trim().slice(0, 200);

    const nextEvent = {
      id: existing?.id || `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      title: title.slice(0, 32),
      emoji: selectedEmoji,
      calendar,
      solarDate: null,
      lunar: null,
      repeat,
      note,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    if (calendar === 'lunar') {
      const month = Number(data.get('lunarMonth'));
      const day = Number(data.get('lunarDay'));
      if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 30) {
        showToast('农历日期不正确');
        return;
      }
      nextEvent.lunar = { month, day };
    } else {
      const solar = parseISO(String(data.get('solarDate') || ''));
      if (!solar) {
        showToast('请选择有效的公历日期');
        return;
      }
      nextEvent.solarDate = formatISO(solar);
    }

    const nextEvents = existing
      ? state.events.map((item) => (item.id === existing.id ? nextEvent : item))
      : [...state.events, nextEvent];

    if (!persist({ ...state, events: nextEvents })) return;
    window.location.hash = '#/events';
    showToast('已保存');
  });

  form.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
    const existing = id ? state.events.find((item) => item.id === id) : null;
    if (!existing) return;
    if (!window.confirm(`确定删除「${existing.title}」吗？`)) return;
    if (!persist({ ...state, events: state.events.filter((item) => item.id !== id) })) return;
    window.location.hash = '#/events';
    showToast('已删除');
  });
}

function downloadBackup() {
  const text = store.exportJSON(state);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `love-days-backup-${todayISO()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  showToast('备份已导出');
}

function bindSettings() {
  const form = document.getElementById('settingsForm');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const startDate = String(data.get('startDate') || '');
    if (!parseISO(startDate)) {
      showToast('请选择有效的在一起日期');
      return;
    }
    if (
      !persist({
        ...state,
        settings: {
          ...state.settings,
          herName: String(data.get('herName') || '').trim().slice(0, 20),
          myName: String(data.get('myName') || '').trim().slice(0, 20),
          startDate,
        },
      })
    ) {
      return;
    }
    showToast('资料已保存');
    render();
  });

  document.querySelectorAll('.theme-swatch').forEach((button) => {
    button.addEventListener('click', () => {
      const theme = button.dataset.themeChoice;
      if (!THEMES.some((item) => item.id === theme)) return;
      persist({ ...state, settings: { ...state.settings, theme } });
      applyTheme();
      render();
    });
  });

  document.querySelector('[data-action="install"]')?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try {
      await deferredInstallPrompt.userChoice;
    } finally {
      deferredInstallPrompt = null;
      render();
    }
  });

  document.querySelector('[data-action="export"]')?.addEventListener('click', downloadBackup);

  const fileInput = document.getElementById('importFile');
  document.querySelector('[data-action="import"]')?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { state: imported } = parseImport(text);
      const count = imported.events.length;
      if (!window.confirm(`将导入 ${count} 个纪念日并覆盖当前数据，继续吗？`)) return;
      if (!persist(imported)) return;
      applyTheme();
      render();
      showToast(`已导入 ${count} 个纪念日`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '导入失败');
    } finally {
      fileInput.value = '';
    }
  });

  document.querySelector('[data-action="clear"]')?.addEventListener('click', () => {
    if (!window.confirm('确定清空所有纪念日和资料吗？此操作无法撤销。')) return;
    if (!window.confirm('建议先导出备份。再次确认：要清空吗？')) return;
    store.reset();
    state = defaultState();
    applyTheme();
    window.location.hash = '#/home';
    render();
    showToast('已清空');
  });
}

// parseImport 来自 store 模块，用于「导入备份」。

function bindPage(route) {
  if (route.name === 'edit') {
    bindEdit(route.id || null);
    return;
  }
  if (route.name === 'settings') {
    bindSettings();
    return;
  }
}

function render() {
  applyTheme();
  dayKey = todayISO();
  const route = currentRoute();

  if (!state.settings.startDate) {
    renderOnboarding();
    document.title = '我们的纪念日';
    return;
  }

  let page = null;
  if (route.name === 'events') page = renderEvents();
  else if (route.name === 'settings') page = renderSettings();
  else if (route.name === 'edit') page = renderEdit(route.id);
  else page = renderHome();

  if (!page) return;

  appEl.innerHTML = `${page.header}<main class="main" id="main">${page.body}</main>${route.name === 'edit' ? '' : tabbar(route.name)}`;
  document.title = page.title ? `${page.title} · 我们的纪念日` : '我们的纪念日';
  bindPage(route);
}

function showUpdateBanner(registration) {
  if (updateShown) return;
  updateShown = true;
  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.innerHTML = '<span>有新版本啦</span><button type="button">刷新</button>';
  banner.querySelector('button').addEventListener('click', () => {
    reloadRequested = true;
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  });
  document.body.appendChild(banner);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const secure = window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!secure) {
    document.documentElement.dataset.sw = 'insecure';
    return;
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // 首次安装时 SW 会接管页面，此时不要自动刷新；只有用户点了「刷新」才重载。
    if (!reloadRequested) return;
    reloadRequested = false;
    window.location.reload();
  });

  navigator.serviceWorker
    .register('./sw.js')
    .then((registration) => {
      document.documentElement.dataset.sw = 'ready';
      if (registration.waiting) showUpdateBanner(registration);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(registration);
        });
      });
      registration.update().catch(() => {});
    })
    .catch(() => {
      document.documentElement.dataset.sw = 'error';
    });
}

function watchDayChange() {
  const check = () => {
    // 正在编辑表单时不要重绘，避免把用户输入冲掉。
    if (currentRoute().name === 'edit') return;
    const key = todayISO();
    if (key !== dayKey) {
      dayKey = key;
      render();
    }
  };
  window.setInterval(check, 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('focus', check);
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (currentRoute().name === 'settings') render();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  showToast('已添加到主屏幕');
  render();
});

window.addEventListener('hashchange', () => {
  window.scrollTo(0, 0);
  render();
});
window.addEventListener('offline', () => showToast('当前没有网络，已保存的数据仍可正常查看'));

applyTheme();
render();
registerServiceWorker();
watchDayChange();
if (loaded.warning) showToast(loaded.warning);

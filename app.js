import { createStore } from './store.js';
import { settle } from './settle.js';

const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const x = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(x) ? x : 0; };
const money = n => '₪' + (Math.round((+n || 0) * 100) / 100).toLocaleString('he-IL', { maximumFractionDigits: 2 });
const qty = n => (n == null || n === '' ? '—' : (+n).toLocaleString('he-IL', { maximumFractionDigits: 2 }));
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const fmtDate = d => { try { return new Date(d + 'T00:00').toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }); } catch { return d; } };

let store, view = 'loading', S = {}, unsub = [];
const DEFAULT_PERSONAL = ['שישיית מים', 'צלחת', 'כוס', 'מזלג', 'סכין'];
const H = { tpl: null, tplOpen: false }; // מצב דף הבית
const tpl = () => H.tpl ?? DEFAULT_PERSONAL;
const lines = s => [...new Set(String(s ?? '').split(/[\n,]+/).map(x => x.trim()).filter(Boolean))];

// ---------- מסגרת ----------
function render() {
  // שמירה על פוקוס ועל טיוטות בטפסים כשמגיע עדכון חי ממשתתף אחר
  const a = document.activeElement;
  const keep = a && app.contains(a) && a.dataset.k ? { k: a.dataset.k, v: a.value, s: a.selectionStart, e: a.selectionEnd } : null;
  const drafts = {};
  app.querySelectorAll('[data-draft]').forEach(el => (drafts[el.form?.dataset.form + ':' + el.name] = el.value));

  app.innerHTML = (store?.mode === 'local' ? `<div class="demo">מצב הדגמה · הנתונים נשמרים רק בדפדפן הזה</div>` : '') +
    (view === 'home' ? homeHTML() : view === 'event' ? eventHTML() : `<div class="loading">טוען…</div>`);

  app.querySelectorAll('[data-draft]').forEach(el => {
    const k = el.form?.dataset.form + ':' + el.name;
    if (k in drafts) el.value = drafts[k];
  });
  if (keep) {
    const el = app.querySelector(`[data-k="${CSS.escape(keep.k)}"]`);
    if (el) { el.value = keep.v; el.focus(); try { el.setSelectionRange(keep.s, keep.e); } catch {} }
  }
}

let toastTimer;
function toast(msg, bad) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = ''), 1800);
}
async function safe(fn, ok) {
  try { await fn(); if (ok) toast(ok); } catch (e) { console.error(e); toast('השמירה נכשלה: ' + (e.message || e), true); }
}

function route() {
  unsub.forEach(f => f && f()); unsub = [];
  const m = location.hash.match(/^#\/e\/([a-z0-9]+)/);
  if (m) openEvent(m[1]);
  else {
    view = 'home';
    unsub.push(store.watchTemplate(t => { H.tpl = t; render(); }, e => console.error(e)));
    render();
  }
  window.scrollTo(0, 0);
}

// ---------- דף הבית ----------
function homeHTML() {
  const recent = ls.get('tl-recent', []);
  return `
  <header class="brand">
    <div class="mark" aria-hidden="true">⛺</div>
    <h1>רשימות לטיול</h1>
    <p>רשימת קניות משותפת, מעקב מה נקנה, וחלוקת ההוצאות שווה בשווה.</p>
  </header>
  <form class="card stack" data-form="create">
    <h2>אירוע חדש</h2>
    <label>שם האירוע<input data-draft name="name" required maxlength="80" placeholder="קמפינג בכנרת"></label>
    <label>תאריך<input data-draft name="date" type="date"></label>
    <label>משתתפים <span class="hint">שם בכל שורה</span>
      <textarea data-draft name="people" rows="5" required placeholder="יניב&#10;דנה&#10;אורי"></textarea></label>
    <div class="tplsum">
      <span class="lbl">כל משתתף יקבל רשימת ציוד מהבית <span class="hint">(לא נכנס להוצאות)</span></span>
      <span>${tpl().map(esc).join(' · ') || '—'}</span>
      <button type="button" class="link" data-act="tplOpen">${H.tplOpen ? 'סגירת העריכה' : 'עריכת התבנית'}</button>
    </div>
    <button class="btn wide">יצירת אירוע</button>
  </form>
  ${H.tplOpen ? `
  <section class="card" id="tpl">
    <h2>תבנית: ציוד שכל אחד מביא מהבית</h2>
    <p class="hint" style="margin:-6px 0 12px">שינוי כאן חל רק על אירועים שייווצרו מעכשיו. באירוע קיים עורכים בלשונית "ניהול", והשינוי מתעדכן אצל כל המשתתפים.</p>
    <ul class="plist">${tpl().map((n, i) => `
      <li><input data-k="tp-${i}" data-act="tplRename" data-i="${i}" value="${esc(n)}" maxlength="60" aria-label="פריט">
      <button class="x" data-act="tplDel" data-i="${i}" aria-label="הסר את ${esc(n)}">×</button></li>`).join('')}</ul>
    <form class="row" data-form="tplAdd">
      <input data-draft name="name" required maxlength="60" placeholder="למשל: פנס ראש">
      <button class="btn">הוסף</button>
    </form>
  </section>` : ''}
  ${recent.length ? `<section class="card"><h2>אירועים אחרונים</h2><ul class="recent">${recent.map(r =>
    `<li><a href="#/e/${esc(r.id)}">${esc(r.name)}<span>‹</span></a></li>`).join('')}</ul></section>` : ''}`;
}

function rememberRecent(id, name) {
  const r = ls.get('tl-recent', []).filter(x => x.id !== id);
  r.unshift({ id, name }); ls.set('tl-recent', r.slice(0, 8));
}

// ---------- אירוע ----------
function openEvent(id) {
  view = 'event';
  const me = ls.get('tl-me-' + id, '');
  S = { id, event: undefined, participants: [], items: [], personal: [], tab: ls.get('tl-tab-' + id, 'list'), me, filter: me || 'all', error: null };
  const onErr = e => { console.error(e); S.error = e.message || String(e); render(); };
  unsub.push(store.watchEvent(id, ev => { S.event = ev; if (ev) rememberRecent(id, ev.name); render(); }, onErr));
  unsub.push(store.watchCol(id, 'participants', ps => {
    S.participants = ps.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (S.me && ps.length && !ps.find(p => p.id === S.me)) { S.me = ''; S.filter = 'all'; }
    render();
  }, onErr));
  unsub.push(store.watchCol(id, 'items', its => { S.items = its.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)); render(); }, onErr));
  unsub.push(store.watchCol(id, 'personal', its => { S.personal = its.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)); render(); }, onErr));
  render();
}

const pname = id => S.participants.find(p => p.id === id)?.name || 'ללא שיוך';
function status(it) {
  const b = num(it.bought), p = num(it.planned);
  if (!b) return 'todo';
  if (p && b < p) return 'part';
  return 'done';
}

function eventHTML() {
  if (S.error) return `<div class="card err"><h2>בעיה בחיבור</h2><p>${esc(S.error)}</p><a class="btn" href="#/">לדף הבית</a></div>`;
  if (S.event === undefined) return `<div class="loading">טוען…</div>`;
  if (S.event === null) return `<div class="card"><h2>האירוע לא נמצא</h2><p>ייתכן שהקישור שגוי או שהאירוע נמחק.</p><a class="btn" href="#/">לדף הבית</a></div>`;
  const ev = S.event;
  const tabs = [['list', 'רשימה'], ['money', 'כסף ואיזון'], ['manage', 'ניהול']];
  return `
  <header class="top">
    <a href="#/" class="back" aria-label="לדף הבית">›</a>
    <div class="title"><h1>${esc(ev.name)}</h1>${ev.date ? `<div class="sub">${esc(fmtDate(ev.date))}</div>` : ''}</div>
    <button class="ghost" data-act="share">שיתוף</button>
  </header>
  <div class="me ${S.me ? '' : 'nudge'}">
    <span>${S.me ? 'אני:' : 'מי אתה?'}</span>
    <select data-act="me" aria-label="בחר את השם שלך">
      <option value="">בחר שם…</option>
      ${S.participants.map(p => `<option value="${esc(p.id)}" ${p.id === S.me ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
    </select>
  </div>
  <nav class="tabs" role="tablist">${tabs.map(([k, l]) =>
    `<button role="tab" aria-selected="${S.tab === k}" class="${S.tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${l}</button>`).join('')}</nav>
  ${S.tab === 'money' ? moneyHTML() : S.tab === 'manage' ? manageHTML() : listHTML()}`;
}

function itemRow(it) {
  const st = status(it);
  const over = num(it.bought) > num(it.planned) && num(it.planned) > 0;
  return `
  <li class="item s-${st}">
    <button class="check" data-act="toggle" data-id="${esc(it.id)}" aria-label="${st === 'done' ? 'בטל סימון' : 'סמן כנקנה'}">${st === 'done' ? '✓' : st === 'part' ? '½' : ''}</button>
    <div class="iname">
      <div class="n">${esc(it.name)}</div>
      <div class="meta">
        <span>תוכנן ${qty(it.planned)}${it.unit ? ' ' + esc(it.unit) : ''}</span>
        <select class="mini" data-act="assign" data-id="${esc(it.id)}" aria-label="מי מביא">
          <option value="">ללא שיוך</option>
          ${S.participants.map(p => `<option value="${esc(p.id)}" ${p.id === it.assignee ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <label class="bought ${over ? 'over' : ''}"><span>נקנה</span>
      <input data-k="b-${esc(it.id)}" data-act="bought" data-id="${esc(it.id)}" inputmode="decimal" value="${it.bought ?? ''}" placeholder="0"></label>
    <button class="x" data-act="delItem" data-id="${esc(it.id)}" aria-label="מחק פריט">×</button>
  </li>`;
}

function listHTML() {
  const ps = S.participants;
  const known = new Set(ps.map(p => p.id));
  const unassigned = S.items.filter(i => !known.has(i.assignee));
  const chips = [['all', 'הכל'], ...ps.map(p => [p.id, p.name + (p.id === S.me ? ' (אני)' : '')])];
  if (unassigned.length) chips.push(['none', 'ללא שיוך']);
  // לא משנים את S.filter כאן: בטעינה הראשונה המשתתפים עוד לא הגיעו
  const F = chips.find(c => c[0] === S.filter) ? S.filter : 'all';

  const shown = F === 'all' ? S.items : F === 'none' ? unassigned : S.items.filter(i => i.assignee === F);
  const done = shown.filter(i => status(i) === 'done').length;
  const pct = shown.length ? Math.round((done / shown.length) * 100) : 0;

  let body;
  if (!shown.length) body = `<p class="empty">${S.items.length ? 'אין פריטים ברשימה הזו.' : 'עוד אין פריטים. הוסיפו את הראשון למטה.'}</p>`;
  else if (F === 'all') {
    const groups = [...ps.map(p => [p.name, S.items.filter(i => i.assignee === p.id)]), ['ללא שיוך', unassigned]].filter(g => g[1].length);
    body = groups.map(([name, its]) => `<h3 class="group">${esc(name)} <span>${its.filter(i => status(i) === 'done').length}/${its.length}</span></h3><ul class="items">${its.map(itemRow).join('')}</ul>`).join('');
  } else body = `<ul class="items">${shown.map(itemRow).join('')}</ul>`;

  const defAssignee = F !== 'all' && F !== 'none' ? F : S.me;
  return `
  <div class="chips">${chips.map(([k, l]) => `<button class="chip ${F === k ? 'on' : ''}" data-act="filter" data-v="${esc(k)}">${esc(l)}</button>`).join('')}</div>
  ${shown.length ? `<div class="progress"><div class="bar"><i style="width:${pct}%"></i></div><span>${done} מתוך ${shown.length} נקנו</span></div>` : ''}
  ${body}
  ${personalHTML(F)}
  <form class="card add" data-form="addItem">
    <h2>הוספת פריט</h2>
    <input data-draft name="name" required maxlength="80" placeholder="פריט (למשל: פחמים)" class="full">
    <div class="row">
      <input data-draft name="planned" inputmode="decimal" placeholder="כמות" aria-label="כמות מתוכננת">
      <input data-draft name="unit" maxlength="20" placeholder="יחידה (ק״ג, שקית…)" aria-label="יחידה">
    </div>
    <div class="row">
      <select data-draft name="assignee" aria-label="מי מביא">
        <option value="">ללא שיוך</option>
        ${ps.map(p => `<option value="${esc(p.id)}" ${p.id === defAssignee ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
      </select>
      <button class="btn">הוסף</button>
    </div>
  </form>`;
}

// ציוד אישי שכל משתתף מביא מהבית — לא קשור להוצאות
function personalHTML(F) {
  if (!S.personal.length || F === 'none') return '';
  const ps = S.participants;
  const tag = 'לא נכנס להוצאות';
  if (F === 'all') {
    return `
  <section class="card personal">
    <h2>ציוד מהבית <span class="tag">כל אחד מביא · ${tag}</span></h2>
    <ul class="pall">${S.personal.map(it => {
      const missing = ps.filter(p => !p.packed?.[it.id]);
      return `<li><span class="nm">${esc(it.name)}</span><span class="cnt ${missing.length ? '' : 'full'}">${ps.length - missing.length}/${ps.length}</span>
        ${missing.length && missing.length <= 3 ? `<small>חסר אצל ${missing.map(p => esc(p.name)).join(', ')}</small>` : ''}</li>`;
    }).join('')}</ul>
  </section>`;
  }
  const p = ps.find(x => x.id === F);
  if (!p) return '';
  const done = S.personal.filter(it => p.packed?.[it.id]).length;
  return `
  <section class="card personal">
    <h2>${p.id === S.me ? 'הציוד שלי מהבית' : 'הציוד של ' + esc(p.name) + ' מהבית'} <span class="tag">${done}/${S.personal.length} · ${tag}</span></h2>
    <ul class="pack">${S.personal.map(it => {
      const on = !!p.packed?.[it.id];
      return `<li><button class="pk ${on ? 'on' : ''}" data-act="pack" data-id="${esc(it.id)}" data-pid="${esc(p.id)}" aria-pressed="${on}"><i>${on ? '✓' : ''}</i><span>${esc(it.name)}</span></button></li>`;
    }).join('')}</ul>
  </section>`;
}

function moneyHTML() {
  const ps = S.participants;
  const r = settle(ps.map(p => ({ id: p.id, name: p.name, spent: p.spent })));
  const mine = ps.find(p => p.id === S.me);
  const net = Object.fromEntries(r.balances.map(b => [b.id, b.net]));
  const missing = ps.filter(p => !num(p.spent)).length;

  return `
  ${mine ? `
  <div class="card hero">
    <label for="myspent">כמה הוצאת בסך הכל?</label>
    <div class="money-in"><input id="myspent" data-k="sp-${esc(mine.id)}" data-act="spent" data-id="${esc(mine.id)}" inputmode="decimal" value="${num(mine.spent) || ''}" placeholder="0"><span>₪</span></div>
    <p class="hint">סכום כולל של כל מה שקנית לאירוע, לא פר פריט. נשמר כשיוצאים מהשדה.</p>
  </div>` : `<p class="empty">בחר את השם שלך למעלה כדי להזין כמה הוצאת.</p>`}

  <div class="stats">
    <div><span>סה״כ הוצאות</span><b>${money(r.total)}</b></div>
    <div><span>לכל משתתף</span><b>${money(r.share)}</b></div>
  </div>

  <section class="card">
    <h2>מי שילם כמה</h2>
    <ul class="people">${ps.map(p => {
      const n = net[p.id] || 0;
      return `<li>
        <span class="pn">${esc(p.name)}${p.id === S.me ? ' <em>(אני)</em>' : ''}</span>
        <span class="money-in sm"><input data-k="sp-${esc(p.id)}-l" data-act="spent" data-id="${esc(p.id)}" inputmode="decimal" value="${num(p.spent) || ''}" placeholder="0" aria-label="הוצאה של ${esc(p.name)}"><span>₪</span></span>
        <span class="net ${n > 0.004 ? 'pos' : n < -0.004 ? 'neg' : ''}">${n > 0.004 ? 'מקבל ' + money(n) : n < -0.004 ? 'משלם ' + money(-n) : 'מאוזן'}</span>
      </li>`;
    }).join('')}</ul>
    ${missing ? `<p class="hint">${missing} משתתפים עדיין לא הזינו הוצאה. האיזון יתעדכן אוטומטית.</p>` : ''}
  </section>

  <section class="card">
    <h2>מי מעביר למי</h2>
    ${r.transfers.length ? `<ul class="transfers">${r.transfers.map(t => `
      <li class="${t.from === S.me || t.to === S.me ? 'mine' : ''}">
        <span class="who">${esc(t.fromName)}</span><span class="arrow" aria-label="מעביר ל">←</span><span class="who">${esc(t.toName)}</span>
        <b>${money(t.amount)}</b>
      </li>`).join('')}</ul>` : `<p class="empty">${r.total ? 'כולם מאוזנים, אין צורך בהעברות.' : 'עוד לא הוזנו הוצאות.'}</p>`}
  </section>`;
}

function manageHTML() {
  const ev = S.event;
  return `
  <section class="card stack">
    <h2>פרטי האירוע</h2>
    <label>שם<input data-k="ev-name" data-act="evName" value="${esc(ev.name)}" maxlength="80"></label>
    <label>תאריך<input data-k="ev-date" data-act="evDate" type="date" value="${esc(ev.date || '')}"></label>
  </section>
  <section class="card">
    <h2>משתתפים (${S.participants.length})</h2>
    <ul class="plist">${S.participants.map(p => `
      <li><input data-k="pn-${esc(p.id)}" data-act="rename" data-id="${esc(p.id)}" value="${esc(p.name)}" maxlength="40" aria-label="שם">
      <button class="x" data-act="delPerson" data-id="${esc(p.id)}" aria-label="הסר את ${esc(p.name)}">×</button></li>`).join('')}</ul>
    <form class="row" data-form="addPerson">
      <input data-draft name="name" required maxlength="40" placeholder="שם משתתף חדש">
      <button class="btn">הוסף</button>
    </form>
  </section>
  <section class="card">
    <h2>ציוד שכל אחד מביא מהבית</h2>
    <p class="hint" style="margin:-6px 0 10px">מופיע ברשימה של כל משתתף, ולא נכנס לחישוב ההוצאות.</p>
    <ul class="plist">${S.personal.map(it => `
      <li><input data-k="ps-${esc(it.id)}" data-act="renamePersonal" data-id="${esc(it.id)}" value="${esc(it.name)}" maxlength="60" aria-label="פריט">
      <button class="x" data-act="delPersonal" data-id="${esc(it.id)}" aria-label="הסר את ${esc(it.name)}">×</button></li>`).join('')}</ul>
    <form class="row" data-form="addPersonal">
      <input data-draft name="name" required maxlength="60" placeholder="למשל: שק שינה">
      <button class="btn">הוסף</button>
    </form>
  </section>
  <p class="hint center">כל מי שיש לו את הקישור יכול לצפות ולערוך.</p>`;
}

// ---------- אירועים ----------
app.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || t.tagName === 'SELECT' || t.tagName === 'INPUT') return;
  const id = t.dataset.id;
  switch (t.dataset.act) {
    case 'tab': S.tab = t.dataset.v; ls.set('tl-tab-' + S.id, S.tab); render(); break;
    case 'filter':
      S.filter = t.dataset.v;
      app.querySelector('[data-form=addItem] [name=assignee]')?.removeAttribute('data-draft'); // ברירת מחדל לפי הפילטר החדש
      render(); break;
    case 'toggle': {
      const it = S.items.find(i => i.id === id); if (!it) return;
      safe(() => store.update(S.id, 'items', id, { bought: status(it) === 'done' ? null : (num(it.planned) || 1) }));
      break;
    }
    case 'delItem': {
      const it = S.items.find(i => i.id === id);
      if (it && confirm(`למחוק את "${it.name}"?`)) safe(() => store.remove(S.id, 'items', id));
      break;
    }
    case 'tplOpen':
      H.tplOpen = !H.tplOpen; render();
      if (H.tplOpen) document.getElementById('tpl')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      break;
    case 'tplDel': {
      const list = [...tpl()]; list.splice(+t.dataset.i, 1);
      safe(() => store.setTemplate(list), 'התבנית עודכנה');
      break;
    }
    case 'pack': {
      const p = S.participants.find(x => x.id === t.dataset.pid); if (!p) return;
      const packed = { ...(p.packed || {}) };
      if (packed[id]) delete packed[id]; else packed[id] = true;
      safe(() => store.update(S.id, 'participants', p.id, { packed }));
      break;
    }
    case 'delPersonal': {
      const it = S.personal.find(i => i.id === id);
      if (it && confirm(`להסיר את "${it.name}" מהרשימה של כולם?`)) safe(() => store.remove(S.id, 'personal', id));
      break;
    }
    case 'delPerson': {
      const p = S.participants.find(x => x.id === id); if (!p) return;
      const n = S.items.filter(i => i.assignee === id).length;
      if (!confirm(`להסיר את ${p.name}?${n ? `\n${n} פריטים שלו יעברו ל"ללא שיוך".` : ''}${num(p.spent) ? `\nההוצאה שלו (${money(p.spent)}) תימחק מהאיזון.` : ''}`)) return;
      safe(async () => {
        await Promise.all(S.items.filter(i => i.assignee === id).map(i => store.update(S.id, 'items', i.id, { assignee: '' })));
        await store.remove(S.id, 'participants', id);
      });
      break;
    }
    case 'share': {
      const url = location.href;
      if (navigator.share) navigator.share({ title: S.event?.name, text: 'הרשימה שלנו לטיול', url }).catch(() => {});
      else navigator.clipboard?.writeText(url).then(() => toast('הקישור הועתק'), () => prompt('העתק את הקישור:', url));
      break;
    }
  }
});

app.addEventListener('change', e => {
  const t = e.target, id = t.dataset.id;
  switch (t.dataset.act) {
    case 'me':
      S.me = t.value; ls.set('tl-me-' + S.id, S.me); S.filter = S.me || 'all';
      app.querySelector('[data-form=addItem] [name=assignee]')?.removeAttribute('data-draft');
      render(); break;
    case 'bought': {
      const v = t.value.trim();
      safe(() => store.update(S.id, 'items', id, { bought: v === '' ? null : num(v) })); break;
    }
    case 'assign': safe(() => store.update(S.id, 'items', id, { assignee: t.value }), 'עודכן'); break;
    case 'spent': safe(() => store.update(S.id, 'participants', id, { spent: num(t.value) }), 'נשמר'); break;
    case 'tplRename': {
      const v = t.value.trim(); if (!v) return;
      const list = [...tpl()]; list[+t.dataset.i] = v;
      safe(() => store.setTemplate(list), 'התבנית עודכנה'); break;
    }
    case 'renamePersonal': if (t.value.trim()) safe(() => store.update(S.id, 'personal', id, { name: t.value.trim() }), 'נשמר'); break;
    case 'rename': if (t.value.trim()) safe(() => store.update(S.id, 'participants', id, { name: t.value.trim() }), 'נשמר'); break;
    case 'evName': if (t.value.trim()) safe(() => store.updateEvent(S.id, { name: t.value.trim() }), 'נשמר'); break;
    case 'evDate': safe(() => store.updateEvent(S.id, { date: t.value }), 'נשמר'); break;
  }
});

// Enter בשדה מספרי שומר מיד
app.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('input[data-act]')) e.target.blur();
});

app.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, fd = new FormData(f), g = k => String(fd.get(k) ?? '').trim();
  switch (f.dataset.form) {
    case 'create': {
      const people = lines(g('people'));
      if (!g('name') || !people.length) return toast('צריך שם אירוע ולפחות משתתף אחד', true);
      const btn = f.querySelector('button'); btn.disabled = true;
      try {
        // התבנית מועתקת לאירוע ברגע היצירה; שינויים עתידיים בתבנית לא נוגעים בו
        const personal = (await store.getTemplate().catch(() => null)) ?? tpl();
        const id = await store.createEvent({ name: g('name'), date: g('date'), participants: people, personal });
        f.reset(); location.hash = '#/e/' + id;
      } catch (err) { btn.disabled = false; toast('היצירה נכשלה: ' + err.message, true); }
      break;
    }
    case 'addItem': {
      const data = { name: g('name'), planned: g('planned') ? num(g('planned')) : null, unit: g('unit'), assignee: g('assignee'), bought: null, createdAt: Date.now() };
      if (!data.name) return;
      f.elements.name.value = ''; f.elements.planned.value = ''; f.elements.unit.value = '';
      f.elements.name.focus();
      safe(() => store.add(S.id, 'items', data));
      break;
    }
    case 'tplAdd': {
      const name = g('name'); if (!name) return;
      f.elements.name.value = '';
      if (tpl().includes(name)) return toast('כבר קיים בתבנית');
      safe(() => store.setTemplate([...tpl(), name]), 'נוסף לתבנית');
      break;
    }
    case 'addPersonal': {
      const name = g('name'); if (!name) return;
      f.elements.name.value = '';
      safe(() => store.add(S.id, 'personal', { name, createdAt: Date.now() }), 'נוסף לכולם');
      break;
    }
    case 'addPerson': {
      const name = g('name'); if (!name) return;
      f.elements.name.value = '';
      const order = Math.max(-1, ...S.participants.map(p => p.order ?? 0)) + 1;
      safe(() => store.add(S.id, 'participants', { name, spent: 0, order }), 'נוסף');
      break;
    }
  }
});

// ---------- התחלה ----------
render();
createStore()
  .then(s => { store = s; window.addEventListener('hashchange', route); route(); })
  .catch(e => { app.innerHTML = `<div class="card err"><h2>לא הצלחתי להתחבר</h2><p>${esc(e.message)}</p></div>`; });

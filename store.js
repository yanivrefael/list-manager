import { firebaseConfig } from './config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

export function newId(n = 16) {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  return [...crypto.getRandomValues(new Uint8Array(n))].map(x => a[x % a.length]).join('');
}

export async function createStore() {
  return firebaseConfig ? firebaseStore() : localStore();
}

// מבנה הנתונים:
// events/{eventId}                       { name, date, createdAt }
// events/{eventId}/participants/{pid}    { name, spent, order, packed: { [personalId]: true } }
// events/{eventId}/items/{itemId}        { name, planned, unit, assignee, bought, createdAt }   — קניות משותפות (נכנסות לעלות)
// events/{eventId}/personal/{id}         { name, createdAt }                                    — ציוד אישי מהבית (לא נכנס לעלות)

async function firebaseStore() {
  const { initializeApp } = await import(FB + 'firebase-app.js');
  const { getFirestore, doc, collection, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, getDoc } =
    await import(FB + 'firebase-firestore.js');
  const db = getFirestore(initializeApp(firebaseConfig));
  const ev = id => doc(db, 'events', id);
  const sub = (id, c) => collection(db, 'events', id, c);

  return {
    mode: 'firebase',
    async createEvent({ name, date, participants, personal = [] }) {
      const id = newId();
      const b = writeBatch(db);
      b.set(ev(id), { name, date, createdAt: Date.now() });
      participants.forEach((p, i) => b.set(doc(sub(id, 'participants'), newId(8)), { name: p, spent: 0, order: i, packed: {} }));
      personal.forEach((p, i) => b.set(doc(sub(id, 'personal'), newId(8)), { name: p, createdAt: Date.now() + i }));
      await b.commit();
      return id;
    },
    watchEvent(id, cb, err) {
      return onSnapshot(ev(id), s => cb(s.exists() ? { id: s.id, ...s.data() } : null), err);
    },
    watchCol(id, c, cb, err) {
      return onSnapshot(sub(id, c), s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), err);
    },
    add: (id, c, data) => setDoc(doc(sub(id, c), newId(8)), data),
    update: (id, c, did, data) => updateDoc(doc(sub(id, c), did), data),
    remove: (id, c, did) => deleteDoc(doc(sub(id, c), did)),
    updateEvent: (id, data) => updateDoc(ev(id), data),
    // תבנית "ציוד מהבית" — מועתקת לכל אירוע חדש ברגע היצירה
    watchTemplate: (cb, err) => onSnapshot(doc(db, 'templates', 'personal'), s => cb(s.exists() ? s.data().items : null), err),
    getTemplate: async () => { const s = await getDoc(doc(db, 'templates', 'personal')); return s.exists() ? s.data().items : null; },
    setTemplate: items => setDoc(doc(db, 'templates', 'personal'), { items, updatedAt: Date.now() }),
  };
}

// מצב הדגמה: אותו ממשק, שמירה ב-localStorage (מסתנכרן בין לשוניות באותו דפדפן)
function localStore() {
  const KEY = 'triplists-demo';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { events: {} }; } catch { return { events: {} }; } };
  let data = load();
  const subs = new Set();
  const emit = () => subs.forEach(f => f());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} emit(); };
  window.addEventListener('storage', e => { if (e.key === KEY) { data = load(); emit(); } });
  const watch = (get, cb) => {
    const f = () => cb(structuredClone(get()));
    subs.add(f);
    queueMicrotask(f);
    return () => subs.delete(f);
  };
  const E = id => data.events[id];

  return {
    mode: 'local',
    async createEvent({ name, date, participants, personal = [] }) {
      const id = newId();
      const e = (data.events[id] = { meta: { name, date, createdAt: Date.now() }, participants: {}, items: {}, personal: {} });
      participants.forEach((p, i) => (e.participants[newId(8)] = { name: p, spent: 0, order: i, packed: {} }));
      personal.forEach((p, i) => (e.personal[newId(8)] = { name: p, createdAt: Date.now() + i }));
      save();
      return id;
    },
    watchEvent: (id, cb) => watch(() => (E(id) ? { id, ...E(id).meta } : null), cb),
    watchCol: (id, c, cb) => watch(() => (E(id) ? Object.entries(E(id)[c] || {}).map(([k, v]) => ({ id: k, ...v })) : []), cb),
    async add(id, c, d) { (E(id)[c] ||= {})[newId(8)] = { ...d }; save(); },
    async update(id, c, did, d) { Object.assign(E(id)[c][did], d); save(); },
    async remove(id, c, did) { delete E(id)[c][did]; save(); },
    async updateEvent(id, d) { Object.assign(E(id).meta, d); save(); },
    watchTemplate: cb => watch(() => data.template ?? null, cb),
    getTemplate: async () => data.template ?? null,
    async setTemplate(items) { data.template = items; save(); },
  };
}

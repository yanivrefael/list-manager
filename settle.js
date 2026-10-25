// חישוב איזון שווה בשווה ומינימום העברות.
// people: [{ id, name, spent }]  — spent בש"ח
export function settle(people) {
  const n = people.length;
  if (!n) return { total: 0, share: 0, balances: [], transfers: [] };

  // עובדים באגורות כדי להימנע משגיאות עיגול
  const cents = people.map(p => Math.max(0, Math.round((Number(p.spent) || 0) * 100)));
  const total = cents.reduce((a, b) => a + b, 0);
  const base = Math.floor(total / n);
  const rem = total - base * n;

  const bal = people.map((p, i) => ({ id: p.id, name: p.name, paid: cents[i], share: base }));
  // אגורות עודפות הולכות למי ששילמו הכי הרבה, כך שהעיגול לא יוצר העברה מיותרת
  [...bal.keys()].sort((a, b) => cents[b] - cents[a]).slice(0, rem).forEach(i => bal[i].share += 1);
  bal.forEach(b => (b.net = b.paid - b.share));

  const cred = bal.filter(b => b.net > 0).map(b => ({ ...b, left: b.net })).sort((a, b) => b.left - a.left);
  const debt = bal.filter(b => b.net < 0).map(b => ({ ...b, left: -b.net })).sort((a, b) => b.left - a.left);

  const transfers = [];
  let i = 0, j = 0;
  while (i < debt.length && j < cred.length) {
    const amt = Math.min(debt[i].left, cred[j].left);
    if (amt > 0) transfers.push({ from: debt[i].id, fromName: debt[i].name, to: cred[j].id, toName: cred[j].name, amount: amt / 100 });
    debt[i].left -= amt;
    cred[j].left -= amt;
    if (debt[i].left === 0) i++;
    if (cred[j].left === 0) j++;
  }

  return {
    total: total / 100,
    share: total / n / 100,
    balances: bal.map(b => ({ id: b.id, name: b.name, paid: b.paid / 100, share: b.share / 100, net: b.net / 100 })),
    transfers,
  };
}

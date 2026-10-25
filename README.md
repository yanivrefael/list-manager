# List Manager ⛺

A simple site for shared event shopping lists (camping, trips, barbecues) with an equal expense split.

- The organizer creates an event, adds participants and items, and assigns each item to whoever is bringing it.
- Each participant picks their name, sees their own list, and marks what was bought and how much (vs. what was planned).
- Each participant enters how much they spent in total (not per item).
- **Bring from home**: a list of things every participant brings from home (water, plate, cutlery…). Everyone ticks off what they packed. These items are not counted in the expenses.
  - One **template**, edited on the home page, is copied into every new event. Changing it does not affect existing events.
  - Inside an event, edit it in the "ניהול" (Manage) tab; changes show up immediately for every participant in that event.
- The balance screen shows how much each person pays or receives, and who transfers to whom with the minimum number of transfers.

No sign-in. Anyone with an event's link can view and edit it.

## Tech

Plain HTML and JavaScript, no build step. Firestore (Firebase free Spark plan) as the real-time database, hosted on GitHub Pages.
If `firebaseConfig` in `config.js` is `null`, the site runs in demo mode and stores data only in the current browser.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page shell and styles (Hebrew, RTL, mobile-first) |
| `app.js` | UI, routing and event handling |
| `store.js` | Data layer: Firestore, or localStorage in demo mode |
| `settle.js` | Equal-split settlement and minimum-transfer calculation |
| `config.js` | Firebase web config |
| `firestore.rules` | Firestore security rules |

## One-time setup

1. In the [Firebase Console](https://console.firebase.google.com), create a new project (Analytics is optional).
2. Build → Firestore Database → Create database. Pick a European location.
3. In the **Rules** tab, paste the contents of `firestore.rules` and click Publish.
4. Project settings → Your apps → `</>`: register a Web app, copy `firebaseConfig` and paste it into `config.js`:
   ```js
   export const firebaseConfig = { apiKey: "...", authDomain: "...", projectId: "...", /* ... */ };
   ```
5. On GitHub: Settings → Pages → Source: `Deploy from a branch` → `main` / `(root)`.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

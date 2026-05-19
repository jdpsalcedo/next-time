# next-time

Activity timer and tracker. Vite + React frontend, Firebase (Firestore + Google auth) for persistence.

## Data model

- **Activity** — `title`, `description`, `duration_seconds`, `liked`, optional tags.
- **Tag** — `name`, `color`. Survives activity deletion (only the link from the activity is removed).
- **Timer** — `title`, `description`, plus an ordered `items[]` mixing two kinds of entries:
  - **Ref**: `{ activity_id, duration_override }` — references an Activity, optionally overriding its duration for this timer only.
  - **Inline**: `{ inline_title, inline_description, inline_duration_seconds }` — a one-off slot that lives only inside this timer.

Each signed-in user's data lives under `users/{uid}/{tags|activities|timers|settings}` in Firestore.

## Run it locally

```bash
cd frontend
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. Sign in with Google on the landing screen.

## Settings

- **Dark mode** — flips a `data-theme` attribute on `<html>`; light/dark palettes defined in `styles.css`.
- **Reverse timer countdown** — count up from 0 instead of down to 0.
- **Dummy data** — toggling ON seeds tags, activities, and timers under the user's Firestore subtree. Toggling OFF removes only seeded rows (`is_seed=true`); your own data is untouched.

## Project layout

```
frontend/
  src/
    firebase.js        Firebase app init (auth + Firestore + persistent cache)
    auth.jsx           AuthProvider, signIn/signOut, useAuth()
    firebaseStore.js   Firestore CRUD (per-user subcollections)
    api.js             Thin wrapper that re-exports the store as `api.*`
    settings.jsx       Settings context, syncs with users/{uid}/settings/main
    App.jsx            Sign-in gate + router shell
    pages/             Home, Activities, Timers, Settings
    components/        Modal, ContextMenu, TagChip, TimerDial, SortableActivityList
    styles.css         Theme + responsive layout
```

## Firestore security rules

Paste these into Firebase Console → Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Deploy (Firebase App Hosting)

The app deploys to **Firebase App Hosting**. The Cloud Run container runs `node server.mjs` (a tiny static-file server defined in `frontend/server.mjs`) which serves `frontend/dist/` with SPA fallback.

### One-time setup

1. **Upgrade to the Blaze plan** — App Hosting requires it. Firebase Console → ⚙ → Usage and billing → Modify plan → Blaze.

2. **Create the App Hosting backend** in the Firebase Console:
   - Build → App Hosting → **Create backend**
   - Region: pick one (e.g. `us-central1`)
   - GitHub repo: `jdpsalcedo/next-time`, branch: `main`
   - **Root directory: `frontend`** (critical — that's where `package.json` + `apphosting.yaml` live)
   - Backend ID: `next-time` (matches the workflow env var `APP_HOSTING_BACKEND_ID`)
   - Live branch: `main`
   - Auto-deploy: **disable** (the GitHub Actions workflow triggers rollouts instead)

3. **Authorized domains** — once the backend is live, Firebase will give it a URL like `https://next-time--next-time-8844f.us-central1.hosted.app`. Add that domain to **Authentication → Settings → Authorized domains** so Google sign-in works.

4. **Service account for CI**:
   - GCP Console → IAM → Service Accounts → Create. Name: `github-deploy`.
   - Grant the role **Firebase App Hosting Admin** (or the narrower role `Firebase App Hosting Compute Service Agent` if you scope down).
   - Manage keys → Add key → JSON. Download.
   - In GitHub: repo Settings → Secrets and variables → Actions → **New repository secret**.
     - Name: `FIREBASE_SERVICE_ACCOUNT_KEY`
     - Value: paste the full JSON contents of the key file.

### Deploys

Push to `main` → `.github/workflows/deploy.yml` authenticates with the service account, installs `firebase-tools`, and runs `firebase apphosting:rollouts:create next-time --git-branch main`. App Hosting then builds (`npm install` → `npm run build`) and rolls out a new revision.

### Firestore security rules

Paste into Firebase Console → Firestore Database → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

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

## Deploys

The repo ships two parallel deploys, both pointing at the same Firebase project (`next-time-io`). Sign-in and data are shared — they're just different URLs.

| | Where | When | Workflow |
|---|---|---|---|
| Primary | Firebase App Hosting (Cloud Run) | push to `main`, paths under `frontend/**` | [.github/workflows/deploy.yml](.github/workflows/deploy.yml) |
| Static mirror | GitHub Pages (`jdpsalcedo.github.io/next-time/`) | same | [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) |

The static-mirror build sets `VITE_STATIC_MODE=true`, which renders a small **`static`** badge next to the brand on that deploy so you can tell which site you're on. Both bundles are otherwise identical and call Firestore + Auth straight from the browser.

### Firebase App Hosting (Cloud Run)

The app deploys to **Firebase App Hosting**. The Cloud Run container runs `node server.mjs` (a tiny static-file server defined in `frontend/server.mjs`) which serves `frontend/dist/` with SPA fallback.

### One-time setup

1. **Upgrade to the Blaze plan** — App Hosting requires it. Firebase Console → ⚙ → Usage and billing → Modify plan → Blaze.

2. **Create the App Hosting backend** in the Firebase Console:
   - Build → App Hosting → **Create backend**
   - Region: pick one (e.g. `us-east4`)
   - GitHub repo: `jdpsalcedo/next-time`, branch: `main`
   - **Root directory: `frontend`** (critical — that's where `package.json` + `apphosting.yaml` live)
   - Backend ID: `next-time` (matches the workflow env var `APP_HOSTING_BACKEND_ID`)
   - Live branch: `main`
   - Auto-deploy: **disable** (the GitHub Actions workflow triggers rollouts instead)

3. **Authorized domains** — once the backend is live, Firebase will give it a URL like `https://next-time--next-time-io.us-east4.hosted.app`. Add that domain to **Authentication → Settings → Authorized domains** so Google sign-in works.

4. **Service account for CI** — this is the most error-prone step. The `github-deploy` SA needs **four project-level roles** and **one per-SA binding**. None of these are bundled together by Firebase, so missing any one produces a 403 mid-rollout. The fastest path is the gcloud block below:

   ```bash
   PROJECT_ID=next-time-io
   PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
   SA=github-deploy@${PROJECT_ID}.iam.gserviceaccount.com

   gcloud iam service-accounts create github-deploy \
     --display-name="GitHub Actions deploy" \
     --project=$PROJECT_ID

   # Project-level roles
   for ROLE in \
       firebaseapphosting.admin \
       developerconnect.admin \
       developerconnect.readTokenAccessor \
       serviceusage.serviceUsageConsumer; do
     gcloud projects add-iam-policy-binding $PROJECT_ID \
       --member="serviceAccount:${SA}" \
       --role="roles/${ROLE}" --condition=None
   done

   # Per-SA binding: let github-deploy "act as" the App Hosting compute SA
   gcloud iam service-accounts add-iam-policy-binding \
     firebase-app-hosting-compute@${PROJECT_ID}.iam.gserviceaccount.com \
     --member="serviceAccount:${SA}" \
     --role="roles/iam.serviceAccountUser" \
     --project=$PROJECT_ID

   # Download a JSON key
   gcloud iam service-accounts keys create ~/github-deploy-${PROJECT_ID}.json \
     --iam-account=${SA}
   ```

   Then in GitHub: repo Settings → Secrets and variables → Actions → **New repository secret** `FIREBASE_SERVICE_ACCOUNT_KEY` = full JSON contents of the key file.

   **Why each role is needed** (each one was a separate 403 we hit during setup):

   | Role | What it unlocks | Error you see without it |
   |---|---|---|
   | `firebaseapphosting.admin` | Trigger rollouts on the backend | `firebaseapphosting.backends.rollouts.create denied` |
   | `developerconnect.admin` | Manage the GitHub repo connection | `developerconnect.connections.* denied` |
   | `developerconnect.readTokenAccessor` | Mint the OAuth token that clones your repo at build time | `developerconnect.gitRepositoryLinks.fetchReadToken denied` |
   | `serviceusage.serviceUsageConsumer` | Let the CLI check that the App Hosting API is enabled | `Permission denied to get service [firebaseapphosting.googleapis.com]` |
   | `iam.serviceAccountUser` *(on the compute SA, not project-wide)* | "Act as" the compute SA when starting a build | `iam.serviceAccounts.actAs denied on firebase-app-hosting-compute@…` |

   > **Trap: `developerconnect.admin` does NOT include `readTokenAccessor`.** Admin lets you *manage* the GitHub connection; `readTokenAccessor` is gated separately because it mints a token with source-read access. Both are required.

   > **Trap: `iam.serviceAccountUser` is bound on a target SA, not the project.** It's the second gcloud command above — the one with `service-accounts add-iam-policy-binding`. Granting `serviceAccountUser` at the project level technically works too but is overbroad; bind it specifically on `firebase-app-hosting-compute@…`.

   Verify the project-level roles landed:
   ```bash
   gcloud projects get-iam-policy $PROJECT_ID \
     --flatten="bindings[].members" \
     --filter="bindings.members:${SA}" \
     --format="table(bindings.role)"
   ```
   You should see all four `roles/...` entries listed above. The `actAs` binding lives on the compute SA, so it won't show in the project policy — verify separately with:
   ```bash
   gcloud iam service-accounts get-iam-policy \
     firebase-app-hosting-compute@${PROJECT_ID}.iam.gserviceaccount.com \
     --project=$PROJECT_ID
   ```

### Deploys

Push to `main` → `.github/workflows/deploy.yml` authenticates with the service account, installs `firebase-tools`, and runs `firebase apphosting:rollouts:create next-time --git-branch main`. App Hosting then builds (`npm install` → `npm run build`) and rolls out a new revision.

### GitHub Pages (static mirror)

1. Repo Settings → **Pages** → Source: **GitHub Actions**. (No need to configure a branch/folder; the workflow uploads the artifact directly.)
2. Make sure `jdpsalcedo.github.io` is in Firebase Console → **Authentication → Settings → Authorized domains** so Google sign-in works there too.
3. Push to `main`. The Pages workflow builds with `VITE_STATIC_MODE=true` and publishes to `https://jdpsalcedo.github.io/next-time/`.

Routing uses `HashRouter` so URLs look like `…/next-time/#/timers` — that's deliberate; GH Pages doesn't natively SPA-fallback unknown paths, and hash routing dodges the issue entirely.

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

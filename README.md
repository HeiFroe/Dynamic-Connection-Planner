# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

---

## Obsidian Integration

DCDC can sync your asset library and plans bidirectionally with an Obsidian vault.
The vault becomes the source of truth — changes you make in Obsidian (renaming a
note, editing frontmatter, dragging nodes in Canvas) flow back into DCDC on the
next poll.

### Setup

1. **Install the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin** in your Obsidian vault.
2. Open the plugin settings:
   - Note the **Bearer Token** (long random string).
   - Add `http://localhost:3000` to **Allowed Origins** (required for the browser to fetch).
   - Make sure the HTTP server is enabled on port `27123`. (Don't use HTTPS on 27124 —
     the self-signed cert is painful in the browser.)
3. In DCDC, click the **⚙** icon in the header (top right) and configure:
   - **Enable Obsidian sync** on
   - **API Base URL**: `http://127.0.0.1:27123` (default)
   - **Bearer Token**: paste from Obsidian
   - **Vault Subfolder**: `DCDC` (default — all DCDC files live here)
   - **Poll interval**: 30 seconds (default)
4. Click **Test connection** to verify, then **Save**.
5. The first sync pulls vault contents and overwrites your local state.

### What gets synced

| DCDC entity | Vault representation |
|---|---|
| `Asset` | `DCDC/Assets/<category>/<vendor>/<model>--<dbNumber>.md` with full YAML frontmatter |
| Asset image | `DCDC/Attachments/asset-<uuid>.png` |
| `Plan` | `DCDC/Plans/<plan-slug>.canvas` (standard JSON Canvas 1.0 file, editable in Obsidian's Canvas view) |
| Plan extras | `DCDC/Plans/<plan-slug>.dcdc.json` sidecar — holds DCDC-only fields (layer visibility, port IDs, waypoints, isDirect flag) |

### Conflict resolution

**Obsidian always wins.** On app start, DCDC fully pulls from the vault and
replaces its local state. During the session, local edits push to the vault
1.5 seconds after the change. Race conditions (you edit locally while a poll
is in flight) resolve in favour of the vault content.

If a sidecar is missing or deleted, DCDC reconstructs the plan with degraded
fidelity — it picks the first compatible port on each side of every edge.

### Limitations

- Renaming a note in Obsidian is fine — DCDC tracks assets by `dcdc-id` (UUID)
  in frontmatter, not by file path.
- Renaming a plan file in Obsidian changes its slug — the plan is treated as
  the same plan (sidecar carries `planId`).
- Deleting an asset note in Obsidian deletes it locally too. Plans referencing
  that asset will show orphan instances.
- The hand-rolled YAML parser handles the DCDC schema (scalars, flow objects
  like `position: { x, y }`, arrays of objects). Extra free-form YAML you add
  won't be preserved.

---

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

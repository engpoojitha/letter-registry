# Docshare

Simple monorepo for the letter management app.

## Structure

- `apps/frontend`: static React HTML app served by nginx
- `apps/backend`: Node.js API that saves shared app data to `data/data.json`
- `apps/apps-script`: Google Apps Script API for Google Sheets and Drive hosting
- `data`: local persistent data folder mounted into Docker

## Recommended Public Hosting

The recommended free public setup is:

- GitHub Pages for the frontend
- Google Apps Script Web App for the API
- Google Sheets for database tables
- Google Drive for attachments

Setup guide:

```text
docs/google-apps-script-setup.md
```

ERD:

```text
docs/erd.md
```

## GitHub Pages And PR Previews

This repo deploys the frontend from `apps/frontend` to a `gh-pages` branch.

In GitHub, configure:

```text
Settings > Pages > Deploy from a branch > gh-pages > / (root)
```

Pull requests get preview URLs under:

```text
https://NISHAN-AKALANKA.github.io/docshare/pr-preview/pr-<PR_NUMBER>/
```

The preview is updated on every PR push and removed when the PR is closed.

If the root URL shows a GitHub Pages 404, run or merge the main Pages deployment first. The preview URL itself must include `/pr-preview/pr-<PR_NUMBER>/`.

If the PR preview workflow logs `Timed out waiting for build to start`, the preview files were still pushed to `gh-pages`; GitHub Pages just did not report a matching deployment in time. Wait a minute and open the preview URL directly.

## Run With Docker

```bash
docker compose up --build
```

Open:

```text
http://localhost:3005
```

The backend saves shared data on your local machine at:

```text
./data/data.json
```

## Public Access

Expose `http://localhost:3005` with a tunnel such as Cloudflare Tunnel or ngrok.

Example:

```bash
cloudflared tunnel --url http://localhost:3005
```

Keep the computer on while people use the app.

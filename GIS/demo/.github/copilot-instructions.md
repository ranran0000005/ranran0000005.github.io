# Copilot instructions for this repository

Purpose
- Help AI coding agents be immediately productive when working on this small static website under `/var/www/website/GIS`.

Big picture
- This is a minimal, static single-page site. The root page is `index.html` and there are no build tools, package manifests, or test suites present.
- Expect manual editing of HTML/CSS/JS and direct deployment to a webroot (this workspace appears to be the served site directory).

Key files & patterns
- `index.html`: the single entry point. Note: it contains non-standard structure (e.g. `<doc type="html">`, `<header>` inside `<head>`). Do NOT refactor aggressively without explicit user approval.
- Top-level layout is inline-styled; look for `assets/`, `favicon.ico`, or sibling directories when adding resources.

Developer workflows (discoverable)
- No build step detected. To preview locally, run from the repo root:
  - `python3 -m http.server 8000` and open `http://localhost:8000`.
  - Or use `npx serve .` if Node is available.
- Deploying appears to be copying files into the webserver document root (this workspace path suggests `/var/www/website/GIS`). Confirm with maintainer before automating deployment.

Conventions & agent behavior
- Preserve the site's minimal footprint: avoid adding new build tooling, heavy dependencies, or changing hosting assumptions unless asked.
- When editing `index.html`, prefer small, targeted fixes and clearly explain any structural changes in the commit message.
- Do not reformat or normalize HTML automatically; point out anomalies and ask the user whether to modernize structure (e.g. replace `<doc type="html">` with `<!DOCTYPE html>`).

Integration points & external dependencies
- No package manifests found; there are no npm, pip, or other dependency files to modify.
- External integrations (APIs, databases) are not discoverable in the repo files—ask before adding credentials or network calls.

Examples (from this repo)
- To add an image referenced from `index.html`, place it in `assets/` and reference as `assets/img.png`.
- To preview a change and keep a rollback: create a commit with a concise message, e.g. `fix(html): correct meta/head structure in index.html`.

If `.github/copilot-instructions.md` already exists
- Merge approach: preserve any existing top-level guidance, append repo-specific sections above, and call out any conflicts for human review.

Questions for the maintainer
- Confirm preferred deployment method and any server-side constraints.
- Indicate whether modernizing HTML structure is permitted, or if changes must be conservative.

If anything is unclear, ask before making wide-reaching changes.

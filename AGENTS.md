# Repository Guidelines

[中文版本（AGENTS_CN.md）](./AGENTS_CN.md)

## Project Structure & Module Organization
- `src/`: Vue 3 app — SFCs in `components/`, utilities in `utils/`, web workers in `workers/`.
- `public/`: Static assets; `index.html` entry.
- `tests/`: Playwright specs (`*.spec.js`); screenshots/artifacts in `test-results/` and `test_screenshots/`.
- `fnirs_sdk/` + `fnirs_data_server.py`: Python SDK and local data/API server.
- `docs/`, `screenshots/`, reports (`UI_TEST_REPORT.md`, etc.) for references.

## Build, Test, and Development Commands
- Install: `npm install`
- Dev (frontend): `npm run dev` (Vite on port 3000). For tests, Playwright auto-starts Vite on 3001 via `playwright.config.js`.
- Build: `npm run build`; Preview: `npm run preview`.
- Backend (Python): `python -m venv .venv && .venv\\Scripts\\activate && pip install -r requirements.txt && python fnirs_data_server.py` (defaults to 8091).
- Tests (UI): `npm test` for headless; `npm run test:ui` for inspector. Tip (Windows): `./kill-ports-3000-8090.bat` to free ports.

## Coding Style & Naming Conventions
- JS/Vue: 2-space indent, ESM modules, alias `@` -> `src` (see `vite.config.js`). Components in PascalCase (e.g., `TrainingView.vue`); utilities CamelCase (e.g., `HeatmapRenderer.js`). Prefer `data-testid` for selectors used in tests.
- Python: PEP 8, 4-space indent, snake_case modules; add type hints where practical.

## Testing Guidelines
- Framework: Playwright (`@playwright/test`). Place specs under `tests/` as `*.spec.js`.
- Base URL: many specs assume `http://localhost:3001/`; run Vite with `--port 3001` when executing tests.
- Artifacts: screenshots saved to `test-results/`. For end-to-end flows, ensure frontend (Vite) and backend (`fnirs_data_server.py` on 8091) are running.

## Commit & Pull Request Guidelines
- Commits: use Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`). Keep messages short and imperative; Chinese or English is fine.
- PRs: include purpose, linked issues, test plan (commands run), and screenshots for UI changes. Keep diffs focused and ensure Playwright tests pass locally.

## Security & Configuration Tips
- Don’t commit secrets or large binaries; respect `.gitignore`. Use a local `.venv/`. Default ports: 3000/3001 (frontend), 8091 (backend).

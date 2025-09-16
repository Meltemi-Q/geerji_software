# Repository Guidelines

[中文版本（AGENTS_CN.md）](./AGENTS_CN.md)

## Project Structure & Module Organization
- `src/`: Vue 3 app; SFCs in `components/`, utilities in `utils/`, workers in `workers/`.
- `public/`: Static assets; entry `index.html`.
- `tests/`: Playwright specs (`*.spec.js`); artifacts in `test-results/` and `test_screenshots/`.
- `fnirs_sdk/`, `fnirs_data_server.py`: Python SDK and local data/API server (8091).
- `docs/`, `screenshots/`: Plans, reports, and references.

## Build, Test, and Development
- Install deps: `npm install`
- Frontend dev: `npm run dev` (Vite on 3000). Tests expect 3001; Playwright config auto-starts Vite on 3001 when running tests.
- Build/preview: `npm run build` / `npm run preview`
- Backend (Python):
  - Linux/macOS: `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && python fnirs_data_server.py`
  - Windows: `python -m venv .venv && .venv\\Scripts\\activate && pip install -r requirements.txt && python fnirs_data_server.py`
- UI tests: `npm test` (headless), `npm run test:ui` (inspector). Windows tip: `./kill-ports-3000-8090.bat`.

## Coding Style & Naming Conventions
- JS/Vue: 2-space indent, ESM; alias `@` -> `src` (see `vite.config.js`). Components PascalCase (e.g., `TrainingView.vue`); utilities CamelCase (e.g., `HeatmapRenderer.js`). Prefer `data-testid` for selectors.
- Python: PEP 8, 4-space indent; snake_case modules; add type hints where practical.

## Testing Guidelines
- Framework: Playwright (`@playwright/test`); specs under `tests/*.spec.js`.
- Base URL: `http://localhost:3001/`. Ensure frontend (Vite) and backend (8091) are running for end-to-end flows.
- Artifacts: screenshots and traces in `test-results/` (and `test_screenshots/` when used).

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`), concise, imperative; English or Chinese are fine.
- PRs: state purpose, link issues, include a test plan (commands run) and UI screenshots for visual changes. Keep diffs focused and ensure Playwright tests pass locally.

## Security & Configuration Tips
- Do not commit secrets or large binaries; honor `.gitignore`. Use a local `.venv/`. Default ports: 3000/3001 (frontend), 8091 (backend).

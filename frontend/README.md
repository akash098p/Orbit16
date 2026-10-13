# Orbit16 Studio UI

React + TypeScript + Vite client.

- npm install installs frontend packages.
- npm run dev starts the UI on loopback at port 5173.
- npm run build type-checks and builds the production UI to dist.
- npm run typecheck runs the TypeScript checker.

In development, Vite proxies /api to FastAPI on 127.0.0.1:8000. Keep both services on loopback. The initial theme selector supports Midnight and Light; other theme JSON files are starter assets for the complete theme loader in a later phase.

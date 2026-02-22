# Proto Drive: Backend 🐾

This is the high-performance, stateless backend for Proto Drive, built with **Bun**, **Hono**, and **Pino**.

## 🛠️ Tech Stack

- **Runtime**: Bun
- **Framework**: Hono
- **Bundler**: esbuild (for Vercel deployment)
- **Logging**: Pino (JSON format in production)

## 🚀 Getting Started

### 1. Install Dependencies

```sh
bun install
```

### 2. Configuration

Copy `.env.example` to `.env` and fill in your credentials.

### 3. Development

```sh
bun run dev
```

The server will start on `http://localhost:3000`.

### 4. Build (for Vercel)

```sh
npm run build
```

This bundles the TypeScript source code into `dist/index.js` using esbuild.

## 🏗️ Architecture

- `src/app.ts`: Core application logic and middleware.
- `src/index.ts`: Entry point for local Bun development.
- `src/vercel.ts`: Entry point for Vercel deployment.
- `src/lib/`: Shared utilities (logger, discord, database).
- `src/routes/`: API route definitions.
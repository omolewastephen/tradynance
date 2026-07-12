// PM2 process definitions for a non-Docker deploy — the Next.js standalone web server plus the
// five standalone services. Usage (after `npm ci`, a running Postgres, `npm run db:migrate`,
// `npm run db:seed`, and `npm run build`):
//
//   npm i -g pm2
//   pm2 start ecosystem.config.cjs
//   pm2 save && pm2 startup      # restart on reboot
//   pm2 logs                     # tail all processes
//
// Env is loaded from the repo-root .env (see .env.docker.example for the keys — the same set
// applies here; DATABASE_URL should point at your Postgres host).

const fs = require("node:fs");
const path = require("node:path");

function loadEnv(file) {
  const env = {};
  try {
    for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^([\w.]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[m[1]] = v;
    }
  } catch {
    /* no .env — rely on the ambient environment */
  }
  return env;
}

const env = { ...loadEnv(path.join(__dirname, ".env")), NODE_ENV: "production" };
const tsx = "node_modules/.bin/tsx";

// tsx binary run directly (interpreter "none"), from the repo root, on each service entrypoint.
const service = (name, entry) => ({
  name,
  cwd: __dirname,
  script: tsx,
  args: entry,
  interpreter: "none",
  autorestart: true,
  env,
});

module.exports = {
  apps: [
    {
      name: "web",
      cwd: path.join(__dirname, "web/.next/standalone/web"),
      script: "server.js",
      autorestart: true,
      env: { ...env, PORT: env.PORT || "3000", HOSTNAME: env.HOSTNAME || "0.0.0.0" },
    },
    service("market-data", "services/market-data/src/index.ts"),
    service("market-maker", "services/market-maker/src/index.ts"),
    service("liquidation-engine", "services/liquidation-engine/src/index.ts"),
    service("sweeper", "services/sweeper/src/index.ts"),
    service("chain-watcher", "services/chain-watcher/src/index.ts"),
  ],
};

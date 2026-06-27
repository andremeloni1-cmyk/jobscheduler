// PM2 process definition for JoineryFlow.
// Usage: pm2 start deploy/ecosystem.config.js && pm2 save
module.exports = {
  apps: [
    {
      name: "joineryflow",
      cwd: __dirname + "/..",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};

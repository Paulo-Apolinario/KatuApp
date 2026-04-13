module.exports = {
  apps: [
    {
      name: "katu-api",
      script: "dist/server.js",
      cwd: "/var/www/katu-server/server",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        APP_ENV: "production"
      }
    }
  ]
};
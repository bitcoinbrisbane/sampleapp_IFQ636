// PM2 process definition for the DebateApp backend on the EC2 box.
// Started/reloaded by the GitHub Actions deploy workflow:
//   pm2 startOrReload ecosystem.config.js --update-env
module.exports = {
  apps: [
    {
      name: 'debateapp-backend',
      cwd: '/var/www/debateapp/backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
        MONGO_URI: 'mongodb://localhost:27017/debateapp',
        // JWT_SECRET is injected at deploy time from the GitHub Actions secret
        // into /var/www/debateapp/backend/.env (dotenv loads it in server.js).
      },
    },
  ],
};

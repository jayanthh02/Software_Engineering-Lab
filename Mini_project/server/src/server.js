const app = require('./app');
const config = require('./config');

if (!config.jwtSecret) {
  console.error('JWT_SECRET is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

app.listen(config.port, () => console.log(`API running on port ${config.port}`));

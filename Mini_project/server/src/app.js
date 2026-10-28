const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');

const app = express();
app.use(cors());
app.use(express.json());

// Public endpoint (SCP-NF-004)
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);

// Unknown route
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' });
});

// Error handler: JSON {error, message}, never a stack trace (SAD 4.4)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Malformed JSON body' });
  }
  console.error('Unhandled error:', err.message); // message only, no request body
  return res.status(500).json({ error: 'SERVER_ERROR', message: 'Something went wrong' });
});

module.exports = app;

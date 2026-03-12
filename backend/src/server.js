const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const workflowRoutes = require('./routes/workflows');
const requestRoutes = require('./routes/requests');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/workflows', workflowRoutes);
app.use('/api/requests', requestRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀 Workflow Platform API running on http://localhost:${PORT}`);
    console.log(`📋 API Docs:\n  GET  /api/workflows\n  POST /api/workflows/:id/submit\n  GET  /api/requests\n  GET  /api/requests/:id/audit\n`);
  });
}

module.exports = app;

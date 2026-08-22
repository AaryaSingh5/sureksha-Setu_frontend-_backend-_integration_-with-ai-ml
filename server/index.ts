import express from 'express';
import cors from 'cors';
import { initDatabase } from './db';
import authRoutes from './routes/auth';
import sosRoutes from './routes/sos';
import touristRoutes from './routes/tourists';
import responderRoutes from './routes/responders';
import aiAndBroadcastRoutes from './routes/aiAndBroadcasts';

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// API v1 Routers
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/sos', sosRoutes);
app.use('/api/v1/tourists', touristRoutes);
app.use('/api/v1', responderRoutes);
app.use('/api/v1', aiAndBroadcastRoutes);

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Suraksha Setu Emergency Command API',
    timestamp: new Date().toISOString()
  });
});

// Initialize database and start listening
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`  🚨 SURAKSHA SETU BACKEND SERVER IS RUNNING 🚨`);
      console.log(`  Base URL: http://localhost:${PORT}/api/v1`);
      console.log(`  Health Check: http://localhost:${PORT}/api/v1/health`);
      console.log(`=======================================================`);
    });
  })
  .catch((err) => {
    console.error('Fatal error initializing database:', err);
    process.exit(1);
  });

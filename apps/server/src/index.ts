import express from 'express';
import integrationRouter from './api/integration-router';
import healthRouter from './api/health-router';
import { initializeDatabase } from './dal/database';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database tables
initializeDatabase();

app.use(express.json());
app.use('/api/v1', integrationRouter);
app.use('/', healthRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

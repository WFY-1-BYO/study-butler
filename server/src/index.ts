import express from "express";
import cors from "cors";
import subjectsRouter from "./routes/subjects.js";
import eventsRouter from "./routes/events.js";
import planTasksRouter from "./routes/plan-tasks.js";
import materialsRouter from "./routes/materials.js";
import aiRouter from "./routes/ai.js";

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

app.use('/api/v1/subjects', subjectsRouter);
app.use('/api/v1/events', eventsRouter);
app.use('/api/v1/plan-tasks', planTasksRouter);
app.use('/api/v1/materials', materialsRouter);
app.use('/api/v1/ai', aiRouter);

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
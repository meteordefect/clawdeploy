import express from "express";
import cors from "cors";
import Dockerode from "dockerode";
import { API_HOST, API_PORT } from "./config.js";
import * as memory from "./memory.js";
import * as github from "./github.js";
import * as phoung from "./phoung.js";

const app = express();
app.use(cors());
app.use(express.json());

const docker = new Dockerode({ socketPath: "/var/run/docker.sock" });

// --- Health ---

app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "3.0.0" });
});

// --- Tasks ---

app.get("/tasks", (_req, res) => {
  res.json(memory.listAllTasks());
});

app.get("/tasks/:taskId", (req, res) => {
  const task = memory.loadTask(req.params.taskId);
  if (!task) return res.status(404).json({ detail: "Task not found" });
  res.json(task);
});

app.post("/tasks/:taskId/merge", async (req, res) => {
  try {
    const task = memory.loadTask(req.params.taskId);
    if (!task) return res.status(404).json({ detail: "Task not found" });
    const pr = task.meta.pr as string | undefined;
    if (!pr) return res.status(400).json({ detail: "No PR associated with this task" });

    const ctx = memory.loadProjectContext((task.meta.project as string) || "");
    const repoUrl = memory.extractRepoUrl(ctx);
    if (!repoUrl) return res.status(400).json({ detail: "No repo URL found" });

    await github.mergePr(repoUrl, parseInt(pr, 10));
    memory.moveToCompleted(req.params.taskId);
    res.json({ status: "merged" });
  } catch (e: unknown) {
    res.status(500).json({ detail: e instanceof Error ? e.message : String(e) });
  }
});

app.post("/tasks/:taskId/reject", async (req, res) => {
  try {
    const task = memory.loadTask(req.params.taskId);
    if (!task) return res.status(404).json({ detail: "Task not found" });
    const pr = task.meta.pr as string | undefined;
    if (pr) {
      const ctx = memory.loadProjectContext((task.meta.project as string) || "");
      const repoUrl = memory.extractRepoUrl(ctx);
      if (repoUrl) await github.closePr(repoUrl, parseInt(pr, 10));
    }
    memory.updateTask(req.params.taskId, { status: "rejected" });
    res.json({ status: "rejected" });
  } catch (e: unknown) {
    res.status(500).json({ detail: e instanceof Error ? e.message : String(e) });
  }
});

app.get("/tasks/:taskId/activity", (req, res) => {
  const task = memory.loadTask(req.params.taskId);
  if (!task) return res.status(404).json({ detail: "Task not found" });
  res.json(memory.loadTaskActivity(req.params.taskId));
});

app.get("/tasks/:taskId/runs/:run/log", (req, res) => {
  const task = memory.loadTask(req.params.taskId);
  if (!task) return res.status(404).json({ detail: "Task not found" });
  const logText = memory.loadAgentLog(req.params.taskId, parseInt(req.params.run, 10));
  if (logText === null) return res.status(404).json({ detail: `No log found for run ${req.params.run}` });
  res.json({ task_id: req.params.taskId, run: parseInt(req.params.run, 10), log: logText });
});

app.get("/tasks/:taskId/pr-info", async (req, res) => {
  try {
    const task = memory.loadTask(req.params.taskId);
    if (!task) return res.status(404).json({ detail: "Task not found" });
    const pr = task.meta.pr as string | undefined;
    if (!pr) return res.status(400).json({ detail: "No PR associated with this task" });
    const ctx = memory.loadProjectContext((task.meta.project as string) || "");
    const repoUrl = memory.extractRepoUrl(ctx);
    if (!repoUrl) return res.status(400).json({ detail: "No repo URL found" });
    const details = await github.getPrDetails(repoUrl, parseInt(pr, 10));
    res.json(details);
  } catch (e: unknown) {
    res.status(500).json({ detail: e instanceof Error ? e.message : String(e) });
  }
});

// --- Chat ---

app.post("/chat", async (req, res) => {
  try {
    const { message, conversation_id, model } = req.body;
    const convId = conversation_id || memory.createConversation();
    const response = await phoung.chat(message, convId, model || undefined);
    res.json({ response, conversation_id: convId });
  } catch (e: unknown) {
    res.status(500).json({ detail: e instanceof Error ? e.message : String(e) });
  }
});

// --- Conversations ---

app.get("/conversations", (_req, res) => {
  res.json(memory.listAllConversations());
});

app.get("/conversations/:convId", (req, res) => {
  const conv = memory.loadConversation(req.params.convId);
  if (!conv) return res.status(404).json({ detail: "Conversation not found" });
  res.json({ id: req.params.convId, content: conv });
});

app.post("/conversations/new", (_req, res) => {
  const convId = memory.createConversation();
  res.json({ conversation_id: convId });
});

// --- Models ---

app.get("/models", async (_req, res) => {
  try {
    const models = await phoung.getAvailableModels();
    res.json(models);
  } catch {
    res.json([]);
  }
});

// --- Projects ---

app.get("/projects", (_req, res) => {
  const projects = memory.listProjects();
  res.json(projects.map(name => ({
    name,
    context_preview: memory.loadProjectContext(name).slice(0, 200),
  })));
});

// --- Logs ---

const KNOWN_CONTAINERS: Record<string, string> = {
  api: "clawdeploy-api",
  ui: "clawdeploy-ui",
  nginx: "clawdeploy-nginx",
};

app.get("/logs", (_req, res) => {
  res.json(Object.keys(KNOWN_CONTAINERS));
});

app.get("/logs/:service", async (req, res) => {
  const containerName = KNOWN_CONTAINERS[req.params.service];
  if (!containerName) return res.status(404).json({ detail: `Unknown service: ${req.params.service}` });

  const lines = Math.min(parseInt((req.query.lines as string) || "200", 10), 2000);
  try {
    const container = docker.getContainer(containerName);
    const logBuf = await container.logs({ tail: lines, timestamps: true, stdout: true, stderr: true });
    res.json({ service: req.params.service, container: containerName, logs: logBuf.toString("utf-8") });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such container") || msg.includes("404")) {
      return res.status(404).json({ detail: `Container ${containerName} not found` });
    }
    res.status(500).json({ detail: msg });
  }
});

// --- Cron ---

app.post("/cron/wake", async (_req, res) => {
  try {
    const { runCronCycle } = await import("./cron.js");
    await runCronCycle();
    res.json({ status: "ok" });
  } catch (e: unknown) {
    res.status(500).json({ detail: e instanceof Error ? e.message : String(e) });
  }
});

// --- Start ---

export function startServer() {
  app.listen(API_PORT, API_HOST, () => {
    console.log(`ClawDeploy API v3.0.0 listening on ${API_HOST}:${API_PORT}`);
  });
}

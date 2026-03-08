import Dockerode from "dockerode";
import {
  KIMI_API_KEY,
  ZAI_API_KEY,
  ANTHROPIC_API_KEY,
  GITHUB_TOKEN,
  MAX_CONCURRENT_SUBAGENTS,
  SUBAGENT_IMAGE,
  SUBAGENT_MODEL,
  SUBAGENT_MEMORY_LIMIT,
  SUBAGENT_CPUS,
} from "./config.js";
import * as memory from "./memory.js";

const docker = new Dockerode({ socketPath: "/var/run/docker.sock" });

async function countRunning(): Promise<number> {
  const containers = await docker.listContainers({
    filters: { label: ["clawdeploy.type=subagent"] },
  });
  return containers.length;
}

export async function checkContainers(): Promise<{ taskId: string; run: number; containerId: string; status: string; exitCode: number | null }[]> {
  const all = await docker.listContainers({
    all: true,
    filters: { label: ["clawdeploy.type=subagent"] },
  });
  const results: { taskId: string; run: number; containerId: string; status: string; exitCode: number | null }[] = [];

  for (const info of all) {
    const container = docker.getContainer(info.Id);
    const taskId = info.Labels["clawdeploy.task"] || "";
    const run = parseInt(info.Labels["clawdeploy.run"] || "0", 10);
    const status = info.State;
    let exitCode: number | null = null;

    if (status === "exited") {
      const inspect = await container.inspect();
      exitCode = inspect.State.ExitCode;
      try {
        const logBuf = await container.logs({ tail: 500, stdout: true, stderr: true });
        const logText = logBuf.toString("utf-8");
        if (taskId && run) memory.saveAgentLog(taskId, run, logText);
      } catch {}
      memory.appendTaskActivity(taskId, { type: "agent_completed", run, exit_code: exitCode });
      try { await container.remove(); } catch {}
    }

    results.push({ taskId, run, containerId: info.Id.slice(0, 12), status, exitCode });
  }
  return results;
}

function buildFullPrompt(taskId: string, taskPrompt: string): string {
  const template = memory.loadSubagentPrompt();
  return template.replace("{AGENT_ID}", taskId).replace("{TASK_PROMPT}", taskPrompt);
}

function nextRun(taskId: string): number {
  const activity = memory.loadTaskActivity(taskId);
  const runs = activity
    .filter(e => e.type === "agent_spawned")
    .map(e => (e.run as number) || 0);
  return Math.max(0, ...runs) + 1;
}

export async function spawn(taskId: string, project: string, prompt: string, agentType = "pi") {
  const running = await countRunning();
  if (running >= MAX_CONCURRENT_SUBAGENTS) {
    memory.log(`Cannot spawn subagent for ${taskId}: at max capacity (${MAX_CONCURRENT_SUBAGENTS})`);
    memory.updateTask(taskId, { status: "queued", note: "Waiting for subagent slot" });
    return;
  }

  const projectContext = memory.loadProjectContext(project);
  const repoUrl = memory.extractRepoUrl(projectContext);
  if (!repoUrl) {
    memory.log(`Cannot spawn subagent for ${taskId}: no repo URL found in project context`);
    memory.updateTask(taskId, { status: "failed", note: "No repo URL in project context" });
    return;
  }

  const fullPrompt = buildFullPrompt(taskId, prompt);
  const run = nextRun(taskId);
  const branch = `task/${taskId}`;

  try {
    const container = await docker.createContainer({
      Image: SUBAGENT_IMAGE,
      Env: [
        `GITHUB_TOKEN=${GITHUB_TOKEN}`,
        `KIMI_API_KEY=${KIMI_API_KEY}`,
        `ZAI_API_KEY=${ZAI_API_KEY}`,
        `ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}`,
        `SUBAGENT_MODEL=${SUBAGENT_MODEL}`,
        `TASK_ID=${taskId}`,
        `BRANCH=${branch}`,
        `PROMPT=${fullPrompt}`,
        `REPO_URL=${repoUrl}`,
        `AGENT_TYPE=${agentType}`,
      ],
      Labels: {
        "clawdeploy.type": "subagent",
        "clawdeploy.task": taskId,
        "clawdeploy.run": String(run),
      },
      HostConfig: {
        Memory: parseMemLimit(SUBAGENT_MEMORY_LIMIT),
        NanoCpus: Math.round(parseFloat(SUBAGENT_CPUS) * 1e9),
      },
    });
    await container.start();

    const containerId = container.id.slice(0, 12);
    memory.updateTask(taskId, { status: "coding", container_id: containerId, current_run: run });
    memory.appendTaskActivity(taskId, {
      type: "agent_spawned",
      run,
      container_id: containerId,
      agent_type: agentType,
      prompt: fullPrompt,
    });
    memory.log(`Spawned subagent ${containerId} for task ${taskId} (run ${run})`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    memory.log(`Failed to spawn subagent for ${taskId}: ${msg}`);
    memory.updateTask(taskId, { status: "failed", note: msg });
  }
}

function parseMemLimit(limit: string): number {
  const match = limit.match(/^(\d+)([gmk]?)$/i);
  if (!match) return 4 * 1024 * 1024 * 1024;
  const num = parseInt(match[1], 10);
  const unit = (match[2] || "b").toLowerCase();
  if (unit === "g") return num * 1024 * 1024 * 1024;
  if (unit === "m") return num * 1024 * 1024;
  if (unit === "k") return num * 1024;
  return num;
}

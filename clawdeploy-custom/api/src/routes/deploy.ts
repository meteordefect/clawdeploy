/**
 * Deploy and rollback endpoints. Requires Docker socket and CLAWDEPLOY_PROJECT_PATH.
 * Used for direct VPS deploy (no round-trips) when OpenClaw edits files on the mount.
 */
import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const router = Router();

const PROJECT_PATH = process.env.CLAWDEPLOY_PROJECT_PATH;
const DOCKER_IMAGE = 'docker:24'; // Has docker CLI and compose v2

function canDeploy(): { ok: boolean; reason?: string } {
  if (!PROJECT_PATH) {
    return { ok: false, reason: 'CLAWDEPLOY_PROJECT_PATH not set' };
  }
  return { ok: true };
}

function runDockerCompose(command: string): Promise<{ stdout: string; stderr: string }> {
  const fullCmd = [
    'docker', 'run', '--rm',
    '-v', '/var/run/docker.sock:/var/run/docker.sock',
    '-v', `${PROJECT_PATH}:/app`,
    '-w', '/app',
    '-e', 'COMPOSE_HTTP_TIMEOUT=200',
    DOCKER_IMAGE,
    'sh', '-c', command,
  ].join(' ');
  return execAsync(fullCmd, { maxBuffer: 10 * 1024 * 1024 });
}

router.post('/deploy', async (req: Request, res: Response) => {
  const check = canDeploy();
  if (!check.ok) {
    res.status(503).json({ error: check.reason });
    return;
  }

  try {
    const { stdout, stderr } = await runDockerCompose(
      'docker compose build --no-cache && docker compose up -d --force-recreate'
    );
    res.json({
      status: 'ok',
      output: stdout + (stderr ? '\n' + stderr : ''),
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    res.status(500).json({
      error: 'Deploy failed',
      output: (e.stdout || '') + (e.stderr ? '\n' + e.stderr : ''),
      message: e.message,
    });
  }
});

router.post('/deploy/rollback', async (req: Request, res: Response) => {
  const check = canDeploy();
  if (!check.ok) {
    res.status(503).json({ error: check.reason });
    return;
  }

  const rollbackScript = `
    set -e
    docker compose down
    docker tag clawdeploy-custom-dashboard:latest clawdeploy-custom-dashboard:broken 2>/dev/null || true
    docker tag clawdeploy-custom-dashboard:previous clawdeploy-custom-dashboard:latest 2>/dev/null || true
    docker tag clawdeploy-custom-api:latest clawdeploy-custom-api:broken 2>/dev/null || true
    docker tag clawdeploy-custom-api:previous clawdeploy-custom-api:latest 2>/dev/null || true
    docker compose up -d
  `.replace(/\n\s+/g, ' ').trim();

  try {
    const { stdout, stderr } = await runDockerCompose(rollbackScript);
    res.json({
      status: 'ok',
      output: stdout + (stderr ? '\n' + stderr : ''),
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    res.status(500).json({
      error: 'Rollback failed',
      output: (e.stdout || '') + (e.stderr ? '\n' + e.stderr : ''),
      message: e.message,
    });
  }
});

export default router;

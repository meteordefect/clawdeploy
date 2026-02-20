/**
 * Deploy, rollback, and sync endpoints. Requires Docker socket and CLAWDEPLOY_PROJECT_PATH.
 * Sync: OpenClaw pushes its workspace (gzipped tarball) so edits take effect on VPS before deploy.
 * Access control: nginx auth_basic on /dashboard/custom/api/ protects these endpoints.
 */
import express, { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { query } from '../db/client';

const router = Router();

const PROJECT_PATH = process.env.CLAWDEPLOY_PROJECT_PATH;

const DOCKER_IMAGE = 'docker:24'; // Has docker CLI and compose v2
const DEPLOY_TIMEOUT_MS = 25 * 60 * 1000; // 25 min - full builds can be slow

function canDeploy(): { ok: boolean; reason?: string } {
  if (!PROJECT_PATH) {
    return { ok: false, reason: 'CLAWDEPLOY_PROJECT_PATH not set' };
  }
  return { ok: true };
}

function runDockerCompose(command: string): Promise<{ stdout: string; stderr: string }> {
  const args = [
    'run', '--rm',
    '-v', '/var/run/docker.sock:/var/run/docker.sock',
    '-v', `${PROJECT_PATH}:/app`,
    '-w', '/app',
    '-e', 'COMPOSE_HTTP_TIMEOUT=200',
    '-e', 'COMPOSE_PROJECT_NAME=clawdeploy-custom',
    DOCKER_IMAGE,
    'sh', '-c', command,
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => stdout += data.toString());
    proc.stderr?.on('data', (data) => stderr += data.toString());

    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      const err = new Error(`Deploy timed out after ${DEPLOY_TIMEOUT_MS / 60000} minutes\n${stdout}${stderr}`) as Error & { stdout?: string; stderr?: string };
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
    }, DEPLOY_TIMEOUT_MS);

    proc.on('close', (code, signal) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const err = new Error(
          signal ? `Command killed (${signal})\n${stdout}${stderr}` : `Command failed with exit code ${code}\n${stdout}${stderr}`
        ) as Error & { stdout?: string; stderr?: string };
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/** Clear stuck building/starting deploys on API startup (e.g. after full deploy killed this process) */
export async function clearStuckDeploys() {
  try {
    const result = await query(
      `UPDATE deploys SET status = 'failed', error = 'Interrupted by API restart', stage = NULL, updated_at = now()
       WHERE status IN ('building', 'starting')
       RETURNING id`
    );
    if (result && (result as any[]).length > 0) {
      console.log(`Cleared ${(result as any[]).length} stuck deploy(s)`);
    }
  } catch (err) {
    console.error('Failed to clear stuck deploys:', err);
  }
}

// Deploy state management
async function updateDeployState(id: string, status: string, stage?: string, output?: string, error?: string) {
  const updates: any = {
    status,
    updated_at: new Date(),
  };
  if (stage !== undefined) updates.stage = stage;
  if (output !== undefined) updates.output = output;
  if (error !== undefined) updates.error = error;

  await query(
    `UPDATE deploys SET ${Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`,
    [id, ...Object.values(updates)]
  );
}

async function createDeploy() {
  const result = await query(
    'INSERT INTO deploys (status, stage, started_at) VALUES ($1, $2, $3) RETURNING id',
    ['building', 'initializing', new Date()]
  );
  return (result as any)[0].id;
}

router.get('/deploy/status', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM deploys ORDER BY created_at DESC LIMIT 1'
    );
    const deploy = (result as any)[0];
    if (!deploy) {
      res.json({ deploying: false });
      return;
    }
    const deploying = deploy.status === 'building' || deploy.status === 'starting';
    let lastResult: { success: boolean; error?: string } | undefined;
    if (deploy.status === 'success' || deploy.status === 'failed') {
      const updatedAt = deploy.updated_at ? new Date(deploy.updated_at).getTime() : 0;
      const ageMs = Date.now() - updatedAt;
      if (ageMs < 15_000) {
        lastResult = deploy.status === 'success'
          ? { success: true }
          : { success: false, error: deploy.error };
      }
    }

    res.json({
      deploying,
      stage: deploying ? deploy.stage : undefined,
      lastResult,
      logs: deploy.output ?? '',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch deploy status' });
  }
});

/**
 * Called by redeploy.sh and ansible when manual (CLI) deploy completes.
 * Clears any stuck building/starting deploys so the banner dismisses.
 */
router.post('/deploy/complete', async (req: Request, res: Response) => {
  try {
    await query(
      `UPDATE deploys SET status = 'success', updated_at = now(), stage = NULL
       WHERE status IN ('building', 'starting')`
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Deploy complete error:', err);
    res.status(500).json({ error: 'Failed to clear deploy state' });
  }
});

router.get('/deploy/logs', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT output FROM deploys ORDER BY created_at DESC LIMIT 1'
    );
    const deploy = (result as any)[0];
    res.json({ logs: deploy?.output ?? '' });
  } catch (err) {
    res.status(500).json({ logs: '' });
  }
});

function runDeployInBackground(deployId: string, soft: boolean) {
  (async () => {
    try {
      await updateDeployState(deployId, 'building', 'building_images');
      const cmd = soft
        ? 'docker compose build dashboard && docker compose up -d --force-recreate dashboard'
        : 'docker compose build --no-cache && docker compose up -d --force-recreate dashboard postgres';
      const { stdout, stderr } = await runDockerCompose(cmd);
      const output = stdout + (stderr ? '\n' + stderr : '');
      await updateDeployState(deployId, 'success', undefined, output, undefined);
    } catch (err: unknown) {
      const e = err as { message?: string; stdout?: string; stderr?: string };
      const output = (e.stdout || '') + (e.stderr ? '\n' + e.stderr : '');
      await updateDeployState(deployId, 'failed', undefined, output, e.message || 'Unknown error');
    }
  })();
}

router.post('/deploy', async (req: Request, res: Response) => {
  const check = canDeploy();
  if (!check.ok) {
    res.status(503).json({ error: check.reason });
    return;
  }

  const soft = req.query.soft === '1' || req.body?.soft === true;

  const existingDeploy = await query(
    'SELECT * FROM deploys WHERE status IN ($1, $2) ORDER BY created_at DESC LIMIT 1',
    ['building', 'starting']
  );

  if (existingDeploy && existingDeploy.length > 0) {
    res.status(409).json({
      error: 'A deploy is already in progress',
      deploy: existingDeploy[0],
    });
    return;
  }

  const deployId = await createDeploy();
  runDeployInBackground(deployId, soft);

  res.json({
    status: 'started',
    deployId,
    message: soft ? 'Quick deploy started (cached build)' : 'Full deploy started',
  });
});

router.post('/deploy/soft', async (req: Request, res: Response) => {
  const check = canDeploy();
  if (!check.ok) {
    res.status(503).json({ error: check.reason });
    return;
  }

  const existingDeploy = await query(
    'SELECT * FROM deploys WHERE status IN ($1, $2) ORDER BY created_at DESC LIMIT 1',
    ['building', 'starting']
  );

  if (existingDeploy && existingDeploy.length > 0) {
    res.status(409).json({
      error: 'A deploy is already in progress',
      deploy: existingDeploy[0],
    });
    return;
  }

  const deployId = await createDeploy();
  runDeployInBackground(deployId, true);

  res.json({
    status: 'started',
    deployId,
    message: 'Quick deploy started (cached build)',
  });
});

/**
 * Sync workspace from OpenClaw to VPS. POST a gzipped tarball (e.g. from
 * `cd /workspace/clawdeploy-custom && tar czf - .`) so edits take effect before deploy.
 */
router.post('/sync', express.raw({ type: 'application/gzip', limit: '50mb' }), async (req: Request, res: Response) => {
  const projectPath = process.env.CLAWDEPLOY_PROJECT_PATH || '/opt/clawdeploy-custom';
  if (!fs.existsSync(projectPath)) {
    res.status(503).json({ error: `Project path ${projectPath} not found (is it mounted?)` });
    return;
  }

  const body = req.body;
  if (!body || !Buffer.isBuffer(body) || body.length === 0) {
    res.status(400).json({ error: 'Send a gzipped tarball as body (Content-Type: application/gzip)' });
    return;
  }

  const tmpFile = path.join('/tmp', `sync-${Date.now()}.tar.gz`);
  try {
    fs.writeFileSync(tmpFile, body);
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('tar', ['xzf', tmpFile, '-C', projectPath], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      proc.stderr?.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        fs.unlinkSync(tmpFile);
        if (code === 0) resolve();
        else reject(new Error(`tar failed: ${stderr}`));
      });
      proc.on('error', reject);
    });
    res.json({ ok: true, message: 'Workspace synced' });
  } catch (err) {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    console.error('Sync error:', err);
    res.status(500).json({
      error: 'Sync failed',
      message: err instanceof Error ? err.message : 'Unknown error',
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

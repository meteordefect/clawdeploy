/**
 * Deploy and rollback endpoints. Requires Docker socket and CLAWDEPLOY_PROJECT_PATH.
 * Used for direct VPS deploy (no round-trips) when OpenClaw edits files on the mount.
 *
 * Access control:
 * - Deploy: only from custom dashboard (Referer/Origin contains /dashboard/custom) OR has X-Deploy-Secret
 * - Rollback: from custom dashboard or main dashboard (main has emergency rollback button)
 */
import { Router, Request, Response, NextFunction } from 'express';
import { spawn } from 'child_process';
import { query } from '../db/client';

const router = Router();

const PROJECT_PATH = process.env.CLAWDEPLOY_PROJECT_PATH;
const DEPLOY_API_SECRET = process.env.DEPLOY_API_SECRET;

/**
 * Deploy access:
 * - Require Referer from /dashboard/custom (blocks random sites, main dashboard)
 * - If no Referer (curl, OpenClaw script): require X-Deploy-Secret
 * - Set ALLOW_DEPLOY_FROM_MAIN=1 to let main dashboard trigger deploy too
 */
const DEPLOY_REQUIRE_CUSTOM = process.env.ALLOW_DEPLOY_FROM_MAIN !== '1';

function isFromCustomDashboard(req: Request): boolean {
  const ref = req.get('Referer') || req.get('Origin') || '';
  return ref.includes('/dashboard/custom');
}

function checkDeploySecret(req: Request, res: Response, next: NextFunction): void {
  const ref = req.get('Referer') || req.get('Origin') || '';

  // If request comes from custom dashboard, allow it
  if (ref && isFromCustomDashboard(req)) {
    next();
    return;
  }

  // If no Referer (curl, scripts), require the API secret
  const providedSecret = req.get('X-Deploy-Secret');
  if (providedSecret === DEPLOY_API_SECRET) {
    next();
    return;
  }

  res.status(403).json({
    error: 'Access denied. Must provide valid X-Deploy-Secret header or come from /dashboard/custom',
  });
}

function isFromOurDashboards(req: Request): boolean {
  const ref = req.get('Referer') || req.get('Origin') || '';
  if (!ref) return true;
  return ref.includes('/dashboard/custom') || ref.includes('/settings') || /\/$/.test(ref);
}

const ROLLBACK_REQUIRE_CUSTOM = process.env.ROLLBACK_RESTRICT_TO_CUSTOM === '1';

function requireDashboard(req: Request, res: Response, next: NextFunction): void {
  const fromCustom = isFromCustomDashboard(req);
  const fromOurs = isFromOurDashboards(req);
  if (ROLLBACK_REQUIRE_CUSTOM ? fromCustom : fromOurs) {
    next();
    return;
  }
  res.status(403).json({
    error: ROLLBACK_REQUIRE_CUSTOM
      ? 'Rollback is restricted to the custom dashboard'
      : 'Request must originate from a ClawDeploy dashboard',
  });
}

const DOCKER_IMAGE = 'docker:24'; // Has docker CLI and compose v2

function canDeploy(): { ok: boolean; reason?: string } {
  if (!PROJECT_PATH) {
    return { ok: false, reason: 'CLAWDEPLOY_PROJECT_PATH not set' };
  }
  return { ok: true };
}

function runDockerCompose(command: string): Promise<{ stdout: string; stderr: string }> {
  // Extract project directory name for consistent project naming
  const projectName = PROJECT_PATH?.split('/').pop() || 'clawdeploy-custom';

  const fullCmd = [
    'docker', 'run', '--rm',
    '-v', '/var/run/docker.sock:/var/run/docker.sock',
    '-v', `${PROJECT_PATH}:/app`,
    '-w', '/app',
    '-e', 'COMPOSE_HTTP_TIMEOUT=200',
    '-e', 'COMPOSE_PROJECT_NAME=clawdeploy-custom',  // Force consistent project name
    DOCKER_IMAGE,
    'sh', '-c', `"${command}"`,
  ].join(' ');

  return new Promise((resolve, reject) => {
    const proc = spawn(fullCmd, { shell: true });
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => stdout += data);
    proc.stderr?.on('data', (data) => stderr += data);

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with exit code ${code}\n${stdout}${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
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
      res.json({ status: 'idle' });
      return;
    }
    res.json(deploy);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch deploy status' });
  }
});

router.post('/deploy', checkDeploySecret, async (req: Request, res: Response) => {
  const check = canDeploy();
  if (!check.ok) {
    res.status(503).json({ error: check.reason });
    return;
  }

  // Check if there's already a deploy running
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

  // Start deploy in background
  (async () => {
    try {
      await updateDeployState(deployId, 'building', 'building_images');
      const { stdout, stderr } = await runDockerCompose(
        'docker compose build --no-cache && docker compose up -d --force-recreate'
      );

      await updateDeployState(deployId, 'starting', 'restarting_containers', stdout + (stderr ? '\n' + stderr : ''));

      await updateDeployState(deployId, 'success', undefined, undefined, undefined);
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      await updateDeployState(
        deployId,
        'failed',
        undefined,
        (e.stdout || '') + (e.stderr ? '\n' + e.stderr : ''),
        e.message || 'Unknown error'
      );
    }
  })();

  // Respond immediately with deploy ID
  res.json({
    status: 'started',
    deployId,
    message: 'Deploy started in background',
  });
});

router.post('/deploy/rollback', requireDashboard, async (req: Request, res: Response) => {
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

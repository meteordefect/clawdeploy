/**
 * Deploy and rollback endpoints. Requires Docker socket and CLAWDEPLOY_PROJECT_PATH.
 * Used for direct VPS deploy (no round-trips) when OpenClaw edits files on the mount.
 *
 * Access control:
 * - Deploy: only from custom dashboard (Referer/Origin contains /dashboard/custom)
 * - Rollback: from custom dashboard or main dashboard (main has emergency rollback button)
 */
import { Router, Request, Response, NextFunction } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const router = Router();

const PROJECT_PATH = process.env.CLAWDEPLOY_PROJECT_PATH;

/**
 * Deploy access:
 * - Require Referer from /dashboard/custom (blocks random sites, main dashboard)
 * - If no Referer (curl, OpenClaw script): allow only when DEPLOY_ALLOW_NO_REFERER=1
 * - Set ALLOW_DEPLOY_FROM_MAIN=1 to let main dashboard trigger deploy too
 */
const DEPLOY_REQUIRE_CUSTOM = process.env.ALLOW_DEPLOY_FROM_MAIN !== '1';
const DEPLOY_ALLOW_NO_REFERER = process.env.DEPLOY_ALLOW_NO_REFERER === '1';

function isFromCustomDashboard(req: Request): boolean {
  const ref = req.get('Referer') || req.get('Origin') || '';
  if (!ref) return DEPLOY_ALLOW_NO_REFERER;
  return ref.includes('/dashboard/custom');
}

function isFromOurDashboards(req: Request): boolean {
  const ref = req.get('Referer') || req.get('Origin') || '';
  if (!ref) return true;
  return ref.includes('/dashboard/custom') || ref.includes('/settings') || /\/$/.test(ref);
}

function requireCustomDashboard(req: Request, res: Response, next: NextFunction): void {
  if (!DEPLOY_REQUIRE_CUSTOM || isFromCustomDashboard(req)) {
    next();
    return;
  }
  res.status(403).json({
    error: 'Deploy is restricted to the custom dashboard. Set DEPLOY_ALLOW_NO_REFERER=1 to allow scripted deploys (e.g. OpenClaw).',
  });
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

router.post('/deploy', requireCustomDashboard, async (req: Request, res: Response) => {
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

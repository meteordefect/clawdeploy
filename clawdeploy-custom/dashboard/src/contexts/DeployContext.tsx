import { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { api } from '../api/client';
import { usePolling } from '../hooks/usePolling';

export type DeployStage = 'building_images' | 'restarting_containers';

interface DeployContextValue {
  deploying: boolean;
  stage?: DeployStage;
  lastResult?: { success: boolean; error?: string };
  setLocalDeploying: (v: boolean) => void;
}

const DeployContext = createContext<DeployContextValue | null>(null);

export function DeployProvider({ children }: { children: React.ReactNode }) {
  const [localDeploying, setLocalDeploying] = useState(false);
  const { data: status } = usePolling(
    () => api.deploy.status(),
    2000,
  );

  // Clear local deploying when API reports deploy finished (success or failed)
  useEffect(() => {
    if (status?.lastResult) {
      setLocalDeploying(false);
    }
  }, [status?.lastResult]);

  const apiDeploying = status?.deploying ?? false;
  const deploying = localDeploying || apiDeploying;

  const value = useMemo(
    () => ({
      deploying,
      stage: status?.stage,
      lastResult: status?.lastResult,
      setLocalDeploying,
    }),
    [deploying, status?.stage, status?.lastResult],
  );

  return (
    <DeployContext.Provider value={value}>
      {children}
    </DeployContext.Provider>
  );
}

export function useDeploy() {
  const ctx = useContext(DeployContext);
  if (!ctx) throw new Error('useDeploy must be used within DeployProvider');
  return ctx;
}

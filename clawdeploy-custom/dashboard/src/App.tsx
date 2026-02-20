import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DeployBanner } from './components/DeployBanner';
import { ChatView } from './components/chat/ChatView';
import { Overview } from './views/Overview';
import { Deploys } from './views/Deploys';
import { Missions } from './views/Missions';
import { Files } from './views/Files';
import { Sessions } from './views/Sessions';
import { Events } from './views/Events';
import { Settings } from './views/Settings';
import { api } from './api/client';
import { usePolling } from './hooks/usePolling';

// Deploy status tracker for auto-reload when a deploy just completes
function DeployAwareApp() {
  const { data: deployStatus, loading } = usePolling(() => api.deploy.status(), 2000);
  const wasDeployingRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (loading || deployStatus == null) return;

    const wasDeploying = wasDeployingRef.current;
    wasDeployingRef.current = deployStatus.deploying;

    // Only reload when we transition from deploying -> not deploying (deploy just finished)
    if (wasDeploying === true && deployStatus.deploying === false) {
      window.location.reload();
    }
  }, [deployStatus, loading]);

  return (
    <BrowserRouter basename={(import.meta.env.VITE_BASE_PATH || '/').replace(/\/$/, '') || '/'}>
      <DeployBanner />
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/chat" element={<ChatView />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/missions" element={<Missions />} />
          <Route path="/files" element={<Files />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/events" element={<Events />} />
          <Route path="/deploys" element={<Deploys />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default DeployAwareApp;

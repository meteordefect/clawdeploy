import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ChatView } from './components/chat/ChatView';
import { TasksView } from './views/TasksView';
import { MergeQueueView } from './views/MergeQueueView';
import { ActivityView } from './views/ActivityView';
import { Files } from './views/Files';
import { Settings } from './views/Settings';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/p" replace />} />
          {/* v4 project-scoped routes */}
          <Route path="/p" element={<Navigate to="/p/default/tasks" replace />} />
          <Route path="/p/:projectId/tasks" element={<TasksView />} />
          <Route path="/p/:projectId/merge-queue" element={<MergeQueueView />} />
          <Route path="/p/:projectId/chat" element={<ChatView />} />
          <Route path="/p/:projectId/activity" element={<ActivityView />} />
          <Route path="/p/:projectId/files" element={<Files />} />
          <Route path="/p/:projectId/settings" element={<Settings />} />
          {/* Legacy routes — deprecated, kept for backward compat */}
          <Route path="/chat" element={<ChatView />} />
          <Route path="/files" element={<Files />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;

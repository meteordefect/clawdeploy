import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { ChatView } from './ChatView';
import { TaskDetailView } from './TaskDetailView';
import { ContextPanel } from './ContextPanel';
import { LogsDrawer } from './LogsDrawer';
import { api } from './api';
import type { Task, Conversation } from './types';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeView, setActiveView] = useState<'chat' | 'task'>('chat');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  const fetchTasks = useCallback(async () => {
    try {
      setTasks(await api.tasks.list());
    } catch { /* API may not be ready */ }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      setConversations(await api.conversations.list());
    } catch { /* API may not be ready */ }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchConversations();
    const interval = setInterval(() => {
      fetchTasks();
      fetchConversations();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchTasks, fetchConversations]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '`' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setLogsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('light', next === 'light');
  };

  const handleSelectChat = (convId?: string) => {
    setActiveView('chat');
    setSelectedConversationId(convId || null);
    setSelectedTaskId(null);
  };

  const handleSelectTask = (taskId: string) => {
    setActiveView('task');
    setSelectedTaskId(taskId);
  };

  const handleNewChat = () => {
    setActiveView('chat');
    setSelectedConversationId(null);
    setSelectedTaskId(null);
  };

  const handleConversationCreated = (convId: string) => {
    setSelectedConversationId(convId);
    fetchConversations();
  };

  const selectedTask = tasks.find(t => t.meta.id === selectedTaskId) || null;

  return (
    <div className="h-screen flex bg-surface text-primary font-sans">
      <Sidebar
        tasks={tasks}
        conversations={conversations}
        activeView={activeView}
        selectedTaskId={selectedTaskId}
        selectedConversationId={selectedConversationId}
        onSelectChat={handleSelectChat}
        onSelectTask={handleSelectTask}
        onNewChat={handleNewChat}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="flex-1 min-h-0 overflow-hidden flex">
          <div className={`flex-1 min-w-0 ${activeView === 'chat' ? '' : 'hidden'}`}>
            <ChatView
              key={selectedConversationId ?? '__new__'}
              initialConversationId={selectedConversationId}
              onConversationCreated={handleConversationCreated}
            />
          </div>
          {activeView === 'task' && selectedTask && (
            <div className="flex-1 min-w-0">
              <TaskDetailView task={selectedTask} onRefresh={fetchTasks} />
            </div>
          )}
          {activeView === 'task' && !selectedTask && (
            <div className="flex-1 flex items-center justify-center text-tertiary text-sm">
              Select a task from the sidebar
            </div>
          )}
          {activeView === 'task' && selectedTask?.meta.pr && (
            <ContextPanel taskId={selectedTask.meta.id} pr={selectedTask.meta.pr} />
          )}
        </div>

        <LogsDrawer open={logsOpen} onToggle={() => setLogsOpen(prev => !prev)} />
      </div>
    </div>
  );
}

export default App;

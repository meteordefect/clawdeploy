import { useState } from 'react';
import { Card } from '../components/Card';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api/client';

export function Sessions() {
  const { data: sessions, loading, error } = usePolling(() => api.sessions.list(), 10000);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  const handleSelectSession = async (id: string) => {
    setSelectedSession(id);
    setLoadingSession(true);
    try {
      const session = await api.sessions.get(id);
      setSessionData(session);
    } catch (err) {
      alert(`Failed to load session: ${err}`);
    } finally {
      setLoadingSession(false);
    }
  };

  if (loading && !sessions) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading sessions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-danger">Error loading sessions: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-gray-900">Sessions</h1>
        <p className="text-gray-600 mt-1">OpenClaw session transcripts</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Session List">
          {sessions && sessions.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  className={`w-full text-left px-3 py-3 rounded border transition-colors ${
                    selectedSession === session.id
                      ? 'bg-accent text-white border-accent'
                      : 'hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="font-medium text-sm">{session.id}</div>
                  <div className="text-xs opacity-80 mt-1">
                    {new Date(session.created).toLocaleString()}
                  </div>
                  <div className="text-xs opacity-70 mt-1">
                    {(session.size / 1024).toFixed(1)} KB
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No sessions found</div>
          )}
        </Card>

        <Card title={selectedSession || 'Select a session'} className="lg:col-span-2">
          {loadingSession ? (
            <div className="text-gray-500">Loading session...</div>
          ) : sessionData ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                Created: {new Date(sessionData.created).toLocaleString()}
              </div>
              <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {JSON.stringify(sessionData.content, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">Select a session to view transcript</div>
          )}
        </Card>
      </div>
    </div>
  );
}

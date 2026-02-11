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
        <div className="text-tertiary">Loading sessions...</div>
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
        <h1 className="text-3xl font-serif font-bold text-primary">Sessions</h1>
        <p className="text-secondary mt-1">OpenClaw session transcripts</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Session List" noPadding className="h-full">
          {sessions && sessions.length > 0 ? (
            <div className="max-h-[600px] overflow-y-auto p-2 space-y-1">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 group ${
                    selectedSession === session.id
                      ? 'bg-primary text-white border-primary shadow-md'
                      : 'bg-white hover:bg-subtle border-gray-100 text-secondary hover:border-gray-200'
                  }`}
                >
                  <div className={`font-medium text-sm ${selectedSession === session.id ? 'text-white' : 'text-primary'}`}>{session.id}</div>
                  <div className={`text-xs mt-1 ${selectedSession === session.id ? 'text-white/80' : 'text-tertiary'}`}>
                    {new Date(session.created).toLocaleString()}
                  </div>
                  <div className={`text-xs mt-1 ${selectedSession === session.id ? 'text-white/60' : 'text-tertiary'}`}>
                    {(session.size / 1024).toFixed(1)} KB
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-tertiary text-sm p-6 text-center">No sessions found</div>
          )}
        </Card>

        <Card title={selectedSession || 'Select a session'} className="lg:col-span-2 min-h-[600px]">
          {loadingSession ? (
            <div className="text-tertiary flex items-center justify-center h-64">Loading session...</div>
          ) : sessionData ? (
            <div className="space-y-4 h-full flex flex-col">
              <div className="text-sm text-secondary bg-subtle px-4 py-2 rounded-lg border border-gray-100 inline-block self-start">
                Created: <span className="font-medium text-primary">{new Date(sessionData.created).toLocaleString()}</span>
              </div>
              <div className="bg-subtle/50 rounded-xl p-6 border border-gray-100 flex-1 overflow-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap text-primary">
                  {JSON.stringify(sessionData.content, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-tertiary text-sm flex items-center justify-center h-64">Select a session to view transcript</div>
          )}
        </Card>
      </div>
    </div>
  );
}

import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api/client';

export function Overview() {
  const { data: agents } = usePolling(() => api.agents.list(), 5000);
  const { data: missions } = usePolling(() => api.missions.list(), 5000);
  const { data: events } = usePolling(() => api.events.list({ limit: 10 }), 10000);
  const { data: health } = usePolling(() => api.health(), 30000);

  const stats = {
    agents: {
      total: agents?.length || 0,
      online: agents?.filter((a) => a.status === 'online').length || 0,
    },
    missions: {
      total: missions?.length || 0,
      active: missions?.filter((m) => m.status === 'active').length || 0,
      completed: missions?.filter((m) => m.status === 'completed').length || 0,
    },
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-primary">Overview</h1>
        <p className="text-secondary mt-1 text-lg">System status and recent activity</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex flex-col h-full justify-between">
            <div>
              <div className="text-sm font-medium text-secondary uppercase tracking-wide">Total Agents</div>
              <div className="text-4xl font-serif font-bold text-primary mt-2">{stats.agents.total}</div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-success"></span>
              <div className="text-sm font-medium text-success">{stats.agents.online} online</div>
            </div>
          </div>
        </Card>

        <Card>
           <div className="flex flex-col h-full justify-between">
            <div>
              <div className="text-sm font-medium text-secondary uppercase tracking-wide">Total Missions</div>
              <div className="text-4xl font-serif font-bold text-primary mt-2">{stats.missions.total}</div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-accent"></span>
              <div className="text-sm font-medium text-accent">{stats.missions.active} active</div>
            </div>
          </div>
        </Card>

        <Card>
           <div className="flex flex-col h-full justify-between">
            <div>
              <div className="text-sm font-medium text-secondary uppercase tracking-wide">Completed Missions</div>
              <div className="text-4xl font-serif font-bold text-success mt-2">{stats.missions.completed}</div>
            </div>
             <div className="mt-4 flex items-center gap-2">
               <span className="text-sm text-tertiary">Lifetime total</span>
            </div>
          </div>
        </Card>

        <Card>
           <div className="flex flex-col h-full justify-between">
            <div>
              <div className="text-sm font-medium text-secondary uppercase tracking-wide">System Health</div>
              <div className="mt-2">
                <StatusBadge status={health?.status === 'ok' ? 'online' : 'offline'} className="text-sm py-1 px-3" />
              </div>
            </div>
            <div className="mt-4 text-xs font-mono text-tertiary border-t border-gray-100 pt-2">
              DB: {health?.db || 'unknown'}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Agents" noPadding>
          {agents && agents.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {agents.slice(0, 5).map((agent) => (
                <div key={agent.id} className="flex items-center justify-between p-4 hover:bg-subtle/30 transition-colors">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-subtle flex items-center justify-center text-lg border border-gray-100">
                        🤖
                    </div>
                    <div>
                      <div className="font-medium text-primary text-sm">{agent.name}</div>
                      <div className="text-xs text-secondary">{agent.openclaw_version || 'Unknown version'}</div>
                    </div>
                  </div>
                  <StatusBadge status={agent.status} variant="dot" />
                </div>
              ))}
              <div className="p-3 text-center border-t border-gray-50">
                <a href="/agents" className="text-xs font-medium text-accent hover:text-accent-dark transition-colors">View All Agents →</a>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-secondary text-sm">No agents registered</div>
          )}
        </Card>

        <Card title="Recent Events" noPadding>
          {events && events.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {events.map((event) => (
                <div key={event.id} className="p-4 hover:bg-subtle/30 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                     <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-subtle text-primary border border-gray-200 uppercase tracking-wide">
                        {event.type}
                      </span>
                      <div className="text-[10px] text-tertiary">
                        {new Date(event.created_at).toLocaleString()}
                      </div>
                  </div>
                  <div className="text-xs text-secondary pl-1">
                    {event.agent_name && (
                        <>
                        <span className="text-tertiary">Agent:</span> <span className="font-medium text-primary">{event.agent_name}</span>
                        </>
                    )}
                    {event.agent_name && event.mission_name && <span className="mx-1.5 text-tertiary">|</span>}
                    {event.mission_name && (
                        <>
                        <span className="text-tertiary">Mission:</span> {event.mission_name}
                        </>
                    )}
                  </div>
                </div>
              ))}
               <div className="p-3 text-center border-t border-gray-50">
                <a href="/events" className="text-xs font-medium text-accent hover:text-accent-dark transition-colors">View Full Log →</a>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-secondary text-sm">No recent events</div>
          )}
        </Card>
      </div>
    </div>
  );
}

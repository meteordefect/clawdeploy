import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api/client';

export function Overview() {
  const { data: missions } = usePolling(() => api.missions.list(), 5000);
  const { data: events } = usePolling(() => api.events.list({ limit: 10 }), 10000);
  const { data: health } = usePolling(() => api.health(), 30000);

  const stats = {
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 md:gap-6">
        <Card>
          <div className="flex flex-col h-full justify-between">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-sm font-medium text-secondary uppercase tracking-wide">System</div>
                <StatusBadge status={health?.status === 'ok' ? 'online' : 'offline'} className="mt-2 text-sm" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col h-full justify-between">
            <div>
              <div className="text-sm font-medium text-secondary uppercase tracking-wide">Missions</div>
              <div className="text-4xl font-serif font-bold text-primary mt-2">{stats.missions.total}</div>
              <div className="mt-3 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-accent"></span>
                  <div className="text-sm font-medium text-accent">{stats.missions.active} active</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-success"></span>
                  <div className="text-sm font-medium text-success">{stats.missions.completed} done</div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
        <Card title="Recent Events" noPadding>
          {events && events.length > 0 ? (
            <div className="divide-y divide-border">
              {events.map((event) => (
                <div key={event.id} className="p-4 hover:bg-subtle/30 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-subtle text-primary border border-border uppercase tracking-wide">
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
              <div className="p-3 text-center border-t border-border/50">
                <Link to="/events" className="text-xs font-medium text-accent hover:text-accent-dark transition-colors">View Full Log →</Link>
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

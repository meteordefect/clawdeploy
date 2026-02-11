import React, { useState } from 'react';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api/client';

export function Missions() {
  const { data: missions, loading, error, refetch } = usePolling(() => api.missions.list(), 5000);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newMission, setNewMission] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.missions.create(newMission);
      setNewMission({ name: '', description: '' });
      setShowCreateForm(false);
      refetch();
    } catch (err) {
      alert(`Failed to create mission: ${err}`);
    } finally {
      setCreating(false);
    }
  };

  if (loading && !missions) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading missions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-danger">Error loading missions: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-900">Missions</h1>
          <p className="text-gray-600 mt-1">High-level objectives and command queues</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-opacity-90 transition-colors"
        >
          {showCreateForm ? 'Cancel' : 'New Mission'}
        </button>
      </div>

      {showCreateForm && (
        <Card>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mission Name
              </label>
              <input
                type="text"
                value={newMission.name}
                onChange={(e) => setNewMission({ ...newMission, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="e.g., Deploy to Production"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={newMission.description}
                onChange={(e) => setNewMission({ ...newMission, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="Optional description"
                rows={3}
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-success text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Mission'}
            </button>
          </form>
        </Card>
      )}

      {missions && missions.length > 0 ? (
        <div className="space-y-4">
          {missions.map((mission) => (
            <Card key={mission.id}>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900">{mission.name}</h3>
                    {mission.description && (
                      <p className="text-sm text-gray-600 mt-1">{mission.description}</p>
                    )}
                  </div>
                  <StatusBadge status={mission.status} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Total Commands</div>
                    <div className="font-medium text-gray-900">{mission.total_commands || 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Completed</div>
                    <div className="font-medium text-success">{mission.completed_commands || 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Failed</div>
                    <div className="font-medium text-danger">{mission.failed_commands || 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Created</div>
                    <div className="font-medium text-gray-900">
                      {new Date(mission.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🎯</div>
            <div className="text-gray-900 font-medium mb-2">No missions yet</div>
            <div className="text-sm text-gray-600">
              Create a mission to start queuing commands for agents
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

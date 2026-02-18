import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api/client';
import type { Agent } from '../types';

interface OpenClawAgent {
  id: string;
  name: string;
  synced: boolean;
}

function AgentSubagents({
  openclawAgentId,
  globalSubagents,
  onChat,
}: {
  openclawAgentId: string;
  globalSubagents?: Array<{ runId: string; sessionKey: string; parentAgentId: string | null; label?: string; task?: string }>;
  onChat: (sessionKey: string) => void;
}) {
  const ocId = openclawAgentId?.toLowerCase() ?? '';
  const subagents =
    globalSubagents?.filter((s) => (s.parentAgentId ?? '').toLowerCase() === ocId) ?? [];

  return (
    <div className="space-y-2 p-4 rounded-xl border border-border bg-subtle/30">
      <div className="text-sm font-semibold text-primary">Subagents</div>
      <p className="text-xs text-tertiary">
        Subagent runs from OpenClaw. Chat to message directly.
      </p>
      <div className="space-y-1.5 mt-2">
        {subagents.map((s) => (
          <div
            key={s.sessionKey}
            className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-subtle/50 border border-border text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium text-primary truncate">{s.label || s.task || s.runId}</div>
              <div className="text-[10px] text-tertiary font-mono break-all" title={s.sessionKey}>
                {s.sessionKey}
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => onChat(s.sessionKey)}>
              Chat
            </Button>
          </div>
        ))}
      </div>
      {subagents.length === 0 && (
        <div className="text-xs text-tertiary py-2">No subagents</div>
      )}
    </div>
  );
}

export function Agents() {
  const { data: agents, loading, error, refetch } = usePolling(() => api.agents.list(), 5000);
  const { data: openclawData, error: openclawError, refetch: refetchOpenClaw } = usePolling(
    () => api.agents.openclawList(),
    10000
  );
  const { data: subagentsData } = usePolling(
    () => api.agents.subagentsRegistry(),
    10000
  );
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', openclaw_agent_id: '' as string });
  const [saving, setSaving] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pullingId, setPullingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleString();
  };

  const handleEditClick = (agent: Agent) => {
    setEditingAgent(agent);
    setEditForm({
      name: agent.name,
      description: agent.description || '',
      openclaw_agent_id: agent.openclaw_agent_id || '',
    });
  };

  const handleCloseModal = () => {
    setEditingAgent(null);
    setEditForm({ name: '', description: '', openclaw_agent_id: '' });
    setSaving(false);
  };

  const handleSave = async () => {
    if (!editingAgent) return;

    setSaving(true);
    try {
      await api.agents.update(editingAgent.id, {
        name: editForm.name,
        description: editForm.description || undefined,
        openclaw_agent_id: editForm.openclaw_agent_id || null,
      });
      refetch();
      handleCloseModal();
    } catch (err) {
      alert(`Failed to update agent: ${err}`);
      setSaving(false);
    }
  };

  const handleDeleteClick = (agent: Agent) => {
    setDeletingAgent(agent);
  };

  const handleCloseDeleteModal = () => {
    setDeletingAgent(null);
    setDeleting(false);
  };

  const handlePullFromOpenClaw = async (ocAgent: OpenClawAgent) => {
    if (ocAgent.synced) return;
    setPullingId(ocAgent.id);
    try {
      await api.agents.pullFromOpenClaw(ocAgent.id, ocAgent.name);
      refetch();
      refetchOpenClaw();
    } catch (err) {
      alert(`Pull failed: ${err}`);
    } finally {
      setPullingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingAgent) return;

    setDeleting(true);
    try {
      await api.agents.delete(deletingAgent.id);
      refetch();
      handleCloseDeleteModal();
    } catch (err) {
      alert(`Failed to delete agent: ${err}`);
      setDeleting(false);
    }
  };

  if (loading && !agents) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-tertiary">Loading agents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-danger">Error loading agents: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-primary">Agents</h1>
        <p className="text-secondary mt-1">Registered OpenClaw instances</p>
      </div>

      {/* OpenClaw Agents - available to pull */}
      {openclawData && openclawData.agents.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-primary mb-2">OpenClaw Agents</h2>
          <p className="text-sm text-secondary mb-4">
            Agents configured in OpenClaw. Pull to add them to ClawDeploy.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {openclawData.agents.map((ocAgent) => (
              <div
                key={ocAgent.id}
                className="flex flex-col gap-3 p-3 rounded-lg bg-subtle/50 border border-border"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="font-medium text-primary truncate">{ocAgent.name}</div>
                    <div>
                      <div className="text-tertiary text-[10px] uppercase tracking-wide mb-0.5">OpenClaw ID</div>
                      <div className="font-mono text-xs text-secondary bg-subtle px-2 py-1 rounded border border-border break-all" title={ocAgent.id}>
                        {ocAgent.id}
                      </div>
                    </div>
                    {ocAgent.synced && ocAgent.dbAgentId && (
                      <div>
                        <div className="text-tertiary text-[10px] uppercase tracking-wide mb-0.5">ClawDeploy ID</div>
                        <div className="font-mono text-xs text-secondary bg-subtle px-2 py-1 rounded border border-border break-all" title={ocAgent.dbAgentId}>
                          {ocAgent.dbAgentId}
                        </div>
                      </div>
                    )}
                  </div>
                  {ocAgent.synced ? (
                    <span className="text-xs text-success font-medium flex-shrink-0">✓ Synced</span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePullFromOpenClaw(ocAgent)}
                      disabled={pullingId === ocAgent.id}
                    >
                      {pullingId === ocAgent.id ? 'Pulling...' : 'Pull'}
                    </Button>
                  )}
                </div>
                <AgentSubagents
                  openclawAgentId={ocAgent.id}
                  globalSubagents={subagentsData?.subagents}
                  onChat={(sessionKey) => navigate(`/chat?session=${encodeURIComponent(sessionKey)}`)}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {openclawError && (
        <p className="text-sm text-danger">
          Could not load OpenClaw agents: {openclawError.message}. Check that OPENCLAW_DATA_PATH is shared between control-api and the gateway.
        </p>
      )}
      {openclawData && !openclawError && openclawData.agents.length === 0 && (
        <p className="text-sm text-tertiary">
          No OpenClaw agents found. Configure agents in ~/.openclaw/openclaw.json (agents.list) or ensure the OpenClaw data path is shared with the control-api.
        </p>
      )}

      {/* OpenClaw Subagents - all from registry */}
      {subagentsData && subagentsData.subagents.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-primary mb-2">OpenClaw Subagents</h2>
          <p className="text-sm text-secondary mb-4">
            All subagent runs from the OpenClaw registry. Chat to message them directly.
          </p>
          <div className="space-y-2">
            {subagentsData.subagents.map((s) => (
              <div
                key={s.runId}
                className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-subtle/50 border border-border text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-primary truncate">{s.label || s.task || s.runId}</div>
                  <div className="text-[10px] text-tertiary font-mono break-all space-y-0.5" title={s.sessionKey}>
                    <div>parent: {s.parentAgentId ?? '?'}</div>
                    <div>{s.sessionKey}</div>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => navigate(`/chat?session=${encodeURIComponent(s.sessionKey)}`)}>
                  Chat
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <h2 className="text-lg font-semibold text-primary">ClawDeploy Agents</h2>

      {agents && agents.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-subtle flex items-center justify-center text-xl shadow-inner">
                        🤖
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-lg text-primary">{agent.name}</h3>
                        {agent.description && (
                        <p className="text-sm text-secondary mt-0.5">{agent.description}</p>
                        )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditClick(agent)}
                      className="text-xs"
                    >
                      ✏️ Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(agent)}
                      className="text-xs text-danger hover:text-danger hover:bg-danger/10"
                    >
                      🗑️ Delete
                    </Button>
                    <StatusBadge status={agent.status} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm bg-subtle/50 p-4 rounded-xl border border-border">
                  <div>
                    <div className="text-tertiary text-xs uppercase tracking-wide mb-1">Last Heartbeat</div>
                    <div className="font-medium text-primary">
                      {formatTimestamp(agent.last_heartbeat)}
                    </div>
                  </div>
                  <div>
                    <div className="text-tertiary text-xs uppercase tracking-wide mb-1">Version</div>
                    <div className="font-medium text-primary">
                      {agent.openclaw_version || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div className="text-tertiary text-xs uppercase tracking-wide mb-1">IP Address</div>
                    <div className="font-medium text-primary">
                      {agent.ip_address || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div className="text-tertiary text-xs uppercase tracking-wide mb-1">ClawDeploy ID</div>
                    <div className="font-mono text-xs text-secondary bg-subtle px-2 py-1 rounded border border-border break-all" title={agent.id}>
                      {agent.id}
                    </div>
                    {agent.openclaw_agent_id && (
                      <div className="mt-1">
                        <div className="text-tertiary text-xs uppercase tracking-wide mb-0.5">OpenClaw ID</div>
                        <div className="font-mono text-xs text-secondary bg-subtle px-2 py-1 rounded border border-border break-all" title={agent.openclaw_agent_id}>
                          {agent.openclaw_agent_id}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {agent.openclaw_agent_id && (
                  <AgentSubagents
                    openclawAgentId={agent.openclaw_agent_id}
                    globalSubagents={subagentsData?.subagents}
                    onChat={(sessionKey) => navigate(`/chat?session=${encodeURIComponent(sessionKey)}`)}
                  />
                )}

                {Object.keys(agent.health).length > 0 && (
                  <div>
                    <div className="text-xs text-secondary mb-2 font-medium">Health Metrics</div>
                    <pre className="text-[10px] bg-subtle p-3 rounded-lg overflow-x-auto text-secondary border border-border">
                      {JSON.stringify(agent.health, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-12">
            <div className="text-4xl mb-4 grayscale opacity-50">🤖</div>
            <div className="text-primary font-medium mb-2">No agents registered yet</div>
            <div className="text-secondary text-sm">
              Agents will appear here once they register with the control plane
            </div>
          </div>
        </Card>
      )}

      <Modal
        isOpen={!!deletingAgent}
        onClose={handleCloseDeleteModal}
        title="Delete Agent"
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={handleCloseDeleteModal}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-danger hover:bg-danger/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        }
      >
        {deletingAgent && (
          <p className="text-secondary">
            Are you sure you want to delete <strong className="text-primary">{deletingAgent.name}</strong>?
            This cannot be undone. The agent will need to re-register to reconnect.
          </p>
        )}
      </Modal>

      <Modal
        isOpen={!!editingAgent}
        onClose={handleCloseModal}
        title="Edit Agent"
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={handleCloseModal}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || !editForm.name.trim()}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Agent Name
            </label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="input-base"
              placeholder="Enter agent name"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Description (Optional)
            </label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="input-base resize-none"
              placeholder="Enter agent description"
              rows={3}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              OpenClaw Agent
            </label>
            <select
              value={editForm.openclaw_agent_id}
              onChange={(e) => setEditForm({ ...editForm, openclaw_agent_id: e.target.value })}
              className="input-base"
              disabled={saving}
            >
              <option value="">None</option>
              {openclawData?.agents.map((oc) => (
                <option key={oc.id} value={oc.id}>
                  {oc.name} ({oc.id})
                </option>
              ))}
            </select>
            <p className="text-xs text-tertiary mt-1">
              Links this agent to an OpenClaw agent for subagents and chat.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

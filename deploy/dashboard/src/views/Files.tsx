import { useState } from 'react';
import { Card } from '../components/Card';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api/client';

export function Files() {
  const { data: files, loading, error } = usePolling(() => api.files.list(), 10000);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSelectFile = async (path: string) => {
    setSelectedFile(path);
    setLoadingFile(true);
    try {
      const file = await api.files.get(path);
      setFileContent(file.content || '');
    } catch (err) {
      alert(`Failed to load file: ${err}`);
    } finally {
      setLoadingFile(false);
    }
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await api.files.update(selectedFile, fileContent);
      alert('File saved successfully');
    } catch (err) {
      alert(`Failed to save file: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !files) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading files...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-danger">Error loading files: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-gray-900">Files</h1>
        <p className="text-gray-600 mt-1">Browse and edit workspace files</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Workspace Files">
          {files && files.length > 0 ? (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {files.map((file) => (
                <button
                  key={file}
                  onClick={() => handleSelectFile(file)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedFile === file
                      ? 'bg-accent text-white'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {file}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No files found</div>
          )}
        </Card>

        <Card title={selectedFile || 'Select a file'} className="lg:col-span-2">
          {loadingFile ? (
            <div className="text-gray-500">Loading file...</div>
          ) : selectedFile ? (
            <div className="space-y-4">
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                className="w-full h-96 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                spellCheck={false}
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">Select a file to view and edit</div>
          )}
        </Card>
      </div>
    </div>
  );
}

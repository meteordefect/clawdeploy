interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusColors: Record<string, string> = {
  online: 'bg-success text-white',
  stale: 'bg-warning text-white',
  offline: 'bg-gray-400 text-white',
  pending: 'bg-gray-300 text-gray-800',
  active: 'bg-blue-500 text-white',
  running: 'bg-blue-500 text-white',
  completed: 'bg-success text-white',
  failed: 'bg-danger text-white',
  cancelled: 'bg-gray-400 text-white',
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const color = statusColors[status.toLowerCase()] || 'bg-gray-300 text-gray-800';
  
  return (
    <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${color} ${className}`}>
      {status}
    </span>
  );
}

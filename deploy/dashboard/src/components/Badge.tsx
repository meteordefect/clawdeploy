interface BadgeProps {
  children: React.ReactNode;
  status?: string;
  variant?: 'outline' | 'solid';
  className?: string;
}

export function Badge({ children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

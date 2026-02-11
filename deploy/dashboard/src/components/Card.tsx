import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  variant?: 'elevated' | 'flat';
  action?: React.ReactNode;
  noPadding?: boolean;
}

export function Card({ children, className = '', title, variant = 'elevated', action, noPadding = false }: CardProps) {
  const baseStyles = "bg-white overflow-hidden transition-all duration-200";
  
  const variants = {
    elevated: "rounded-2xl shadow-card border border-black/5",
    flat: "rounded-xl border border-gray-200 shadow-none"
  };

  return (
    <div className={`${baseStyles} ${variants[variant]} ${className}`}>
      {title && (
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-serif font-medium text-primary">{title}</h2>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>
        {children}
      </div>
    </div>
  );
}

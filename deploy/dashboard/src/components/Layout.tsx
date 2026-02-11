import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Overview', icon: '📊' },
  { path: '/agents', label: 'Agents', icon: '🤖' },
  { path: '/missions', label: 'Missions', icon: '🎯' },
  { path: '/files', label: 'Files', icon: '📁' },
  { path: '/sessions', label: 'Sessions', icon: '💬' },
  { path: '/events', label: 'Events', icon: '📜' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-surface flex">
      <aside className="hidden md:flex flex-col w-60 bg-card border-r border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-serif font-bold text-accent">ClawDeploy</h1>
          <p className="text-xs text-gray-500 mt-1">Control Plane v3.0</p>
        </div>
        
        <nav className="flex-1 p-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
          <p>© 2026 Friend Labs</p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          {children}
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-gray-200 flex justify-around p-2">
        {navItems.slice(0, 5).map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg ${
                isActive ? 'text-accent' : 'text-gray-600'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

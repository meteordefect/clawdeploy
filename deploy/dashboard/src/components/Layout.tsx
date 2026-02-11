import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Bot, Target, FolderOpen, MessageSquare, ScrollText, Settings as SettingsIcon, Menu, X, LucideIcon } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Overview', icon: BarChart3 },
  { path: '/agents', label: 'Agents', icon: Bot },
  { path: '/missions', label: 'Missions', icon: Target },
  { path: '/files', label: 'Files', icon: FolderOpen },
  { path: '/sessions', label: 'Sessions', icon: MessageSquare },
  { path: '/events', label: 'Events', icon: ScrollText },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface text-primary flex font-sans">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-subtle border-r border-gray-200/60 sticky top-0 h-screen">
        <div className="p-8 border-b border-gray-200/60">
          <h1 className="text-2xl font-serif font-bold text-primary tracking-tight">ClawDeploy</h1>
          <p className="text-xs font-medium text-secondary mt-2 tracking-wide uppercase">Control Plane v3.0</p>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-white text-primary shadow-sm ring-1 ring-black/5'
                    : 'text-secondary hover:text-primary hover:bg-white/50'
                }`}
              >
                <Icon 
                  size={18} 
                  className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? 'opacity-100' : 'opacity-70'}`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-6 border-t border-gray-200/60">
          <p className="text-xs text-tertiary font-medium">© 2026 Friend Labs</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-surface">
        {/* Mobile Header */}
        <div className="md:hidden sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-xl font-serif font-bold text-primary">ClawDeploy</h1>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8 md:px-12 md:py-12 pb-24 md:pb-12">
          {children}
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="absolute top-0 right-0 h-full w-64 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-serif font-bold text-primary">Menu</h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <nav className="p-4 space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-gray-100 text-primary'
                        : 'text-secondary hover:text-primary hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
              <p className="text-xs text-tertiary">ClawDeploy v3.0</p>
              <p className="text-xs text-tertiary mt-1">© 2026 Friend Labs</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation - Quick Access */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-200 z-40 pb-safe">
        <div className="flex justify-around items-center p-2">
          {navItems.slice(0, 4).map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-xl transition-colors ${
                  isActive ? 'text-primary' : 'text-tertiary hover:text-secondary'
                }`}
              >
                <Icon 
                  size={20} 
                  className={`transition-transform ${isActive ? '-translate-y-0.5' : ''}`}
                />
                <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-xl transition-colors text-tertiary hover:text-secondary"
          >
            <Menu size={20} />
            <span className="text-[10px] font-medium tracking-wide">More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

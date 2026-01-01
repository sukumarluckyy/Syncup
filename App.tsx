import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Room from './pages/Room';
import { Music } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col font-sans text-zinc-100 bg-zinc-950">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <Music size={20} className="text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">SyncTune</span>
          </div>
          <a href="https://github.com/google/generative-ai-js" target="_blank" rel="noreferrer" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            v1.0.0
          </a>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;
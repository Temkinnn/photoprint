import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { ToastContainer } from './components/Toast';
import { LoginView } from './views/LoginView';
import { MeetingsView } from './views/MeetingsView';
import { KnowledgeBaseView } from './views/KnowledgeBaseView';
import { OverviewView } from './views/OverviewView';
import { TasksView } from './views/TasksView';
import { AuditLogView } from './views/AuditLogView';

const Workspace: React.FC = () => {
  const { isAuthenticated, activeTab } = useApp();

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div className="flex h-screen w-screen bg-[#f6f8fb] dark:bg-[#090c13] text-neutral-900 dark:text-neutral-100 font-sans overflow-hidden select-none relative transition-colors duration-200">
      {/* Subtle ambient light glows for Antigravity-grade glassmorphism */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-[32rem] h-[32rem] bg-blue-500/[0.04] dark:bg-blue-600/[0.06] rounded-full blur-[140px]" />
      <div className="pointer-events-none absolute top-1/3 -right-40 w-[30rem] h-[30rem] bg-indigo-500/[0.03] dark:bg-indigo-600/[0.05] rounded-full blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/3 w-[32rem] h-[32rem] bg-emerald-500/[0.02] dark:bg-emerald-600/[0.04] rounded-full blur-[140px]" />

      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        {activeTab === 'meetings' && <MeetingsView />}
        {activeTab === 'knowledge_base' && <KnowledgeBaseView />}
        {activeTab === 'overview' && <OverviewView />}
        {activeTab === 'tasks' && <TasksView />}
        {activeTab === 'audit' && <AuditLogView />}
      </main>
      <ToastContainer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <Workspace />
    </AppProvider>
  );
};

export default App;

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
    <div className="flex h-screen w-screen bg-neutral-950 text-neutral-100 font-sans overflow-hidden select-none">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden bg-neutral-950">
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

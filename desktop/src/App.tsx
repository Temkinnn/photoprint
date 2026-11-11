import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ToastContainer } from './components/Toast';
import { MeetingsView } from './views/MeetingsView';
import { KnowledgeBaseView } from './views/KnowledgeBaseView';
import { OverviewView } from './views/OverviewView';
import { TasksView } from './views/TasksView';
import { AuditLogView } from './views/AuditLogView';

const MainContent: React.FC = () => {
  const { activeTab } = useApp();

  return (
    <div className="flex-1 flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        {activeTab === 'meetings' && <MeetingsView />}
        {activeTab === 'knowledge_base' && <KnowledgeBaseView />}
        {activeTab === 'overview' && <OverviewView />}
        {activeTab === 'tasks' && <TasksView />}
        {activeTab === 'audit' && <AuditLogView />}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
        <Header />
        <MainContent />
        <ToastContainer />
      </div>
    </AppProvider>
  );
};

export default App;

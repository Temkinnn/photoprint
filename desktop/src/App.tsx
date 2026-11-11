import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ToastContainer } from './components/Toast';
import { LoginView } from './views/LoginView';
import { MeetingPrepView } from './views/MeetingPrepView';
import { MeetingScheduleView } from './views/MeetingScheduleView';
import { MeetingProtocolView } from './views/MeetingProtocolView';
import { TasksView } from './views/TasksView';
import { KnowledgeBaseView } from './views/KnowledgeBaseView';
import { OverviewView } from './views/OverviewView';
import { AuditLogView } from './views/AuditLogView';

const Workspace: React.FC = () => {
  const { isAuthenticated, activeTab } = useApp();

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div className="flex h-screen w-screen bg-[#f8f9fa] dark:bg-[#0c0d11] text-neutral-900 dark:text-neutral-100 font-sans overflow-hidden select-none transition-colors">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden bg-[#f8f9fa] dark:bg-[#0c0d11]">
        <TopBar />
        <div className="flex-1 flex flex-col overflow-hidden">
          {(activeTab === 'meeting_prep' || activeTab === 'meetings') && <MeetingPrepView />}
          {activeTab === 'meeting_schedule' && <MeetingScheduleView />}
          {activeTab === 'meeting_protocol' && <MeetingProtocolView />}
          {activeTab === 'tasks' && <TasksView />}
          {activeTab === 'knowledge_base' && <KnowledgeBaseView />}
          {activeTab === 'overview' && <OverviewView />}
          {activeTab === 'audit' && <AuditLogView />}
        </div>
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

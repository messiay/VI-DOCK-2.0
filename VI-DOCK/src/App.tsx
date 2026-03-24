import { useEffect } from 'react';
import { useDockingStore } from './store/dockingStore';
import { Sidebar } from './ui/components/Sidebar';
import { PrepPanel } from './ui/components/PrepPanel';
import { InputPanel } from './ui/components/InputPanel';
import { RunningPanel } from './ui/components/RunningPanel';
import { OutputPanel } from './ui/components/OutputPanel';
import { ProjectPanel } from './ui/components/ProjectPanel';
import { BatchPanel } from './ui/components/BatchPanel';
import { MDPanel } from './ui/components/MDPanel';
import { LandingPanel } from './ui/components/LandingPanel';
import { MoleculeViewer } from './ui/components/MoleculeViewer';
import { DraggablePanel } from './ui/components/DraggablePanel';
import { FloatingToolbar } from './ui/components/FloatingToolbar'; // Keep toolbar
import BackgroundGrid from './ui/components/BackgroundGrid';
// gridboxCalculator imported on-demand if needed
import './App.css';

function App() {
  const { activeTab, theme } = useDockingStore();

  // Example auto-load removed as per user request

  // Sync theme to body class for global CSS variables
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [theme]);


  const renderActivePanel = () => {
    switch (activeTab) {
      case 'prep':
        return (
          <DraggablePanel title="Molecule Import" width="500px" initialX={60} initialY={80}>
            <PrepPanel />
          </DraggablePanel>
        );
      case 'input':
        return (
          <DraggablePanel title="Input Parameters" width="450px" initialX={60} initialY={80}>
            <InputPanel />
          </DraggablePanel>
        );
      case 'batch':
        return (
          <DraggablePanel title="Batch Docking" width="600px" initialX={60} initialY={80}>
            <BatchPanel />
          </DraggablePanel>
        );
      case 'md':
        return (
          <DraggablePanel title="Molecular Dynamics" width="450px" initialX={60} initialY={80}>
            <MDPanel />
          </DraggablePanel>
        );
      case 'running':
        return (
          <DraggablePanel title="Docking Status" width="600px" initialX={window.innerWidth / 2 - 300} initialY={window.innerHeight / 2 - 200}>
            <RunningPanel />
          </DraggablePanel>
        );
      case 'output':
        return (
          <DraggablePanel title="Docking Results" width="450px" initialX={window.innerWidth - 500} initialY={80}>
            <OutputPanel />
          </DraggablePanel>
        );
      case 'projects':
        return (
          <DraggablePanel title="Mission Log" width="400px" initialX={60} initialY={80}>
            <ProjectPanel />
          </DraggablePanel>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app spatial-mode">
      <BackgroundGrid />
      {/* LAYER 0: GLOBAL VIEWER */}
      <div className="global-viewer-layer">
        <MoleculeViewer />
      </div>

      {/* LAYER 1: UI OVERLAY */}
      <div className="ui-overlay-layer">
        {activeTab === 'landing' ? (
          <LandingPanel />
        ) : (
          <>
            <Sidebar />
            <FloatingToolbar />
            {renderActivePanel()}
          </>
        )}
      </div>
    </div>
  );
}

export default App;

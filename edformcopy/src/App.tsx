import React, { useState, useEffect } from 'react';
import TeacherDashboard from './components/TeacherDashboard';
import WorksheetEditor from './components/WorksheetEditor';
import StudentView from './components/StudentView';
import { Award, GraduationCap, Layout, LogOut, Moon, Sun } from 'lucide-react';

export default function App() {
  const [view, setView] = useState<'dashboard' | 'editor' | 'student'>('dashboard');
  const [selectedWorksheetId, setSelectedWorksheetId] = useState<string | null>(null);

  // Initialize view from URL if student mode is active
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isStudent = params.get('student') === 'true';
    const worksheetId = params.get('id');
    
    if (isStudent && worksheetId) {
      setView('student');
      setSelectedWorksheetId(worksheetId);
    }
  }, []);

  // Back from Student view to dashboard
  const handleStudentBack = () => {
    // Clear URL query parameters to reset state nicely
    const url = new URL(window.location.href);
    url.search = '';
    window.history.pushState({}, '', url.toString());
    
    setView('dashboard');
    setSelectedWorksheetId(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased">
      {/* Shared Navigation Header (Not visible in full screen student view when started) */}
      {view !== 'editor' && (
        <header className="bg-white border-b border-slate-200/80 sticky top-0 z-45 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/10">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-slate-800 text-base tracking-tight block leading-none">Fichas Interactivas</span>
                <span className="text-[10px] text-indigo-600 font-bold tracking-wider uppercase">Plataforma Docente</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {view === 'student' && (
                <button
                  onClick={handleStudentBack}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-slate-500" />
                  Regresar al Panel
                </button>
              )}
              
              {view === 'dashboard' && (
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-150 px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span>Sincronizado</span>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Render Active View */}
      <main className="relative">
        {view === 'dashboard' && (
          <TeacherDashboard
            onEditWorksheet={(id) => {
              setSelectedWorksheetId(id);
              setView('editor');
            }}
            onPreviewWorksheet={(id) => {
              setSelectedWorksheetId(id);
              setView('student');
            }}
          />
        )}

        {view === 'editor' && (
          <WorksheetEditor
            worksheetId={selectedWorksheetId}
            onBack={() => {
              setView('dashboard');
              setSelectedWorksheetId(null);
            }}
            onSaveSuccess={() => {
              setView('dashboard');
              setSelectedWorksheetId(null);
            }}
          />
        )}

        {view === 'student' && selectedWorksheetId && (
          <StudentView
            worksheetId={selectedWorksheetId}
            onBackToDashboard={handleStudentBack}
          />
        )}
      </main>
    </div>
  );
}

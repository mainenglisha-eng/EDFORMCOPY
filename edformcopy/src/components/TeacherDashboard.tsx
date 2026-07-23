import React, { useState, useEffect } from 'react';
import { Worksheet, StudentSubmission } from '../types';
import { 
  FileText, Link as LinkIcon, Edit3, Trash2, Download, Eye, Users, 
  Plus, Calendar, BarChart2, CheckCircle, Award, Copy, Check, X,
  Search, ExternalLink, RefreshCw, AlertCircle, Volume2, Video, Mic, Camera
} from 'lucide-react';
import { exportWorksheetToHTML5 } from './HTML5Exporter';
import { motion } from 'motion/react';

const getEmbedUrl = (url: string = '') => {
  if (!url) return '';
  let regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  let match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }
  let vReg = /vimeo\.com\/(\d+)/;
  let vMatch = url.match(vReg);
  if (vMatch) {
    return `https://player.vimeo.com/video/${vMatch[1]}`;
  }
  return url;
};

interface TeacherDashboardProps {
  onEditWorksheet: (id: string | null) => void;
  onPreviewWorksheet: (id: string) => void;
}

export default function TeacherDashboard({ onEditWorksheet, onPreviewWorksheet }: TeacherDashboardProps) {
  const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals / Overlays
  const [assignLink, setAssignLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmission | null>(null);
  const [submissionWorksheet, setSubmissionWorksheet] = useState<Worksheet | null>(null);
  const [activeTab, setActiveTab] = useState<'worksheets' | 'submissions'>('worksheets');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [wsRes, subRes] = await Promise.all([
        fetch('/api/worksheets'),
        fetch('/api/submissions')
      ]);
      
      if (wsRes.ok && subRes.ok) {
        const wsData = await wsRes.json();
        const subData = await subRes.json();
        setWorksheets(wsData);
        setSubmissions(subData);
      }
    } catch (err) {
      console.error("Error fetching dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorksheet = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta ficha? Esto borrará también todas las respuestas recibidas de los estudiantes.')) {
      return;
    }
    try {
      const res = await fetch(`/api/worksheets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setWorksheets(prev => prev.filter(w => w.id !== id));
        setSubmissions(prev => prev.filter(s => s.worksheetId !== id));
      }
    } catch (err) {
      console.error("Error deleting worksheet", err);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const triggerAssign = (wsId: string) => {
    const studentUrl = `${window.location.origin}?student=true&id=${wsId}`;
    setAssignLink(studentUrl);
  };

  const handleDownloadHTML5 = (ws: Worksheet) => {
    const htmlContent = exportWorksheetToHTML5(ws);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${ws.title.toLowerCase().replace(/\s+/g, '_')}_interactiva.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const viewSubmissionDetails = async (sub: StudentSubmission) => {
    setSelectedSubmission(sub);
    const matchingWs = worksheets.find(w => w.id === sub.worksheetId);
    if (matchingWs) {
      setSubmissionWorksheet(matchingWs);
    } else {
      // If deleted or not cached, fetch from server
      try {
        const res = await fetch(`/api/worksheets/${sub.worksheetId}`);
        if (res.ok) {
          const ws = await res.json();
          setSubmissionWorksheet(ws);
        } else {
          setSubmissionWorksheet(null);
        }
      } catch {
        setSubmissionWorksheet(null);
      }
    }
  };

  // Stats calculators
  const totalWorksheets = worksheets.length;
  const totalSubmissions = submissions.length;
  const avgScore = totalSubmissions > 0 
    ? (submissions.reduce((acc, s) => acc + (s.score / (s.maxScore || 1)), 0) / totalSubmissions) * 10
    : 0;

  const filteredWorksheets = worksheets.filter(w => 
    w.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSubmissions = submissions.filter(s => 
    s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.worksheetTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-semibold text-lg text-slate-700">Cargando panel docente...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-3xl p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl -ml-20 -mb-20"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Panel de Control Docente</h1>
            <p className="text-indigo-100/90 text-sm max-w-xl">
              Crea hojas interactivas con casillas de texto, desplegables y opciones múltiples. Asígnalas, descárgalas en formato HTML5 o revisa el progreso en tiempo real de tus estudiantes.
            </p>
          </div>
          <button
            onClick={() => onEditWorksheet(null)}
            className="self-start md:self-center bg-white hover:bg-slate-100 text-indigo-700 font-bold py-3.5 px-6 rounded-2xl shadow-lg hover:shadow-xl transition flex items-center gap-2 cursor-pointer text-sm"
          >
            <Plus className="w-5 h-5 text-indigo-600" />
            Nueva Ficha Interactiva
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 font-semibold text-xs uppercase tracking-wider block">Fichas Creadas</span>
            <span className="text-2xl font-black text-slate-800">{totalWorksheets}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 font-semibold text-xs uppercase tracking-wider block">Entregas Recibidas</span>
            <span className="text-2xl font-black text-slate-800">{totalSubmissions}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 font-semibold text-xs uppercase tracking-wider block">Nota Promedio</span>
            <span className="text-2xl font-black text-slate-800">
              {avgScore.toFixed(1)} <span className="text-xs text-slate-400 font-medium">/ 10 pts</span>
            </span>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tab Selection */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
          <button
            onClick={() => { setActiveTab('worksheets'); setSearchQuery(''); }}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'worksheets' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Mis Fichas Creadas
          </button>
          
          <button
            onClick={() => { setActiveTab('submissions'); setSearchQuery(''); }}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'submissions' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Resultados de Alumnos ({totalSubmissions})
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'worksheets' ? "Buscar ficha..." : "Buscar estudiante o ficha..."}
              className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-250 rounded-2xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full md:w-64"
            />
          </div>

          <button
            onClick={fetchData}
            title="Sincronizar Datos"
            className="p-2.5 bg-slate-50 border border-slate-250 rounded-2xl hover:bg-slate-100 text-slate-600 hover:text-indigo-600 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* --- Mis Fichas Panel --- */}
      {activeTab === 'worksheets' && (
        <>
          {filteredWorksheets.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-sm">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-700 mb-1">No se encontraron fichas</h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
                {searchQuery ? 'Prueba cambiando tus términos de búsqueda' : 'Comienza subiendo un PDF o imagen en el editor para crear tu primera ficha interactiva.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => onEditWorksheet(null)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition text-sm cursor-pointer"
                >
                  Subir PDF / Imagen
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredWorksheets.map(ws => (
                <div key={ws.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col">
                  {/* Thumbnail Preview Banner */}
                  <div className="bg-slate-50 border-b border-slate-100 h-32 flex items-center justify-center relative overflow-hidden group">
                    {ws.backgrounds[0] ? (
                      <img 
                        src={ws.backgrounds[0]} 
                        alt={ws.title} 
                        className="w-full h-full object-cover object-top opacity-80 group-hover:scale-105 transition duration-300"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <FileText className="w-10 h-10 text-slate-300" />
                    )}
                    <div className="absolute top-3 left-3 bg-indigo-600/90 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">
                      {ws.fields.length} Casillas
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base leading-snug mb-1 line-clamp-1">{ws.title}</h3>
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold mb-4">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(ws.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Action buttons list */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex gap-2">
                        <button
                          onClick={() => triggerAssign(ws.id)}
                          className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          title="Asignar actividad con un enlace"
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                          Asignar Enlace
                        </button>
                        
                        <button
                          onClick={() => onPreviewWorksheet(ws.id)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold p-2.5 rounded-xl transition text-xs flex items-center justify-center cursor-pointer"
                          title="Vista Previa de Alumno"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => onEditWorksheet(ws.id)}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Editar
                        </button>

                        <button
                          onClick={() => handleDownloadHTML5(ws)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold p-2.5 rounded-xl transition text-xs flex items-center justify-center cursor-pointer"
                          title="Descargar en HTML5 offline"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteWorksheet(ws.id)}
                          className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* --- Entregas Recibidas Panel --- */}
      {activeTab === 'submissions' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
          {filteredSubmissions.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-700 mb-1">No hay respuestas recibidas</h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mb-2">
                {searchQuery ? 'Prueba cambiando tus términos de búsqueda' : 'Comparte el Enlace de Estudiante de alguna de tus fichas creadas.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="py-4 px-6">Estudiante</th>
                    <th className="py-4 px-6">Ficha de Trabajo</th>
                    <th className="py-4 px-6">Fecha de Entrega</th>
                    <th className="py-4 px-6 text-center">Calificación</th>
                    <th className="py-4 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                  {filteredSubmissions.map(sub => {
                    const pct = (sub.score / (sub.maxScore || 1)) * 100;
                    let badgeClass = 'bg-red-50 text-red-700 border-red-200';
                    if (pct >= 80) badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    else if (pct >= 50) badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/55 transition">
                        <td className="py-4 px-6 font-bold text-slate-800">{sub.studentName}</td>
                        <td className="py-4 px-6 text-slate-600">{sub.worksheetTitle}</td>
                        <td className="py-4 px-6 text-slate-400 text-xs font-medium">
                          {new Date(sub.submittedAt).toLocaleString()}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center">
                            <span className={`px-3 py-1 border rounded-full text-xs font-extrabold ${badgeClass}`}>
                              {sub.score} / {sub.maxScore} pts
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => viewSubmissionDetails(sub)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition text-xs cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver Examen
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- Assign Enlace Link Modal --- */}
      {assignLink && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative border border-slate-100"
          >
            <button 
              onClick={() => setAssignLink(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center p-3 bg-indigo-50 text-indigo-600 rounded-full mb-3">
                <LinkIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Enlace de Asignación</h3>
              <p className="text-slate-500 text-xs mt-1">Comparte este enlace con tus alumnos para que resuelvan la actividad.</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
              <input
                type="text"
                readOnly
                value={assignLink}
                className="bg-transparent border-none text-slate-600 text-xs font-bold focus:outline-none w-full select-all"
              />
              <button
                onClick={() => handleCopyLink(assignLink)}
                className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                  copied ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-3 text-xs text-slate-400 leading-normal">
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <span>Las respuestas se calificarán de inmediato y aparecerán sincronizadas al instante en tu panel de control docente.</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* --- Detailed Student Exam Result Modal --- */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 overflow-y-auto flex justify-center p-6">
          <div className="bg-slate-100 rounded-3xl max-w-4xl w-full flex flex-col shadow-2xl relative my-auto">
            
            {/* Modal Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 rounded-t-3xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-full">
                  Examen del Estudiante
                </span>
                <h3 className="text-lg font-black text-slate-800 mt-1.5">
                  Alumno: {selectedSubmission.studentName}
                </h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Calificación</span>
                  <span className="text-lg font-black text-indigo-600">{selectedSubmission.score} / {selectedSubmission.maxScore} pts</span>
                </div>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-8">
              {submissionWorksheet ? (
                submissionWorksheet.backgrounds.map((bg, idx) => {
                  const pageNum = idx + 1;
                  const pageFields = submissionWorksheet.fields.filter(f => f.page === pageNum);

                  return (
                    <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow overflow-hidden max-w-[800px] mx-auto">
                      <div className="bg-slate-50 px-6 py-2.5 border-b border-slate-100 flex justify-between items-center text-xs font-semibold text-slate-400">
                        <span>Página {pageNum}</span>
                        <span>Vista de Corrección</span>
                      </div>
                      <div className="relative w-full" style={{ userSelect: 'none' }}>
                        <img 
                          src={bg} 
                          alt="Página" 
                          className="w-full h-auto block"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0">
                          {pageFields.map(field => {
                            const studentAns = selectedSubmission.answers[field.id] || '';
                            const correctAns = field.correctAnswer;
                            const isCorrect = (field.type === 'audio' || field.type === 'video') 
                              ? true 
                              : (field.type === 'record-audio' || field.type === 'record-video')
                                ? (studentAns.startsWith('data:') || studentAns.length > 0)
                                : studentAns.trim().toLowerCase() === correctAns.trim().toLowerCase() && correctAns !== '';

                            return (
                              <div
                                key={field.id}
                                className="absolute flex flex-col"
                                style={{
                                  left: `${field.x}%`,
                                  top: `${field.y}%`,
                                  width: `${field.width}%`,
                                  height: `${field.height}%`,
                                }}
                              >
                                {field.type === 'text' && (
                                  <div className="relative w-full h-full">
                                    <div className={`w-full h-full border-2 rounded-lg text-xs font-bold px-2 flex items-center ${
                                      isCorrect 
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800' 
                                        : 'border-red-500 bg-red-50 text-red-800'
                                    }`}>
                                      {studentAns || <span className="italic text-slate-400">(no contestó)</span>}
                                    </div>
                                    {!isCorrect && (
                                      <div className="absolute bottom-full left-0 mb-1 bg-slate-800 text-white text-[9px] py-0.5 px-1.5 rounded shadow whitespace-nowrap z-50">
                                        Correcto: {correctAns}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {field.type === 'select' && (
                                  <div className="relative w-full h-full">
                                    <div className={`w-full h-full border-2 rounded-lg text-xs font-bold px-2 flex items-center ${
                                      isCorrect 
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800' 
                                        : 'border-red-500 bg-red-50 text-red-800'
                                    }`}>
                                      {studentAns || <span className="italic text-slate-400">(no contestó)</span>}
                                    </div>
                                    {!isCorrect && (
                                      <div className="absolute bottom-full left-0 mb-1 bg-slate-800 text-white text-[9px] py-0.5 px-1.5 rounded shadow whitespace-nowrap z-50">
                                        Correcto: {correctAns}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {field.type === 'choice' && (
                                  <div className="w-full h-full bg-white/95 rounded-lg border border-slate-200 p-1 flex flex-col justify-center gap-1 overflow-hidden shadow-sm">
                                    {field.options.map((opt, oIdx) => {
                                      const isChecked = studentAns === opt;
                                      const isThisOptCorrect = correctAns === opt;
                                      
                                      let optionClass = 'border-slate-100 text-slate-400';
                                      if (isChecked && isThisOptCorrect) {
                                        optionClass = 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold';
                                      } else if (isChecked && !isThisOptCorrect) {
                                        optionClass = 'border-red-400 bg-red-50 text-red-800 font-bold';
                                      } else if (isThisOptCorrect) {
                                        optionClass = 'border-emerald-300 bg-emerald-50/50 text-emerald-800 font-bold border-dashed';
                                      }

                                      return (
                                        <div 
                                          key={oIdx} 
                                          className={`flex items-center gap-1 px-1.5 py-0.5 border rounded text-[10px] truncate ${optionClass}`}
                                        >
                                          <input
                                            type="radio"
                                            disabled
                                            checked={isChecked}
                                            className="w-3 h-3 text-indigo-600"
                                          />
                                          <span>{opt}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {field.type === 'audio' && (
                                  <div className="w-full h-full bg-amber-50/80 rounded-lg border border-amber-200 p-1 flex items-center justify-center shadow-xs overflow-hidden">
                                    <audio src={field.mediaUrl} controls className="w-full h-full object-contain" />
                                  </div>
                                )}

                                {field.type === 'video' && (
                                  <div className="w-full h-full bg-black rounded-lg border border-sky-200 overflow-hidden shadow-xs flex items-center justify-center">
                                    {field.mediaUrl?.includes('youtube.com') || field.mediaUrl?.includes('youtu.be') || field.mediaUrl?.includes('vimeo') ? (
                                      <iframe 
                                        src={getEmbedUrl(field.mediaUrl)} 
                                        title="Teacher Video Playback"
                                        className="w-full h-full border-0" 
                                        allowFullScreen
                                      />
                                    ) : (
                                      <video src={field.mediaUrl} controls className="w-full h-full object-contain" />
                                    )}
                                  </div>
                                )}

                                {field.type === 'record-audio' && (
                                  <div className="w-full h-full bg-emerald-50/80 rounded-lg border-2 border-emerald-400/50 p-1 flex items-center justify-center shadow-xs overflow-hidden">
                                    {studentAns ? (
                                      <audio src={studentAns} controls className="w-full h-full object-contain" />
                                    ) : (
                                      <span className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                                        <Mic className="w-3.5 h-3.5" /> No grabado
                                      </span>
                                    )}
                                  </div>
                                )}

                                {field.type === 'record-video' && (
                                  <div className="w-full h-full bg-rose-50/80 rounded-lg border-2 border-rose-400/50 overflow-hidden shadow-xs flex items-center justify-center">
                                    {studentAns ? (
                                      <video src={studentAns} controls className="w-full h-full object-cover bg-black" />
                                    ) : (
                                      <span className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                                        <Camera className="w-3.5 h-3.5" /> No grabado
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
                  <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600 font-bold">No se puede renderizar la ficha</p>
                  <p className="text-slate-400 text-xs mt-1">La ficha de trabajo original asociada a esta entrega fue eliminada.</p>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 rounded-b-3xl text-right">
              <button
                onClick={() => setSelectedSubmission(null)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition text-sm cursor-pointer"
              >
                Cerrar Corrección
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

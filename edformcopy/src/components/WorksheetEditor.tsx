import React, { useState, useRef, useEffect } from 'react';
import { Worksheet, WorksheetField } from '../types';
import { 
  FileText, Plus, Trash2, Save, Download, ChevronLeft, ChevronRight, 
  Settings, Type, CheckSquare, List, Info, AlertCircle, ArrowLeft,
  Sliders, HelpCircle, Check, Copy, Volume2, Video, Mic, Camera
} from 'lucide-react';
import { exportWorksheetToHTML5 } from './HTML5Exporter';

interface WorksheetEditorProps {
  worksheetId?: string | null;
  onBack: () => void;
  onSaveSuccess: () => void;
}

export default function WorksheetEditor({ worksheetId, onBack, onSaveSuccess }: WorksheetEditorProps) {
  const [title, setTitle] = useState('');
  const [backgrounds, setBackgrounds] = useState<string[]>([]);
  const [fields, setFields] = useState<WorksheetField[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<'text' | 'choice' | 'select' | 'audio' | 'video' | 'record-audio' | 'record-video' | null>('text');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfRenderingStatus, setPdfRenderingStatus] = useState<string>('');
  
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; fieldX: number; fieldY: number } | null>(null);
  
  const [resizingFieldId, setResizingFieldId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; fieldWidth: number; fieldHeight: number } | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // If editing an existing worksheet
  useEffect(() => {
    if (worksheetId) {
      loadWorksheet(worksheetId);
    }
  }, [worksheetId]);

  const loadWorksheet = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/worksheets/${id}`);
      if (res.ok) {
        const data: Worksheet = await res.json();
        setTitle(data.title);
        setBackgrounds(data.backgrounds);
        setFields(data.fields);
        setCurrentPage(1);
      }
    } catch (err) {
      console.error("Error loading worksheet", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle PDF/Image upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setPdfRenderingStatus('Procesando archivo...');
    
    // Default title from file name
    if (!title) {
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setTitle(nameWithoutExt);
    }

    if (file.type === 'application/pdf') {
      try {
        setPdfRenderingStatus('Inicializando motor de renderizado PDF...');
        const pdfjsLib = (window as any).pdfjsLib;
        if (!pdfjsLib) {
          throw new Error('La librería de PDF no está cargada en el navegador. Intente recargar.');
        }

        const fileReader = new FileReader();
        fileReader.onload = async function() {
          try {
            const arrayBuffer = this.result as ArrayBuffer;
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            
            setPdfRenderingStatus('Cargando documento PDF...');
            const pdf = await loadingTask.promise;
            const pagesBgs: string[] = [];
            
            for (let i = 1; i <= pdf.numPages; i++) {
              setPdfRenderingStatus(`Renderizando página ${i} de ${pdf.numPages}...`);
              const page = await pdf.getPage(i);
              
              // Render PDF page to a canvas
              const viewport = page.getViewport({ scale: 1.5 });
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              
              if (context) {
                await page.render({ canvasContext: context, viewport }).promise;
                // Convert page to JPEG base64 to store in worksheet
                pagesBgs.push(canvas.toDataURL('image/jpeg', 0.85));
              }
            }
            
            setBackgrounds(pagesBgs);
            setCurrentPage(1);
            setFields([]);
            setPdfRenderingStatus('');
            setLoading(false);
          } catch (err: any) {
            alert('Error al renderizar el PDF: ' + err.message);
            setLoading(false);
          }
        };
        fileReader.readAsArrayBuffer(file);
      } catch (err: any) {
        alert(err.message);
        setLoading(false);
      }
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setBackgrounds([reader.result as string]);
        setCurrentPage(1);
        setFields([]);
        setLoading(false);
        setPdfRenderingStatus('');
      };
      reader.readAsDataURL(file);
    } else {
      alert('Por favor, sube un PDF o una imagen (PNG/JPG).');
      setLoading(false);
    }
  };

  // Add field on canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedTool || backgrounds.length === 0 || !containerRef.current) return;

    // Calculate percentage coords
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Default sizes based on tool type
    let defaultWidth = 12; // % of canvas
    let defaultHeight = 4; // % of canvas
    let options: string[] = [];

    if (selectedTool === 'select') {
      options = ['Opción A', 'Opción B', 'Opción C'];
    } else if (selectedTool === 'choice') {
      defaultWidth = 14;
      defaultHeight = 8;
      options = ['Verdadero', 'Falso'];
    } else if (selectedTool === 'audio') {
      defaultWidth = 20;
      defaultHeight = 6;
    } else if (selectedTool === 'video') {
      defaultWidth = 32;
      defaultHeight = 18;
    } else if (selectedTool === 'record-audio') {
      defaultWidth = 18;
      defaultHeight = 6;
    } else if (selectedTool === 'record-video') {
      defaultWidth = 24;
      defaultHeight = 15;
    }

    const newField: WorksheetField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: selectedTool,
      page: currentPage,
      x: parseFloat(x.toFixed(2)),
      y: parseFloat(y.toFixed(2)),
      width: defaultWidth,
      height: defaultHeight,
      correctAnswer: selectedTool === 'choice' ? 'Verdadero' : '',
      points: (selectedTool === 'audio' || selectedTool === 'video') ? 0 : 1,
      options,
      placeholder: selectedTool === 'text' ? 'Escribe aquí' : undefined,
      mediaUrl: (selectedTool === 'audio') 
        ? 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' 
        : (selectedTool === 'video') 
          ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' 
          : '',
      mediaEmbed: ''
    };

    setFields(prev => [...prev, newField]);
    setActiveFieldId(newField.id);
  };

  const updateFieldProperty = (fieldId: string, property: keyof WorksheetField, value: any) => {
    setFields(prev => prev.map(field => {
      if (field.id === fieldId) {
        return { ...field, [property]: value };
      }
      return field;
    }));
  };

  const deleteField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    if (activeFieldId === id) {
      setActiveFieldId(null);
    }
  };

  const duplicateField = (field: WorksheetField, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newField: WorksheetField = {
      ...field,
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      x: Math.min(85, field.x + 3),
      y: Math.min(90, field.y + 3),
    };
    setFields(prev => [...prev, newField]);
    setActiveFieldId(newField.id);
  };

  // Drag-and-drop handlers for mouse movement of fields on canvas
  useEffect(() => {
    if (!draggingFieldId || !dragStart || !containerRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const deltaX = ((e.clientX - dragStart.x) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStart.y) / rect.height) * 100;

      const targetField = fields.find(f => f.id === draggingFieldId);
      if (!targetField) return;

      let newX = parseFloat((dragStart.fieldX + deltaX).toFixed(2));
      let newY = parseFloat((dragStart.fieldY + deltaY).toFixed(2));

      // Clamp so it stays inside the page bounds [0, 100]
      newX = Math.max(0, Math.min(100 - targetField.width, newX));
      newY = Math.max(0, Math.min(100 - targetField.height, newY));

      setFields(prev => prev.map(f => {
        if (f.id === draggingFieldId) {
          return { ...f, x: newX, y: newY };
        }
        return f;
      }));
    };

    const handleMouseUp = () => {
      setDraggingFieldId(null);
      setDragStart(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingFieldId, dragStart, fields]);

  // Handle resizing fields with the mouse
  useEffect(() => {
    if (!resizingFieldId || !resizeStart || !containerRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const deltaX = ((e.clientX - resizeStart.x) / rect.width) * 100;
      const deltaY = ((e.clientY - resizeStart.y) / rect.height) * 100;

      const targetField = fields.find(f => f.id === resizingFieldId);
      if (!targetField) return;

      // Calculate new width & height
      let newWidth = parseFloat((resizeStart.fieldWidth + deltaX).toFixed(2));
      let newHeight = parseFloat((resizeStart.fieldHeight + deltaY).toFixed(2));

      // Clamp size to reasonable bounds (e.g., minimum 2.5%, and cannot exceed sheet boundary)
      newWidth = Math.max(2.5, Math.min(100 - targetField.x, newWidth));
      newHeight = Math.max(2.5, Math.min(100 - targetField.y, newHeight));

      setFields(prev => prev.map(f => {
        if (f.id === resizingFieldId) {
          return { ...f, width: newWidth, height: newHeight };
        }
        return f;
      }));
    };

    const handleMouseUp = () => {
      setResizingFieldId(null);
      setResizeStart(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingFieldId, resizeStart, fields]);

  const activeField = fields.find(f => f.id === activeFieldId);

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Por favor introduce un título para la ficha.');
      return;
    }
    if (backgrounds.length === 0) {
      alert('Por favor sube un PDF o imagen para tu ficha de trabajo.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: worksheetId || undefined,
        title,
        backgrounds,
        fields
      };

      const res = await fetch('/api/worksheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Error al guardar en el servidor');
      }

      onSaveSuccess();
    } catch (err: any) {
      alert(err.message || 'Error al conectar con el servidor.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadHTML5 = () => {
    if (backgrounds.length === 0) {
      alert('Sube un fondo para poder exportar la ficha.');
      return;
    }
    const htmlContent = exportWorksheetToHTML5({
      id: worksheetId || 'custom-worksheet',
      title,
      backgrounds,
      fields,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_interactiva.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-900 text-slate-100">
      {/* Editor Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-700 rounded-lg transition text-slate-400 hover:text-slate-200 cursor-pointer"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título de la ficha de trabajo..."
            className="bg-transparent border-b border-slate-600 focus:border-indigo-500 py-1 font-bold text-lg focus:outline-none w-full max-w-md transition text-slate-100"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadHTML5}
            disabled={backgrounds.length === 0}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-lg transition text-sm flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Descargar HTML5
          </button>

          <button
            onClick={handleSave}
            disabled={saving || backgrounds.length === 0}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold rounded-lg transition text-sm flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar y Publicar'}
          </button>
        </div>
      </div>

      {/* Editor Main Area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Toolbar */}
        <div className="w-64 bg-slate-800 border-r border-slate-700 p-4 flex flex-col gap-6 select-none">
          <div>
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">Paso 1: Subir Archivo</h3>
            {backgrounds.length === 0 ? (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-600 rounded-xl p-6 cursor-pointer hover:border-indigo-500 hover:bg-slate-750 transition text-center">
                <FileText className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-sm font-semibold text-slate-200">Sube un PDF o Imagen</span>
                <span className="text-xs text-slate-500 mt-1">Soporta PDF, PNG, JPG</span>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="bg-slate-750 rounded-xl p-3 border border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                  <span className="text-xs text-slate-300 truncate">Documento cargado ({backgrounds.length} pág.)</span>
                </div>
                <label className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer flex-shrink-0 ml-2">
                  Cambiar
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">Paso 2: Herramientas interactivo</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setSelectedTool('text')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition text-left cursor-pointer ${
                  selectedTool === 'text' 
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' 
                    : 'bg-slate-750 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Type className="w-4 h-4 flex-shrink-0" />
                <span>Casilla de Texto (Span)</span>
              </button>

              <button
                onClick={() => setSelectedTool('select')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition text-left cursor-pointer ${
                  selectedTool === 'select' 
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' 
                    : 'bg-slate-750 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <List className="w-4 h-4 flex-shrink-0" />
                <span>Menú Desplegable (Select)</span>
              </button>

              <button
                onClick={() => setSelectedTool('choice')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition text-left cursor-pointer ${
                  selectedTool === 'choice' 
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' 
                    : 'bg-slate-750 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <CheckSquare className="w-4 h-4 flex-shrink-0" />
                <span>Opción Múltiple</span>
              </button>
            </div>

            <h4 className="text-[10px] font-extrabold uppercase text-indigo-400 tracking-wider mt-4 mb-2">Multimedia e Interacción</h4>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setSelectedTool('audio')}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs font-semibold transition text-left cursor-pointer ${
                  selectedTool === 'audio' 
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' 
                    : 'bg-slate-750 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Volume2 className="w-4 h-4 flex-shrink-0 text-amber-400" />
                <span>Reproductor Audio</span>
              </button>

              <button
                onClick={() => setSelectedTool('video')}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs font-semibold transition text-left cursor-pointer ${
                  selectedTool === 'video' 
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' 
                    : 'bg-slate-750 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Video className="w-4 h-4 flex-shrink-0 text-sky-400" />
                <span>Ver Video (YouTube/Link)</span>
              </button>

              <button
                onClick={() => setSelectedTool('record-audio')}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs font-semibold transition text-left cursor-pointer ${
                  selectedTool === 'record-audio' 
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' 
                    : 'bg-slate-750 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Mic className="w-4 h-4 flex-shrink-0 text-emerald-400 animate-pulse" />
                <span>Grabar Audio (Estudiante)</span>
              </button>

              <button
                onClick={() => setSelectedTool('record-video')}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs font-semibold transition text-left cursor-pointer ${
                  selectedTool === 'record-video' 
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' 
                    : 'bg-slate-750 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Camera className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>Grabar Video (Estudiante)</span>
              </button>
            </div>
          </div>
            
            {backgrounds.length > 0 && (
              <p className="text-[11px] text-slate-400 mt-3 flex items-start gap-1.5 bg-slate-750/50 p-2.5 rounded-lg border border-slate-700/50 leading-relaxed">
                <Info className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <span>Haz clic en la herramienta deseada arriba, y luego haz clic en el documento para posicionarla. Puedes arrastrar cualquier casilla con el mouse.</span>
              </p>
            )}

          {backgrounds.length > 0 && (
            <div className="pt-4 border-t border-slate-750/60 flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Acciones Rápidas</span>
              <button
                onClick={() => {
                  if (window.confirm('¿Estás seguro de que deseas eliminar TODOS los campos interactivos de esta página?')) {
                    setFields(prev => prev.filter(f => f.page !== currentPage));
                    setActiveFieldId(null);
                  }
                }}
                disabled={fields.filter(f => f.page === currentPage).length === 0}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-950/40 hover:bg-rose-900/40 disabled:opacity-30 disabled:cursor-not-allowed border border-rose-900/40 rounded-xl text-xs font-bold text-rose-300 hover:text-rose-200 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Borrar todos los campos
              </button>
            </div>
          )}

          {backgrounds.length > 1 && (
            <div className="mt-auto pt-4 border-t border-slate-750">
              <span className="text-xs font-bold text-slate-400 block mb-2">PÁGINAS</span>
              <div className="flex items-center justify-between bg-slate-750 border border-slate-700 rounded-lg p-1.5">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="p-1.5 hover:bg-slate-700 disabled:opacity-40 rounded transition cursor-pointer text-slate-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-200">
                  Pág. {currentPage} / {backgrounds.length}
                </span>
                <button
                  disabled={currentPage >= backgrounds.length}
                  onClick={() => setCurrentPage(prev => Math.min(backgrounds.length, prev + 1))}
                  className="p-1.5 hover:bg-slate-700 disabled:opacity-40 rounded transition cursor-pointer text-slate-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Central Workspace Canvas */}
        <div className="flex-1 bg-slate-950 overflow-y-auto p-8 flex flex-col items-center">
          
          {loading && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="font-bold text-lg text-indigo-400">{pdfRenderingStatus || 'Cargando editor...'}</p>
              <p className="text-sm text-slate-400 mt-1">Por favor espera un momento.</p>
            </div>
          )}

          {backgrounds.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center max-w-md text-center py-24">
              <div className="p-4 bg-slate-800 rounded-full text-indigo-400 mb-4 animate-pulse">
                <FileText className="w-12 h-12" />
              </div>
              <h2 className="text-lg font-bold text-slate-200 mb-2">Sube tu primer recurso</h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Sube una ficha de sumas, un cuestionario escolar o un mapa en PDF/imagen para convertirlo en un documento calificado autocalificable.
              </p>
              <label className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer text-sm">
                Seleccionar PDF o Imagen
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="relative max-w-[850px] w-full" style={{ userSelect: 'none' }}>
              <div className="mb-4 flex items-center justify-between text-slate-400 text-xs px-2">
                <span>Título: {title || 'Sin Título'}</span>
                <span>Página {currentPage} de {backgrounds.length}</span>
              </div>

              {/* Dynamic canvas container */}
              <div 
                ref={containerRef}
                onClick={handleCanvasClick}
                className="relative bg-white border border-slate-700 shadow-2xl rounded-lg overflow-hidden cursor-crosshair w-full"
              >
                <img 
                  src={backgrounds[currentPage - 1]} 
                  alt="Ficha" 
                  className="w-full h-auto block pointer-events-none"
                  referrerPolicy="no-referrer"
                />

                {/* Overlays list */}
                {fields.filter(f => f.page === currentPage).map(field => {
                  const isActive = field.id === activeFieldId;
                  
                  return (
                    <div
                      key={field.id}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setActiveFieldId(field.id);
                        setDraggingFieldId(field.id);
                        setDragStart({
                          x: e.clientX,
                          y: e.clientY,
                          fieldX: field.x,
                          fieldY: field.y
                        });
                      }}
                      onClick={(e) => {
                        e.stopPropagation(); // Avoid adding new field
                        setActiveFieldId(field.id);
                      }}
                      className={`group absolute border-2 rounded-lg flex items-center justify-center p-0.5 cursor-move transition-all duration-75 ${
                        isActive 
                          ? 'border-indigo-500 bg-indigo-500/15 ring-2 ring-indigo-300' 
                          : 'border-slate-500/80 bg-slate-500/5 hover:border-slate-400 hover:bg-slate-400/5'
                      }`}
                      style={{
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        width: `${field.width}%`,
                        height: `${field.height}%`,
                      }}
                    >
                      {/* Floating helper actions on hover/active */}
                      <div className={`absolute -top-3.5 -right-3.5 flex items-center gap-1 transition-opacity duration-200 z-30 ${
                        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}>
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateField(field, e);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-1 shadow-md hover:scale-110 active:scale-95 transition-all border border-indigo-500 cursor-pointer flex items-center justify-center"
                          title="Duplicar casilla"
                        >
                          <Copy className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteField(field.id);
                          }}
                          className="bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 shadow-md hover:scale-110 active:scale-95 transition-all border border-rose-500 cursor-pointer flex items-center justify-center"
                          title="Eliminar casilla"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      {/* Visual indicator based on tool type */}
                      {field.type === 'text' && (
                        <div className="w-full h-full bg-indigo-600/10 rounded flex items-center justify-between px-1.5 overflow-hidden text-[10px] text-indigo-300 font-bold">
                          <span className="truncate">TEXTO: {field.correctAnswer || '(vacío)'}</span>
                          <span className="font-mono text-[9px] bg-indigo-600/30 px-1 rounded flex-shrink-0">{field.points}pt</span>
                        </div>
                      )}

                      {field.type === 'select' && (
                        <div className="w-full h-full bg-emerald-600/10 rounded flex items-center justify-between px-1.5 overflow-hidden text-[10px] text-emerald-300 font-bold border border-emerald-500/40">
                          <span className="truncate">SEL: {field.correctAnswer || '(vacío)'}</span>
                          <span className="font-mono text-[9px] bg-emerald-600/30 px-1 rounded flex-shrink-0">{field.points}pt</span>
                        </div>
                      )}

                      {field.type === 'choice' && (
                        <div className="w-full h-full bg-amber-600/10 rounded flex flex-col justify-center p-1 overflow-hidden text-[8px] text-amber-300 font-bold border border-amber-500/40 gap-0.5">
                          <div className="flex justify-between items-center w-full border-b border-amber-500/20 pb-0.5 mb-0.5">
                             <span className="uppercase text-[7px] tracking-wider">MULTICHOICE</span>
                             <span className="bg-amber-600/30 px-1 rounded">{field.points}pt</span>
                          </div>
                          <div className="truncate text-amber-200">Ans: {field.correctAnswer || '(vacío)'}</div>
                        </div>
                      )}

                      {field.type === 'audio' && (
                        <div className="w-full h-full bg-amber-600/15 rounded flex items-center gap-1.5 px-2 overflow-hidden text-[10px] text-amber-400 font-bold border border-amber-500/40">
                          <Volume2 className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="block text-[8px] text-amber-500 uppercase tracking-wider">REPRODUCIR AUDIO</span>
                            <span className="block truncate text-[9px] text-slate-300 font-normal">{field.mediaUrl || 'Sin enlace'}</span>
                          </div>
                        </div>
                      )}

                      {field.type === 'video' && (
                        <div className="w-full h-full bg-sky-600/15 rounded flex items-center gap-1.5 px-2 overflow-hidden text-[10px] text-sky-400 font-bold border border-sky-500/40">
                          <Video className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="block text-[8px] text-sky-500 uppercase tracking-wider">VER VIDEO</span>
                            <span className="block truncate text-[9px] text-slate-300 font-normal">{field.mediaUrl || 'Sin enlace'}</span>
                          </div>
                        </div>
                      )}

                      {field.type === 'record-audio' && (
                        <div className="w-full h-full bg-emerald-600/15 rounded flex items-center justify-between px-2 overflow-hidden text-[10px] text-emerald-400 font-bold border border-emerald-500/40">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Mic className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 animate-pulse" />
                            <div className="min-w-0">
                              <span className="block text-[8px] text-emerald-500 uppercase tracking-wider">GRABAR AUDIO</span>
                              <span className="block truncate text-[9px] text-slate-300 font-normal">Micrófono activo</span>
                            </div>
                          </div>
                          <span className="font-mono text-[9px] bg-emerald-600/30 px-1 rounded flex-shrink-0">{field.points}pt</span>
                        </div>
                      )}

                      {field.type === 'record-video' && (
                        <div className="w-full h-full bg-rose-600/15 rounded flex items-center justify-between px-2 overflow-hidden text-[10px] text-rose-400 font-bold border border-rose-500/40">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Camera className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <span className="block text-[8px] text-rose-500 uppercase tracking-wider">GRABAR VIDEO</span>
                              <span className="block truncate text-[9px] text-slate-300 font-normal">Cámara activa</span>
                            </div>
                          </div>
                          <span className="font-mono text-[9px] bg-rose-600/30 px-1 rounded flex-shrink-0">{field.points}pt</span>
                        </div>
                      )}

                      {/* Resize Handle at the bottom right corner */}
                      <div 
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setActiveFieldId(field.id);
                          setResizingFieldId(field.id);
                          setResizeStart({
                            x: e.clientX,
                            y: e.clientY,
                            fieldWidth: field.width,
                            fieldHeight: field.height
                          });
                        }}
                        className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-se-resize flex items-end justify-end p-0.5 z-20 opacity-40 group-hover:opacity-100 transition-opacity"
                        title="Arrastra para cambiar el tamaño"
                      >
                        <svg className="w-2.5 h-2.5 text-slate-400 hover:text-indigo-400 select-none pointer-events-none" viewBox="0 0 10 10" fill="currentColor">
                          <path d="M10,0 L0,10 L10,10 Z" />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Properties Inspector */}
        <div className="w-80 bg-slate-800 border-l border-slate-700 p-4 flex flex-col overflow-y-auto">
          {activeField ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-indigo-400" />
                  Propiedades del Campo
                </h3>
                <button
                  onClick={() => deleteField(activeField.id)}
                  className="p-1.5 bg-red-950/40 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition cursor-pointer"
                  title="Eliminar campo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Type Read-only Info */}
              <div className="bg-slate-750 rounded-xl p-3 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider mb-1">TIPO DE CAMPO</span>
                <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  {activeField.type === 'text' && <Type className="w-4 h-4 text-indigo-400" />}
                  {activeField.type === 'select' && <List className="w-4 h-4 text-emerald-400" />}
                  {activeField.type === 'choice' && <CheckSquare className="w-4 h-4 text-amber-400" />}
                  {activeField.type === 'text' && 'Entrada de Texto'}
                  {activeField.type === 'select' && 'Menú Desplegable'}
                  {activeField.type === 'choice' && 'Opción Múltiple'}
                </span>
              </div>

              {/* Sliders for Width and Height */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  Dimensiones y Posición
                </h4>
                
                <div className="space-y-3 bg-slate-750/40 border border-slate-700/50 rounded-xl p-3">
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                      <span>Ancho de casilla</span>
                      <span>{Math.round(activeField.width)}%</span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="40"
                      step="0.5"
                      value={activeField.width}
                      onChange={e => updateFieldProperty(activeField.id, 'width', parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                      <span>Alto de casilla</span>
                      <span>{Math.round(activeField.height)}%</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="20"
                      step="0.5"
                      value={activeField.height}
                      onChange={e => updateFieldProperty(activeField.id, 'height', parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Manual coordinates offsets */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Alinear Izq (X%)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={activeField.x}
                        onChange={e => updateFieldProperty(activeField.id, 'x', parseFloat(e.target.value))}
                        className="w-full bg-slate-750 border border-slate-700 rounded p-1 text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Alinear Top (Y%)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={activeField.y}
                        onChange={e => updateFieldProperty(activeField.id, 'y', parseFloat(e.target.value))}
                        className="w-full bg-slate-750 border border-slate-700 rounded p-1 text-xs text-slate-200"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Grading Properties (Points) */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Puntaje (Valor)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={activeField.points}
                  onChange={e => updateFieldProperty(activeField.id, 'points', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-750 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none font-bold"
                />
              </div>

              {/* Actions: Duplicate / Delete */}
              <div className="grid grid-cols-2 gap-2 border-t border-slate-700/60 pt-4">
                <button
                  onClick={() => duplicateField(activeField)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-950/40 hover:bg-indigo-900/30 border border-indigo-900/40 text-indigo-300 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Duplicar
                </button>
                <button
                  onClick={() => deleteField(activeField.id)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-950/40 hover:bg-rose-900/30 border border-rose-900/40 text-rose-300 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar
                </button>
              </div>

              {/* Custom Options and Correct Answer Selector (for Dropdown or Choice) */}
              {(activeField.type === 'select' || activeField.type === 'choice') && (
                <div className="space-y-4 border-t border-slate-700/60 pt-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Opciones y Respuesta Correcta
                    </span>
                    <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
                      Haz clic en el botón de check <span className="text-emerald-400 font-bold">✓</span> al lado de la opción para seleccionarla como la **respuesta correcta** para calificar automáticamente.
                    </p>
                    
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {activeField.options.map((option, idx) => {
                        const isCorrect = activeField.correctAnswer === option;
                        return (
                          <div key={idx} className="flex items-center gap-2 bg-slate-750/70 p-2 rounded-xl border border-slate-700/60">
                            {/* Correct indicator button */}
                            <button
                              onClick={() => updateFieldProperty(activeField.id, 'correctAnswer', option)}
                              className={`w-7 h-7 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                                isCorrect 
                                  ? 'bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/10' 
                                  : 'bg-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                              }`}
                              title={isCorrect ? 'Respuesta correcta elegida' : 'Marcar como respuesta correcta'}
                            >
                              <Check className="w-4 h-4" />
                            </button>

                            {/* Option value input */}
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...activeField.options];
                                const oldVal = newOptions[idx];
                                const newVal = e.target.value;
                                newOptions[idx] = newVal;
                                
                                updateFieldProperty(activeField.id, 'options', newOptions);
                                
                                // Keep correct answer updated with the modified text
                                if (activeField.correctAnswer === oldVal) {
                                  updateFieldProperty(activeField.id, 'correctAnswer', newVal);
                                }
                              }}
                              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 flex-1 focus:border-indigo-500 focus:outline-none font-medium"
                              placeholder={`Opción ${idx + 1}`}
                            />

                            {/* Delete Option Button */}
                            <button
                              onClick={() => {
                                const newOptions = activeField.options.filter((_, i) => i !== idx);
                                updateFieldProperty(activeField.id, 'options', newOptions);
                                if (activeField.correctAnswer === option) {
                                  updateFieldProperty(activeField.id, 'correctAnswer', newOptions[0] || '');
                                }
                              }}
                              disabled={activeField.options.length <= 1}
                              className="p-1 text-slate-400 hover:text-rose-400 disabled:opacity-30 rounded transition cursor-pointer"
                              title="Eliminar opción"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const optName = `Opción ${activeField.options.length + 1}`;
                      const newOptions = [...activeField.options, optName];
                      updateFieldProperty(activeField.id, 'options', newOptions);
                      if (!activeField.correctAnswer) {
                        updateFieldProperty(activeField.id, 'correctAnswer', optName);
                      }
                    }}
                    className="w-full py-2 bg-slate-750 hover:bg-slate-700 text-slate-200 rounded-xl border border-dashed border-slate-650 hover:border-slate-500 transition text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Añadir Nueva Opción
                  </button>

                  <div className="space-y-1 bg-slate-750/30 p-2.5 rounded-xl border border-slate-700/40">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Respuesta Correcta actual:</span>
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      {activeField.correctAnswer || '(Ninguna seleccionada)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Text Field Correct Answer input */}
              {activeField.type === 'text' && (
                <div className="space-y-2 border-t border-slate-700/60 pt-4">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Respuesta Correcta para Calificación
                  </label>
                  <input
                    type="text"
                    placeholder="Introduce el texto correcto..."
                    value={activeField.correctAnswer}
                    onChange={e => updateFieldProperty(activeField.id, 'correctAnswer', e.target.value)}
                    className="w-full bg-slate-750 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 leading-normal">
                    La corrección de texto no distingue entre mayúsculas y minúsculas.
                  </p>
                </div>
              )}

              {/* Input Placeholder (Text type only) */}
              {activeField.type === 'text' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Ayuda / Placeholder
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Escribe la capital..."
                    value={activeField.placeholder || ''}
                    onChange={e => updateFieldProperty(activeField.id, 'placeholder', e.target.value)}
                    className="w-full bg-slate-750 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Media Settings (for Audio and Video types) */}
              {(activeField.type === 'audio' || activeField.type === 'video') && (
                <div className="space-y-4 border-t border-slate-700/60 pt-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Configuración del Recurso Multimedia
                  </h4>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Enlace / URL del archivo
                    </label>
                    <input
                      type="text"
                      placeholder={activeField.type === 'audio' ? "Ej. https://sitio.com/audio.mp3" : "Ej. https://www.youtube.com/watch?v=..."}
                      value={activeField.mediaUrl || ''}
                      onChange={e => updateFieldProperty(activeField.id, 'mediaUrl', e.target.value)}
                      className="w-full bg-slate-750 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      {activeField.type === 'audio' 
                        ? 'Enlace directo a un archivo MP3, WAV u OGG.' 
                        : 'Enlace de video de YouTube, Vimeo, o archivo directo MP4.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <HelpCircle className="w-10 h-10 mb-2 text-slate-600" />
              <p className="text-sm font-semibold">Ninguna casilla seleccionada</p>
              <p className="text-xs mt-1">Haz clic sobre cualquier casilla o crea una nueva para configurar sus propiedades.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

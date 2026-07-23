import React, { useState, useEffect, useRef } from 'react';
import { Worksheet, WorksheetField } from '../types';
import { Check, AlertCircle, Award, ArrowLeft, ArrowRight, Save, User, Volume2, Video, Mic, Camera, Square, RotateCcw, Play } from 'lucide-react';
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

interface StudentViewProps {
  worksheetId: string;
  onBackToDashboard?: () => void;
}

export default function StudentView({ worksheetId, onBackToDashboard }: StudentViewProps) {
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [studentName, setStudentName] = useState('');
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Student answer state: field.id -> answer string
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [gradingResult, setGradingResult] = useState<{
    score: number;
    maxScore: number;
    correctFields: Record<string, boolean>;
  } | null>(null);

  const mediaRecordersRef = useRef<Record<string, MediaRecorder | null>>({});
  const streamsRef = useRef<Record<string, MediaStream | null>>({});
  const [recordingStates, setRecordingStates] = useState<Record<string, 'idle' | 'recording' | 'recorded'>>({});

  // Cleanup active recording streams on unmount
  useEffect(() => {
    return () => {
      Object.values(streamsRef.current).forEach(stream => {
        if (stream) {
          (stream as any).getTracks().forEach((track: any) => track.stop());
        }
      });
    };
  }, []);

  const startAudioRecording = async (fieldId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamsRef.current[fieldId] = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecordersRef.current[fieldId] = mediaRecorder;
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setAnswers(prev => ({ ...prev, [fieldId]: base64data }));
        };
        reader.readAsDataURL(blob);
        
        setRecordingStates(prev => ({ ...prev, [fieldId]: 'recorded' }));
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setRecordingStates(prev => ({ ...prev, [fieldId]: 'recording' }));
    } catch (err) {
      alert("No se pudo acceder al micrófono. Por favor, otorga los permisos necesarios.");
    }
  };

  const stopAudioRecording = (fieldId: string) => {
    const recorder = mediaRecordersRef.current[fieldId];
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const startVideoRecording = async (fieldId: string, videoElement: HTMLVideoElement | null) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      streamsRef.current[fieldId] = stream;
      
      if (videoElement) {
        videoElement.srcObject = stream;
        videoElement.play().catch(e => console.log(e));
      }
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecordersRef.current[fieldId] = mediaRecorder;
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setAnswers(prev => ({ ...prev, [fieldId]: base64data }));
        };
        reader.readAsDataURL(blob);
        
        setRecordingStates(prev => ({ ...prev, [fieldId]: 'recorded' }));
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setRecordingStates(prev => ({ ...prev, [fieldId]: 'recording' }));
    } catch (err) {
      alert("No se pudo acceder a la cámara o micrófono. Por favor, otorga los permisos necesarios.");
    }
  };

  const stopVideoRecording = (fieldId: string) => {
    const recorder = mediaRecordersRef.current[fieldId];
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  useEffect(() => {
    fetchWorksheet();
  }, [worksheetId]);

  const fetchWorksheet = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/worksheets/${worksheetId}`);
      if (!res.ok) {
        throw new Error('No se pudo cargar la ficha interactiva');
      }
      const data = await res.json();
      setWorksheet(data);
      
      // Initialize empty answers
      const initialAnswers: Record<string, string> = {};
      data.fields.forEach((field: WorksheetField) => {
        initialAnswers[field.id] = '';
      });
      setAnswers(initialAnswers);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (studentName.trim()) {
      setStarted(true);
    }
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    if (submitted) return;
    setAnswers(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSubmit = async () => {
    if (!worksheet || submitted) return;
    
    // Grade the worksheet
    let earnedPoints = 0;
    let totalPoints = 0;
    const correctFields: Record<string, boolean> = {};

    worksheet.fields.forEach(field => {
      // Audio or video links are informational, they do not have points
      if (field.type === 'audio' || field.type === 'video') {
        correctFields[field.id] = true;
        return;
      }

      const studentAns = (answers[field.id] || '').trim();
      const points = field.points || 0;
      
      if (field.type === 'record-audio' || field.type === 'record-video') {
        totalPoints += points;
        // Correct if student has recorded something (non-empty string)
        const isRecorded = studentAns.startsWith('data:') || studentAns.length > 0;
        correctFields[field.id] = isRecorded;
        if (isRecorded) {
          earnedPoints += points;
        }
        return;
      }

      // Standard gradable fields (text, select, choice)
      totalPoints += points;
      const isCorrect = studentAns.toLowerCase() === field.correctAnswer.trim().toLowerCase() && field.correctAnswer !== '';
      correctFields[field.id] = isCorrect;
      if (isCorrect) {
        earnedPoints += points;
      }
    });

    const result = {
      score: earnedPoints,
      maxScore: totalPoints,
      correctFields
    };

    try {
      // Save submission to server
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worksheetId: worksheet.id,
          studentName,
          answers,
          score: earnedPoints,
          maxScore: totalPoints
        })
      });

      if (!res.ok) {
        throw new Error('Error al sincronizar tus respuestas');
      }

      setGradingResult(result);
      setSubmitted(true);
    } catch (err: any) {
      alert(err.message || 'No se pudo enviar el resultado. Reintenta por favor.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-gray-500">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" id="spinner-loader"></div>
        <p className="font-medium text-lg">Cargando actividad...</p>
      </div>
    );
  }

  if (error || !worksheet) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white rounded-xl shadow-lg p-8 border border-red-100 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">¡Ups! Algo salió mal</h2>
        <p className="text-gray-600 mb-6">{error || 'La ficha interactiva no existe.'}</p>
        {onBackToDashboard && (
          <button
            onClick={onBackToDashboard}
            className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
          >
            Volver al Panel
          </button>
        )}
      </div>
    );
  }

  // Welcome Screen / Name entry
  if (!started) {
    return (
      <div className="max-w-lg mx-auto my-12 bg-white rounded-xl shadow-xl p-8 border border-indigo-50/50">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-50 text-indigo-600 rounded-full mb-4">
            <Award className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{worksheet.title}</h1>
          <p className="text-gray-500 text-sm">Ficha de trabajo interactiva para estudiantes</p>
        </div>

        <form onSubmit={handleStart} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="student-name">
              Escribe tu nombre completo
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <input
                id="student-name"
                type="text"
                required
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                placeholder="Ej. Sofía Rodríguez"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm text-gray-800 font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl transition duration-200 shadow-md flex items-center justify-center gap-2 text-base cursor-pointer"
          >
            Iniciar Actividad
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Tus respuestas serán enviadas automáticamente al panel de control de tu profesor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Header Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full uppercase tracking-wider">
            Estudiante: {studentName}
          </span>
          <h1 className="text-2xl font-bold text-slate-800 mt-2">{worksheet.title}</h1>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition flex items-center gap-2 text-sm cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Salir
            </button>
          )}

          {!submitted ? (
            <button
              onClick={handleSubmit}
              className="flex-1 md:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Enviar Respuestas
            </button>
          ) : (
            <div className="px-5 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold flex items-center gap-2 text-sm">
              <Check className="w-5 h-5" />
              ¡Enviado con Éxito!
            </div>
          )}
        </div>
      </div>

      {/* Grade Results Card */}
      {submitted && gradingResult && (
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-6 mb-8 text-center"
        >
          <div className="inline-flex items-center justify-center p-3 bg-emerald-100 text-emerald-700 rounded-full mb-3">
            <Award className="w-12 h-12" />
          </div>
          <h2 className="text-xl font-bold text-emerald-900 mb-1">¡Buen trabajo, {studentName}!</h2>
          <p className="text-emerald-700 text-sm mb-4">
            Tus respuestas han sido corregidas y guardadas para tu profesor.
          </p>
          <div className="inline-block bg-white border border-emerald-200 rounded-2xl px-8 py-4 shadow-sm">
            <span className="text-xs text-slate-400 font-semibold block uppercase tracking-widest mb-1">PUNTUACIÓN</span>
            <span className="text-3xl font-extrabold text-emerald-600">
              {gradingResult.score} <span className="text-slate-400 text-xl font-medium">/ {gradingResult.maxScore}</span>
            </span>
            <span className="text-slate-500 font-medium text-xs block mt-1">puntos totales</span>
          </div>
        </motion.div>
      )}

      {/* Interactive Worksheet Pages */}
      <div className="space-y-12">
        {worksheet.backgrounds.map((bg, index) => {
          const pageNum = index + 1;
          const pageFields = worksheet.fields.filter(f => f.page === pageNum);

          return (
            <div 
              key={index} 
              className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden max-w-[900px] mx-auto"
              id={`worksheet-page-card-${pageNum}`}
            >
              <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-500">Página {pageNum}</span>
                <span className="text-xs font-mono text-slate-400">Interactiva</span>
              </div>
              
              <div className="relative w-full" style={{ userSelect: 'none' }}>
                <img 
                  src={bg} 
                  alt={`Hoja ${pageNum}`} 
                  className="w-full h-auto block" 
                  referrerPolicy="no-referrer"
                />
                
                {/* Overlays */}
                <div className="absolute inset-0 w-full h-full">
                  {pageFields.map(field => {
                    const isCorrect = gradingResult?.correctFields[field.id];
                    const studentVal = answers[field.id] || '';
                    
                    return (
                      <div
                        key={field.id}
                        className="absolute"
                        style={{
                          left: `${field.x}%`,
                          top: `${field.y}%`,
                          width: `${field.width}%`,
                          height: `${field.height}%`,
                        }}
                      >
                        {/* Text Field Input */}
                        {field.type === 'text' && (
                          <div className="relative w-full h-full">
                            <input
                              type="text"
                              disabled={submitted}
                              value={studentVal}
                              onChange={e => handleFieldChange(field.id, e.target.value)}
                              placeholder={field.placeholder || 'Escribe aquí...'}
                              className={`w-full h-full border-2 rounded-lg text-sm px-2 font-medium bg-white/90 shadow-sm focus:ring-2 focus:outline-none transition-all duration-150 ${
                                submitted 
                                  ? isCorrect 
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800' 
                                    : 'border-red-500 bg-red-50 text-red-800'
                                  : 'border-indigo-500/60 focus:border-indigo-600 focus:ring-indigo-200'
                              }`}
                            />
                            {submitted && !isCorrect && (
                              <div className="absolute bottom-full left-0 mb-1 bg-slate-800 text-white text-xs py-1 px-2 rounded shadow-md whitespace-nowrap z-50">
                                R: {field.correctAnswer}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Dropdown Select Field */}
                        {field.type === 'select' && (
                          <div className="relative w-full h-full">
                            <select
                              disabled={submitted}
                              value={studentVal}
                              onChange={e => handleFieldChange(field.id, e.target.value)}
                              className={`w-full h-full border-2 rounded-lg text-sm px-1.5 font-medium bg-white/90 shadow-sm focus:ring-2 focus:outline-none transition-all duration-150 cursor-pointer ${
                                submitted 
                                  ? isCorrect 
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800' 
                                    : 'border-red-500 bg-red-50 text-red-800'
                                  : 'border-indigo-500/60 focus:border-indigo-600 focus:ring-indigo-200'
                              }`}
                            >
                              <option value="">Elegir...</option>
                              {field.options.map((opt, oIdx) => (
                                <option key={oIdx} value={opt}>{opt}</option>
                              ))}
                            </select>
                            {submitted && !isCorrect && (
                              <div className="absolute bottom-full left-0 mb-1 bg-slate-800 text-white text-xs py-1 px-2 rounded shadow-md whitespace-nowrap z-50">
                                R: {field.correctAnswer}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Multiple Choice Radio Fields */}
                        {field.type === 'choice' && (
                          <div className="w-full h-full bg-white/95 rounded-lg border-2 border-indigo-400/40 p-1 flex flex-col justify-center gap-1.5 shadow-sm overflow-hidden">
                            {field.options.map((opt, oIdx) => {
                              const isChecked = studentVal === opt;
                              const isThisOptCorrect = field.correctAnswer === opt;
                              
                              let optionClass = 'border-slate-100 hover:bg-slate-50';
                              if (submitted) {
                                if (isChecked && isThisOptCorrect) {
                                  optionClass = 'border-emerald-500 bg-emerald-50 text-emerald-800';
                                } else if (isChecked && !isThisOptCorrect) {
                                  optionClass = 'border-red-400 bg-red-50 text-red-800';
                                } else if (isThisOptCorrect) {
                                  optionClass = 'border-emerald-300 bg-emerald-50/50 text-emerald-800 border-dashed';
                                }
                              } else if (isChecked) {
                                optionClass = 'border-indigo-500 bg-indigo-50 text-indigo-900';
                              }

                              return (
                                <label 
                                  key={oIdx} 
                                  className={`flex items-center gap-1.5 px-2 py-0.5 border rounded-md cursor-pointer transition-all duration-150 text-xs font-semibold select-none ${optionClass}`}
                                >
                                  <input
                                    type="radio"
                                    disabled={submitted}
                                    name={`choice-${field.id}`}
                                    value={opt}
                                    checked={isChecked}
                                    onChange={() => handleFieldChange(field.id, opt)}
                                    className="cursor-pointer text-indigo-600 focus:ring-indigo-400"
                                  />
                                  <span className="truncate">{opt}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {/* Audio Player Field */}
                        {field.type === 'audio' && (
                          <div className="w-full h-full bg-white/95 rounded-lg border-2 border-amber-400/50 p-1 flex items-center justify-center shadow-sm overflow-hidden">
                            <audio 
                              src={field.mediaUrl} 
                              controls 
                              className="w-full h-full object-contain" 
                            />
                          </div>
                        )}

                        {/* Video Player Field */}
                        {field.type === 'video' && (
                          <div className="w-full h-full bg-black rounded-lg border-2 border-sky-400/50 overflow-hidden shadow-sm flex items-center justify-center">
                            {field.mediaUrl?.includes('youtube.com') || field.mediaUrl?.includes('youtu.be') || field.mediaUrl?.includes('vimeo') ? (
                              <iframe 
                                src={getEmbedUrl(field.mediaUrl)} 
                                title="Video student"
                                className="w-full h-full border-0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowFullScreen
                              />
                            ) : (
                              <video 
                                src={field.mediaUrl} 
                                controls 
                                className="w-full h-full object-contain" 
                              />
                            )}
                          </div>
                        )}

                        {/* Student Audio Record Field */}
                        {field.type === 'record-audio' && (
                          <div className="w-full h-full bg-white/95 rounded-lg border-2 border-emerald-400/50 p-1 flex items-center justify-between gap-1 shadow-sm overflow-hidden text-xs">
                            {recordingStates[field.id] === 'recording' ? (
                              <button
                                disabled={submitted}
                                onClick={() => stopAudioRecording(field.id)}
                                className="flex-1 h-full flex items-center justify-center gap-1 bg-red-600 text-white rounded font-bold cursor-pointer hover:bg-red-700 animate-pulse"
                              >
                                <Square className="w-3.5 h-3.5" />
                                <span>Detener</span>
                              </button>
                            ) : studentVal ? (
                              <div className="w-full h-full flex items-center justify-between gap-1">
                                <audio src={studentVal} controls className="flex-1 h-full min-w-0" />
                                {!submitted && (
                                  <button
                                    onClick={() => {
                                      setAnswers(prev => ({ ...prev, [field.id]: '' }));
                                      setRecordingStates(prev => ({ ...prev, [field.id]: 'idle' }));
                                    }}
                                    className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded cursor-pointer"
                                    title="Volver a grabar"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                disabled={submitted}
                                onClick={() => startAudioRecording(field.id)}
                                className="w-full h-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold cursor-pointer disabled:opacity-50"
                              >
                                <Mic className="w-4 h-4" />
                                <span className="truncate">Grabar Audio</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Student Video Record Field */}
                        {field.type === 'record-video' && (
                          <div className="w-full h-full bg-slate-950 rounded-lg border-2 border-rose-400/50 overflow-hidden shadow-sm flex flex-col items-stretch justify-between relative text-xs">
                            {recordingStates[field.id] === 'recording' ? (
                              <div className="w-full h-full flex flex-col justify-between relative">
                                <video 
                                  id={`live-vid-${field.id}`}
                                  muted
                                  className="absolute inset-0 w-full h-full object-cover bg-black"
                                />
                                <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-600 text-white font-bold px-1.5 py-0.5 rounded text-[10px] uppercase animate-pulse">
                                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                  Grabando
                                </div>
                                <button
                                  disabled={submitted}
                                  onClick={() => stopVideoRecording(field.id)}
                                  className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-full font-bold cursor-pointer"
                                >
                                  <Square className="w-3 h-3" />
                                  <span>Detener</span>
                                </button>
                              </div>
                            ) : studentVal ? (
                              <div className="w-full h-full relative group">
                                <video src={studentVal} controls className="w-full h-full object-cover bg-black" />
                                {!submitted && (
                                  <button
                                    onClick={() => {
                                      setAnswers(prev => ({ ...prev, [field.id]: '' }));
                                      setRecordingStates(prev => ({ ...prev, [field.id]: 'idle' }));
                                    }}
                                    className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full shadow cursor-pointer transition opacity-0 group-hover:opacity-100"
                                    title="Volver a grabar"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 text-center">
                                <Camera className="w-6 h-6 text-rose-400" />
                                <button
                                  disabled={submitted}
                                  onClick={() => {
                                    setRecordingStates(prev => ({ ...prev, [field.id]: 'recording' }));
                                    setTimeout(() => {
                                      const videoEl = document.getElementById(`live-vid-${field.id}`) as HTMLVideoElement;
                                      startVideoRecording(field.id, videoEl);
                                    }, 100);
                                  }}
                                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full font-bold cursor-pointer text-[11px] flex items-center gap-1"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                  Grabar Video
                                </button>
                              </div>
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
        })}
      </div>

      {/* Floating Submit footer if not submitted */}
      {!submitted && (
        <div className="sticky bottom-6 left-0 right-0 max-w-[900px] mx-auto bg-white border border-slate-200 rounded-2xl shadow-xl px-6 py-4 flex items-center justify-between z-40 mt-8 animate-bounce-subtle">
          <span className="text-sm font-semibold text-slate-500">
            ¿Terminaste de llenar la ficha?
          </span>
          <button
            onClick={handleSubmit}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer text-sm"
          >
            <Check className="w-4 h-4" />
            Entregar Ficha Calificada
          </button>
        </div>
      )}
    </div>
  );
}

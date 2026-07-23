import { Worksheet } from '../types';

export function exportWorksheetToHTML5(worksheet: Worksheet): string {
  // Serialize worksheet details
  const escapedTitle = worksheet.title.replace(/"/g, '&quot;');
  
  // Create a structured list of pages, each with its background and fields
  const pagesHtml = worksheet.backgrounds.map((bg, idx) => {
    const pageNum = idx + 1;
    const pageFields = worksheet.fields.filter(f => f.page === pageNum);
    
    const fieldsHtml = pageFields.map(field => {
      let inputElement = '';
      
      if (field.type === 'text') {
        inputElement = `
          <input 
            type="text" 
            id="field-${field.id}" 
            data-field-id="${field.id}"
            data-correct="${field.correctAnswer.replace(/"/g, '&quot;')}"
            data-points="${field.points}"
            class="worksheet-input text-field" 
            placeholder="${field.placeholder || ''}"
            style="width: 100%; height: 100%; border: 1.5px dashed #4f46e5; border-radius: 4px; padding: 2px 6px; font-size: 14px; outline: none; background: rgba(255, 255, 255, 0.85); box-sizing: border-box;"
          />
        `;
      } else if (field.type === 'select') {
        const optionsHtml = [
          `<option value="">-- Selecciona --</option>`,
          ...field.options.map(opt => `<option value="${opt.replace(/"/g, '&quot;')}">${opt}</option>`)
        ].join('');
        
        inputElement = `
          <select 
            id="field-${field.id}" 
            data-field-id="${field.id}"
            data-correct="${field.correctAnswer.replace(/"/g, '&quot;')}"
            data-points="${field.points}"
            class="worksheet-input select-field"
            style="width: 100%; height: 100%; border: 1.5px dashed #4f46e5; border-radius: 4px; font-size: 14px; outline: none; background: rgba(255, 255, 255, 0.85); box-sizing: border-box; cursor: pointer;"
          >
            ${optionsHtml}
          </select>
        `;
      } else if (field.type === 'choice') {
        const optionsHtml = field.options.map((opt, oIdx) => {
          return `
            <label style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; font-size: 13px; font-weight: bold; background: rgba(255,255,255,0.95); padding: 4px 10px; border: 1.5px solid #cbd5e1; border-radius: 6px; box-shadow: 0 1.5px 3px rgba(0,0,0,0.06); box-sizing: border-box; flex: 1; min-width: 70px; height: 100%; transition: all 0.15s; overflow: hidden; text-overflow: ellipsis;">
              <input 
                type="radio" 
                name="radio-${field.id}" 
                value="${opt.replace(/"/g, '&quot;')}"
                data-field-id="${field.id}"
                data-correct="${field.correctAnswer.replace(/"/g, '&quot;')}"
                data-points="${field.points}"
                class="worksheet-input choice-option"
                style="margin: 0; cursor: pointer; accent-color: #4f46e5; width: 14px; height: 14px;"
              />
              <span style="white-space: nowrap; text-overflow: ellipsis; overflow: hidden; color: #1e293b;">${opt}</span>
            </label>
          `;
        }).join('');
        
        inputElement = `
          <div style="display: flex; flex-direction: row; flex-wrap: wrap; justify-content: stretch; align-items: stretch; width: 100%; height: 100%; box-sizing: border-box; gap: 6px; padding: 2px;">
            ${optionsHtml}
          </div>
        `;
      } else if (field.type === 'audio') {
        inputElement = `
          <div style="width: 100%; height: 100%; background: rgba(255, 255, 255, 0.95); border: 2px solid #f59e0b; border-radius: 6px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 2px;">
            <audio src="${field.mediaUrl}" controls style="width: 100%; height: 100%; object-fit: contain;"></audio>
          </div>
        `;
      } else if (field.type === 'video') {
        let embedUrl = field.mediaUrl || '';
        let isEmbed = embedUrl.includes('youtube.com') || embedUrl.includes('youtu.be') || embedUrl.includes('vimeo.com');
        if (isEmbed) {
          let regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
          let match = embedUrl.match(regExp);
          if (match && match[2].length === 11) {
            embedUrl = `https://www.youtube.com/embed/${match[2]}`;
          } else {
            let vReg = /vimeo\.com\/(\d+)/;
            let vMatch = embedUrl.match(vReg);
            if (vMatch) {
              embedUrl = `https://player.vimeo.com/video/${vMatch[1]}`;
            }
          }
        }
        
        if (isEmbed) {
          inputElement = `
            <div style="width: 100%; height: 100%; background: black; border: 2px solid #38bdf8; border-radius: 6px; box-sizing: border-box; overflow: hidden;">
              <iframe src="${embedUrl}" style="width: 100%; height: 100%; border: none;" allowfullscreen></iframe>
            </div>
          `;
        } else {
          inputElement = `
            <div style="width: 100%; height: 100%; background: black; border: 2px solid #38bdf8; border-radius: 6px; box-sizing: border-box; overflow: hidden; display: flex; align-items: center; justify-content: center;">
              <video src="${embedUrl}" controls style="width: 100%; height: 100%; object-fit: contain;"></video>
            </div>
          `;
        }
      } else if (field.type === 'record-audio') {
        inputElement = `
          <div id="recorder-container-${field.id}" style="width: 100%; height: 100%; background: rgba(255, 255, 255, 0.95); border: 2px solid #10b981; border-radius: 6px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; padding: 4px; gap: 4px; overflow: hidden;">
            <button id="record-btn-${field.id}" onclick="toggleAudioRecord('${field.id}')" style="flex: 1; height: 100%; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 4px; outline: none; font-family: sans-serif;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
              <span id="record-text-${field.id}">Grabar</span>
            </button>
            <audio id="audio-preview-${field.id}" style="display: none; flex: 1; height: 100%; min-width: 0;" controls></audio>
            <input type="hidden" id="field-${field.id}" data-field-id="${field.id}" data-type="record-audio" data-points="${field.points}" class="worksheet-input record-field" />
            <button id="reset-btn-${field.id}" onclick="resetAudioRecord('${field.id}')" style="display: none; background: #e2e8f0; color: #475569; border: none; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; align-items: center; justify-content: center;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            </button>
          </div>
        `;
      } else if (field.type === 'record-video') {
        inputElement = `
          <div id="recorder-container-${field.id}" style="width: 100%; height: 100%; background: #020617; border: 2px solid #f43f5e; border-radius: 6px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; overflow: hidden; padding: 4px;">
            <video id="video-live-${field.id}" style="width: 100%; height: 100%; object-fit: cover; background: black; border-radius: 4px; display: none;" autoplay playsinline muted></video>
            <video id="video-preview-${field.id}" style="width: 100%; height: 100%; object-fit: cover; background: black; border-radius: 4px; display: none;" controls playsinline></video>
            <button id="record-btn-${field.id}" onclick="toggleVideoRecord('${field.id}')" style="background: #f43f5e; color: white; border: none; padding: 6px 12px; border-radius: 20px; cursor: pointer; font-size: 11px; font-weight: bold; display: flex; align-items: center; gap: 4px; z-index: 5; outline: none; font-family: sans-serif;">
              <svg id="record-icon-${field.id}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              <span id="record-text-${field.id}">Grabar Video</span>
            </button>
            <input type="hidden" id="field-${field.id}" data-field-id="${field.id}" data-type="record-video" data-points="${field.points}" class="worksheet-input record-field" />
            <button id="reset-btn-${field.id}" onclick="resetVideoRecord('${field.id}')" style="display: none; position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; align-items: center; justify-content: center; z-index: 6;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            </button>
          </div>
        `;
      }
      
      return `
        <div 
          class="field-container" 
          id="container-${field.id}"
          style="
            position: absolute; 
            left: ${field.x}%; 
            top: ${field.y}%; 
            width: ${field.width}%; 
            height: ${field.height}%; 
            z-index: 10;
          "
        >
          ${inputElement}
        </div>
      `;
    }).join('\n');

    return `
      <div class="page-container" id="page-${pageNum}" style="position: relative; width: 100%; max-width: 900px; margin: 0 auto 30px auto; box-shadow: 0 4px 20px rgba(0,0,0,0.15); border-radius: 8px; overflow: hidden; background: #fff;">
        <div class="page-header" style="background: #f8fafc; padding: 8px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600; color: #475569; font-size: 14px;">Página ${pageNum}</span>
          <span style="font-size: 12px; color: #94a3b8; font-family: monospace;">Ficha Interactiva HTML5</span>
        </div>
        <div style="position: relative; width: 100%; display: inline-block;">
          <img 
            src="${bg}" 
            alt="Página ${pageNum}" 
            style="width: 100%; display: block; height: auto;" 
            referrerpolicy="no-referrer"
          />
          <div class="fields-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
            ${fieldsHtml}
          </div>
        </div>
      </div>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f1f5f9;
      color: #1e293b;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    
    header {
      background-color: #4f46e5;
      color: white;
      width: 100%;
      padding: 20px 0;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    
    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
    }
    
    .subtitle {
      margin: 5px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
    }
    
    main {
      width: 100%;
      padding: 30px 15px;
      box-sizing: border-box;
      max-width: 1000px;
    }
    
    .actions-panel {
      background: white;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    
    .btn {
      background-color: #4f46e5;
      color: white;
      border: none;
      padding: 10px 20px;
      font-size: 15px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .btn:hover {
      background-color: #4338ca;
    }
    
    .btn-reset {
      background-color: #64748b;
    }
    
    .btn-reset:hover {
      background-color: #475569;
    }
    
    .score-card {
      background-color: #ecfdf5;
      border: 1px solid #10b981;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      display: none;
      margin-bottom: 24px;
      animation: fadeIn 0.3s ease-out;
    }
    
    .score-title {
      font-size: 18px;
      font-weight: bold;
      color: #065f46;
      margin: 0 0 8px 0;
    }
    
    .score-value {
      font-size: 32px;
      font-weight: 800;
      color: #10b981;
      margin: 0;
    }

    /* Grading feedback styles */
    .correct-field {
      border-color: #10b981 !important;
      background-color: #ecfdf5 !important;
      color: #065f46 !important;
    }
    
    .incorrect-field {
      border-color: #ef4444 !important;
      background-color: #fef2f2 !important;
      color: #991b1b !important;
    }

    .correct-option-label {
      border: 1.5px solid #10b981 !important;
      background-color: #ecfdf5 !important;
    }

    .incorrect-option-label {
      border: 1.5px solid #ef4444 !important;
      background-color: #fef2f2 !important;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>

  <header>
    <h1>${escapedTitle}</h1>
    <p class="subtitle">Completa la ficha interactiva y califica tus respuestas</p>
  </header>

  <main>
    <div class="score-card" id="scoreCard">
      <p class="score-title">¡Ficha Calificada!</p>
      <p class="score-value" id="scoreValue">0 / 0</p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #047857;">Las respuestas correctas se muestran en verde, las incorrectas en rojo.</p>
    </div>

    <div class="actions-panel">
      <span style="font-size: 14px; color: #64748b; font-weight: 500;">Llena todos los campos antes de calificar</span>
      <div style="display: flex; gap: 10px;">
        <button class="btn btn-reset" onclick="resetAnswers()">Reiniciar Ficha</button>
        <button class="btn" onclick="gradeWorksheet()">Corregir y Calificar</button>
      </div>
    </div>

    <div class="worksheet-pages">
      ${pagesHtml}
    </div>
  </main>

  <script>
    const activeRecorders = {};
    const mediaStreams = {};

    async function toggleAudioRecord(id) {
      const btn = document.getElementById('record-btn-' + id);
      const text = document.getElementById('record-text-' + id);
      const audioPrev = document.getElementById('audio-preview-' + id);
      const hiddenInput = document.getElementById('field-' + id);
      const resetBtn = document.getElementById('reset-btn-' + id);

      if (activeRecorders[id] && activeRecorders[id].state === 'recording') {
        activeRecorders[id].stop();
        if (mediaStreams[id]) {
          mediaStreams[id].getTracks().forEach(track => track.stop());
        }
        btn.style.background = '#10b981';
        text.innerText = 'Grabar';
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreams[id] = stream;
        const mediaRecorder = new MediaRecorder(stream);
        activeRecorders[id] = mediaRecorder;
        
        const chunks = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result;
            hiddenInput.value = base64data;
          };
          reader.readAsDataURL(blob);

          const audioURL = URL.createObjectURL(blob);
          audioPrev.src = audioURL;
          audioPrev.style.display = 'block';
          btn.style.display = 'none';
          resetBtn.style.display = 'flex';
        };

        mediaRecorder.start();
        btn.style.background = '#ef4444';
        text.innerText = 'Detener';
      } catch (err) {
        alert('No se pudo acceder al micrófono para grabar.');
      }
    }

    function resetAudioRecord(id) {
      const btn = document.getElementById('record-btn-' + id);
      const audioPrev = document.getElementById('audio-preview-' + id);
      const hiddenInput = document.getElementById('field-' + id);
      const resetBtn = document.getElementById('reset-btn-' + id);

      audioPrev.pause();
      audioPrev.src = '';
      audioPrev.style.display = 'none';
      hiddenInput.value = '';
      btn.style.display = 'flex';
      resetBtn.style.display = 'none';
    }

    async function toggleVideoRecord(id) {
      const btn = document.getElementById('record-btn-' + id);
      const text = document.getElementById('record-text-' + id);
      const liveVideo = document.getElementById('video-live-' + id);
      const previewVideo = document.getElementById('video-preview-' + id);
      const hiddenInput = document.getElementById('field-' + id);
      const resetBtn = document.getElementById('reset-btn-' + id);

      if (activeRecorders[id] && activeRecorders[id].state === 'recording') {
        activeRecorders[id].stop();
        if (mediaStreams[id]) {
          mediaStreams[id].getTracks().forEach(track => track.stop());
        }
        liveVideo.style.display = 'none';
        btn.style.display = 'none';
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        mediaStreams[id] = stream;
        liveVideo.srcObject = stream;
        liveVideo.style.display = 'block';
        previewVideo.style.display = 'none';

        const mediaRecorder = new MediaRecorder(stream);
        activeRecorders[id] = mediaRecorder;
        
        const chunks = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result;
            hiddenInput.value = base64data;
          };
          reader.readAsDataURL(blob);

          const videoURL = URL.createObjectURL(blob);
          previewVideo.src = videoURL;
          previewVideo.style.display = 'block';
          resetBtn.style.display = 'flex';
        };

        mediaRecorder.start();
        btn.style.background = '#ef4444';
        text.innerText = 'Detener';
      } catch (err) {
        alert('No se pudo acceder a la cámara o micrófono.');
      }
    }

    function resetVideoRecord(id) {
      const btn = document.getElementById('record-btn-' + id);
      const text = document.getElementById('record-text-' + id);
      const previewVideo = document.getElementById('video-preview-' + id);
      const hiddenInput = document.getElementById('field-' + id);
      const resetBtn = document.getElementById('reset-btn-' + id);

      previewVideo.pause();
      previewVideo.src = '';
      previewVideo.style.display = 'none';
      hiddenInput.value = '';
      btn.style.background = '#f43f5e';
      text.innerText = 'Grabar Video';
      btn.style.display = 'flex';
      resetBtn.style.display = 'none';
    }

    function gradeWorksheet() {
      // Hide previous results formatting first
      resetStyles();
      
      let totalPoints = 0;
      let earnedPoints = 0;
      
      // 1. Grade Text Fields and Select Fields
      const inputs = document.querySelectorAll('input.text-field, select.select-field');
      inputs.forEach(input => {
        const correctVal = input.getAttribute('data-correct').trim().toLowerCase();
        const points = parseFloat(input.getAttribute('data-points') || '1');
        const studentVal = input.value.trim().toLowerCase();
        
        totalPoints += points;
        
        if (studentVal === correctVal && correctVal !== '') {
          earnedPoints += points;
          input.classList.add('correct-field');
        } else {
          input.classList.add('incorrect-field');
          
          // Append a small correct answer tooltip if incorrect
          const tooltip = document.createElement('span');
          tooltip.className = 'correct-answer-tooltip';
          tooltip.innerText = 'R: ' + input.getAttribute('data-correct');
          tooltip.style.cssText = 'position: absolute; background: #1e293b; color: white; font-size: 10px; padding: 2px 4px; border-radius: 4px; bottom: 100%; left: 0; white-space: nowrap; z-index: 100; pointer-events: none;';
          input.parentNode.appendChild(tooltip);
        }
      });
      
      // 2. Grade Radio Choice Fields
      const choiceFields = {};
      const choiceInputs = document.querySelectorAll('input.choice-option');
      
      choiceInputs.forEach(input => {
        const fieldId = input.getAttribute('data-field-id');
        if (!choiceFields[fieldId]) {
          choiceFields[fieldId] = {
            inputs: [],
            correct: input.getAttribute('data-correct'),
            points: parseFloat(input.getAttribute('data-points') || '1')
          };
        }
        choiceFields[fieldId].inputs.push(input);
      });
      
      Object.keys(choiceFields).forEach(fieldId => {
        const data = choiceFields[fieldId];
        totalPoints += data.points;
        
        let selectedInput = null;
        data.inputs.forEach(input => {
          if (input.checked) {
            selectedInput = input;
          }
        });
        
        if (selectedInput && selectedInput.value === data.correct) {
          earnedPoints += data.points;
          if (selectedInput.parentNode) {
            selectedInput.parentNode.style.borderColor = '#10b981';
            selectedInput.parentNode.style.backgroundColor = '#ecfdf5';
          }
        } else {
          if (selectedInput && selectedInput.parentNode) {
            selectedInput.parentNode.style.borderColor = '#ef4444';
            selectedInput.parentNode.style.backgroundColor = '#fef2f2';
          }
          
          data.inputs.forEach(input => {
            if (input.value === data.correct && input.parentNode) {
              input.parentNode.style.border = '1.5px dashed #10b981';
              input.parentNode.style.backgroundColor = '#f0fdf4';
            }
          });
        }
      });

      // 3. Grade Student Recording Fields
      const recordFields = document.querySelectorAll('input.record-field');
      recordFields.forEach(field => {
        const points = parseFloat(field.getAttribute('data-points') || '1');
        const recorded = field.value.startsWith('data:') || field.value.length > 0;
        
        totalPoints += points;
        const container = document.getElementById('recorder-container-' + field.getAttribute('data-field-id'));
        if (recorded) {
          earnedPoints += points;
          if (container) {
            container.style.borderColor = '#10b981';
            container.style.boxShadow = '0 0 8px rgba(16, 185, 129, 0.2)';
          }
        } else {
          if (container) {
            container.style.borderColor = '#ef4444';
            container.style.boxShadow = '0 0 8px rgba(239, 68, 68, 0.2)';
          }
        }
      });
      
      // 4. Display Score
      const scoreCard = document.getElementById('scoreCard');
      const scoreValue = document.getElementById('scoreValue');
      scoreValue.innerText = earnedPoints + ' / ' + totalPoints + ' pts';
      scoreCard.style.display = 'block';
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    function resetStyles() {
      document.querySelectorAll('.worksheet-input').forEach(input => {
        input.classList.remove('correct-field', 'incorrect-field');
        if (input.parentNode && input.parentNode.tagName === 'LABEL') {
          input.parentNode.style.border = '1.5px solid #cbd5e1';
          input.parentNode.style.backgroundColor = 'rgba(255,255,255,0.95)';
          input.parentNode.style.borderColor = '#cbd5e1';
          input.parentNode.style.boxShadow = '0 1.5px 3px rgba(0,0,0,0.06)';
        }
      });
      
      // Reset recorders containers
      document.querySelectorAll('input.record-field').forEach(input => {
        const container = document.getElementById('recorder-container-' + input.getAttribute('data-field-id'));
        if (container) {
          if (input.getAttribute('data-type') === 'record-video') {
            container.style.borderColor = '#f43f5e';
          } else {
            container.style.borderColor = '#10b981';
          }
          container.style.boxShadow = 'none';
        }
      });
      
      document.querySelectorAll('.correct-answer-tooltip').forEach(tooltip => {
        tooltip.remove();
      });
    }
    
    function resetAnswers() {
      resetStyles();
      
      document.querySelectorAll('input.text-field').forEach(input => {
        input.value = '';
      });
      
      document.querySelectorAll('select.select-field').forEach(select => {
        select.value = '';
      });
      
      document.querySelectorAll('input.choice-option').forEach(radio => {
        radio.checked = false;
      });

      // Clear recording fields
      document.querySelectorAll('input.record-field').forEach(input => {
        const id = input.getAttribute('data-field-id');
        const type = input.getAttribute('data-type');
        if (type === 'record-video') {
          resetVideoRecord(id);
        } else {
          resetAudioRecord(id);
        }
      });
      
      document.getElementById('scoreCard').style.display = 'none';
    }

    // Dynamic choice selection color feedback for student answering
    document.addEventListener('DOMContentLoaded', function() {
      initChoiceListeners();
    });
    // Run immediately as well in case DOMContentLoaded already fired
    initChoiceListeners();

    function initChoiceListeners() {
      document.querySelectorAll('input.choice-option').forEach(radio => {
        // Set up click/change listeners
        radio.addEventListener('change', function() {
          const fieldId = this.getAttribute('data-field-id');
          // Reset styling for all sibling options in this field
          document.querySelectorAll('input.choice-option[data-field-id="' + fieldId + '"]').forEach(r => {
            if (r.parentNode) {
              r.parentNode.style.border = '1.5px solid #cbd5e1';
              r.parentNode.style.backgroundColor = 'rgba(255,255,255,0.95)';
              r.parentNode.style.borderColor = '#cbd5e1';
              r.parentNode.style.boxShadow = '0 1.5px 3px rgba(0,0,0,0.06)';
            }
          });
          // Apply active styling to selected option
          if (this.checked && this.parentNode) {
            this.parentNode.style.border = '1.5px solid #4f46e5';
            this.parentNode.style.backgroundColor = '#e0e7ff';
            this.parentNode.style.borderColor = '#4f46e5';
            this.parentNode.style.boxShadow = '0 0 0 2px rgba(79, 70, 229, 0.15)';
          }
        });
      });
    }
  </script>
</body>
</html>
`;
}

// ── TIPO / FORMULARIO ─────────────────────────────────────────
const TIPOS_BASE = [
  {value:'revision',    label:'Revisión'},
  {value:'plazo',       label:'Plazo'},
  {value:'aniversario', label:'Aniversario'},
  {value:'clases',      label:'Clases'},
  {value:'otro',        label:'Otro'}
];
const TIPOS_CUSTOM_KEY  = 'gantt_maah_tipos_custom';
const TIPOS_OCULTOS_KEY = 'gantt_maah_tipos_ocultos';
let tiposCustom  = [];        // [{value, label}] tipos añadidos
let tiposOcultos = new Set(); // valores de tipos base eliminados
let tipoAddTarget = 'add';

function loadTiposCustom(){
  // Solo inicializa en vacío — los tipos reales se cargan desde Firebase al loguearse
  tiposCustom  = [];
  tiposOcultos = new Set();
}
function loadTiposDesdeFirebase(){
  // Cargar tipos del usuario actual desde Firebase (100% independiente por usuario)
  if(!db || !currentUser) return;
  // Limpiar primero para no mezclar datos de otro usuario
  tiposCustom  = [];
  tiposOcultos = new Set();
  db.ref('gantt_maah/tipos_usuario/'+currentUser.id).once('value', snap=>{
    const data = snap.val();
    if(data){
      if(Array.isArray(data.custom))  tiposCustom  = data.custom;
      if(Array.isArray(data.ocultos)) tiposOcultos = new Set(data.ocultos);
    }
    refreshAllTipoSelects();
  });
}
function saveTiposCustom(){
  // Guardar bajo el usuario VISTO (si admin está viendo otra Gantt) o el propio
  const targetId = (typeof viewingUserId !== 'undefined' && viewingUserId) ? viewingUserId : (currentUser ? currentUser.id : null);
  if(db && targetId){
    db.ref('gantt_maah/tipos_usuario/'+targetId).set({
      custom:  tiposCustom,
      ocultos: [...tiposOcultos]
    });
  }
}
function getAllTipos(){
  return [...TIPOS_BASE.filter(t=>!tiposOcultos.has(t.value)), ...tiposCustom];
}
function tipoLabel(value){
  const all = [...TIPOS_BASE, ...tiposCustom];
  const t = all.find(x=>x.value===value);
  return t ? t.label : (value||'').toString();
}
function fillTipoSelect(selectEl, currentValue){
  if(!selectEl) return;
  const all = getAllTipos();
  let html = '';
  all.forEach(t=>{
    html += '<option value="'+t.value+'"'+(t.value===currentValue?' selected':'')+'>'+t.label+'</option>';
  });
  html += '<option value="__add__">+ Agregar nueva opción...</option>';
  html += '<option value="__delete__">− Eliminar categoría...</option>';
  selectEl.innerHTML = html;
  if(currentValue && !all.find(t=>t.value===currentValue)){
    selectEl.value = all.length ? all[0].value : '';
  }
}
function refreshAllTipoSelects(){
  const fSel = document.getElementById('f-tipo');
  const eSel = document.getElementById('edit-tipo');
  if(fSel) fillTipoSelect(fSel, fSel.value || cType);
  if(eSel) fillTipoSelect(eSel, eSel.value || editType);
}

function onTipoSelectChange(sel, where){
  const v = sel.value;
  if(v === '__add__'){
    if(where==='add')  sel.value = cType || 'revision';
    else               sel.value = editType || 'revision';
    openTipoAddModal(where);
    return;
  }
  if(v === '__delete__'){
    if(where==='add')  sel.value = cType || 'revision';
    else               sel.value = editType || 'revision';
    openTipoDeleteModal();
    return;
  }
  if(where==='add')  cType = v;
  else               editType = v;
}
function onFreqSelectChange(sel, where){
  const v = sel.value;
  if(where==='add'){
    cFreq = v;
    toggleFechaInicioBlock('add', v);
  } else {
    editFreq = v;
    toggleFechaInicioBlock('edit', v);
  }
}
function toggleFechaInicioBlock(where, freq){
  if(where === 'add'){ updateFormForFreq(freq); return; }
  // Formulario de edición: solo mostrar 2 fechas para Desde/Hasta
  const el = document.getElementById('edit-inicio-block');
  if(!el) return;
  if(freq === 'rango'){
    el.style.display = 'block';
    el.classList.add('visible');
    const hint = el.querySelector('.hint');
    if(hint) hint.textContent = 'Fecha de inicio de la actividad.';
  } else {
    // Puntual, Semanal, Mensual, Anual: solo 1 fecha
    el.style.display = 'none';
    el.classList.remove('visible');
  }
}

function updateFormForFreq(freq){
  const inicioBlock = document.getElementById('f-inicio-block');
  const inicioLabel = document.getElementById('f-inicio-label');
  const inicioHint  = document.getElementById('f-inicio-hint');
  const fechaLabel  = document.getElementById('f-fecha-label');
  const dowBlock    = document.getElementById('f-dow-block');
  const diaBlock    = document.getElementById('f-dia-block');

  if(dowBlock) dowBlock.style.display = 'none';
  if(diaBlock) diaBlock.style.display = 'none';

  if(freq === 'puntual'){
    if(inicioBlock) inicioBlock.style.display = 'none';
    if(fechaLabel)  fechaLabel.textContent = 'Fecha';
  } else if(freq === 'rango'){
    if(inicioBlock){ inicioBlock.style.display='block'; inicioBlock.classList.add('visible'); }
    if(inicioLabel) inicioLabel.textContent = 'Desde (inicio de barra)';
    if(inicioHint)  inicioHint.textContent  = 'La barra se pintará desde esta fecha hasta la de término.';
    if(fechaLabel)  fechaLabel.textContent  = 'Hasta (fin de barra)';
  } else if(freq === 'semanal'){
    if(inicioBlock) inicioBlock.style.display = 'none';
    if(fechaLabel)  fechaLabel.textContent = 'Fecha (elige el día de la semana)';
  } else if(freq === 'mensual'){
    if(inicioBlock) inicioBlock.style.display = 'none';
    if(fechaLabel)  fechaLabel.textContent = 'Fecha (elige el día del mes)';
  } else if(freq === 'anual'){
    if(inicioBlock) inicioBlock.style.display = 'none';
    if(fechaLabel)  fechaLabel.textContent = 'Fecha (día y mes que se repite)';
  }
  updateFreqPreview(freq);
}

function updateFreqPreview(freq){
  const preview = document.getElementById('freq-preview');
  if(!preview) return;
  const fv  = (document.getElementById('f-fecha')||{}).value||'';
  const fiv = (document.getElementById('f-inicio')||{}).value||'';
  const dowSel = document.getElementById('f-dow-sel');
  const diaSel = document.getElementById('f-dia-sel');
  const DN = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const MN = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  let txt = '';
  if(freq==='puntual'){
    if(fv){ const [y,m,d]=fv.split('-'); txt='📌 Actividad el '+d+'/'+m+'/'+y; }
  } else if(freq==='rango'){
    if(fiv && fv){
      const [yi,mi,di]=fiv.split('-'); const [yf,mf,df]=fv.split('-');
      const dias=Math.round((new Date(+yf,+mf-1,+df)-new Date(+yi,+mi-1,+di))/86400000)+1;
      txt='📊 Barra del '+di+'/'+mi+' al '+df+'/'+mf+' ('+dias+(dias===1?' día':' días')+')';
    } else { txt='📊 Selecciona inicio y fin para ver la barra'; }
  } else if(freq==='semanal'){
    const dow = dowSel ? DN[Number(dowSel.value)] : '?';
    if(fv){ const [yf,mf,df]=fv.split('-'); txt='🔁 Todos los '+dow+' hasta el '+df+'/'+mf+'/'+yf; }
    else { txt='🔁 Todos los '+dow; }
  } else if(freq==='mensual'){
    const dia = diaSel ? diaSel.value : '?';
    if(fv){ const [yf,mf]=fv.split('-'); txt='🔁 Día '+dia+' de cada mes hasta '+MN[+mf-1]+'/'+yf; }
    else { txt='🔁 El día '+dia+' de cada mes'; }
  } else if(freq==='anual'){
    if(fv){ const [,mf,df]=fv.split('-'); txt='🎂 Cada año el '+df+'/'+MN[+mf-1]; }
  }
  if(txt){ preview.textContent=txt; preview.style.display='block'; }
  else { preview.style.display='none'; }
}

// ── MODAL "AGREGAR NUEVA CATEGORÍA" ───────────────────────────
function openTipoAddModal(where){
  tipoAddTarget = where || 'add';
  const ov = document.getElementById('tipo-add-overlay');
  const inp = document.getElementById('tipo-add-input');
  const err = document.getElementById('tipo-add-err');
  if(inp) inp.value = '';
  if(err) err.classList.remove('visible');
  renderTipoCustomList();
  if(ov) ov.classList.add('open');
  setTimeout(()=>{ if(inp) inp.focus(); }, 50);
}

function renderTipoCustomList(){
  const container = document.getElementById('tipo-custom-list');
  if(!container) return;
  const baseActivos = TIPOS_BASE.filter(t => !tiposOcultos.has(t.value));
  const hayOcultos  = tiposOcultos.size > 0;
  const rowStyle = 'display:flex;align-items:center;padding:6px 10px;border-radius:6px;margin-bottom:5px;';
  const btnStyle = 'flex-shrink:0;background:none;border:1px solid #e53e3e;color:#e53e3e;border-radius:4px;width:24px;height:24px;font-size:13px;line-height:1;cursor:pointer;transition:all .15s;margin-left:8px;'
    +'display:flex;align-items:center;justify-content:center;';
  let html = '';

  if(baseActivos.length){
    html += '<div style="font-size:10px;color:#718096;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Tipos por defecto</div>';
    html += baseActivos.map(t=>
      '<div style="'+rowStyle+'background:#f8fafc;border:1px solid #e2e8f0;">'
        +'<span style="flex:1;font-size:12px;color:#2d3748;font-weight:500;">'+t.label+'</span>'
        +'<button onclick="deleteTipoBase(\''+t.value+'\')" style="'+btnStyle+'" title="Eliminar \''+t.label+'\'">✕</button>'
      +'</div>'
    ).join('');
  }

  if(tiposCustom.length){
    html += '<div style="font-size:10px;color:#718096;margin:10px 0 6px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Tipos personalizados</div>';
    html += tiposCustom.map(t=>
      '<div style="'+rowStyle+'background:#ebf4ff;border:1px solid #bee3f8;">'
        +'<span style="flex:1;font-size:12px;color:#2c5282;font-weight:500;">'+t.label+'</span>'
        +'<button onclick="deleteCustomTipo(\''+t.value+'\')" style="'+btnStyle+'border-color:#3182ce;color:#3182ce;" title="Eliminar \''+t.label+'\'">✕</button>'
      +'</div>'
    ).join('');
  }

  if(!baseActivos.length && !tiposCustom.length){
    html += '<div style="color:#a0aec0;font-size:12px;text-align:center;padding:10px 0;">No hay categorías activas.</div>';
  }

  if(hayOcultos){
    html += '<button onclick="restaurarTiposBase()" style="margin-top:12px;width:100%;padding:7px;background:#fff;color:#2d6a9f;border:1px solid #2d6a9f;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;">↺ Restaurar tipos por defecto</button>';
  }
  container.innerHTML = html;
}

function deleteTipoBase(value){
  tiposOcultos.add(value);
  saveTiposCustom();
  renderTipoCustomList();
  refreshAllTipoSelects();
}
function deleteCustomTipo(value){
  tiposCustom = tiposCustom.filter(t => t.value !== value);
  saveTiposCustom();
  renderTipoCustomList();
  refreshAllTipoSelects();
}
function restaurarTiposBase(){
  tiposOcultos.clear();
  saveTiposCustom();
  renderTipoCustomList();
  refreshAllTipoSelects();
}

function openTipoDeleteModal(){
  renderTipoCustomList();
  const ov = document.getElementById('tipo-add-overlay');
  if(ov) ov.classList.add('open');
}
function closeTipoDeleteModal(){
  closeTipoAddModal();
}
function closeTipoAddModal(){
  const ov = document.getElementById('tipo-add-overlay');
  if(ov) ov.classList.remove('open');
}
function confirmTipoAdd(){
  const inp = document.getElementById('tipo-add-input');
  const err = document.getElementById('tipo-add-err');
  const txt = (inp.value||'').trim();
  if(!txt){ inp.focus(); return; }
  const value = '_c_' + txt.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  const ya = getAllTipos().some(t=> t.value===value || t.label.toLowerCase()===txt.toLowerCase());
  if(ya){
    err.textContent = 'Esa categoría ya existe.';
    err.classList.add('visible');
    return;
  }
  tiposCustom.push({value, label: txt});
  saveTiposCustom();
  closeTipoAddModal();
  refreshAllTipoSelects();
  if(tipoAddTarget==='add'){
    const fs = document.getElementById('f-tipo');
    if(fs){ fs.value = value; cType = value; }
  } else {
    const es = document.getElementById('edit-tipo');
    if(es){ es.value = value; editType = value; }
  }
}

// Compatibilidad con llamadas antiguas

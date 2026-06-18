// ── MODAL CONFIRMACIÓN ────────────────────────────────────────
function showModal(msg,cb){
  document.getElementById('modal-msg').textContent=msg;
  modalCb=cb;
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal-ok').onclick=()=>{closeModal();if(modalCb)modalCb();};
}
function closeModal(){document.getElementById('modal-overlay').classList.remove('open');}

// ── EDICIÓN CON CONTRASEÑA (FIX 2 & 3) ───────────────────────
// Al estar logueado, NO se vuelve a pedir clave: ya está autenticado.
// EDIT_PWD se mantiene como fallback para modo sin login (Firebase no configurado).
const EDIT_PWD = '1996';
let editingId = null;
let editType  = 'revision';

function requestEdit(id){
  editingId = id;
  // Si ya está logueado, saltar paso de pwd e ir directo al formulario
  if(currentUser){
    document.getElementById('edit-step-pwd').style.display='none';
    document.getElementById('edit-step-form').style.display='block';
    document.getElementById('modal-edit-overlay').classList.add('open');
    fillEditForm(id);
    return;
  }
  // Resetear modal al estado inicial (paso contraseña)
  document.getElementById('edit-step-pwd').style.display='block';
  document.getElementById('edit-step-form').style.display='none';
  document.getElementById('edit-pwd').value='';
  document.getElementById('pwd-error').style.display='none';
  document.getElementById('modal-edit-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('edit-pwd').focus(),100);
}

function verifyPwd(){
  const pwd = document.getElementById('edit-pwd').value.trim();
  if(pwd !== EDIT_PWD){
    document.getElementById('pwd-error').style.display='block';
    document.getElementById('edit-pwd').value='';
    document.getElementById('edit-pwd').focus();
    return;
  }
  // Contraseña correcta → cargar datos de la actividad
  fillEditForm(editingId);
}

function fillEditForm(id){
  // Buscar primero por id exacto, luego por id como string (compatibilidad Firebase)
  let act = acts.find(a=>String(a.id)===String(id));
  if(!act){closeEditModal();return;}

  // Si por algún motivo llegó una ocurrencia virtual, usar la madre
  if(act.isVirtualAnual && act.parentAnualId){
    act = acts.find(a=>String(a.id)===String(act.parentAnualId)) || act;
  }

  // Asegurar que fecha es Date (Firebase puede guardar timestamps)
  if(act.fecha && !(act.fecha instanceof Date)){
    act.fecha = new Date(act.fecha);
  }
  if(act.fechaInicio && !(act.fechaInicio instanceof Date)){
    act.fechaInicio = new Date(act.fechaInicio);
  }

  // Rellenar formulario
  document.getElementById('edit-act').value   = act.act;
  document.getElementById('edit-obs').value   = act.obs||'';
  let fechaParaInput = act.fecha;
  if(!(fechaParaInput instanceof Date) || isNaN(fechaParaInput.getTime())){
    fechaParaInput = new Date();
  }
  const f = fechaParaInput;
  document.getElementById('edit-fecha').value =
    f.getFullYear()+'-'+String(f.getMonth()+1).padStart(2,'0')+'-'+String(f.getDate()).padStart(2,'0');

  // Tipo
  editType = act.type||'revision';
  const tipoSel = document.getElementById('edit-tipo');
  fillTipoSelect(tipoSel, editType);

  // Frecuencia
  let freqActual = act.freq;
  if(!freqActual){
    if(act.anual)         freqActual='anual';
    else if(act.mensual)  freqActual='mensual';
    else if(act.semanal)  freqActual='semanal';
    else                  freqActual='puntual';
  }
  // rango se detecta SOLO si freq === 'rango' en Firebase (no por inferencia)
  editFreq = freqActual;
  const freqSel = document.getElementById('edit-freq');
  if(freqSel) freqSel.value = freqActual;
  toggleFechaInicioBlock('edit', freqActual);
  // Visibilidad del bloque inicio ya manejada por toggleFechaInicioBlock

  const inicioInp = document.getElementById('edit-inicio');
  if(inicioInp){
    if(act.fechaInicio instanceof Date && !isNaN(act.fechaInicio.getTime())){
      const fi = act.fechaInicio;
      inicioInp.value = fi.getFullYear()+'-'+String(fi.getMonth()+1).padStart(2,'0')+'-'+String(fi.getDate()).padStart(2,'0');
    } else {
      inicioInp.value = '';
    }
  }

  updateEditPreview();
  document.getElementById('edit-step-pwd').style.display='none';
  document.getElementById('edit-step-form').style.display='block';
}

function setEditType(el,type){ editType=type; const s=document.getElementById('edit-tipo'); if(s) s.value=type; }

function updateEditPreview(){
  const v   = document.getElementById('edit-fecha').value;
  const box = document.getElementById('edit-preview');
  if(!v){box.className='edit-preview prev-neutral';box.style.background='';box.style.color='';box.textContent='—';return;}
  const [yr,mo,da]=v.split('-').map(Number);
  const d=new Date(yr,mo-1,da);
  const diff=diasRest(d);
  const col=getColor(diff,editType==='aniversario');
  box.style.background=col.bg; box.style.color=col.fg; box.style.borderColor=col.bg;
  box.className='edit-preview';
  if(diff<0) box.textContent='VENCIDO hace '+Math.abs(diff)+'d';
  else if(diff===0) box.textContent='Vence HOY';
  else box.textContent='Faltan '+diff+' día'+(diff!==1?'s':'')+' para el término';
}

function saveEdit(){
  const actTxt = toUpper(document.getElementById('edit-act').value);
  const obsTxt = toUpper(document.getElementById('edit-obs').value);
  const fv     = document.getElementById('edit-fecha').value;
  const fiv    = document.getElementById('edit-inicio').value;
  const esRecurrente = (editFreq==='semanal'||editFreq==='mensual'||editFreq==='anual');
  if(!actTxt||!fv){alert('Complete la descripción y la fecha.');return;}
  const [yr,mo,da]=fv.split('-').map(Number);
  const nuevaFecha=new Date(yr,mo-1,da);

  // Fecha de inicio — aplica a cualquier frecuencia si se ingresó
  let nuevaFechaInicio = null;
  if(fiv){
    const [yri,moi,dai]=fiv.split('-').map(Number);
    nuevaFechaInicio = new Date(yri,moi-1,dai);
    nuevaFechaInicio.setHours(0,0,0,0);
  } else if(esRecurrente){
    nuevaFechaInicio = new Date(TODAY);
    nuevaFechaInicio.setHours(0,0,0,0);
  }

  const idx=acts.findIndex(a=>String(a.id)===String(editingId));
  if(idx===-1){closeEditModal();return;}

  const mesAnterior = acts[idx].fecha instanceof Date ? acts[idx].fecha.getMonth() : -1;
  const anioAnterior= acts[idx].fecha instanceof Date ? acts[idx].fecha.getFullYear() : -1;
  const merged = {...acts[idx], act:actTxt, obs:obsTxt, fecha:nuevaFecha, type:editType};
  aplicarFrecuenciaACto(merged, editFreq, nuevaFecha);
  if(nuevaFechaInicio){
    merged.fechaInicio = nuevaFechaInicio;
  } else {
    delete merged.fechaInicio;
  }
  acts[idx] = merged;
  acts.sort((a,b)=>a.fecha-b.fecha);

  closeEditModal();
  saveActToFB(acts.find(a=>String(a.id)===String(editingId))||acts[idx]);

  const nuevoMes  = nuevaFecha.getMonth();
  const nuevoAnio = nuevaFecha.getFullYear();
  rebuildMonthSelect();
  if((nuevoMes!==mesAnterior||nuevoAnio!==anioAnterior) && currentMonthKey!=='all'){
    currentMonthKey = nuevoAnio+'-'+nuevoMes;
    syncSelectoresAKey(currentMonthKey);
  }
  render();
}

// Sincroniza year-select y month-select con una clave "YYYY-M"
function syncSelectoresAKey(key){
  const yearSel  = document.getElementById('year-select');
  const monthSel = document.getElementById('month-select');
  const monthLbl = document.getElementById('month-select-label');
  if(!yearSel || !monthSel) return;
  if(key==='all'){
    yearSel.value = 'all';
    monthSel.style.display = 'none';
    monthLbl.style.display = 'none';
    currentWeekKey = 'all';
    rebuildWeekSelect();
    return;
  }
  const parts = key.split('-');
  const y = Number(parts[0]);
  yearSel.value = String(y);
  const {monthSet, allMonths, todayY, todayM} = calcRangoYMeses();
  _buildMonthsForYear(y, monthSet, allMonths, todayY, todayM);
  monthSel.value = key;
  monthSel.style.display = '';
  monthLbl.style.display = '';
  // Reconstruir el selector de semana al sincronizar con un mes específico
  currentWeekKey = 'all';
  rebuildWeekSelect();
}

function closeEditModal(){
  document.getElementById('modal-edit-overlay').classList.remove('open');
  editingId=null;
}

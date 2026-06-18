// ── ACTIVIDADES RECURRENTES ──────────────────────────────────
// Una actividad recurrente se guarda UNA SOLA VEZ en Firebase. Para
// mostrarse repetida en la Gantt, generamos "ocurrencias" virtuales con
// fechas reales calculadas al vuelo según la vista que el usuario abra.
//
// Frecuencias soportadas:
//   - anual:   {anual:true, dia(1-31), mes(0-11)}  → 1 ocurrencia por año
//   - mensual: {mensual:true, dia(1-31)}           → 1 ocurrencia por mes
//   - semanal: {semanal:true, dow(0=dom..6=sáb)}   → 1 ocurrencia por semana
// Cada ocurrencia conserva parentAnualId/isVirtualAnual para que la fila
// no permita editar/borrar individualmente — eso se hace desde el modal
// "Recurrentes" sobre el registro original.

function getFrecuencia(act){
  if(act.freq) return act.freq;
  if(act.anual)   return 'anual';
  if(act.mensual) return 'mensual';
  if(act.semanal) return 'semanal';
  return 'puntual';
}

function makeAnualOcurrencia(orig, year){
  const dia = Math.min(Math.max(parseInt(orig.dia,10)||1,1),31);
  const mes = Math.min(Math.max(parseInt(orig.mes,10)||0,0),11);
  // Si el día no existe en ese mes (ej: 29-feb en año no bisiesto),
  // JS lo "rebota" al mes siguiente. Lo limitamos al último día válido.
  const ultimoDia = new Date(year, mes+1, 0).getDate();
  const diaSeguro = Math.min(dia, ultimoDia);
  const fecha = new Date(year, mes, diaSeguro, 12, 0, 0);
  return {
    ...orig,
    fecha: fecha,
    fechaInicio: null,   // la ocurrencia virtual no hereda el rango del padre
    type: orig.type || 'aniversario',
    parentAnualId: orig.id,
    isVirtualAnual: true,
    id: 'A'+orig.id+'_'+year
  };
}

function makeMensualOcurrencia(orig, year, month){
  const dia = Math.min(Math.max(parseInt(orig.dia,10)||1,1),31);
  const ultimoDia = new Date(year, month+1, 0).getDate();
  const diaSeguro = Math.min(dia, ultimoDia);
  const fecha = new Date(year, month, diaSeguro, 12, 0, 0);
  return {
    ...orig,
    fecha: fecha,
    fechaInicio: null,   // la ocurrencia virtual no hereda el rango del padre
    type: orig.type || 'revision',
    parentAnualId: orig.id,
    isVirtualAnual: true,
    id: 'M'+orig.id+'_'+year+'_'+month
  };
}

// Genera todas las ocurrencias semanales que caen dentro del rango
// [startDate, endDate] (inclusive) para una actividad semanal.
function makeSemanalOcurrencias(orig, startDate, endDate){
  const dow = Math.min(Math.max(parseInt(orig.dow,10)||0,0),6);
  const out = [];
  // Aplicar la fecha de término de la actividad como límite máximo (si existe)
  let endLimit = endDate;
  if(orig.fecha instanceof Date && !isNaN(orig.fecha.getTime())){
    const termino = new Date(orig.fecha);
    termino.setHours(23,59,59,999);
    if(termino < endLimit) endLimit = termino;
  }
  // Avanzamos al primer día con el dow correcto a partir de startDate
  const cur = new Date(startDate);
  cur.setHours(12,0,0,0);
  const diff = (dow - cur.getDay() + 7) % 7;
  cur.setDate(cur.getDate() + diff);
  while(cur <= endLimit){
    const occ = new Date(cur);
    out.push({
      ...orig,
      fecha: occ,
      type: orig.type || 'revision',
      parentAnualId: orig.id,
      isVirtualAnual: true,
      id: 'S'+orig.id+'_'+occ.getFullYear()+'_'+occ.getMonth()+'_'+occ.getDate()
    });
    cur.setDate(cur.getDate() + 7);
  }
  return out;
}

// ── MODAL ACTIVIDADES ANUALES ────────────────────────────────
function openAnualesModal(){
  const overlay = document.getElementById('modal-anuales-overlay');
  if(!overlay){ return; }
  renderAnualesList();
  overlay.classList.add('open');
}
function closeAnualesModal(){
  const overlay = document.getElementById('modal-anuales-overlay');
  if(overlay) overlay.classList.remove('open');
}
function renderAnualesList(){
  const cont = document.getElementById('anuales-list');
  if(!cont) return;
  // Recurrentes = todas las que tienen freq distinto de puntual (o flags antiguos)
  const recurrentes = acts.filter(a=> {
    const fr = getFrecuencia(a);
    return fr==='anual' || fr==='mensual' || fr==='semanal';
  });
  if(!recurrentes.length){
    cont.innerHTML = '<div style="padding:20px;text-align:center;color:#718096;font-size:13px;">No tienes actividades recurrentes.<br><br>Crea una desde el formulario <strong>+ Nueva actividad</strong> de la Carta Gantt eligiendo una frecuencia (Semanal/Mensual/Anual), o desde la <strong>Agenda</strong> marcando la casilla ANUAL al ingresar una actividad.</div>';
    return;
  }
  // Ordenar: anuales primero (por mes/día), luego mensuales (por día), luego semanales (por dow)
  const ord = {anual:1, mensual:2, semanal:3};
  const DOW_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  recurrentes.sort((a,b)=>{
    const fa=getFrecuencia(a), fb=getFrecuencia(b);
    if(ord[fa]!==ord[fb]) return ord[fa]-ord[fb];
    if(fa==='anual'){
      if(a.mes!==b.mes) return (a.mes||0)-(b.mes||0);
      return (a.dia||0)-(b.dia||0);
    }
    if(fa==='mensual') return (a.dia||0)-(b.dia||0);
    if(fa==='semanal') return (a.dow||0)-(b.dow||0);
    return 0;
  });
  let html = '<table style="width:100%;border-collapse:collapse;">';
  html += '<thead><tr style="background:#1a3f6f;color:#fff;">';
  html += '<th style="padding:8px 10px;text-align:left;font-size:11px;">ACTIVIDAD</th>';
  html += '<th style="padding:8px 10px;text-align:center;font-size:11px;width:80px;">FRECUENCIA</th>';
  html += '<th style="padding:8px 10px;text-align:center;font-size:11px;width:120px;">CUÁNDO</th>';
  html += '<th style="padding:8px 10px;text-align:center;font-size:11px;width:140px;">ACCIONES</th>';
  html += '</tr></thead><tbody>';
  recurrentes.forEach(a=>{
    const fr = getFrecuencia(a);
    let badgeCls, badgeTxt, cuando;
    if(fr==='anual'){
      badgeCls='anual-badge'; badgeTxt='ANUAL';
      cuando = String(a.dia||1).padStart(2,'0')+' / '+(MNAMES[a.mes||0]||'?');
    } else if(fr==='mensual'){
      badgeCls='mensual-badge'; badgeTxt='MENSUAL';
      cuando = 'Día '+String(a.dia||1).padStart(2,'0')+' de cada mes';
    } else {
      badgeCls='semanal-badge'; badgeTxt='SEMANAL';
      cuando = 'Cada '+(DOW_NAMES[a.dow||0]||'—');
    }
    // Escapamos posibles ' en ids/textos
    const safeId = JSON.stringify(a.id); // funciona para number y string
    html += '<tr style="border-bottom:1px solid #e2e8f0;">';
    html += '<td style="padding:8px 10px;font-size:12px;color:#2d3748;">'+(a.act||'')+(a.obs?' <span style="color:#718096;font-size:10px;">('+a.obs+')</span>':'')+'</td>';
    html += '<td style="padding:8px 10px;text-align:center;"><span class="'+badgeCls+'" style="font-size:8px;padding:2px 6px;">'+badgeTxt+'</span></td>';
    html += '<td style="padding:8px 10px;font-size:11px;color:#1a3f6f;text-align:center;font-weight:600;">'+cuando+'</td>';
    html += '<td style="padding:8px 10px;text-align:center;">';
    html += '<button onclick="editarRecurrente('+safeId+')" style="background:#1a3f6f;color:#fff;border:none;padding:5px 10px;border-radius:4px;font-size:11px;cursor:pointer;margin-right:4px;">&#9998; Cambiar</button>';
    html += '<button onclick="borrarRecurrente('+safeId+')" style="background:#c62828;color:#fff;border:none;padding:5px 10px;border-radius:4px;font-size:11px;cursor:pointer;">&#10005; Borrar</button>';
    html += '</td></tr>';
  });
  html += '</tbody></table>';
  cont.innerHTML = html;
}
// Acepta id numérico o string (los recurrentes guardados desde la agenda
// usan id numérico; comparamos con doble igual flexible).
function _findActById(id){
  return acts.find(a=> a.id===id || String(a.id)===String(id));
}

function editarRecurrente(id){
  const orig = _findActById(id);
  if(!orig){ alert('No se encontró la actividad recurrente.'); return; }
  const fr = getFrecuencia(orig);
  if(fr==='puntual'){ alert('Esta actividad no es recurrente.'); return; }
  const DOW_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

  let updates = null;
  if(fr==='anual'){
    const diaActual = String(orig.dia||1).padStart(2,'0');
    const mesActual = String((orig.mes||0)+1).padStart(2,'0');
    const inputStr = prompt('Editar actividad ANUAL:\n\n'+(orig.act||'')+'\n\nIngrese la nueva fecha (DD/MM):', diaActual+'/'+mesActual);
    if(!inputStr) return;
    const m = inputStr.trim().match(/^(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})$/);
    if(!m){ alert('Formato inválido. Use DD/MM (por ejemplo: 21/04).'); return; }
    const nDia = parseInt(m[1],10);
    const nMes = parseInt(m[2],10);
    if(nDia<1||nDia>31||nMes<1||nMes>12){ alert('Día o mes fuera de rango.'); return; }
    updates = {dia:nDia, mes:nMes-1};
  } else if(fr==='mensual'){
    const diaActual = String(orig.dia||1);
    const inputStr = prompt('Editar actividad MENSUAL:\n\n'+(orig.act||'')+'\n\nIngrese el nuevo día del mes (1-31):', diaActual);
    if(!inputStr) return;
    const nDia = parseInt(inputStr.trim(),10);
    if(isNaN(nDia)||nDia<1||nDia>31){ alert('Día fuera de rango (1-31).'); return; }
    updates = {dia:nDia};
  } else if(fr==='semanal'){
    const dowActual = String(orig.dow||0);
    const lista = DOW_NAMES.map((n,i)=>i+'='+n).join('\n');
    const inputStr = prompt('Editar actividad SEMANAL:\n\n'+(orig.act||'')+'\n\nIngrese el día de la semana (0-6):\n'+lista, dowActual);
    if(!inputStr) return;
    const nDow = parseInt(inputStr.trim(),10);
    if(isNaN(nDow)||nDow<0||nDow>6){ alert('Día de la semana fuera de rango (0-6).'); return; }
    updates = {dow:nDow};
  }
  if(!updates) return;

  // Persistir
  if(!FB_CONFIGURED || !dbRef){
    Object.assign(orig, updates);
    renderAnualesList();
    rebuildMonthSelect();
    render();
    return;
  }
  dbRef.child(String(orig.id)).update(updates, err=>{
    if(err){ alert('No se pudo guardar: '+err.message); return; }
    setTimeout(()=>{ if(document.getElementById('modal-anuales-overlay').classList.contains('open')) renderAnualesList(); }, 300);
  });
}

function borrarRecurrente(id){
  const orig = _findActById(id);
  if(!orig){ alert('No se encontró la actividad recurrente.'); return; }
  const fr = getFrecuencia(orig);
  const frTxt = fr==='anual'?'anual':(fr==='mensual'?'mensual':(fr==='semanal'?'semanal':''));
  const aviso = fr==='anual'?'Dejará de aparecer en TODOS los años.'
              :fr==='mensual'?'Dejará de aparecer en TODOS los meses.'
              :'Dejará de aparecer en TODAS las semanas.';
  if(!confirm('¿Borrar la actividad '+frTxt+' "'+(orig.act||'')+'"?\n\n'+aviso+'\nEsta acción no se puede deshacer.')) return;
  if(!FB_CONFIGURED || !dbRef){
    acts = acts.filter(a=> !(a.id===orig.id || String(a.id)===String(orig.id)));
    renderAnualesList();
    rebuildMonthSelect();
    render();
    return;
  }
  dbRef.child(String(orig.id)).remove(err=>{
    if(err){ alert('No se pudo borrar: '+err.message); return; }
    setTimeout(()=>{ if(document.getElementById('modal-anuales-overlay').classList.contains('open')) renderAnualesList(); }, 300);
  });
}

// Aliases retro-compatibles por si algo del HTML viejo los llama
function editarAnual(id){ return editarRecurrente(id); }
function borrarAnual(id){ return borrarRecurrente(id); }

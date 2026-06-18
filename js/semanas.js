// ── FILTRO POR SEMANA (lunes a domingo, ISO) ───────────────────
// currentWeekKey: 'all' = sin filtro, o 'YYYY-MM-DD' = lunes de la semana
//   (compatibilidad para resto del código que usa 1 sola semana)
// selectedWeekKeys: Set de claves cuando el usuario marca múltiples
let currentWeekKey = 'all';
let selectedWeekKeys = new Set();   // Ej: {"2026-05-04", "2026-05-11"}
let weekDropdownOpenList = [];       // Caché de las semanas mostradas en el dropdown

// Sincroniza currentWeekKey desde selectedWeekKeys (para compatibilidad)
function syncWeekKeyFromSet(){
  if(selectedWeekKeys.size === 0){
    currentWeekKey = 'all';
  } else if(selectedWeekKeys.size === 1){
    // Una sola semana: comportamiento clásico (filtro a esa semana)
    currentWeekKey = Array.from(selectedWeekKeys)[0];
  } else {
    // Múltiples: marcamos como 'multi' para que rangoSemanaActual() devuelva null
    // y el render use modo extendido con buildDaysFromMultipleWeeks
    currentWeekKey = 'multi';
  }
}

// Construir/abrir/cerrar el dropdown de semanas
function toggleWeekDropdown(ev){
  if(ev) ev.stopPropagation();
  const dd = document.getElementById('week-dropdown');
  if(!dd) return;
  if(dd.style.display === 'block'){
    dd.style.display = 'none';
  } else {
    rebuildWeekDropdown();
    dd.style.display = 'block';
  }
}

// Cerrar el dropdown al hacer clic fuera
document.addEventListener('click', function(ev){
  const wrap = document.getElementById('week-select-wrap');
  if(!wrap) return;
  if(!wrap.contains(ev.target)){
    const dd = document.getElementById('week-dropdown');
    if(dd) dd.style.display = 'none';
  }
});

// Toggle de una semana específica (clave = lunes-YYYY-MM-DD)
function toggleWeekSelection(key){
  if(selectedWeekKeys.has(key)){
    selectedWeekKeys.delete(key);
  } else {
    selectedWeekKeys.add(key);
  }
  syncWeekKeyFromSet();
  rebuildWeekDropdown();   // refrescar visual
  updateWeekTriggerLabel();
  render();
}

// Toggle "Todo el mes" — marca/desmarca TODAS las del mes elegido (no las extras)
function toggleWeekMaster(){
  // Identificar las claves del mes (no extras)
  const mesKeys = weekDropdownOpenList.filter(w => !w.isExtra).map(w => w.key);
  const todasMarcadas = mesKeys.length > 0 && mesKeys.every(k => selectedWeekKeys.has(k));
  if(todasMarcadas){
    // Desmarcar todas las del mes
    mesKeys.forEach(k => selectedWeekKeys.delete(k));
  } else {
    // Marcar todas las del mes
    mesKeys.forEach(k => selectedWeekKeys.add(k));
  }
  syncWeekKeyFromSet();
  rebuildWeekDropdown();
  updateWeekTriggerLabel();
  render();
}

// Reconstruye el contenido del dropdown según el mes elegido
function rebuildWeekDropdown(){
  const dd = document.getElementById('week-dropdown');
  if(!dd) return;

  let year, month;
  if(currentMonthKey === 'current'){
    year = TODAY.getFullYear();
    month = TODAY.getMonth();
  } else if(currentMonthKey && !currentMonthKey.startsWith('year-') && currentMonthKey !== 'all'){
    const parts = currentMonthKey.split('-');
    year = Number(parts[0]);
    month = Number(parts[1]);
  } else {
    return;
  }

  // Semanas del mes
  const semanasMes = generarSemanasDelMes(year, month);
  // Semanas del mes siguiente (4)
  const nextDate = new Date(year, month+1, 1);
  const semanasSig = generarSemanasDelMes(nextDate.getFullYear(), nextDate.getMonth()).slice(0, 4);

  const fmt = (d)=>{
    const M = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return String(d.getDate()).padStart(2,'0')+' '+M[d.getMonth()];
  };
  const wkKey = (lunes)=> lunes.getFullYear()+'-'+String(lunes.getMonth()+1).padStart(2,'0')+'-'+String(lunes.getDate()).padStart(2,'0');

  // Cache
  weekDropdownOpenList = [];
  semanasMes.forEach((s,i)=>{
    weekDropdownOpenList.push({ key: wkKey(s.lunes), lunes: s.lunes, domingo: s.domingo, num: i+1, isExtra: false });
  });
  semanasSig.forEach((s,i)=>{
    weekDropdownOpenList.push({ key: wkKey(s.lunes), lunes: s.lunes, domingo: s.domingo, num: i+1, isExtra: true });
  });

  // Construir HTML
  const mesKeys = semanasMes.map(s => wkKey(s.lunes));
  const todasMarcadas = mesKeys.length > 0 && mesKeys.every(k => selectedWeekKeys.has(k));

  let html = '';
  // Master
  html += '<div class="ext-wkrow master '+(todasMarcadas?'checked':'')+'" onclick="toggleWeekMaster();event.stopPropagation();">';
  html += '<div class="ext-cb"></div>';
  html += '<div style="flex:1;">Todo el mes ('+MNAMES[month]+')</div>';
  html += '</div>';

  // Semanas del mes
  semanasMes.forEach((s, i)=>{
    const k = wkKey(s.lunes);
    const checked = selectedWeekKeys.has(k);
    html += '<div class="ext-wkrow '+(checked?'checked':'')+'" onclick="toggleWeekSelection(\''+k+'\');event.stopPropagation();">';
    html += '<div class="ext-cb"></div>';
    html += '<div style="flex:1;">Semana '+(i+1)+' — '+fmt(s.lunes)+' al '+fmt(s.domingo)+'</div>';
    html += '</div>';
  });

  // Sección extras
  if(semanasSig.length){
    const nextMonth = nextDate.getMonth();
    const nextYear = nextDate.getFullYear();
    html += '<div class="ext-wkrow section">SEMANAS DEL MES SIGUIENTE ('+MNAMES[nextMonth]+' '+nextYear+')</div>';
    semanasSig.forEach((s, i)=>{
      const k = wkKey(s.lunes);
      const checked = selectedWeekKeys.has(k);
      html += '<div class="ext-wkrow extra '+(checked?'checked':'')+'" onclick="toggleWeekSelection(\''+k+'\');event.stopPropagation();">';
      html += '<div class="ext-cb"></div>';
      html += '<div style="flex:1;">'+MNAMES[nextMonth].substring(0,3)+' - Semana '+(i+1)+' — '+fmt(s.lunes)+' al '+fmt(s.domingo)+'<span class="ext-wk-tag">EXTRA</span></div>';
      html += '</div>';
    });
  }

  dd.innerHTML = html;
}

// Actualiza el texto del botón trigger según selección
function updateWeekTriggerLabel(){
  const trigger = document.getElementById('week-trigger');
  const text = document.getElementById('week-trigger-text');
  if(!trigger || !text) return;
  const n = selectedWeekKeys.size;
  if(n === 0){
    text.textContent = 'Todo el mes';
    trigger.classList.remove('has-selection');
  } else if(n === 1){
    // Buscar la semana en el cache para mostrar el rango
    const k = Array.from(selectedWeekKeys)[0];
    const w = weekDropdownOpenList.find(x => x.key === k);
    if(w){
      const fmt = d => String(d.getDate()).padStart(2,'0')+' '+['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getMonth()];
      text.textContent = 'Sem '+w.num+' ('+fmt(w.lunes)+' – '+fmt(w.domingo)+')';
    } else {
      text.textContent = '1 semana';
    }
    trigger.classList.add('has-selection');
  } else {
    text.textContent = n+' semanas seleccionadas';
    trigger.classList.add('has-selection');
  }
}

// Reconstruye el desplegable de semana según el mes/año seleccionado
function rebuildWeekSelect(){
  const wrap = document.getElementById('week-select-wrap');
  const lbl = document.getElementById('week-select-label');
  if(!wrap || !lbl) return;

  let year, month;
  if(currentMonthKey === 'current'){
    year = TODAY.getFullYear();
    month = TODAY.getMonth();
  } else if(currentMonthKey && !currentMonthKey.startsWith('year-') && currentMonthKey !== 'all'){
    const parts = currentMonthKey.split('-');
    year = Number(parts[0]);
    month = Number(parts[1]);
    if(isNaN(year) || isNaN(month)){
      wrap.style.display = 'none';
      lbl.style.display = 'none';
      return;
    }
  } else {
    // Año completo o Toda la Gantt → no hay semanas que mostrar
    wrap.style.display = 'none';
    lbl.style.display = 'none';
    selectedWeekKeys = new Set();
    syncWeekKeyFromSet();
    return;
  }

  wrap.style.display = '';
  lbl.style.display = '';
  rebuildWeekDropdown();
  updateWeekTriggerLabel();
}

// Genera array de {lunes, domingo} para todas las semanas que tocan el mes
function generarSemanasDelMes(year, month){
  const out = [];
  const primerDia = new Date(year, month, 1);
  // Encontrar el LUNES anterior o igual al primer día del mes
  const offsetLun = (primerDia.getDay() === 0) ? 6 : (primerDia.getDay() - 1);
  const lunesInicio = new Date(year, month, 1 - offsetLun);
  lunesInicio.setHours(0,0,0,0);

  const ultimoDia = new Date(year, month+1, 0);

  let cur = new Date(lunesInicio);
  while(cur <= ultimoDia){
    const lun = new Date(cur);
    const dom = new Date(cur);
    dom.setDate(dom.getDate()+6);
    dom.setHours(23,59,59,999);
    out.push({lunes: lun, domingo: dom});
    cur.setDate(cur.getDate()+7);
  }
  return out;
}

// Devuelve el rango {ini, fin} de la semana seleccionada (o null)
function rangoSemanaActual(){
  if(!currentWeekKey || currentWeekKey === 'all') return null;
  const parts = currentWeekKey.split('-');
  if(parts.length !== 3) return null;
  const lun = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
  lun.setHours(0,0,0,0);
  const dom = new Date(lun);
  dom.setDate(dom.getDate()+6);
  dom.setHours(23,59,59,999);
  return {ini: lun, fin: dom};
}


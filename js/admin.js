// ── ADMIN: NAVEGACIÓN ENTRE GANTT ────────────────────────────

// Estado del admin guardado cuando entra a ver otra Gantt
let adminSavedState = null;

function buildAdminUserChips(){
  if(!currentUser || currentUser.rol !== 'admin') return;
  const wrap = document.getElementById('admin-users-wrap');
  if(!wrap) return;
  const others = usuariosCache.filter(u => u.id !== currentUser.id);
  if(!others.length){ wrap.classList.remove('visible'); return; }
  let html = '<div class="stat-divider-v"></div>';
  // Chip propio del admin (siempre primero, vuelve a su gantt)
  html += '<div class="admin-user-chip" id="admin-chip-self" onclick="adminVolverAMiGantt()" title="Ver mi Gantt (ADMIN)">★ '+currentUser.nombre+'</div>';
  others.forEach(u => {
    const nom = u.nombre.replace(/'/g,'&#39;');
    html += '<div class="admin-user-chip" id="admin-chip-'+u.id+'" onclick="adminVerGanttDeUsuario(\''+u.id+'\',\''+nom+'\')" title="Ver Gantt de '+nom+'">👤 '+u.nombre+'</div>';
  });
  wrap.innerHTML = html;
  wrap.classList.add('visible');
  // Marcar chip propio como activo al cargar (estás en tu propia Gantt)
  if(!viewingUserId){
    const selfChip = document.getElementById('admin-chip-self');
    if(selfChip) selfChip.classList.add('viewing');
  }
}

function _parsearActsDeSnap(data){
  if(!data) return [];
  return Object.values(data).map(a=>{
    let f = new Date(a.fecha);
    const esRec = !!(a.anual||a.mensual||a.semanal||(a.freq&&a.freq!=='puntual'));
    if(esRec && (isNaN(f.getTime())||!a.fecha)) f = new Date();
    let fi = null;
    if(a.fechaInicio){
      const p = new Date(a.fechaInicio);
      if(!isNaN(p.getTime())){ p.setHours(0,0,0,0); fi = p; }
    }
    const out = {...a, act:(a.act||'').toUpperCase().trim(), obs:(a.obs||'').toUpperCase().trim(), fecha:f};
    if(fi) out.fechaInicio = fi; else delete out.fechaInicio;
    return out;
  }).sort((a,b)=>a.fecha-b.fecha);
}

// Captura el estado completo de filtros y selectores del admin
function _capturarEstado(){
  return {
    currentFilter,
    currentMonthKey,
    currentWeekKey,
    selectedWeekKeys: new Set(selectedWeekKeys),
    currentTipoFilter,
    yearSelectValue:  document.getElementById('year-select')?.value  || 'current',
    monthSelectValue: document.getElementById('month-select')?.value || ''
  };
}

// Resetea TODOS los filtros y selectores a estado inicial
function _resetearEstado(){
  currentFilter     = 'all';
  currentMonthKey   = 'current';
  currentWeekKey    = 'all';
  selectedWeekKeys  = new Set();
  currentTipoFilter = null;

  // Stat cards
  document.querySelectorAll('.stat-card').forEach(c=>c.classList.remove('active-filter'));
  document.querySelector('.stat-total')?.classList.add('active-filter');
  document.getElementById('filter-clear-btn').style.display = 'none';

  // Botón POR TIPO
  const tipoBtn = document.getElementById('stat-tipo-btn');
  if(tipoBtn){
    tipoBtn.classList.remove('active');
    tipoBtn.innerHTML = '🏷️ POR TIPO <span style="font-size:8px;">▾</span>';
  }

  // Selector de semana — ocultar
  const wWrap  = document.getElementById('week-select-wrap');
  const wLabel = document.getElementById('week-select-label');
  const wTxt   = document.getElementById('week-trigger-text');
  if(wWrap)  wWrap.style.display  = 'none';
  if(wLabel) wLabel.style.display = 'none';
  if(wTxt)   wTxt.textContent     = 'Todo el mes';
}

// Restaura el estado guardado del admin (se llama DESPUÉS de rebuildMonthSelect)
function _restaurarEstado(state){
  if(!state) return;
  currentFilter     = state.currentFilter;
  currentMonthKey   = state.currentMonthKey;
  currentWeekKey    = state.currentWeekKey;
  selectedWeekKeys  = new Set(state.selectedWeekKeys);
  currentTipoFilter = state.currentTipoFilter;

  // Restaurar selectores (solo si la opción existe)
  const yearSel  = document.getElementById('year-select');
  const monthSel = document.getElementById('month-select');
  if(yearSel){
    const optY = yearSel.querySelector('option[value="'+state.yearSelectValue+'"]');
    yearSel.value = optY ? state.yearSelectValue : 'current';
  }
  if(monthSel && state.monthSelectValue){
    const optM = monthSel.querySelector('option[value="'+state.monthSelectValue+'"]');
    if(optM) monthSel.value = state.monthSelectValue;
  }

  // Stat cards
  document.querySelectorAll('.stat-card').forEach(c=>c.classList.remove('active-filter'));
  const fMap = {all:'stat-total',venc:'stat-venc',rojo:'stat-rojo',naranja:'stat-naranja',amarillo:'stat-amarillo',aniv:'stat-aniv'};
  document.querySelector('.'+(fMap[currentFilter]||'stat-total'))?.classList.add('active-filter');
  document.getElementById('filter-clear-btn').style.display = currentFilter==='all'?'none':'inline-block';

  // Botón POR TIPO
  const tipoBtn = document.getElementById('stat-tipo-btn');
  if(tipoBtn){
    tipoBtn.classList.toggle('active', currentTipoFilter !== null);
    if(currentTipoFilter !== null){
      const t = getAllTipos().find(x=>x.value===currentTipoFilter);
      tipoBtn.innerHTML = '🏷️ '+(t?t.label.toUpperCase():'TIPO')+' <span style="font-size:8px;">▾</span>';
    } else {
      tipoBtn.innerHTML = '🏷️ POR TIPO <span style="font-size:8px;">▾</span>';
    }
  }
}

function adminVerGanttDeUsuario(userId, userName){
  if(!currentUser || currentUser.rol !== 'admin') return;
  if(viewingUserId === userId) return;

  // Persistir selección para restaurar al refrescar
  try{ localStorage.setItem('gantt_admin_viewing', JSON.stringify({id: userId, nombre: userName})); }catch(e){}

  // 1. Guardar estado actual del admin ANTES de cambiarlo
  adminSavedState = _capturarEstado();

  if(dbRef) dbRef.off();
  viewingUserId  = userId;
  viewingUserName = userName;
  actualizarEnviarAgendaVisible();

  // 2. Resetear filtros/selectores a estado limpio para el otro usuario
  _resetearEstado();

  // Marcar chip activo
  document.querySelectorAll('.admin-user-chip').forEach(c=>c.classList.remove('viewing'));
  const chip = document.getElementById('admin-chip-'+userId);
  if(chip) chip.classList.add('viewing');
  // Header y banner
  const badge = document.getElementById('user-badge');
  if(badge) badge.textContent = '👁 GANTT: '+userName;
  document.getElementById('admin-back-name').textContent = userName;
  document.getElementById('admin-back-banner').classList.add('visible');

  // 3. Cargar tipos del usuario visto (independiente del admin)
  tiposCustom = []; tiposOcultos = new Set();
  db.ref('gantt_maah/tipos_usuario/'+userId).once('value', snap=>{
    const d = snap.val();
    if(d){ if(Array.isArray(d.custom)) tiposCustom=d.custom; if(Array.isArray(d.ocultos)) tiposOcultos=new Set(d.ocultos); }
    refreshAllTipoSelects();
  });

  // 4. Conectar a Firebase del otro usuario (estado independiente)
  dbRef = db.ref('gantt_maah/actividades_por_usuario/'+userId);
  dbRef.on('value', snap=>{
    const data = snap.val();
    acts = _parsearActsDeSnap(data);
    if(acts.length){
      const maxId = acts.reduce((m,a)=>{ const n=Number(a.id); return (Number.isFinite(n)&&n>m)?n:m; },0);
      if(maxId >= nextId) nextId = maxId+1;
    }
    rebuildMonthSelect();
    rebuildWeekSelect();
    render();
    importarDesdeRGDOC(); eliminarDesdeRGDOC();
  }, err=>{ console.error('[ADMIN] Error Firebase otro usuario:',err); });
}

function adminVolverAMiGantt(){
  if(!currentUser || currentUser.rol !== 'admin') return;
  if(dbRef) dbRef.off();
  viewingUserId  = null;
  viewingUserName = null;
  actualizarEnviarAgendaVisible();
  try{ localStorage.removeItem('gantt_admin_viewing'); }catch(e){}

  // 1. Resetear el estado del otro usuario
  _resetearEstado();

  // Marcar chip propio como activo, desmarcar los demás
  document.querySelectorAll('.admin-user-chip').forEach(c=>c.classList.remove('viewing'));
  const selfChip = document.getElementById('admin-chip-self');
  if(selfChip) selfChip.classList.add('viewing');
  // Header y banner
  const badge = document.getElementById('user-badge');
  if(badge) badge.textContent = '👤 '+currentUser.nombre+(currentUser.rol==='admin'?' ★':'');
  document.getElementById('admin-back-banner').classList.remove('visible');

  // 2. Restaurar tipos del admin
  tiposCustom = []; tiposOcultos = new Set();
  db.ref('gantt_maah/tipos_usuario/'+currentUser.id).once('value', snap=>{
    const d = snap.val();
    if(d){ if(Array.isArray(d.custom)) tiposCustom=d.custom; if(Array.isArray(d.ocultos)) tiposOcultos=new Set(d.ocultos); }
    refreshAllTipoSelects();
  });

  // 3. Reconectar a los datos del admin
  dbRef = db.ref('gantt_maah/actividades_por_usuario/'+currentUser.id);
  dbRef.on('value', snap=>{
    const data = snap.val();
    acts = _parsearActsDeSnap(data);
    if(acts.length){
      const maxId = acts.reduce((m,a)=>{ const n=Number(a.id); return (Number.isFinite(n)&&n>m)?n:m; },0);
      if(maxId >= nextId) nextId = maxId+1;
    }
    rebuildMonthSelect();
    rebuildWeekSelect();
    // 3. Restaurar el estado del admin tal como lo dejó
    if(adminSavedState) _restaurarEstado(adminSavedState);
    db.ref('maah_agenda/'+currentUser.id).once('value').then(agSnap=>{
      const agData = agSnap.val()||{};
      acts.forEach(a=>{
        if(a.fromAgenda&&a.agendaFecha){
          const dayActs=agData[a.agendaFecha]||{};
          const match=Object.values(dayActs).find(ag=>ag&&ag.hora===a.agendaHora&&ag.priori);
          if(match) a.priori=true; else delete a.priori;
        }
      });
      render();
    }).catch(()=>render());
  }, err=>{ console.error('[ADMIN] Error Firebase volviendo:',err); });
}


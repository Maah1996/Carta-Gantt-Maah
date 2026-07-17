function iniciarGanttDelUsuario(){
  // Cargar tipos personalizados del usuario desde Firebase
  loadTiposDesdeFirebase();

  // Mostrar toda la app (estaba oculta hasta autenticarse)
  ['app-header','app-stats-bar','app-toolbar','app-main'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display='';
  });

  // Mostrar UI del usuario en el header
  const badge=document.getElementById('user-badge');
  badge.textContent='👤 '+currentUser.nombre+(currentUser.rol==='admin'?' ★':'');
  badge.style.display='inline-block';
  document.getElementById('logout-btn').style.display='inline-block';
  const btnClave=document.getElementById('btn-cambiar-clave');
  if(btnClave) btnClave.style.display='inline-block';

  hideLoginOverlay();

  // Siempre apunta al usuario logueado (no cambia aunque admin vea otra Gantt)
  myDbRef = db.ref('gantt_maah/actividades_por_usuario/'+currentUser.id);

  // Si es admin, construir chips y conectar DIRECTO a la Gantt guardada (sin pasar por la propia)
  if(currentUser.rol === 'admin'){
    buildAdminUserChips();
    const btnUM = document.getElementById('btn-user-mgmt');
    if(btnUM) btnUM.style.display='inline-block';
    // Determinar usuario a mostrar: el guardado en localStorage o CG OCGR por defecto
    let targetUser = null;
    try{
      const saved = JSON.parse(localStorage.getItem('gantt_admin_viewing'));
      targetUser = saved
        ? usuariosCache.find(u => u.id === saved.id)
        : usuariosCache.find(u => u.nombre === 'CG OCGR');
    }catch(e){}
    if(targetUser){
      // Conectar directo a la Gantt del usuario destino sin cargar la del admin
      viewingUserId   = targetUser.id;
      viewingUserName = targetUser.nombre;
      const badge = document.getElementById('user-badge');
      if(badge) badge.textContent = '👁 GANTT: '+targetUser.nombre;
      document.getElementById('admin-back-name').textContent = targetUser.nombre;
      document.getElementById('admin-back-banner').classList.add('visible');
      document.querySelectorAll('.admin-user-chip').forEach(c=>c.classList.remove('viewing'));
      const chip = document.getElementById('admin-chip-'+targetUser.id);
      if(chip) chip.classList.add('viewing');
      dbRef = db.ref('gantt_maah/actividades_por_usuario/'+targetUser.id);
    } else {
      dbRef = myDbRef;
    }
  } else {
    // Usuario normal: modo solo-lectura
    document.body.classList.add('readonly-user');
    dbRef = myDbRef;
  }

  // "Enviar a Agenda" solo existe en la Gantt propia del admin
  actualizarEnviarAgendaVisible();

  // Bandera para hacer la migración solo una vez
  let migracionIntentada = false;

  dbRef.on('value', snap=>{
    const data = snap.val();
    if(data){
      acts = Object.values(data).map(a=>{
        let f = new Date(a.fecha);
        const esRecurrente = !!(a.anual || a.mensual || a.semanal ||
                                (a.freq && a.freq!=='puntual'));
        if(esRecurrente && (isNaN(f.getTime()) || !a.fecha)){
          f = new Date();
        }
        // Parsear fecha de inicio (solo aplica a recurrentes)
        let fi = null;
        if(a.fechaInicio){
          const parsed = new Date(a.fechaInicio);
          if(!isNaN(parsed.getTime())){
            parsed.setHours(0,0,0,0);
            fi = parsed;
          }
        }
        const out = {
          ...a,
          act: (a.act||'').toUpperCase().trim(),
          obs: (a.obs||'').toUpperCase().trim(),
          fecha: f
        };
        if(fi) out.fechaInicio = fi;
        else delete out.fechaInicio;
        return out;
      }).sort((a,b)=>a.fecha-b.fecha);
      const maxId = acts.reduce((m,a)=>{
        const n = Number(a.id);
        return (Number.isFinite(n) && n>m) ? n : m;
      },0);
      if(maxId >= nextId) nextId = maxId + 1;
      rebuildMonthSelect();
      rebuildWeekSelect();
      // Cruzar con agenda para detectar prioritarias (aunque no tengan el flag en Gantt)
      db.ref('maah_agenda/'+currentUser.id).once('value').then(agSnap=>{
        const agData=agSnap.val()||{};
        acts.forEach(a=>{
          if(a.fromAgenda && a.agendaFecha){
            const dayActs=agData[a.agendaFecha]||{};
            const match=Object.values(dayActs).find(ag=>ag&&ag.hora===a.agendaHora&&ag.priori);
            if(match) a.priori=true; else delete a.priori;
          }
        });
        render();
        importarDesdeRGDOC(); eliminarDesdeRGDOC();
      }).catch(()=>{ render(); importarDesdeRGDOC(); eliminarDesdeRGDOC(); });
    } else {
      // Sin datos en la ruta personal del usuario.
      // Para cualquier admin: intentar recuperar datos del respaldo una sola vez.
      const esAdmin = currentUser.rol === 'admin';
      if(esAdmin && !migracionIntentada){
        migracionIntentada = true;
        migrarDatosViejosAMaah();
        return;
      }
      // Usuario sin datos: gantt VACÍA
      acts = [];
      rebuildMonthSelect();
      rebuildWeekSelect();
      render();
      importarDesdeRGDOC(); eliminarDesdeRGDOC();
    }
  }, err=>{
    console.error('Firebase error:', err.code, err.message);
    updateStatusBadge(false);
  });
}

function limpiarEstadoHTMLInicial(){
  ['app-header','app-stats-bar','app-toolbar','app-main'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display='none';
  });

  const badge=document.getElementById('user-badge');
  if(badge){
    badge.textContent='';
    badge.style.display='none';
  }

  ['logout-btn','btn-cambiar-clave','btn-user-mgmt'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display='none';
  });

  const status=document.getElementById('fb-status');
  if(status){
    status.textContent='● Conectando...';
    status.style.background='rgba(113,128,150,.25)';
    status.style.color='#cbd5e0';
  }

  ['s-total','s-venc','s-rojo','s-naranja','s-amarillo','s-anivs'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.textContent='0';
  });

  const info=document.getElementById('view-info');
  if(info) info.textContent='Cargando Carta Gantt...';

  const wrap=document.getElementById('gantt-wrap');
  if(wrap) wrap.innerHTML='<div class="empty-row" style="padding:24px;text-align:center;color:#718096;">Cargando Carta Gantt...</div>';
}
// Migración: copia los datos viejos de gantt_maah/actividades a la ruta personal de MAAH.
// Solo se ejecuta cuando MAAH entra a una gantt vacía.
function migrarDatosViejosAMaah(){
  console.log('[MAAH] Detectada gantt vacía. Buscando datos viejos para migrar...');
  db.ref('gantt_maah/actividades').once('value', snap=>{
    const viejos = snap.val();
    if(!viejos){
      console.log('[MAAH] No hay datos viejos. Gantt vacía.');
      acts = [];
      rebuildMonthSelect();
      rebuildWeekSelect();
      render();
      return;
    }
    console.log('[MAAH] Datos viejos encontrados. Copiando a tu ruta personal...');
    // Copiar cada actividad a la ruta personal de MAAH
    const updates = {};
    Object.entries(viejos).forEach(([id, act])=>{
      updates[id] = act;
    });
    dbRef.update(updates, err=>{
      if(err){
        console.error('[MAAH] Error en migración:', err);
        alert('No se pudieron recuperar los datos viejos. Revisa la consola.');
        return;
      }
      console.log('[MAAH] ✓ Datos migrados correctamente.');
      // El listener dbRef.on('value') se reactivará automáticamente y los cargará.
    });
  }, err=>{
    console.error('[MAAH] Error leyendo datos viejos:', err);
  });
}


// ── INICIO ───────────────────────────────────────────────────
const td2=TODAY;
document.getElementById('today-lbl').textContent=
  'HOY: '+String(td2.getDate()).padStart(2,'0')+'/'+MSHORT[td2.getMonth()]+'/'+td2.getFullYear();

setFilter('all');
limpiarEstadoHTMLInicial();

// Cerrar dropdown de tipo al hacer clic fuera
document.addEventListener('click', function(){
  const dd = document.getElementById('tipo-filter-dropdown');
  if(dd && dd.classList.contains('open')){
    dd.classList.remove('open');
    const btn = document.getElementById('stat-tipo-btn');
    if(btn) btn.classList.remove('active');
  }
});

// Inicializar firebase y cargar usuarios; mostrar login (o restaurar sesión)
initFirebase();

// Inicialización extra: cargar tipos personalizados y poblar selects de Tipo
loadTiposCustom();
(function initTipoSelectsAlInicio(){
  const ready = ()=>{
    const fSel = document.getElementById('f-tipo');
    const eSel = document.getElementById('edit-tipo');
    if(fSel) fillTipoSelect(fSel, 'revision');
    if(eSel) fillTipoSelect(eSel, 'revision');
    toggleFechaInicioBlock('add','puntual');
    toggleFechaInicioBlock('edit','puntual');
  };
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', ready);
  } else { ready(); }
})();

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeModal();closeEditModal();closeAddPwdModal();closeTipoAddModal();closeCtxMenu();closeUserMgmtPanel();}
});

// ── MENÚ CONTEXTUAL LÁPIZ ─────────────────────────────────────

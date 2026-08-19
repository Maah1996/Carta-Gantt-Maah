// ── Eliminar actividad desde Registro Documental (checkbox desmarcado) ───
function eliminarDesdeRGDOC(){
  if(!dbRef) return;
  try{
    const raw = localStorage.getItem('rgdoc_remove_gantt');
    if(!raw) return;
    const sig = JSON.parse(raw);
    localStorage.removeItem('rgdoc_remove_gantt');
    const actNorm = (sig.act||'').toUpperCase().trim();
    const rgdocNum = String(sig.rgdocNumero||'');
    // Buscar actividades coincidentes por rgdocNumero o por materia
    const aEliminar = acts.filter(a => a.fromRGDOC && (
      (rgdocNum && String(a.rgdocNumero) === rgdocNum) ||
      (actNorm && (a.act||'').toUpperCase().trim() === actNorm)
    ));
    aEliminar.forEach(a => {
      dbRef.child(String(a.id)).remove();
      console.log('[RGDOC] Eliminado de Gantt:', a.act);
    });
    if(aEliminar.length){
      acts = acts.filter(a => !aEliminar.includes(a));
      rebuildMonthSelect(); render();
    }
  }catch(e){ console.error('[RGDOC] Error eliminando:', e); }
}

// ── Importar actividad desde Registro Documental OCGR ────────
// Polling cada 3s: detecta payload en localStorage sin importar si la Gantt
// estaba abierta o cerrada cuando RegDoc guardó el documento.
function importarDesdeRGDOC(){
  const acto = _rgdocPendingPayload || (function(){ try{ return JSON.parse(localStorage.getItem('rgdoc_to_gantt')); }catch(e){ return null; } })();
  if(!acto || !acto.fecha) return;

  // Deduplicación por nonce — solo una pestaña procesa cada envío
  if(acto.nonce){
    const done = localStorage.getItem('rgdoc_nonce_done');
    if(done === String(acto.nonce)){ _rgdocPendingPayload = null; return; }
    localStorage.setItem('rgdoc_nonce_done', String(acto.nonce));
  }

  // Consumir payload de inmediato
  _rgdocPendingPayload = null;
  localStorage.removeItem('rgdoc_to_gantt');

  // Determinar ref de destino: siempre el usuario indicado en targetUserName
  let targetRef = dbRef;
  let targetUserId = viewingUserId || (currentUser ? currentUser.id : null);
  if(acto.targetUserName && currentUser){
    const tu = usuariosCache.find(u =>
      u.nombre.toUpperCase().trim() === acto.targetUserName.toUpperCase().trim()
    );
    if(tu){
      targetRef = db.ref('gantt_maah/actividades_por_usuario/'+tu.id);
      targetUserId = tu.id;
      // Auto-cambiar vista si no estamos ahí
      if(viewingUserId !== tu.id) adminVerGanttDeUsuario(tu.id, tu.nombre);
    }
  }
  if(!targetRef) return;

  const rgdocKey = acto.rgdocNumero || '';
  const actNorm  = (acto.act||'').toUpperCase().trim();
  const f = new Date(acto.fecha+'T12:00:00');
  if(isNaN(f.getTime())) return;
  f.setHours(0,0,0,0);

  targetRef.once('value', snap=>{
    const data = snap.val() || {};
    const entries = Object.entries(data);

    // Buscar actividad existente por rgdocNumero
    const existingEntry = entries.find(([,a]) => a.fromRGDOC && rgdocKey && String(a.rgdocNumero) === rgdocKey);

    if(acto.update && existingEntry){
      // Actualización silenciosa: solo sobreescribir act, obs y fecha
      const [existingId, existingAct] = existingEntry;
      const updated = { ...existingAct, act: actNorm, obs: (acto.obs||'').toUpperCase().trim(), fecha: f.toISOString() };
      targetRef.child(String(existingId)).set(updated);
      // Actualizar en memoria si estamos viendo esa Gantt
      if(viewingUserId === targetUserId || (!viewingUserId && currentUser && currentUser.id === targetUserId)){
        const idx = acts.findIndex(a => String(a.id) === String(existingId));
        if(idx !== -1){ acts[idx] = {...updated, fecha: f}; acts.sort((a,b)=>a.fecha-b.fecha); render(); }
      }
      return;
    }

    if(existingEntry){ console.log('[RGDOC] Ya existe en destino, omitiendo.'); return; }

    // Actividad nueva
    const uidBase = 'rgdoc_' + (rgdocKey || actNorm.replace(/[^A-Z0-9]/g,'').slice(0,20)) + '_' + acto.fecha;
    const newAct = {
      id: uidBase, act: actNorm, obs: (acto.obs||'').toUpperCase().trim(),
      fecha: f, type: acto.type || 'plazo', freq: 'puntual',
      priori: true, fromRGDOC: true, rgdocNumero: rgdocKey
    };
    targetRef.child(String(uidBase)).set({...newAct, fecha: f.toISOString(), fechaInicio: null});
    if(viewingUserId === targetUserId || (!viewingUserId && currentUser && currentUser.id === targetUserId)){
      acts.push(newAct);
      acts.sort((a,b)=>a.fecha-b.fecha);
      const mesStr = f.getFullYear()+'-'+(f.getMonth()+1);
      const sel = document.getElementById('month-select');
      if(sel){ sel.value = mesStr; sel.dispatchEvent(new Event('change')); }
      rebuildMonthSelect(); rebuildWeekSelect(); render();
    }
    var t=document.createElement('div');
    t.textContent='📥 Actividad recibida en Gantt CG OCGR';
    t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a3f6f;color:#fff;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:700;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,.3);';
    document.body.appendChild(t);
    setTimeout(function(){t.remove();},6000);
  }); // fin targetRef.once
}


function debugRGDOC(){
  const raw = localStorage.getItem('rgdoc_to_gantt');
  if(!raw){
    alert('❌ No hay payload en localStorage.\n\nmyDbRef: '+(myDbRef?'OK':'NULL')+'\ndbRef: '+(dbRef?'OK':'NULL')+'\n\nSi myDbRef es NULL: recarga la Gantt (Ctrl+Shift+R) y vuelve a intentar.');
    return;
  }
  try{
    const acto = JSON.parse(raw);
    if(confirm('✅ Payload encontrado:\n\nActividad: '+acto.act+'\nPlazo: '+acto.fecha+'\nObs: '+acto.obs+'\n\n¿Importar ahora?')){
      importarDesdeRGDOC();
    }
  }catch(e){ alert('Error leyendo payload: '+e.message); }
}
// Payload desde URL hash — guardado en memoria (no localStorage)
let _rgdocPendingPayload = null;
(function(){
  try{
    const hash = window.location.hash
    if(!hash.startsWith('#rgdoc=')) return
    _rgdocPendingPayload = JSON.parse(decodeURIComponent(escape(atob(hash.slice(7)))))
    history.replaceState(null,'',window.location.pathname)
  }catch(e){}
})()
const RGDOC_ALLOWED_MESSAGE_ORIGINS = ['https://maah1996.github.io'];
function rgdocIsLocalOrigin(origin){
  try{
    const u = new URL(origin);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1';
  }catch(e){ return false; }
}
function rgdocMessageOriginAllowed(origin){
  if(!origin || origin === 'null') return false;
  if(origin === window.location.origin) return true;
  if(RGDOC_ALLOWED_MESSAGE_ORIGINS.includes(origin)) return true;
  return rgdocIsLocalOrigin(origin) && rgdocIsLocalOrigin(window.location.origin);
}
function rgdocPayloadValido(type, payload){
  if(!payload || typeof payload !== 'object') return false;
  if(type === 'rgdoc_new_user') return !!payload.nombre;
  if(type === 'rgdoc_import') return !!payload.fecha && !!payload.act;
  return false;
}

// Escucha cambios de localStorage desde RegDoc (para pestañas ya abiertas)
window.addEventListener('storage', function(e){
  if(e.key === 'rgdoc_to_gantt' && e.newValue) importarDesdeRGDOC();
  if(e.key === 'rgdoc_new_user' && e.newValue) crearUsuarioDesdeRGDOC();
});
window.addEventListener('message', function(e){
  if(!rgdocMessageOriginAllowed(e.origin)){
    console.warn('[RGDOC] Mensaje rechazado por origen no permitido:', e.origin);
    return;
  }
  const msg = e.data || {};
  if(!rgdocPayloadValido(msg.type, msg.payload)) return;
  if(msg.type === 'rgdoc_new_user'){
    localStorage.setItem('rgdoc_new_user', JSON.stringify(msg.payload));
    crearUsuarioDesdeRGDOC();
  }
  if(msg.type === 'rgdoc_import'){
    localStorage.setItem('rgdoc_to_gantt', JSON.stringify(msg.payload));
    importarDesdeRGDOC();
  }
});

// Crea (si no existe todavía) una cuenta de Gantt completa: Firebase Auth
// real + maah_usuarios + maah_auth_index + maah_login_index. Debe llamarse
// con una sesión de admin ya autenticada (es la única con permiso para
// escribir estos nodos). La usan tanto la señal en vivo desde RGDOC
// (crearUsuarioDesdeRGDOC) como el drenado de la cola de pendientes
// (procesarColaUsuariosPendientes).
async function provisionarUsuarioGantt(nombreCrudo, clave, rolCrudo){
  const nombre = (nombreCrudo||'').toUpperCase().trim();
  if(!nombre) return false;
  const key = loginIndexKey(nombre);
  const yaExisteSnap = await db.ref('maah_login_index/'+key).once('value');
  if(yaExisteSnap.exists()){
    console.log('[RGDOC] Usuario ya provisionado en Gantt:', nombre);
    return true;
  }
  const rol = (rolCrudo === 'admin' || rolCrudo === 'administrador') ? 'admin' : 'user';
  const claveInicial = clave || '1234';

  // Mismo criterio de ID legible que usa el panel "+ Nuevo Usuario" de la Gantt
  let userId = nombre.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Z0-9]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');
  let base = userId, suf = 2;
  while((await db.ref('maah_usuarios/'+userId).once('value')).exists()){ userId = base+'_'+suf; suf++; }

  const synEmail = authEmailFromUserId(userId);
  const fbPass = authPasswordFromClave(claveInicial);
  let authUid = null;
  try{
    const sec = firebase.initializeApp(firebase.app().options, 'rgdoc_prov_'+Date.now());
    const secAuth = sec.auth();
    await secAuth.createUserWithEmailAndPassword(synEmail, fbPass);
    authUid = secAuth.currentUser.uid;
    await sec.delete();
  }catch(e){
    console.warn('[RGDOC] No se pudo crear Auth para usuario nuevo:', nombre, e);
    return false;
  }
  await db.ref('maah_usuarios/'+userId).set({ nombre, rol, authUid, permisos:{gantt:true} });
  await db.ref('maah_auth_index/'+authUid).set(userId);
  await db.ref('maah_login_index/'+key).set(userId);
  if(typeof usuariosCache !== 'undefined' && Array.isArray(usuariosCache)){
    usuariosCache.push({ id:userId, nombre, rol, authUid, email:'' });
    usuariosCache.sort((a,b)=>a.nombre.localeCompare(b.nombre));
  }
  console.log('[RGDOC] Usuario provisionado en Gantt:', nombre);
  return true;
}

// Crear usuario en Gantt cuando RegDoc crea uno nuevo — vía señal en vivo
// (localStorage/postMessage), solo funciona si la pestaña Gantt ya estaba
// abierta con sesión de admin. Ver también procesarColaUsuariosPendientes.
function crearUsuarioDesdeRGDOC(){
  try{
    const raw = localStorage.getItem('rgdoc_new_user');
    if(!raw) return;
    localStorage.removeItem('rgdoc_new_user');
    const data = JSON.parse(raw);
    if(!data || !data.nombre) return;
    provisionarUsuarioGantt(data.nombre, data.pass, data.rol);
  }catch(e){ console.error('[RGDOC] Error creando usuario en Gantt:', e); }
}

// Drena la cola de solicitudes de usuario que RGDOC dejó pendientes (no
// pudo crearlas directamente porque su sesión es anónima y las reglas de
// seguridad solo permiten crear cuentas a un admin autenticado de verdad).
// Se llama automáticamente cada vez que un admin inicia sesión en la Gantt.
async function procesarColaUsuariosPendientes(){
  if(!currentUser || currentUser.rol !== 'admin') return;
  try{
    const snap = await db.ref('maah_pending_gantt_users').once('value');
    const pendientes = snap.val();
    if(!pendientes) return;
    let procesados = 0;
    for(const [reqId, req] of Object.entries(pendientes)){
      try{
        await provisionarUsuarioGantt(req.nombre, req.pass, req.rol);
        await db.ref('maah_pending_gantt_users/'+reqId).remove();
        procesados++;
      }catch(e){
        console.warn('[RGDOC] Error procesando solicitud pendiente:', req, e);
      }
    }
    if(procesados){
      console.log('[RGDOC] Usuarios pendientes provisionados desde RGDOC:', procesados);
      if(typeof buildAdminUserChips === 'function') buildAdminUserChips();
      const panel = document.getElementById('user-mgmt-overlay');
      if(panel && panel.style.display === 'flex' && typeof renderUserMgmtList === 'function') renderUserMgmtList();
    }
  }catch(e){ console.warn('[RGDOC] Error leyendo cola de usuarios pendientes:', e); }
}

// ─────────────────────────────────────────────────────────────


function aplicarHintLoginDesdeTicket(u){
  const input = document.getElementById('login-usuario-txt');
  if(input && u && u.nombre) input.value = u.nombre;
  const errBox = document.getElementById('login-error');
  if(errBox){
    errBox.textContent = 'Confirma tu clave para abrir la Gantt con sesión Firebase.';
    errBox.style.display = 'block';
  }
}

function iniciarGanttSiFirebaseCoincide(u){
  const authUser = firebase.auth().currentUser;
  if(!authUser || authUser.isAnonymous || !u || !u.authUid || authUser.uid !== u.authUid){
    aplicarHintLoginDesdeTicket(u);
    return false;
  }
  currentUser = u;
  hideLoginOverlay();
  const btn = document.getElementById('login-btn');
  if(btn){ btn.textContent='Ingresar a mi Gantt'; btn.disabled=false; }
  iniciarGanttDelUsuario();
  return true;
}

function intentarSSOdesdeAgenda(){
  try{
    const raw = localStorage.getItem('maah_session');
    if(!raw) return false;
    const ticket = JSON.parse(raw);
    if(!ticket || !ticket.userId || !ticket.expira) return false;
    if(Date.now() > ticket.expira){ localStorage.removeItem('maah_session'); return false; }
    const u = usuariosCache.find(x => x.id === ticket.userId);
    if(!u) return false;
    return iniciarGanttSiFirebaseCoincide(u);
  }catch(e){ return false; }
}

// SSO desde Registro Documental OCGR — busca nombre en usuariosCache
function intentarSSOdesdeRGDOC(){
  try{
    const raw = localStorage.getItem('rgdoc_session');
    if(!raw) return false;
    const ticket = JSON.parse(raw);
    if(!ticket || !ticket.nombre || !ticket.expira) return false;
    if(Date.now() > ticket.expira){ localStorage.removeItem('rgdoc_session'); return false; }
    const nombre = ticket.nombre.toUpperCase().trim();
    const u = usuariosCache.find(x => (x.nombre||'').toUpperCase().trim() === nombre);
    if(!u) return false;
    return iniciarGanttSiFirebaseCoincide(u);
  }catch(e){ return false; }
}
// ── FIREBASE AUTH ────────────────────────────────────────────


function volverARegDoc(){
  // Si está dentro del iframe de RegDoc, cambiar el tab del padre
  if(window.parent && window.parent !== window && typeof window.parent.mostrarVistaRegDoc === 'function'){
    window.parent.mostrarVistaRegDoc();
  } else {
    // Abierta de forma independiente → navegar normalmente
    window.open('https://maah1996.github.io/registro-documental/', '_blank');
  }
}

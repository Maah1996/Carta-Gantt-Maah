function cargarUsuariosAgenda(){
  if(usuariosCargados || usuariosCargando) return;
  usuariosCargando = true;
  db.ref('maah_usuarios').once('value', snap=>{
    usuariosCargando = false;
    const data=snap.val();
    if(!data){ showLoginOverlay(); return; }
    usuariosCache=Object.entries(data).map(([id,u])=>({
      id,
      nombre:  u.nombre||id,
      rol:     u.rol||'user',
      email:   u.email||'',
      authUid: u.authUid||''
    })).sort((a,b)=>a.nombre.localeCompare(b.nombre));

    usuariosCargados = true;

    if(pendingAuthUid){
      procesarAuthUser(pendingAuthUid);
      pendingAuthUid = null;
    } else {
      const authUser = firebase.auth().currentUser;
      if(authUser && !authUser.isAnonymous){
        // ya hay sesión Firebase activa
      } else {
        // Intentar SSO desde la Agenda MAAH o desde Registro Documental
        const ssoOk = intentarSSOdesdeAgenda() || intentarSSOdesdeRGDOC();
        if(!ssoOk) showLoginOverlay();
      }
    }
  }, err=>{
    usuariosCargando = false;
    console.error('Error cargando usuarios:', err);
    const errBox=document.getElementById('login-error');
    errBox.textContent='No se pudo cargar usuarios. Verifica tu conexión y recarga la página.';
    errBox.style.display='block';
    showLoginOverlay();
  });
}


function initAuth(){
  firebase.auth().onAuthStateChanged(authUser=>{
    if(authUser && authUser.isAnonymous){
      // Sesión anónima (compartida con RegDoc): solo sirve para poder leer
      // maah_usuarios — las reglas exigen auth != null. No es un perfil:
      // no se procesa ni se cierra, y se muestra el login normal.
      cargarUsuariosAgenda();
      if(usuariosCargados && !currentUser) showLoginOverlay();
      return;
    }
    if(authUser){
      // Usuario autenticado: recuperar perfil del cache
      if(usuariosCargados){
        procesarAuthUser(authUser.uid);
      } else {
        // Cache aún cargando — guardar uid para cuando termine
        pendingAuthUid = authUser.uid;
        cargarUsuariosAgenda();
      }
    } else {
      // Sin sesión: entrar de forma anónima para poder leer la lista de
      // usuarios (las reglas de la DB exigen autenticación para leer).
      firebase.auth().signInAnonymously().catch(e=>{
        console.error('[Auth] Error en sesión anónima:', e);
        const errBox=document.getElementById('login-error');
        if(errBox){ errBox.textContent='No se pudo conectar al servidor. Recarga la página.'; errBox.style.display='block'; }
        showLoginOverlay();
      });
      // Mostrar login (solo si la app ya estaba cargada)
      if(usuariosCargados && !currentUser){
        showLoginOverlay();
      }
    }
  });
}

function procesarAuthUser(authUid){
  // 1. Buscar por authUid guardado (usuarios ya migrados)
  let u = usuariosCache.find(x => x.authUid === authUid);

  // 2. Si no, derivar userId desde el email sintético (primer login)
  if(!u){
    const firebaseUser = firebase.auth().currentUser;
    if(firebaseUser && firebaseUser.email && firebaseUser.email.endsWith('@maah.app')){
      const derivedId = firebaseUser.email.split('@')[0];
      u = usuariosCache.find(x => x.id.toLowerCase() === derivedId);
      if(u){
        // Guardar authUid en DB para futuras sesiones (lookup rápido)
        db.ref('maah_usuarios/'+u.id+'/authUid').set(authUid);
        u.authUid = authUid;
      }
    }
  }

  if(!u){
    console.warn('[Auth] UID sin perfil en maah_usuarios:', authUid);
    firebase.auth().signOut();
    return;
  }
  // Todos los usuarios pueden entrar; el rol determina qué ven (admin = completo, resto = solo lectura)
  currentUser = u;
  hideLoginOverlay();
  const btn = document.getElementById('login-btn');
  if(btn){ btn.textContent='Ingresar a mi Gantt'; btn.disabled=false; }
  iniciarGanttDelUsuario();
}

function showLoginOverlay(){
  document.getElementById('login-overlay').style.display='flex';
}
function hideLoginOverlay(){
  document.getElementById('login-overlay').style.display='none';
}

// "Enviar también a la Agenda": existe SOLO en la Gantt propia del administrador.
// Oculto para usuarios normales y también cuando el admin está viendo la Gantt
// de otro usuario (chips / vista por defecto al ingresar).
function actualizarEnviarAgendaVisible(){
  const wrapAgenda = document.getElementById('wrap-enviar-agenda');
  if(!wrapAgenda) return;
  const adminEnSuGantt = currentUser && currentUser.rol === 'admin' && !viewingUserId;
  wrapAgenda.style.display = adminEnSuGantt ? '' : 'none';
  if(!adminEnSuGantt){
    const chk = document.getElementById('f-enviar-agenda');
    if(chk) chk.checked = false;
  }
}

function doLogin(){
  const nombreTxt = (document.getElementById('login-usuario-txt').value||'').trim().toUpperCase();
  const clave   = document.getElementById('login-clave').value.trim();
  const errBox  = document.getElementById('login-error');
  const btn     = document.getElementById('login-btn');
  errBox.style.display = 'none';

  if(!nombreTxt){ errBox.textContent='Ingresa tu nombre de usuario.'; errBox.style.display='block'; return; }
  if(!clave){     errBox.textContent='Ingresa tu clave.';              errBox.style.display='block'; return; }
  if(!usuariosCache.length){
    errBox.textContent='Aún cargando usuarios, intenta en un momento.';
    errBox.style.display='block'; return;
  }

  // Buscar por nombre exacto (sin distinción mayúsculas)
  const u = usuariosCache.find(x=> x.nombre.toUpperCase() === nombreTxt);
  if(!u){ errBox.textContent='Usuario no encontrado. Verifica tu nombre e intenta nuevamente.'; errBox.style.display='block'; return; }
  const userId = u.id;

  // Email sintético — el usuario nunca lo ve
  const syntheticEmail = userId.toLowerCase() + '@maah.app';
  // Sufijo fijo para cumplir mínimo de Firebase (6 chars) sin que el usuario lo sepa
  const fbPass = clave + '@@maah';

  btn.textContent='⏳ Verificando...';
  btn.disabled=true;

  firebase.auth().signInWithEmailAndPassword(syntheticEmail, fbPass)
    .then(()=>{ /* onAuthStateChanged maneja el resto */ })
    .catch(err=>{
      // Primer login: usuario aún no existe en Firebase Auth → verificar clave en DB y auto-registrar
      if(err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential'){
        db.ref('maah_usuarios/'+userId+'/pass').once('value', snap=>{
          const passDB = String(snap.val()||'').trim();
          if(passDB && passDB === clave){
            firebase.auth().createUserWithEmailAndPassword(syntheticEmail, fbPass)
              .then(()=>{ /* onAuthStateChanged maneja el resto */ })
              .catch(createErr=>{
                btn.textContent='Ingresar a mi Gantt'; btn.disabled=false;
                errBox.textContent='Error al activar cuenta ('+createErr.code+'). Contacta al administrador.';
                errBox.style.display='block';
              });
          } else {
            btn.textContent='Ingresar a mi Gantt'; btn.disabled=false;
            document.getElementById('login-clave').value='';
            document.getElementById('login-clave').focus();
            errBox.textContent='Clave incorrecta. Verifica y vuelve a intentar.';
            errBox.style.display='block';
          }
        }, ()=>{
          btn.textContent='Ingresar a mi Gantt'; btn.disabled=false;
          errBox.textContent='Sin conexión. Verifica tu red e intenta nuevamente.';
          errBox.style.display='block';
        });
        return;
      }
      btn.textContent='Ingresar a mi Gantt';
      btn.disabled=false;
      document.getElementById('login-clave').value='';
      document.getElementById('login-clave').focus();
      const msgs={
        'auth/wrong-password':         'Clave incorrecta. Verifica y vuelve a intentar.',
        'auth/too-many-requests':      'Demasiados intentos fallidos. Espera unos minutos.',
        'auth/user-disabled':          'Esta cuenta fue desactivada. Contacta al administrador.',
        'auth/network-request-failed': 'Sin conexión. Verifica tu red e intenta nuevamente.'
      };
      errBox.textContent = msgs[err.code] || 'Error al ingresar ('+err.code+'). Intenta nuevamente.';
      errBox.style.display='block';
    });
}

function doLogout(){
  if(dbRef){ try{ dbRef.off(); }catch(e){} }
  firebase.auth().signOut().finally(()=>{ location.reload(); });
}

// ── RECUPERAR CLAVE (pantalla de login) ──
function mostrarRecuperarClave(e){
  e.preventDefault();
  const msg = document.getElementById('recuperar-clave-msg');
  msg.style.display = msg.style.display === 'none' ? 'block' : 'none';
}

// ── CAMBIAR CLAVE (usuario logueado) ──
function abrirCambiarClave(){
  document.getElementById('cc-actual').value='';
  document.getElementById('cc-nueva').value='';
  document.getElementById('cc-confirma').value='';
  const msg=document.getElementById('cc-msg');
  msg.style.display='none';
  document.getElementById('modal-cambiar-clave').style.display='flex';
  setTimeout(()=>document.getElementById('cc-actual').focus(),100);
}
function cerrarCambiarClave(){
  document.getElementById('modal-cambiar-clave').style.display='none';
}
async function guardarNuevaClave(){
  const actual   = document.getElementById('cc-actual').value.trim();
  const nueva    = document.getElementById('cc-nueva').value.trim();
  const confirma = document.getElementById('cc-confirma').value.trim();
  const msg      = document.getElementById('cc-msg');

  const showMsg=(txt,ok)=>{
    msg.textContent=txt;
    msg.style.cssText='display:block;font-size:11px;border-radius:5px;padding:6px 9px;margin-bottom:10px;text-align:center;'
      +(ok?'background:#f0fff4;border:1px solid #9ae6b4;color:#276749;':'background:#fff5f5;border:1px solid #fc8181;color:#c53030;');
  };

  if(!actual){showMsg('Ingresa tu clave actual.',false);return;}
  if(nueva.length<4){showMsg('La nueva clave debe tener al menos 4 caracteres.',false);return;}
  if(nueva!==confirma){showMsg('Las claves nuevas no coinciden.',false);return;}

  // Verificar clave actual contra Firebase DB
  const snap = await db.ref('maah_usuarios/'+currentUser.id+'/pass').once('value');
  const passDB = String(snap.val()||'').trim();
  if(passDB !== actual){showMsg('La clave actual es incorrecta.',false);return;}

  // Actualizar en Firebase DB
  await db.ref('maah_usuarios/'+currentUser.id+'/pass').set(nueva);
  // Actualizar en Firebase Auth
  const fbPass = nueva+'@@maah';
  try{ await firebase.auth().currentUser.updatePassword(fbPass); }catch(e){}

  showMsg('✅ Clave actualizada correctamente.',true);
  setTimeout(()=>cerrarCambiarClave(),1500);
}

// ── RESETEAR CLAVE (solo admin, desde panel de usuarios) ──
async function resetearClaveUsuario(userId, nombre){
  const nuevaClave = prompt('Nueva clave para '+nombre+' (mínimo 4 caracteres):');
  if(!nuevaClave || nuevaClave.trim().length < 4){
    if(nuevaClave !== null) alert('Clave demasiado corta. Mínimo 4 caracteres.');
    return;
  }
  const claveOk = nuevaClave.trim();
  await db.ref('maah_usuarios/'+userId+'/pass').set(claveOk);
  // Intentar actualizar Firebase Auth si el usuario ya activó su cuenta
  const snap = await db.ref('maah_usuarios/'+userId+'/authUid').once('value');
  if(snap.val()){
    // No podemos cambiar la contraseña de otro usuario desde el cliente sin re-autenticación.
    // En el próximo login, la app detectará auth/wrong-password y verificará contra la DB,
    // auto-creando una nueva cuenta Auth con la clave nueva.
    await db.ref('maah_usuarios/'+userId+'/authUid').remove();
  }
  alert('✅ Clave de '+nombre+' restablecida. El usuario deberá ingresar con la nueva clave.');
  renderUserMgmtList();
}


// ── FIX 5: CLAVE PARA NUEVA ACTIVIDAD ────────────────────────
let addPwdVerified=false;

function openAddPwdModal(){
  // Si está logueado, saltar el modal de contraseña
  if(currentUser){
    addPwdVerified=true;
    showAddForm();
    return;
  }
  // Si ya está autenticado en esta sesión, no pedir clave de nuevo
  if(addPwdVerified){ showAddForm(); return; }
  document.getElementById('addpwd-input').value='';
  document.getElementById('addpwd-error').style.display='none';
  document.getElementById('modal-addpwd-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('addpwd-input').focus(),100);
}
function closeAddPwdModal(){
  document.getElementById('modal-addpwd-overlay').classList.remove('open');
}
function verifyAddPwd(){
  const v=document.getElementById('addpwd-input').value.trim();
  if(v!==EDIT_PWD){
    document.getElementById('addpwd-error').style.display='block';
    document.getElementById('addpwd-input').value='';
    document.getElementById('addpwd-input').focus();
    return;
  }
  addPwdVerified=true;
  closeAddPwdModal();
  showAddForm();
}
function showAddForm(){
  document.getElementById('add-form-body').style.display='block';
  document.getElementById('add-form-locked').style.display='none';
}

// Fix 3: Bloquear sesión — ocultar formulario y volver al estado bloqueado
function lockSession(){
  addPwdVerified=false;
  document.getElementById('add-form-body').style.display='none';
  document.getElementById('add-form-locked').style.display='block';
  // Limpiar campos por seguridad
  document.getElementById('f-act').value='';
  document.getElementById('f-obs').value='';
  document.getElementById('f-fecha').value='';
  resetPreview();
}


function loginIndexKey(value){
  return String(value||'')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^A-Z0-9]+/g,'_')
    .replace(/^_|_$/g,'')
    .toLowerCase();
}

function perfilUsuarioDesdeFirebase(id,u){
  return {
    id,
    nombre:  (u&&u.nombre)||id,
    rol:     (u&&u.rol)||'user',
    email:   (u&&u.email)||'',
    authUid: (u&&u.authUid)||'',
    permisos:(u&&u.permisos)||{},
    // Autorizado por el admin (desde RGDOC, permiso "ver todo") a ver la
    // Carta Gantt OCGR compartida en vez de su propia Gantt personal.
    verOCGR: !!(u && u.verOCGR)
  };
}

async function buscarUsuarioParaLogin(nombreTxt){
  const exact = usuariosCache.find(x=>x.nombre.toUpperCase() === nombreTxt.toUpperCase());
  if(exact) return exact;
  const key = loginIndexKey(nombreTxt);
  const snap = await db.ref('maah_login_index/'+key).once('value');
  const userId = snap.val();
  if(!userId) return null;
  return {id:String(userId), nombre:nombreTxt.toUpperCase(), rol:'user', email:'', authUid:''};
}

async function cargarUsuariosAutenticados(authUid){
  const authUser = firebase.auth().currentUser;
  let userId = null;
  const idxSnap = await db.ref('maah_auth_index/'+authUid).once('value');
  if(idxSnap.exists()) userId = String(idxSnap.val());
  if(!userId && authUser && authUser.email && authUser.email.endsWith('@maah.app')){
    userId = authUser.email.split('@')[0];
  }
  if(!userId) throw new Error('No existe índice de autenticación para este usuario.');

  const profileSnap = await db.ref('maah_usuarios/'+userId).once('value');
  const profileData = profileSnap.val();
  if(!profileData) throw new Error('No existe perfil de usuario para esta sesión.');
  const perfil = perfilUsuarioDesdeFirebase(userId, profileData);

  if(!perfil.authUid){
    perfil.authUid = authUid;
    db.ref('maah_usuarios/'+userId+'/authUid').set(authUid).catch(()=>{});
  }
  await asegurarIndicesUsuario(userId, perfil.nombre, authUid);
  if(perfil.rol === 'admin'){
    const allSnap = await db.ref('maah_usuarios').once('value');
    const data = allSnap.val() || {};
    usuariosCache = Object.entries(data).map(([id,u])=>perfilUsuarioDesdeFirebase(id,u))
      .sort((a,b)=>a.nombre.localeCompare(b.nombre));
  } else {
    usuariosCache = [perfil];
  }
  usuariosCargados = true;
}

async function asegurarIndicesUsuario(userId, nombre, authUid){
  if(!userId || !authUid) return;
  try{
    await db.ref('maah_auth_index/'+authUid).set(userId);
  }catch(e){
    console.warn('[Auth] No se pudo reparar maah_auth_index:', e);
  }
  if(nombre){
    try{
      await db.ref('maah_login_index/'+loginIndexKey(nombre)).set(userId);
    }catch(e){
      console.warn('[Auth] No se pudo reparar maah_login_index:', e);
    }
  }
}

function cargarUsuariosAgenda(){
  if(usuariosCargando) return;
  const authUser = firebase.auth().currentUser;
  if(!authUser || authUser.isAnonymous){
    usuariosCargados = false;
    usuariosCache = [];
    const ssoOk = intentarSSOdesdeAgenda() || intentarSSOdesdeRGDOC();
    if(!ssoOk) showLoginOverlay();
    return;
  }
  usuariosCargando = true;
  cargarUsuariosAutenticados(authUser.uid).then(()=>{
    usuariosCargando = false;
    procesarAuthUser(authUser.uid);
  }).catch(err=>{
    usuariosCargando = false;
    console.error('Error cargando usuario autenticado:', err);
    const errBox=document.getElementById('login-error');
    if(errBox){
      errBox.textContent='No se pudo cargar tu perfil Firebase. Verifica tu conexión y recarga la página.';
      errBox.style.display='block';
    }
    showLoginOverlay();
  });
}

function initAuth(){
  firebase.auth().onAuthStateChanged(authUser=>{
    if(authUser && !authUser.isAnonymous){
      cargarUsuariosAgenda();
      return;
    }
    usuariosCargados = false;
    usuariosCache = [];
    showLoginOverlay();
  });
}

function procesarAuthUser(authUid){
  let u = usuariosCache.find(x => x.authUid === authUid);
  if(!u){
    const firebaseUser = firebase.auth().currentUser;
    if(firebaseUser && firebaseUser.email && firebaseUser.email.endsWith('@maah.app')){
      const derivedId = firebaseUser.email.split('@')[0];
      u = usuariosCache.find(x => x.id.toLowerCase() === derivedId.toLowerCase());
    }
  }

  if(!u){
    console.warn('[Auth] UID sin perfil en maah_usuarios:', authUid);
    firebase.auth().signOut();
    return;
  }
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

function authEmailFromUserId(userId){
  return String(userId||'').toLowerCase() + '@maah.app';
}

function authPasswordFromClave(clave){
  return String(clave||'') + '@@maah';
}

async function hashClaveUsuario(userId, clave){
  if(!window.crypto || !window.crypto.subtle){
    throw new Error('Este navegador no permite proteger claves con hash. Abre la app por HTTPS.');
  }
  const raw = 'gantt-maah-v1|' + String(userId||'').toLowerCase() + '|' + String(clave||'');
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function guardarClaveMigracion(userId, clave){
  const passHash = await hashClaveUsuario(userId, clave);
  return db.ref('maah_usuarios/'+userId).update({
    passHash,
    passVersion: 'sha256-v1'
  });
}

async function limpiarClaveLegacy(userId){
  // No elimina datos ingresados; la limpieza definitiva se hará cuando el admin lo autorice.
  return Promise.resolve();
}

async function claveLegacyValida(userId, clave, userData){
  const passDB = String((userData&&userData.pass)||'').trim();
  if(passDB && passDB === clave){
    await guardarClaveMigracion(userId, clave).catch(e=>console.warn('[Auth] No se pudo migrar clave legacy:', e));
    return true;
  }
  const passHash = String((userData&&userData.passHash)||'').trim();
  if(passHash){
    const actualHash = await hashClaveUsuario(userId, clave);
    return actualHash === passHash;
  }
  return false;
}


async function doLogin(){
  const nombreTxt = (document.getElementById('login-usuario-txt').value||'').trim().toUpperCase();
  const clave   = document.getElementById('login-clave').value.trim();
  const errBox  = document.getElementById('login-error');
  const btn     = document.getElementById('login-btn');
  errBox.style.display = 'none';

  if(!nombreTxt){ errBox.textContent='Ingresa tu nombre de usuario.'; errBox.style.display='block'; return; }
  if(!clave){     errBox.textContent='Ingresa tu clave.';              errBox.style.display='block'; return; }
  let u = null;
  try{
    u = await buscarUsuarioParaLogin(nombreTxt);
  }catch(e){
    errBox.textContent='No se pudo consultar el índice de usuarios. Verifica tu conexión.';
    errBox.style.display='block'; return;
  }
  if(!u){ errBox.textContent='Usuario no encontrado. Verifica tu nombre e intenta nuevamente.'; errBox.style.display='block'; return; }
  const userId = u.id;

  // Email sintético — el usuario nunca lo ve
  const syntheticEmail = authEmailFromUserId(userId);
  // Sufijo fijo para cumplir mínimo de Firebase (6 chars) sin que el usuario lo sepa
  const fbPass = authPasswordFromClave(clave);

  btn.textContent='⏳ Verificando...';
  btn.disabled=true;

  firebase.auth().signInWithEmailAndPassword(syntheticEmail, fbPass)
    .then(async cred=>{
      if(cred && cred.user){
        await db.ref('maah_usuarios/'+userId+'/authUid').set(cred.user.uid).catch(()=>{});
        await asegurarIndicesUsuario(userId, u.nombre||nombreTxt, cred.user.uid);
        limpiarClaveLegacy(userId);
      }
      /* onAuthStateChanged maneja el resto */
    })
    .catch(async err=>{
      // Primer login: usuario aun no existe en Firebase Auth -> verificar clave legacy y auto-registrar
      if(err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'){
        try{
          const snap = await db.ref('maah_usuarios/'+userId).once('value');
          const userData = snap.val() || {};
          const okLegacy = await claveLegacyValida(userId, clave, userData);
          if(okLegacy){
            if(!userData.authUid){
              try{
                const cred = await firebase.auth().createUserWithEmailAndPassword(syntheticEmail, fbPass);
                if(cred && cred.user){
                  await db.ref('maah_usuarios/'+userId+'/authUid').set(cred.user.uid);
                  await asegurarIndicesUsuario(userId, u.nombre||nombreTxt, cred.user.uid);
                  u.authUid = cred.user.uid;
                  await limpiarClaveLegacy(userId);
                }
                return;
              }catch(createErr){
                if(createErr.code !== 'auth/email-already-in-use'){
                  btn.textContent='Ingresar a mi Gantt'; btn.disabled=false;
                  errBox.textContent='Error al activar cuenta ('+createErr.code+'). Contacta al administrador.';
                  errBox.style.display='block';
                  return;
                }
              }
            }
            btn.textContent='Ingresar a mi Gantt'; btn.disabled=false;
            errBox.textContent='La clave temporal no coincide con Firebase Auth. Pide al administrador actualizar la clave Firebase.';
            errBox.style.display='block';
            return;
          }
          btn.textContent='Ingresar a mi Gantt'; btn.disabled=false;
          document.getElementById('login-clave').value='';
          document.getElementById('login-clave').focus();
          errBox.textContent='Clave incorrecta. Verifica y vuelve a intentar.';
          errBox.style.display='block';
        }catch(e){
          btn.textContent='Ingresar a mi Gantt'; btn.disabled=false;
          errBox.textContent='Sin conexión. Verifica tu red e intenta nuevamente.';
          errBox.style.display='block';
        }
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

  const fbUser = firebase.auth().currentUser;
  const synEmail = authEmailFromUserId(currentUser.id);
  const esSesionFirebaseReal = fbUser && !fbUser.isAnonymous && fbUser.email === synEmail;

  if(esSesionFirebaseReal){
    try{
      const cred = firebase.auth.EmailAuthProvider.credential(synEmail, authPasswordFromClave(actual));
      await fbUser.reauthenticateWithCredential(cred);
      await fbUser.updatePassword(authPasswordFromClave(nueva));
      await limpiarClaveLegacy(currentUser.id);
    }catch(e){
      showMsg('La clave actual es incorrecta o la sesión expiró.',false);
      return;
    }
  } else {
    const snap = await db.ref('maah_usuarios/'+currentUser.id).once('value');
    const okLegacy = await claveLegacyValida(currentUser.id, actual, snap.val()||{});
    if(!okLegacy){showMsg('La clave actual es incorrecta.',false);return;}
    await guardarClaveMigracion(currentUser.id, nueva);
  }
  showMsg('✅ Clave actualizada correctamente.',true);
  setTimeout(()=>cerrarCambiarClave(),1500);
}

// ── RESETEAR CLAVE (solo admin, desde panel de usuarios) ──
async function resetearClaveUsuario(userId,nombre){
  if(!currentUser || currentUser.rol!=='admin') return;
  const nuevaClave = prompt('Nueva clave para '+nombre+' (mínimo 4 caracteres):');
  if(nuevaClave===null) return;
  if(nuevaClave.trim().length<4){alert('La clave debe tener al menos 4 caracteres.');return;}
  const claveOk = nuevaClave.trim();
  await guardarClaveMigracion(userId, claveOk);
  alert('Clave temporal guardada como hash. Si el usuario ya tiene Firebase Auth activo, no se borró su authUid ni sus datos.');
}
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


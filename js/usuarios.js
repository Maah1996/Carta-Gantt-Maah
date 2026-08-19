// ── PANEL GESTIÓN DE USUARIOS ─────────────────────────────────
function openUserMgmtPanel(){
  if(!currentUser || currentUser.rol !== 'admin') return;
  document.getElementById('user-mgmt-overlay').style.display='flex';
  renderUserMgmtList();
}
function closeUserMgmtPanel(){
  document.getElementById('user-mgmt-overlay').style.display='none';
}

function renderUserMgmtList(){
  document.getElementById('um-title').textContent='⚙️ Gestión de Usuarios';
  let html='<button class="um-new-btn" onclick="openNewUserForm()">+ Nuevo Usuario</button>';
  usuariosCache.forEach(u=>{
    const rolBadge = u.rol==='admin'
      ? '<span class="um-user-rol um-rol-admin">Admin</span>'
      : '<span class="um-user-rol um-rol-user">Usuario</span>';
    const authSt = u.authUid ? '● Activo' : '○ Sin activar';
    const delBtn = u.id!==currentUser.id
      ? '<button class="um-btn um-btn-del" onclick="deleteUserFromSystem('+jsArgAttr(u.id)+','+jsArgAttr(u.nombre)+')" >Eliminar</button>'
      : '';
    html+='<div class="um-user-row">'
      +'<div class="um-user-name">'+escapeHtml(u.nombre)+'</div>'
      +rolBadge
      +'<span class="um-user-auth">'+authSt+'</span>'
      +'<button class="um-btn um-btn-edit" onclick="openEditUserForm('+jsArgAttr(u.id)+')">Editar</button>'
      +'<button class="um-btn" style="background:#e8f0fb;color:#1a3f6f;border:1px solid #bee3f8;" onclick="resetearClaveUsuario('+jsArgAttr(u.id)+','+jsArgAttr(u.nombre)+')" title="Restablecer clave">🔑 Clave</button>'
      +delBtn
      +'</div>';
  });
  document.getElementById('um-body').innerHTML=html;
}

function openNewUserForm(){
  document.getElementById('um-title').textContent='+ Nuevo Usuario';
  document.getElementById('um-body').innerHTML=
    '<div class="um-form-title">Crear nuevo usuario</div>'
    +'<div class="um-form-group"><label>Nombre</label><input id="um-nombre" type="text" placeholder="Ej: GOMEZ JUAN" autocomplete="off"></div>'
    +'<div class="um-form-group"><label>Clave</label><input id="um-clave" type="password" placeholder="Mínimo 4 caracteres" autocomplete="new-password"></div>'
    +'<div class="um-form-group"><label>Rol</label><select id="um-rol"><option value="user">Usuario</option><option value="admin">Admin</option></select></div>'
    +'<div id="um-msg"></div>'
    +'<div class="um-actions"><button class="um-save-btn" onclick="saveNewUser()">Crear Usuario</button><button class="um-cancel-btn" onclick="renderUserMgmtList()">Cancelar</button></div>';
}

function openEditUserForm(userId){
  const u=usuariosCache.find(x=>x.id===userId);
  if(!u) return;
  document.getElementById('um-title').textContent='Editar: '+u.nombre;
  document.getElementById('um-body').innerHTML=
    '<div class="um-form-title">Editar usuario</div>'
    +'<div class="um-form-group"><label>Nombre</label><input id="um-nombre" type="text" value="'+escapeAttr(u.nombre)+'" autocomplete="off"></div>'
    +'<div class="um-form-group"><label>Nueva clave (vacío = no cambia)</label><input id="um-clave" type="password" placeholder="Nueva clave..." autocomplete="new-password"></div>'
    +'<div class="um-form-group"><label>Rol</label><select id="um-rol"><option value="user"'+(u.rol==='user'?' selected':'')+'>Usuario</option><option value="admin"'+(u.rol==='admin'?' selected':'')+'>Admin</option></select></div>'
    +'<div id="um-msg"></div>'
    +'<div class="um-actions"><button class="um-save-btn" onclick="saveEditUser('+jsArgAttr(userId)+')">Guardar</button><button class="um-cancel-btn" onclick="renderUserMgmtList()">Cancelar</button></div>';
}

async function saveNewUser(){
  const nombre=document.getElementById('um-nombre').value.trim().toUpperCase();
  const clave =document.getElementById('um-clave').value.trim();
  const rol   =document.getElementById('um-rol').value;
  const msg   =document.getElementById('um-msg');
  if(!nombre){msg.innerHTML='<div class="um-error">Ingresa el nombre.</div>';return;}
  if(clave.length<4){msg.innerHTML='<div class="um-error">La clave debe tener al menos 4 caracteres.</div>';return;}

  // Generar ID único desde el nombre
  let userId=nombre.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Z0-9]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');
  let base=userId, suf=2;
  while(usuariosCache.find(u=>u.id===userId)){userId=base+'_'+suf;suf++;}

  msg.innerHTML='<div style="color:#4a5568;font-size:11px;">Creando usuario...</div>';
  const synEmail=userId.toLowerCase()+'@maah.app';
  const fbPass=clave+'@@maah';
  try{
    // Secondary app para no afectar sesión del admin
    const sec=firebase.initializeApp(firebase.app().options,'um_new_'+Date.now());
    const secAuth=sec.auth();
    await secAuth.createUserWithEmailAndPassword(synEmail,fbPass);
    const uid=secAuth.currentUser.uid;
    await sec.delete();

    await db.ref('maah_usuarios/'+userId).set({nombre,rol,authUid:uid,permisos:{gantt:true}});
    await db.ref('maah_auth_index/'+uid).set(userId);
    await db.ref('maah_login_index/'+loginIndexKey(nombre)).set(userId);
    usuariosCache.push({id:userId,nombre,rol,authUid:uid,email:''});
    usuariosCache.sort((a,b)=>a.nombre.localeCompare(b.nombre));

    msg.innerHTML='<div class="um-success">✔ Usuario '+escapeHtml(nombre)+' creado correctamente.</div>';
    setTimeout(()=>renderUserMgmtList(),1200);
  }catch(e){
    if(e.code === 'auth/email-already-in-use'){
      msg.innerHTML='<div class="um-error">Ya existe un registro de acceso con el nombre "'+escapeHtml(nombre)+'" (de una cuenta eliminada antes, cuyo acceso no se pudo borrar). Entra a Firebase Console → Authentication → busca '+escapeHtml(synEmail)+' → Elimínalo, o usa otro nombre.</div>';
    }else{
      msg.innerHTML='<div class="um-error">Error: '+escapeHtml(e.message)+'</div>';
    }
  }
}

async function saveEditUser(userId){
  const u=usuariosCache.find(x=>x.id===userId);
  if(!u) return;
  const nombre=document.getElementById('um-nombre').value.trim().toUpperCase();
  const clave =document.getElementById('um-clave').value.trim();
  const rol   =document.getElementById('um-rol').value;
  const msg   =document.getElementById('um-msg');
  if(!nombre){msg.innerHTML='<div class="um-error">El nombre no puede estar vacío.</div>';return;}
  if(clave && clave.length<4){msg.innerHTML='<div class="um-error">La clave debe tener al menos 4 caracteres.</div>';return;}

  msg.innerHTML='<div style="color:#4a5568;font-size:11px;">Guardando...</div>';
  try{
    const updates={nombre,rol};
    if(clave){
      await guardarClaveMigracion(userId, clave);    }
    await db.ref('maah_usuarios/'+userId).update(updates);
    await db.ref('maah_login_index/'+loginIndexKey(nombre)).set(userId);
    if(u.authUid) await db.ref('maah_auth_index/'+u.authUid).set(userId);
    u.nombre=nombre; u.rol=rol;
    msg.innerHTML='<div class="um-success">✔ Cambios guardados.</div>';
    setTimeout(()=>renderUserMgmtList(),1000);
  }catch(e){
    msg.innerHTML='<div class="um-error">Error: '+escapeHtml(e.message)+'</div>';
  }
}

// Intenta iniciar sesión (en una app secundaria de Firebase, para no tocar
// la sesión del admin) como el usuario a eliminar y auto-borrarse — es la
// única forma de eliminar una cuenta de Firebase Auth desde el cliente (no
// hay backend/Admin SDK en este proyecto). Solo funciona si conseguimos
// adivinar la clave real: el esquema legacy en texto plano si existe, o la
// clave inicial por defecto "1234" para cuentas nuevas que no la cambiaron.
async function _intentarBorrarAuth(userId, candidatas){
  const synEmail = userId.toLowerCase()+'@maah.app';
  for(const candidata of candidatas){
    if(!candidata) continue;
    try{
      const sec=firebase.initializeApp(firebase.app().options,'um_del_'+Date.now()+'_'+Math.random().toString(36).slice(2,6));
      const secAuth=sec.auth();
      await secAuth.signInWithEmailAndPassword(synEmail, candidata+'@@maah');
      await secAuth.currentUser.delete();
      await sec.delete();
      return true;
    }catch(e2){ /* clave incorrecta o cuenta no existe con esa combinación — probar la siguiente */ }
  }
  return false;
}

async function deleteUserFromSystem(userId,userName){
  if(!confirm('¿Eliminar al usuario '+userName+'?\n\nEsta acción eliminará también todas sus actividades Gantt y no se puede deshacer.')) return;
  try{
    const snap=await db.ref('maah_usuarios/'+userId).once('value');
    const userData=snap.val()||{};
    const nombre=String(userData.nombre||userName||'').toUpperCase().trim();
    const authUid=userData.authUid||null;
    const passLegacy=String(userData.pass||'').trim();

    const authBorrado = await _intentarBorrarAuth(userId, [passLegacy, '1234']);

    // Limpiar SIEMPRE los índices, haya podido borrarse la cuenta de Auth o
    // no — sin maah_login_index/maah_auth_index el usuario ya no puede
    // iniciar sesión de ninguna forma, aunque el registro de Firebase
    // Authentication en sí quede huérfano.
    const key = nombre ? loginIndexKey(nombre) : null;
    if(key) await db.ref('maah_login_index/'+key).remove().catch(()=>{});
    if(authUid) await db.ref('maah_auth_index/'+authUid).remove().catch(()=>{});
    await db.ref('maah_usuarios/'+userId).remove();
    await db.ref('gantt_maah/actividades_por_usuario/'+userId).remove();
    const idx=usuariosCache.findIndex(x=>x.id===userId);
    if(idx>=0) usuariosCache.splice(idx,1);
    renderUserMgmtList();

    if(!authBorrado){
      alert('Usuario eliminado — ya no puede iniciar sesión.\n\nNo se pudo determinar su clave para borrar también el registro de acceso (Firebase Authentication), así que quedó un registro huérfano ahí. Es inofensivo, pero si más adelante creas otro usuario con el mismo nombre y da error "email-already-in-use", entra a Firebase Console → Authentication → busca '+userId.toLowerCase()+'@maah.app → Eliminar.');
    }
  }catch(e){
    alert('Error al eliminar: '+e.message);
  }
}

function volverARegDoc(){
  // Si está dentro del iframe de RegDoc, cambiar el tab del padre
  if(window.parent && window.parent !== window && typeof window.parent.mostrarVistaRegDoc === 'function'){
    window.parent.mostrarVistaRegDoc();
  } else {
    // Abierta de forma independiente → navegar normalmente
    window.open('https://maah1996.github.io/registro-documental/', '_blank');
  }
}

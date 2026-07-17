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
    msg.innerHTML='<div class="um-error">Error: '+escapeHtml(e.message)+'</div>';
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
      await guardarClaveMigracion(userId, clave);
      updates.authUid = null;
      u.authUid = '';
    }
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

async function deleteUserFromSystem(userId,userName){
  if(!confirm('¿Eliminar al usuario '+userName+'?\n\nEsta acción eliminará también todas sus actividades Gantt y no se puede deshacer.')) return;
  try{
    const snap=await db.ref('maah_usuarios/'+userId+'/pass').once('value');
    const pass=String(snap.val()||'').trim();
    if(pass){
      const synEmail=userId.toLowerCase()+'@maah.app';
      try{
        const sec=firebase.initializeApp(firebase.app().options,'um_del_'+Date.now());
        const secAuth=sec.auth();
        await secAuth.signInWithEmailAndPassword(synEmail,pass+'@@maah');
        await secAuth.currentUser.delete();
        await sec.delete();
      }catch(e2){/* ignorar si falla limpieza de Auth */}
    }
    await db.ref('maah_usuarios/'+userId).remove();
    await db.ref('gantt_maah/actividades_por_usuario/'+userId).remove();
    const idx=usuariosCache.findIndex(x=>x.id===userId);
    if(idx>=0) usuariosCache.splice(idx,1);
    renderUserMgmtList();
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

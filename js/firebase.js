function initFirebase(){
  if(!FB_CONFIGURED){
    // Sin Firebase: caemos a un modo demo con localStorage genérico
    loadFromLocalStorage();
    showLoginOverlay(); // Aún así pedimos login con un usuario "DEMO"
    return;
  }
  try{
    if(!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
    db = firebase.database();

    db.ref('.info/connected').on('value', snap=>{
      fbOnline = snap.val() === true;
      updateStatusBadge(fbOnline);
    });

    // Iniciar listener de auth ANTES de cargar usuarios.
    // Las reglas de la DB exigen sesión (auth != null), así que la carga de
    // usuarios se dispara desde initAuth cuando ya existe sesión (anónima o real).
    initAuth();
  }catch(e){
    console.error('Firebase init error:', e);
    updateStatusBadge(false);
    loadFromLocalStorage();
  }
}

// Cargar usuarios desde la base de la agenda (usuariosCargando declarado en config.js)

function updateStatusBadge(online){
  const b = document.getElementById('fb-status');
  if(!b) return;
  if(online){
    b.textContent = '● En línea';
    b.style.background = 'rgba(46,125,50,.3)';
    b.style.color = '#a5d6a7';
  } else {
    b.textContent = '● Sin conexión';
    b.style.background = 'rgba(183,28,28,.3)';
    b.style.color = '#ef9a9a';
  }
}

// ── FIREBASE: guardar actividad ───────────────────────────────
function saveActToFB(act){
  if(!dbRef){ saveToLocalStorage(); return; }
  const toSave = {...act, fecha: act.fecha.toISOString()};
  if(act.fechaInicio instanceof Date && !isNaN(act.fechaInicio.getTime())){
    toSave.fechaInicio = act.fechaInicio.toISOString();
  } else {
    toSave.fechaInicio = null;
  }
  dbRef.child(String(act.id)).set(toSave);
  saveToLocalStorage(); // respaldo local también
}

function deleteActFromFB(id){
  if(!dbRef){ saveToLocalStorage(); return; }
  dbRef.child(String(id)).remove();
  saveToLocalStorage();
}

function clearAllFromFB(){
  if(!dbRef){ saveToLocalStorage(); return; }
  dbRef.remove();
  saveToLocalStorage();
}

// ── DATOS POR DEFECTO ──────────────────────────────────────────
// Respaldo SOLO se usa cuando no hay conexión a Firebase ni a localStorage.
const DEFAULT_ACTS=[
  {
    act: 'TALLER PREV. DE RIESGOS Y CONTROL DE EMERGENCIAS',
    obs: '19:15 A 20:45',
    fecha: new Date(2026, 6, 7),
    fechaInicio: new Date(2026, 3, 28),
    type: 'clases',
    freq: 'semanal',
    semanal: true,
    dow: 2,
    id: 1
  },
  {
    act: 'CLASES PREV. DE RIESGOS Y CONTROL DE EMERGENCIAS',
    obs: 'MARTES 20:15 A 21:00',
    fecha: new Date(2026, 11, 29),
    fechaInicio: new Date(2026, 3, 28),
    type: 'clases',
    freq: 'semanal',
    semanal: true,
    dow: 2,
    id: 2
  },
  {
    act: 'ANIVERSARIO · CARABINEROS',
    obs: 'CARABINEROS',
    fecha: new Date(2030, 3, 27),
    fechaInicio: new Date(2026, 3, 27),
    type: 'aniversario',
    freq: 'anual',
    anual: true,
    dia: 27,
    mes: 3,
    id: 3
  },
  {
    act: 'REVISIÓN ARCHIVADORES PROCES.',
    obs: 'DEPTO I',
    fecha: new Date(2026, 3, 27),
    type: 'revision',
    freq: 'puntual',
    id: 4
  },
];

// ── LOCALSTORAGE (respaldo) ───────────────────────────────────
const LS_KEY='gantt_maah_acts';
const LS_ID='gantt_maah_nextid';

function saveToLocalStorage(){
  try{
    const data=acts.map(a=>{
      const out = {...a, fecha: a.fecha.toISOString()};
      if(a.fechaInicio instanceof Date && !isNaN(a.fechaInicio.getTime())){
        out.fechaInicio = a.fechaInicio.toISOString();
      }
      return out;
    });
    localStorage.setItem(LS_KEY,JSON.stringify(data));
    localStorage.setItem(LS_ID,String(nextId));
  }catch(e){}
}

function loadFromLocalStorage(){
  try{
    const raw=localStorage.getItem(LS_KEY);
    const nid=localStorage.getItem(LS_ID);
    if(raw){
      const data=JSON.parse(raw);
      acts=data.map(a=>{
        const out = {
          ...a,
          act:(a.act||'').toUpperCase().trim(),
          obs:(a.obs||'').toUpperCase().trim(),
          fecha:new Date(a.fecha)
        };
        if(a.fechaInicio){
          const fi = new Date(a.fechaInicio);
          if(!isNaN(fi.getTime())){
            fi.setHours(0,0,0,0);
            out.fechaInicio = fi;
          }
        }
        return out;
      });
      if(nid) nextId=Number(nid);
    } else {
      acts=[...DEFAULT_ACTS];
    }
  }catch(e){ acts=[...DEFAULT_ACTS]; }
  rebuildMonthSelect();
  render();
}

// Función unificada para compatibilidad
function saveToStorage(){ saveToLocalStorage(); }


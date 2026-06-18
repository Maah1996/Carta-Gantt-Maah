// ── AGREGAR / ELIMINAR ────────────────────────────────────────
function toUpper(str){ return (str||'').toUpperCase().trim(); }

function sincronizarGanttAAgenda(act){
  if(!act||!act.act) return;
  // Solo para actividades puntuales: escribir en la fecha exacta de la agenda
  // Las recurrentes (semanal/mensual/anual) las lee la Agenda automáticamente
  if(act.freq && act.freq!=='puntual') return;
  if(!act.fecha) return;
  var d=act.fecha instanceof Date ? act.fecha : new Date(act.fecha);
  if(isNaN(d.getTime())) return;
  var yr=d.getFullYear();
  var mo=String(d.getMonth()+1).padStart(2,'0');
  var da=String(d.getDate()).padStart(2,'0');
  var fechaKey=yr+'-'+mo+'-'+da;
  var agendaRef=db.ref('maah_agenda/'+currentUser.id+'/' +fechaKey);
  agendaRef.once('value',function(snap){
    var existing=snap.val()?Object.values(snap.val()):[];
    var newEntry={hora:'08:00',act:(act.act||'').toUpperCase().trim(),obs:(act.obs||'').toUpperCase().trim()};
    if(act.priori) newEntry.priori=true;
    existing.push(newEntry);
    existing.sort(function(a,b){return a.hora.localeCompare(b.hora);});
    var obj=existing.reduce(function(o,a,i){o[i]=a;return o;},{});
    agendaRef.set(obj);
  });
}

function addActivity(){
  const act=toUpper(document.getElementById('f-act').value);
  const obs=toUpper(document.getElementById('f-obs').value);
  const fv=document.getElementById('f-fecha').value;
  const fiv=document.getElementById('f-inicio').value;
  if(!act||!fv){alert('Complete la descripción y la fecha de término.');return;}
  if(cFreq==='rango' && !fiv){alert('Para "Desde / Hasta" debes ingresar la fecha de inicio.');return;}
  const [yr,mo,da]=fv.split('-').map(Number);
  const fecha=new Date(yr,mo-1,da);

  // Fecha de inicio — aplica a cualquier frecuencia si se ingresó
  let fechaInicio = null;
  const esRecurrente = (cFreq==='semanal'||cFreq==='mensual'||cFreq==='anual');
  if(fiv){
    const [yri,moi,dai]=fiv.split('-').map(Number);
    fechaInicio = new Date(yri,moi-1,dai);
    fechaInicio.setHours(0,0,0,0);
  } else if(esRecurrente){
    fechaInicio = new Date(TODAY);
    fechaInicio.setHours(0,0,0,0);
  }

  const chkPriori=document.getElementById('f-priori');
  const esPriori=chkPriori && chkPriori.checked;
  const newAct={act,obs,fecha,type:cType,id:nextId++};
  if(esPriori) newAct.priori=true;
  if(fechaInicio) newAct.fechaInicio = fechaInicio;
  aplicarFrecuenciaACto(newAct, cFreq, fecha);
  // Override DOW/DIA desde selectores explícitos
  if(cFreq==='semanal'){
    const ds=document.getElementById('f-dow-sel');
    if(ds) newAct.dow=Number(ds.value);
  } else if(cFreq==='mensual'){
    const ds=document.getElementById('f-dia-sel');
    if(ds) newAct.dia=Number(ds.value);
  } else if(cFreq==='rango'){
    newAct.freq='rango'; // guardamos explícitamente para detectarlo al editar
  }
  acts.push(newAct);
  acts.sort((a,b)=>a.fecha-b.fecha);
  document.getElementById('f-act').value='';
  document.getElementById('f-obs').value='';
  document.getElementById('f-fecha').value='';
  document.getElementById('f-inicio').value='';
  if(chkPriori) chkPriori.checked=false;
  resetPreview();
  saveActToFB(newAct);
  // Sincronizar a Agenda si está marcado
  const chkAgenda=document.getElementById('f-enviar-agenda');
  if(chkAgenda && chkAgenda.checked && currentUser){
    sincronizarGanttAAgenda(newAct);
    chkAgenda.checked=false;
  }
  resetFreqSelector();
  rebuildMonthSelect(); render();
}

// Aplica los campos de recurrencia al objeto act según la frecuencia elegida.
// 'puntual' es el caso normal — no agrega nada.
function aplicarFrecuenciaACto(act, freq, fechaBase){
  // Limpiar metadata previa para que el cambio en una edición sea consistente
  delete act.anual; delete act.mensual; delete act.semanal;
  delete act.dia;   delete act.mes;     delete act.dow;
  delete act.freq;
  if(!freq || freq==='puntual'){
    act.freq='puntual';
    return;
  }
  if(freq==='anual'){
    act.freq='anual';
    act.anual=true;                       // compatibilidad con la lógica previa
    act.dia=fechaBase.getDate();          // 1-31
    act.mes=fechaBase.getMonth();         // 0-11
  } else if(freq==='mensual'){
    act.freq='mensual';
    act.mensual=true;
    act.dia=fechaBase.getDate();          // 1-31
  } else if(freq==='semanal'){
    act.freq='semanal';
    act.semanal=true;
    act.dow=fechaBase.getDay();           // 0=dom..6=sáb
  } else if(freq==='rango'){
    act.freq='rango';                     // guardado explícitamente como rango
  }
}

function resetFreqSelector(){
  const sel = document.getElementById('f-freq');
  if(sel) sel.value = 'puntual';
  cFreq='puntual';
  toggleFechaInicioBlock('add','puntual');
  const tsel = document.getElementById('f-tipo');
  if(tsel){ tsel.value = 'revision'; cType = 'revision'; }
}
function delAct(id){
  showModal('¿Eliminar esta actividad de la Carta Gantt?',()=>{
    const orig=acts.find(a=>String(a.id)===String(id));
    acts=acts.filter(a=>String(a.id)!==String(id));
    deleteActFromFB(id);
    // Si era puntual y venía de la Agenda, borrar también de ahí
    if(orig && orig.fromAgenda && orig.agendaFecha && !orig.semanal && !orig.mensual && !orig.anual && currentUser && db){
      var agRef=db.ref('maah_agenda/'+currentUser.id+'/'+orig.agendaFecha);
      agRef.once('value',function(snap){
        var ad=snap.val()||{};
        var hora=orig.agendaHora||'';
        Object.entries(ad).forEach(function([k,v]){
          if(v && v.hora===hora)
            db.ref('maah_agenda/'+currentUser.id+'/'+orig.agendaFecha+'/'+k).remove();
        });
      });
    }
    rebuildMonthSelect(); render();
  });
}
// Eliminar una actividad recurrente (afecta a TODAS las repeticiones)
function confirmDelRecurrente(parentId){
  const orig = acts.find(a=>String(a.id)===String(parentId));
  if(!orig){ alert('No se encontró la actividad. Recarga la página e intenta de nuevo.'); return; }
  const nombre = (orig.act||'').toString();
  const fr = getFrecuencia(orig);
  const tipoFr = fr==='anual' ? 'ANUAL' : (fr==='mensual' ? 'MENSUAL' : 'SEMANAL');
  showModal('¿Eliminar la actividad '+tipoFr+' "'+nombre+'"?\n\nEsto borrará TODAS las repeticiones (pasadas y futuras).',()=>{
    acts = acts.filter(a=>String(a.id)!==String(parentId));
    deleteActFromFB(parentId);
    rebuildMonthSelect(); render();
  });
}
function confirmClear(){
  showModal('¿Limpiar TODAS las actividades?',()=>{
    acts=[];
    currentFilter='all';
    clearAllFromFB();
    if(!FB_CONFIGURED){ rebuildMonthSelect(); render(); }
  });
}

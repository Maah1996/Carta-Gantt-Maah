function abrirModalTipo(tipoValue){
  const esRgdoc = tipoValue === '__rgdoc__';
  const tipo = getAllTipos().find(t=>t.value===tipoValue);
  const label = esRgdoc ? '📋 Reg.Doc' : (tipo ? tipo.label : tipoValue);
  const lista = (esRgdoc ? acts.filter(a=>a.fromRGDOC) : acts.filter(a=>a.type===tipoValue)).sort((a,b)=>a.fecha-b.fecha);
  const hoy = new Date(); hoy.setHours(0,0,0,0);

  document.getElementById('modal-tipo-titulo').textContent = '🏷️ ' + label.toUpperCase();
  document.getElementById('modal-tipo-subtitulo').textContent = lista.length + ' actividad' + (lista.length!==1?'es':'') + ' · ordenadas por fecha de término';
  document.getElementById('modal-tipo-header').dataset.tipo = tipoValue;

  if(!lista.length){
    document.getElementById('modal-tipo-body').innerHTML = '<p style="color:#a0aec0;text-align:center;padding:30px;font-size:13px;">No hay actividades de este tipo.</p>';
    document.getElementById('modal-tipo-overlay').style.display='flex';
    return;
  }

  let html = '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
  html += '<thead><tr style="background:#f1f5f9;">'
    + '<th style="padding:8px 10px;text-align:left;font-size:10px;color:#4a5568;font-weight:700;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Actividad</th>'
    + '<th style="padding:8px 10px;text-align:left;font-size:10px;color:#4a5568;font-weight:700;text-transform:uppercase;border-bottom:2px solid #e2e8f0;width:90px;">OBS</th>'
    + '<th style="padding:8px 10px;text-align:center;font-size:10px;color:#4a5568;font-weight:700;text-transform:uppercase;border-bottom:2px solid #e2e8f0;width:80px;">Término</th>'
    + '<th style="padding:8px 10px;text-align:center;font-size:10px;color:#4a5568;font-weight:700;text-transform:uppercase;border-bottom:2px solid #e2e8f0;width:60px;">Días</th>'
    + '</tr></thead><tbody>';

  lista.forEach((a,idx)=>{
    const diff = diasRest(a.fecha);
    const col = getColor(diff, a.type==='aniversario');
    const dl = dLabel(diff);
    const bg = idx%2===0?'#fff':'#f8fafc';
    // Para rango: mostrar inicio → término
    const esRangoAct = a.fechaInicio instanceof Date && !isNaN(a.fechaInicio.getTime()) && a.fechaInicio < a.fecha;
    const fechaCell = esRangoAct
      ? '<span style="color:#7d3c98;font-size:10px;font-weight:600;">'+fmtDate(a.fechaInicio)+'</span>'
        +'<span style="color:#a0aec0;margin:0 3px;">→</span>'
        +'<span>'+fmtDate(a.fecha)+'</span>'
      : fmtDate(a.fecha);
    html += '<tr style="background:'+bg+';border-bottom:1px solid #edf2f7;">'
      + '<td style="padding:8px 10px;font-weight:600;color:#2d3748;">'+(a.priori?'⚑ ':'')+a.act+'</td>'
      + '<td style="padding:8px 10px;color:#718096;font-size:11px;">'+(a.obs||'—')+'</td>'
      + '<td style="padding:8px 10px;text-align:center;color:#4a5568;font-size:11px;">'+fechaCell+'</td>'
      + '<td style="padding:8px 10px;text-align:center;"><span style="background:'+col.bg+';color:'+col.fg+';border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;">'+dl+'</span></td>'
      + '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('modal-tipo-body').innerHTML = html;
  document.getElementById('modal-tipo-overlay').style.display='flex';
}

function cerrarModalTipo(){
  document.getElementById('modal-tipo-overlay').style.display='none';
}

function imprimirModalTipo(){
  const tipoValue = document.getElementById('modal-tipo-header').dataset.tipo;
  const tipo = getAllTipos().find(t=>t.value===tipoValue);
  const label = tipo ? tipo.label : tipoValue;
  const lista = acts.filter(a=>a.type===tipoValue).sort((a,b)=>a.fecha-b.fecha);
  const hoy = new Date().toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'});
  let rows = lista.map((a,i)=>{
    const diff = diasRest(a.fecha);
    const col = getColor(diff, a.type==='aniversario');
    const dl = dLabel(diff);
    return '<tr style="background:'+(i%2===0?'#fff':'#f8fafc')+';">'
      +'<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;">'+(a.priori?'⚑ ':'')+a.act+'</td>'
      +'<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#718096;">'+(a.obs||'—')+'</td>'
      +'<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">'+fmtDate(a.fecha)+'</td>'
      +'<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;"><span style="background:'+col.bg+';color:'+col.fg+';border-radius:4px;padding:2px 8px;font-weight:700;font-size:11px;">'+dl+'</span></td>'
      +'</tr>';
  }).join('');
  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${label} — Carta Gantt MAAH</title>
  <style>body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:24px;color:#2d3748;}
  h1{font-size:18px;color:#1a3f6f;margin-bottom:4px;}
  .sub{font-size:11px;color:#718096;margin-bottom:16px;}
  table{width:100%;border-collapse:collapse;}
  th{background:#1a3f6f;color:#fff;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;}
  @media print{@page{margin:15mm;}}
  </style></head><body>
  <h1>🏷️ ${label.toUpperCase()}</h1>
  <div class="sub">Carta Gantt MAAH · ${lista.length} actividades · ${hoy}</div>
  <table><thead><tr><th>Actividad</th><th>OBS</th><th style="width:90px;text-align:center;">Término</th><th style="width:70px;text-align:center;">Días</th></tr></thead>
  <tbody>${rows}</tbody></table></body></html>`);
  w.document.close();
  setTimeout(()=>w.print(),400);
}


// ── MENÚ CONTEXTUAL LÁPIZ ─────────────────────────────────────
let ctxActId = null;
let ctxIsRecurrente = false;

function openCtxMenu(event, id, isRecurrente){
  event.stopPropagation();
  ctxActId = id;
  ctxIsRecurrente = isRecurrente;
  const menu = document.getElementById('ctx-menu');
  menu.classList.add('open');
  // Posicionar junto al botón
  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  let top = rect.bottom + 4;
  let left = rect.left - menu.offsetWidth + btn.offsetWidth;
  if(left < 4) left = 4;
  if(top + 120 > window.innerHeight) top = rect.top - 120;
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';
}

function closeCtxMenu(){
  const menu = document.getElementById('ctx-menu');
  if(menu) menu.classList.remove('open');
  // Limpiar id en siguiente tick para que ctxEdit/ctxDel ya lo hayan leído
  setTimeout(()=>{ ctxActId = null; ctxIsRecurrente = false; }, 50);
}

function ctxEdit(){
  const id = ctxActId;
  closeCtxMenu();
  if(id !== null) requestEdit(id);
}

function ctxDel(){
  const id = ctxActId;
  const rec = ctxIsRecurrente;
  closeCtxMenu();
  if(id === null) return;
  if(rec){
    confirmDelRecurrente(id);
  } else {
    delAct(id);
  }
}

// Cerrar menú al hacer clic fuera
document.addEventListener('click', function(e){
  const menu = document.getElementById('ctx-menu');
  if(menu && menu.classList.contains('open') && !menu.contains(e.target)){
    closeCtxMenu();
  }
});


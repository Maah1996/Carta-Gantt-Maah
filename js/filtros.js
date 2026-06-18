function setType(el,type){ cType=type; const s=document.getElementById('f-tipo'); if(s) s.value=type; }
function setFreq(el,freq){ cFreq=freq; const s=document.getElementById('f-freq'); if(s){ s.value=freq; toggleFechaInicioBlock('add',freq); } }
function setEditFreq(el,freq){ editFreq=freq; const s=document.getElementById('edit-freq'); if(s){ s.value=freq; toggleFechaInicioBlock('edit',freq); } }
function previewDias(){
  const v=document.getElementById('f-fecha').value;
  const p=document.getElementById('dias-preview');
  if(!v){resetPreview();updateFreqPreview(cFreq);return;}
  const [yr,mo,da]=v.split('-').map(Number);
  const d=new Date(yr,mo-1,da);
  const diff=diasRest(d);
  const col=getColor(diff,false);
  p.style.background=col.bg; p.style.color=col.fg; p.style.borderColor=col.bg;
  p.className='dias-preview';
  if(diff<0) p.textContent='VENCIDO hace '+Math.abs(diff)+'d';
  else if(diff===0) p.textContent='Vence HOY';
  else p.textContent='Faltan '+diff+' día'+(diff!==1?'s':'')+' para el término';
  updateFreqPreview(cFreq);
}
function resetPreview(){
  const p=document.getElementById('dias-preview');
  p.className='dias-preview prev-neutral';
  p.style.background=''; p.style.color=''; p.style.borderColor='';
  p.textContent='Seleccione una fecha';
}

// ── FILTRO ───────────────────────────────────────────────────
function setFilter(key){
  currentFilter=key;
  document.querySelectorAll('.stat-card').forEach(c=>c.classList.remove('active-filter'));
  const map={all:'stat-total',venc:'stat-venc',rojo:'stat-rojo',naranja:'stat-naranja',amarillo:'stat-amarillo',aniv:'stat-aniv'};
  document.querySelector('.'+map[key])?.classList.add('active-filter');
  document.getElementById('filter-clear-btn').style.display=key==='all'?'none':'inline-block';
  render();
}



// ── FILTRO POR TIPO ───────────────────────────────────────────

function toggleTipoFilterDropdown(e){
  e.stopPropagation();
  const dd = document.getElementById('tipo-filter-dropdown');
  if(!dd) return;
  const allTipos = getAllTipos();
  const counts = {};
  allTipos.forEach(t=>{ counts[t.value] = acts.filter(a=>a.type===t.value).length; });
  const rgdocCnt = acts.filter(a=>a.fromRGDOC).length;
  let html = '<div class="tipo-filter-item'+(currentTipoFilter===null?' active':'')+'" onclick="setTipoFilter(null)">— Todos los tipos</div>';
  allTipos.forEach(t=>{
    const cnt = counts[t.value]||0;
    if(cnt===0) return;
    html += '<div class="tipo-filter-item'+(currentTipoFilter===t.value?' active':'')+'" onclick="setTipoFilter(\''+t.value+'\')">'+t.label+' ('+cnt+')</div>';
  });
  if(rgdocCnt>0){
    html += '<div class="tipo-filter-item'+(currentTipoFilter==='__rgdoc__'?' active':'')+'" onclick="setTipoFilter(\'__rgdoc__\')" style="border-top:1px solid rgba(255,255,255,.1);margin-top:4px;padding-top:6px;">📋 Reg.Doc ('+rgdocCnt+')</div>';
  }
  dd.innerHTML = html;
  const isOpen = dd.classList.toggle('open');
  document.getElementById('stat-tipo-btn').classList.toggle('active', isOpen);
}

function setTipoFilter(tipoValue){
  const dd = document.getElementById('tipo-filter-dropdown');
  if(dd) dd.classList.remove('open');
  if(tipoValue === null){
    currentTipoFilter = null;
    const btn = document.getElementById('stat-tipo-btn');
    if(btn){ btn.classList.remove('active'); btn.innerHTML = '🏷️ POR TIPO <span style="font-size:8px;">▾</span>'; }
    render();
    return;
  }
  // Abrir modal con tabla de actividades del tipo seleccionado (incluye Reg.Doc)
  abrirModalTipo(tipoValue);
}


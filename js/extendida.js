// ── MODO EXTENDIDO (semanas seleccionables, saltables, mes + mes siguiente) ──
// Cuando extendedState.active = true, render() usa el array de días seleccionados.
let extendedState = {
  active: false,
  baseYear: null,
  baseMonth: null,
  selectedWeeks: [],   // array de objetos {ini: Date, fin: Date, label, isExtra}
  diasArr: [],         // array de días resultante (sólo los de las semanas seleccionadas, en orden)
  mode: 'print'
};

// Estado temporal del modal mientras el usuario configura
let extModalCfg = {
  year: null,
  month: null,
  weeks: [],           // array completo de semanas disponibles del mes elegido
  extraWeeks: [],      // array de semanas del mes siguiente
  selected: new Set(), // índices marcados (de weeks + extraWeeks combinados)
  mode: 'print'
};

function openExtendedModal(){
  // Llenar el dropdown de meses con los próximos 12 a partir del mes actual
  const sel = document.getElementById('ext-month');
  sel.innerHTML = '';
  const baseY = TODAY.getFullYear();
  const baseM = TODAY.getMonth();
  for(let i=0; i<12; i++){
    const m = (baseM + i) % 12;
    const y = baseY + Math.floor((baseM + i) / 12);
    const opt = document.createElement('option');
    opt.value = y + '-' + m;
    opt.textContent = MNAMES[m] + ' ' + y + (i===0 ? ' (mes en curso)' : '');
    sel.appendChild(opt);
  }
  extModalCfg.year = baseY;
  extModalCfg.month = baseM;
  extModalCfg.mode = 'print';
  sel.value = baseY + '-' + baseM;
  sel.onchange = ()=>{
    const parts = sel.value.split('-');
    extModalCfg.year = Number(parts[0]);
    extModalCfg.month = Number(parts[1]);
    rebuildExtWeeksList();
  };
  rebuildExtWeeksList();
  setExtMode('print');
  document.getElementById('modal-extended-overlay').style.display = 'flex';
}

function closeExtendedModal(){
  document.getElementById('modal-extended-overlay').style.display = 'none';
}

// Reconstruye el listado de checkboxes según el mes elegido
function rebuildExtWeeksList(){
  const y = extModalCfg.year, m = extModalCfg.month;
  // Semanas del mes elegido (lunes-domingo que tocan el mes)
  const weeksMes = generarSemanasDelMes(y, m);
  // Semanas del mes siguiente (las primeras 4)
  const nextDate = new Date(y, m+1, 1);
  const ny = nextDate.getFullYear(), nm = nextDate.getMonth();
  const weeksSig = generarSemanasDelMes(ny, nm).slice(0, 4);

  extModalCfg.weeks = weeksMes;
  extModalCfg.extraWeeks = weeksSig;
  // Por defecto: marcar mes completo (todas las del mes elegido)
  extModalCfg.selected = new Set();
  for(let i=0; i<weeksMes.length; i++) extModalCfg.selected.add('m'+i);

  const fmt = (d, withMes)=>{
    const M = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return String(d.getDate()).padStart(2,'0') + (withMes ? ' '+M[d.getMonth()] : '');
  };

  let html = '';
  // Master: mes completo
  html += '<div class="ext-wkrow master checked" onclick="toggleExtMaster()" id="ext-master">';
  html += '<div class="ext-cb"></div>';
  html += '<div style="flex:1;">Mes completo (todas las semanas de '+MNAMES[m]+')</div>';
  html += '</div>';
  // Semanas del mes
  weeksMes.forEach((w, i)=>{
    const lab = 'Semana '+(i+1)+' — '+fmt(w.lunes, true)+' al '+fmt(w.domingo, true);
    html += '<div class="ext-wkrow checked" onclick="toggleExtWeek(\'m'+i+'\')" data-key="m'+i+'">';
    html += '<div class="ext-cb"></div>';
    html += '<div style="flex:1;">'+lab+'</div>';
    html += '</div>';
  });
  // Sección semanas siguientes
  if(weeksSig.length){
    html += '<div class="ext-wkrow section">SEMANAS DEL MES SIGUIENTE ('+MNAMES[nm]+' '+ny+')</div>';
    weeksSig.forEach((w, i)=>{
      const lab = MNAMES[nm].substring(0,3)+' - Semana '+(i+1)+' — '+fmt(w.lunes, true)+' al '+fmt(w.domingo, true);
      html += '<div class="ext-wkrow extra" onclick="toggleExtWeek(\'e'+i+'\')" data-key="e'+i+'">';
      html += '<div class="ext-cb"></div>';
      html += '<div style="flex:1;">'+lab+'<span class="ext-wk-tag">EXTRA</span></div>';
      html += '</div>';
    });
  }
  document.getElementById('ext-weeks-list').innerHTML = html;
  updateExtHint();
}

function toggleExtWeek(key){
  if(extModalCfg.selected.has(key)){
    extModalCfg.selected.delete(key);
  } else {
    extModalCfg.selected.add(key);
  }
  // Actualizar visual de la fila
  const row = document.querySelector('[data-key="'+key+'"]');
  if(row) row.classList.toggle('checked', extModalCfg.selected.has(key));
  // Actualizar master (sólo si se ven todas las del mes marcadas)
  syncExtMaster();
  updateExtHint();
}

function toggleExtMaster(){
  // Si todas las del mes están marcadas → desmarcar todas. Si no → marcar todas.
  const allSelected = extModalCfg.weeks.every((_,i)=>extModalCfg.selected.has('m'+i));
  extModalCfg.weeks.forEach((_,i)=>{
    if(allSelected){ extModalCfg.selected.delete('m'+i); }
    else { extModalCfg.selected.add('m'+i); }
  });
  // Refrescar UI
  document.querySelectorAll('.ext-wkrow[data-key^="m"]').forEach(r=>{
    r.classList.toggle('checked', extModalCfg.selected.has(r.dataset.key));
  });
  syncExtMaster();
  updateExtHint();
}

function syncExtMaster(){
  const allSelected = extModalCfg.weeks.length>0 && extModalCfg.weeks.every((_,i)=>extModalCfg.selected.has('m'+i));
  const masterEl = document.getElementById('ext-master');
  if(masterEl) masterEl.classList.toggle('checked', allSelected);
}

function setExtMode(mode){
  extModalCfg.mode = mode;
  document.querySelectorAll('.ext-mbtn').forEach(b=>{
    b.classList.toggle('active', b.dataset.m === mode);
  });
  document.getElementById('ext-go-btn').textContent =
    (mode === 'print') ? 'Imprimir' : 'Ver en pantalla';
}

// Devuelve array ordenado de las semanas seleccionadas con sus rangos
function getSelectedWeeks(){
  const out = [];
  extModalCfg.weeks.forEach((w, i)=>{
    if(extModalCfg.selected.has('m'+i)){
      out.push({ lunes: w.lunes, domingo: w.domingo, isExtra: false, weekNum: i+1 });
    }
  });
  extModalCfg.extraWeeks.forEach((w, i)=>{
    if(extModalCfg.selected.has('e'+i)){
      out.push({ lunes: w.lunes, domingo: w.domingo, isExtra: true, weekNum: i+1 });
    }
  });
  // Ordenar por fecha de lunes
  out.sort((a,b)=>a.lunes - b.lunes);
  return out;
}

// Construye el array de días (allDays) a partir de las semanas seleccionadas
function buildDaysFromWeeks(weeks, baseMonth){
  const dias = [];
  weeks.forEach(wk=>{
    const cur = new Date(wk.lunes);
    cur.setHours(12,0,0,0);
    for(let i=0; i<7; i++){
      dias.push({
        d: new Date(cur),
        n: String(cur.getDate()).padStart(2,'0'),
        dn: DNAMES[cur.getDay()],
        wknd: cur.getDay()===0 || cur.getDay()===6,
        otherMonth: false,
        isExtra: wk.isExtra || (cur.getMonth() !== baseMonth)
      });
      cur.setDate(cur.getDate()+1);
    }
  });
  return dias;
}

function updateExtHint(){
  const sel = getSelectedWeeks();
  const hint = document.getElementById('ext-range-text');
  if(!sel.length){
    hint.textContent = 'Marca al menos una semana';
    hint.parentElement.style.background = '#ffe6e6';
    hint.parentElement.style.borderColor = '#f5a3a3';
    hint.parentElement.style.color = '#8b1a1a';
    return;
  }
  const fmt = d => {
    const M = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return String(d.getDate()).padStart(2,'0')+' '+M[d.getMonth()];
  };
  // Detectar tramos contiguos vs saltados
  const diasTotal = sel.length * 7;
  let txt = sel.length + ' semana'+(sel.length>1?'s':'')+' — ';
  // Mostrar primer y último día
  txt += fmt(sel[0].lunes) + ' → ' + fmt(sel[sel.length-1].domingo) +
         ' '+sel[sel.length-1].domingo.getFullYear() +
         ' ('+diasTotal+' días)';
  hint.innerHTML = '<strong>'+txt+'</strong>';
  hint.parentElement.style.background = '#fffbe6';
  hint.parentElement.style.borderColor = '#ffd966';
  hint.parentElement.style.color = '#5a3c00';
}

function applyExtended(){
  const sel = getSelectedWeeks();
  if(!sel.length){ alert('Debes marcar al menos una semana.'); return; }
  closeExtendedModal();

  const diasArr = buildDaysFromWeeks(sel, extModalCfg.month);

  extendedState = {
    active: true,
    baseYear: extModalCfg.year,
    baseMonth: extModalCfg.month,
    selectedWeeks: sel,
    diasArr: diasArr,
    mode: extModalCfg.mode
  };

  if(extModalCfg.mode === 'screen'){
    document.getElementById('btn-exit-extended').style.display = '';
    render();
  } else {
    render();
    setTimeout(()=>{
      printGantt();
      setTimeout(()=>{
        extendedState.active = false;
        render();
      }, 400);
    }, 100);
  }
}

function exitExtendedView(){
  extendedState.active = false;
  document.getElementById('btn-exit-extended').style.display = 'none';
  render();
}


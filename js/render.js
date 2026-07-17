// ── AUTO-AJUSTE DE ANCHO DE COLUMNA ACTIVIDAD ───────────────────
// Mide cada celda .td-act tras el render. Si alguna usa más de 2 líneas,
// va aumentando el ancho de la columna (en saltos de 20px) hasta que TODAS
// caben en 2 líneas como máximo.
// Min 280px, Max 500px (no se permite que ocupe más de la mitad de la pantalla).
function ajustarAnchoColumnaActividad(){
  const tabla = document.querySelector('#gantt-wrap table.gantt');
  if(!tabla) return;

  // Línea-altura objetivo: 2 líneas exactas a font-size 9px, line-height 1.3
  // 9 * 1.3 = 11.7px por línea, +6px de padding (3 arriba + 3 abajo) = ~29.4px para 2 líneas
  // Usamos 30px como umbral de "2 líneas o menos"
  const ALTURA_2_LINEAS = 30;
  const MIN_WIDTH = 280;
  const MAX_WIDTH = 500;
  const STEP = 20;

  const celdasAct = tabla.querySelectorAll('td.td-act');
  if(!celdasAct.length) return;

  // Encontrar el primer <col> del colgroup (es el de ACTIVIDAD)
  const colsGroup = tabla.querySelectorAll('colgroup col');
  if(!colsGroup.length) return;
  const colAct = colsGroup[0];

  // Función auxiliar: ¿hay alguna celda que excede 2 líneas?
  function hayDesbordamiento(){
    for(const c of celdasAct){
      if(c.offsetHeight > ALTURA_2_LINEAS) return true;
    }
    return false;
  }

  // Probar anchos crecientes hasta que ninguna celda exceda 2 líneas
  let ancho = MIN_WIDTH;
  colAct.style.width = ancho + 'px';
  // También actualizar el TH y TD inline-style (algunas reglas CSS tienen !important)
  const thAct = tabla.querySelector('th.th-col-act');
  if(thAct) thAct.style.width = ancho + 'px';
  celdasAct.forEach(c=>{
    c.style.width = ancho + 'px';
    c.style.maxWidth = ancho + 'px';
  });

  while(hayDesbordamiento() && ancho < MAX_WIDTH){
    ancho += STEP;
    colAct.style.width = ancho + 'px';
    if(thAct) thAct.style.width = ancho + 'px';
    celdasAct.forEach(c=>{
      c.style.width = ancho + 'px';
      c.style.maxWidth = ancho + 'px';
    });
  }
}

function render(){
  // ── Determinar modo de vista ──
  const isTodaGantt = currentMonthKey === 'all';
  const isFullYear  = currentMonthKey.startsWith('year-');
  let viewYear, viewMonth;

  if(isTodaGantt){
    const sorted = [...acts].sort((a,b)=>a.fecha-b.fecha);
    if(sorted.length){
      viewYear  = sorted[0].fecha.getFullYear();
      viewMonth = sorted[0].fecha.getMonth();
    } else {
      viewYear  = TODAY.getFullYear();
      viewMonth = TODAY.getMonth();
    }
  } else if(isFullYear){
    viewYear  = Number(currentMonthKey.split('-')[1]);
    viewMonth = TODAY.getMonth(); // referencia para buildDays, no importa en año completo
  } else {
    const vm = getViewMonthYear();
    viewYear  = vm.year;
    viewMonth = vm.month;
  }

  // Para año completo o Toda la Gantt usamos el mes actual como base visual del header
  let allDays = buildDaysForMonth(viewYear, isFullYear ? TODAY.getMonth() : viewMonth);

  // ── MODO EXTENDIDO: si está activo, usar el array de días seleccionados ──
  if(extendedState.active && extendedState.diasArr && extendedState.diasArr.length){
    allDays = extendedState.diasArr;
    viewYear = extendedState.baseYear;
    viewMonth = extendedState.baseMonth;
  }

  // Si hay UNA O MÁS semanas seleccionadas, recortar allDays a esos días
  if(selectedWeekKeys && selectedWeekKeys.size > 0 && !isTodaGantt && !isFullYear && !extendedState.active){
    // Convertir cada clave de semana en sus 7 días
    const dias = [];
    // Ordenar las claves cronológicamente
    const keysOrdenadas = Array.from(selectedWeekKeys).sort();
    keysOrdenadas.forEach(k=>{
      const parts = k.split('-');
      const lunes = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
      lunes.setHours(12,0,0,0);
      const cur = new Date(lunes);
      // Determinar si esta semana es del mes "base" o es extra
      const isExtraWeek = cur.getMonth() !== viewMonth;
      for(let i=0; i<7; i++){
        dias.push({
          n: String(cur.getDate()).padStart(2,'0'),
          dn: DNAMES[cur.getDay()],
          d: new Date(cur),
          wknd: cur.getDay()===0 || cur.getDay()===6,
          otherMonth: false,
          isExtra: isExtraWeek || (cur.getMonth() !== viewMonth)
        });
        cur.setDate(cur.getDate()+1);
      }
    });
    allDays = dias;
  } else {
    // Caso clásico: 1 sola semana vía currentWeekKey (compatibilidad)
    const semanaRango = rangoSemanaActual();
    if(semanaRango && !isTodaGantt && !isFullYear && !extendedState.active){
      const dias7 = [];
      const cur = new Date(semanaRango.ini);
      cur.setHours(12,0,0,0);
      for(let i=0; i<7; i++){
        dias7.push({
          n: String(cur.getDate()).padStart(2,'0'),
          dn: DNAMES[cur.getDay()],
          d: new Date(cur),
          wknd: cur.getDay()===0 || cur.getDay()===6,
          otherMonth: cur.getMonth() !== viewMonth
        });
        cur.setDate(cur.getDate()+1);
      }
      allDays = dias7;
    }
  }
  const weeks   = groupWeeks(allDays);
  const todayIdx = allDays.findIndex(d=>
    d.d.getFullYear()===TODAY.getFullYear()&&
    d.d.getMonth()===TODAY.getMonth()&&
    d.d.getDate()===TODAY.getDate()
  );

  // ── Filtrar actividades por MES/AÑO seleccionado ──
  let byMonth;

  function rangoVista(){
    if(extendedState.active && extendedState.diasArr && extendedState.diasArr.length){
      const arr = extendedState.diasArr;
      const ini = new Date(arr[0].d); ini.setHours(0,0,0,0);
      const fin = new Date(arr[arr.length-1].d); fin.setHours(23,59,59,999);
      return { ini, fin };
    }
    // Múltiples semanas seleccionadas → rango = primer lunes ↔ último domingo
    if(selectedWeekKeys && selectedWeekKeys.size > 0 && !isTodaGantt && !isFullYear){
      const keysOrd = Array.from(selectedWeekKeys).sort();
      const primera = keysOrd[0].split('-');
      const ultima  = keysOrd[keysOrd.length-1].split('-');
      const ini = new Date(Number(primera[0]), Number(primera[1])-1, Number(primera[2]), 0,0,0);
      const finLun = new Date(Number(ultima[0]), Number(ultima[1])-1, Number(ultima[2]));
      const fin = new Date(finLun);
      fin.setDate(fin.getDate()+6);
      fin.setHours(23,59,59,999);
      return { ini, fin };
    }
    if(isTodaGantt){
      const yIni = TODAY.getFullYear();
      return {ini: new Date(yIni,0,1,0,0,0), fin: new Date(yIni+2,11,31,23,59,59)};
    }
    if(isFullYear){
      return {ini: new Date(viewYear,0,1,0,0,0), fin: new Date(viewYear,11,31,23,59,59)};
    }
    const ini = new Date(viewYear, viewMonth, 1, 0, 0, 0);
    const fin = new Date(viewYear, viewMonth+1, 7, 23, 59, 59);
    ini.setDate(ini.getDate()-7);
    return {ini, fin};
  }

  const isMultiWeekCrossMonth = selectedWeekKeys && selectedWeekKeys.size > 0 && !extendedState.active && !isTodaGantt && !isFullYear && (()=>{
    const meses = new Set(Array.from(selectedWeekKeys).map(k=>{ const p=k.split('-'); return p[0]+'-'+p[1]; }));
    return meses.size > 1;
  })();
  if(isTodaGantt || isFullYear || isMultiWeekCrossMonth){
    const {ini: rIni, fin: rFin} = rangoVista();
    const normales = acts.filter(a=>{
      const fr = getFrecuencia(a);
      if(fr!=='puntual') return false;
      if(!(a.fecha instanceof Date) || isNaN(a.fecha.getTime())) return false;
      if(isFullYear) return a.fecha.getFullYear()===viewYear;
      return true;
    });
    const expandidas = [];
    acts.forEach(a=>{
      const fr = getFrecuencia(a);
      // Si la actividad recurrente tiene fechaInicio, ajustamos el rango efectivo
      // para que las ocurrencias NUNCA aparezcan antes de esa fecha.
      // Si NO la tiene (actividades viejas), usamos el rango completo (comportamiento original).
      let rIniEff = rIni;
      if((fr==='anual'||fr==='mensual'||fr==='semanal') && a.fechaInicio instanceof Date && !isNaN(a.fechaInicio.getTime())){
        if(a.fechaInicio > rIni) rIniEff = a.fechaInicio;
      }
      // La fecha de la actividad recurrente actúa como FECHA DE TÉRMINO máxima:
      // las repeticiones NO se generan después de esa fecha.
      let rFinEff = rFin;
      if((fr==='anual'||fr==='mensual'||fr==='semanal') && a.fecha instanceof Date && !isNaN(a.fecha.getTime())){
        const term = new Date(a.fecha);
        term.setHours(23,59,59,999);
        if(term < rFin) rFinEff = term;
      }
      if(fr==='anual'){
        for(let y=rIniEff.getFullYear(); y<=rFinEff.getFullYear(); y++){
          const occ = makeAnualOcurrencia(a, y);
          if(occ.fecha >= rIniEff && occ.fecha <= rFinEff) expandidas.push(occ);
        }
      } else if(fr==='mensual'){
        for(let y=rIniEff.getFullYear(); y<=rFinEff.getFullYear(); y++){
          for(let m=0; m<12; m++){
            const occ = makeMensualOcurrencia(a, y, m);
            if(occ.fecha >= rIniEff && occ.fecha <= rFinEff) expandidas.push(occ);
          }
        }
      } else if(fr==='semanal'){
        const occ = makeSemanalOcurrencias(a, rIniEff, rFinEff);
        occ.forEach(o=>expandidas.push(o));
      }
    });
    byMonth = [...normales, ...expandidas].sort((a,b)=>a.fecha-b.fecha);
  } else {
    const targetKey = viewYear+'-'+viewMonth;
    const normales = acts.filter(a=>{
      const fr = getFrecuencia(a);
      if(fr!=='puntual') return false;
      if(!(a.fecha instanceof Date) || isNaN(a.fecha.getTime())) return false;
      const k = a.fecha.getFullYear()+'-'+a.fecha.getMonth();
      return k === targetKey;
    });
    const expandidas = [];
    acts.forEach(a=>{
      const fr = getFrecuencia(a);
      // Filtro por fechaInicio: si existe, no generamos ocurrencias antes.
      // Si no existe (actividades viejas), no filtramos por fecha.
      const fi = (a.fechaInicio instanceof Date && !isNaN(a.fechaInicio.getTime())) ? a.fechaInicio : null;
      // Filtro por fecha de término: la fecha de la actividad recurrente
      // actúa como límite máximo, las repeticiones NO siguen después.
      let ft = null;
      if((fr==='anual'||fr==='mensual'||fr==='semanal') && a.fecha instanceof Date && !isNaN(a.fecha.getTime())){
        ft = new Date(a.fecha);
        ft.setHours(23,59,59,999);
      }
      if(fr==='anual' && a.mes===viewMonth){
        const occ = makeAnualOcurrencia(a, viewYear);
        if((!fi || occ.fecha >= fi) && (!ft || occ.fecha <= ft)) expandidas.push(occ);
      } else if(fr==='mensual'){
        const occ = makeMensualOcurrencia(a, viewYear, viewMonth);
        if((!fi || occ.fecha >= fi) && (!ft || occ.fecha <= ft)) expandidas.push(occ);
      } else if(fr==='semanal'){
        const {ini: rIni, fin: rFin} = rangoVista();
        const rIniEff = (fi && fi > rIni) ? fi : rIni;
        const rFinEff = (ft && ft < rFin) ? ft : rFin;
        const occ = makeSemanalOcurrencias(a, rIniEff, rFinEff);
        occ.forEach(o=>{ expandidas.push(o); });
      }
    });
    byMonth = [...normales, ...expandidas].sort((a,b)=>a.fecha-b.fecha);
  }

  // ── Filtro por SEMANA(S) seleccionada(s) ──
  if(selectedWeekKeys && selectedWeekKeys.size > 0 && !isTodaGantt && !isFullYear){
    // Construir un Set con todas las fechas (yyyy-mm-dd) de las semanas marcadas
    const fechasOk = new Set();
    selectedWeekKeys.forEach(k=>{
      const parts = k.split('-');
      const lun = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
      lun.setHours(12,0,0,0);
      const cur = new Date(lun);
      for(let i=0; i<7; i++){
        const ymd = cur.getFullYear()+'-'+String(cur.getMonth()+1).padStart(2,'0')+'-'+String(cur.getDate()).padStart(2,'0');
        fechasOk.add(ymd);
        cur.setDate(cur.getDate()+1);
      }
    });
    byMonth = byMonth.filter(a=>{
      if(!(a.fecha instanceof Date) || isNaN(a.fecha.getTime())) return false;
      const ymd = a.fecha.getFullYear()+'-'+String(a.fecha.getMonth()+1).padStart(2,'0')+'-'+String(a.fecha.getDate()).padStart(2,'0');
      return fechasOk.has(ymd);
    });
  }

  // ── Filtro de estado (vencidas, rojo, etc.) sobre las del mes ──
  let filtered = [...byMonth];
  if(currentFilter!=='all'){
    filtered = byMonth.filter(a=> matchesFilter(a, currentFilter));
  }

  // ── Info de vista ──
  let infoTxt;
  const nWeeks = (selectedWeekKeys && selectedWeekKeys.size) || 0;
  if(isTodaGantt)       infoTxt = 'Mostrando todas las actividades';
  else if(isFullYear)   infoTxt = 'Mostrando todo el año '+viewYear+' ('+byMonth.length+' actividades)';
  else if(nWeeks > 1){
    infoTxt = 'Mostrando '+nWeeks+' semanas seleccionadas ('+byMonth.length+' actividades)';
  }
  else if(nWeeks === 1){
    const k = Array.from(selectedWeekKeys)[0];
    const parts = k.split('-');
    const lun = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
    const dom = new Date(lun); dom.setDate(dom.getDate()+6);
    const MSC=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const fmt = (d)=> String(d.getDate()).padStart(2,'0')+' '+MSC[d.getMonth()];
    infoTxt = 'Mostrando semana del '+fmt(lun)+' al '+fmt(dom)+' ('+byMonth.length+' actividades)';
  }
  else if(currentMonthKey==='current') infoTxt = 'Mostrando '+MNAMES[viewMonth]+' '+viewYear+' + 5 días extra';
  else infoTxt = 'Mostrando '+MNAMES[viewMonth]+' '+viewYear+' ('+byMonth.length+' actividades)';
  document.getElementById('view-info').textContent = infoTxt;

  // Actualizar panel de feriados del mes visible
  renderFeriadosPanel(viewYear, viewMonth, isTodaGantt || isFullYear);

  const NCOLS=5+allDays.length;
  let html='<table class="gantt"><colgroup>';
  html+='<col style="width:280px;"><col style="width:40px;"><col style="width:62px;"><col style="width:36px;"><col style="width:22px;">';
  allDays.forEach(()=>{ html+='<col style="width:24px;">'; });
  html+='</colgroup><thead><tr>';

  // Fila 1: título + semanas
  let titleMes;
  if(isTodaGantt)     titleMes = 'TODAS LAS ACTIVIDADES';
  else if(isFullYear) titleMes = 'AÑO '+viewYear+' — TODAS LAS ACTIVIDADES';
  else                titleMes = MNAMES[viewMonth].toUpperCase()+' '+viewYear;
  html+='<th class="th-title" colspan="5">CARTA GANTT MAAH — '+titleMes+'</th>';
  weeks.forEach(w=>{
    html+='<th class="th-week" colspan="'+w.days.length+'">'+w.label+'</th>';
  });
  html+='</tr><tr>';

  // Fila 2: cabeceras fijas + números de día
  html+='<th class="th-col-act">ACTIVIDAD</th>';
  html+='<th class="th-col-obs">OBS</th>';
  html+='<th class="th-col-term">TÉRMINO</th>';
  html+='<th class="th-col-dias">DÍAS</th>';
  html+='<th class="th-col-del"></th>';
  allDays.forEach((d,i)=>{
    const isToday=i===todayIdx;
    const isExtra=d.isExtra===true;
    const cls='th-daynum'+(d.wknd?' wknd':'')+(d.otherMonth?' othermonth':'')+(isToday?' today-col':'')+(isExtra?' extra':'');
    const content=isToday?'<span class="today-th-label">HOY</span>':d.n;
    html+='<th class="'+cls+'">'+content+'</th>';
  });
  html+='</tr><tr>';

  // Fila 3: solo nombres de día (LUN, MAR, MIÉ...), SIN repetir las columnas de texto
  html+='<td class="th-col-act" style="background:#2c5282;"></td>';
  html+='<td class="th-col-obs" style="background:#2c5282;"></td>';
  html+='<td class="th-col-term" style="background:#2c5282;"></td>';
  html+='<td class="th-col-dias" style="background:#2c5282;"></td>';
  html+='<td class="th-col-del" style="background:#2c5282;"></td>';
  allDays.forEach((d,i)=>{
    const isToday=i===todayIdx;
    const isExtra=d.isExtra===true;
    const cls='th-dayname'+(d.wknd?' wknd':'')+(d.otherMonth?' othermonth':'')+(isToday?' today-col':'')+(isExtra?' extra':'');
    html+='<th class="'+cls+'">'+d.dn+'</th>';
  });
  html+='</tr></thead><tbody>';

  if(!filtered.length){
    const msg=currentFilter!=='all'
      ?'No hay actividades con el filtro seleccionado en este período.'
      :isTodaGantt?'No hay actividades. Use el formulario para agregar.'
      :'No hay actividades en '+MNAMES[viewMonth]+' '+viewYear+'.';
    html+='<tr class="empty-row"><td colspan="'+NCOLS+'">'+msg+'</td></tr>';
  }

  filtered.forEach(r=>{
    const diff=diasRest(r.fecha);
    const isAniv=r.type==='aniversario';
    const isPlazo=r.type==='plazo';
    const col=getColor(diff,isAniv);
    const dl=dLabel(diff);

    const barIdx=allDays.findIndex(d=>
      d.d.getFullYear()===r.fecha.getFullYear()&&
      d.d.getMonth()===r.fecha.getMonth()&&
      d.d.getDate()===r.fecha.getDate()
    );

    // Calcular rango de barra Gantt real (fechaInicio → fecha)
    let startIdx=-1;
    if(r.fechaInicio instanceof Date && !isNaN(r.fechaInicio.getTime())){
      startIdx=allDays.findIndex(d=>
        d.d.getFullYear()===r.fechaInicio.getFullYear()&&
        d.d.getMonth()===r.fechaInicio.getMonth()&&
        d.d.getDate()===r.fechaInicio.getDate()
      );
      // fechaInicio antes del rango visible → barra empieza desde columna 0
      if(startIdx===-1 && allDays.length>0 && r.fechaInicio<allDays[0].d) startIdx=0;
    }
    let effStart=startIdx>=0?startIdx:barIdx;
    let effEnd=barIdx>=0?barIdx:-1;
    // fecha después del rango visible pero inicio está en vista → extender barra hasta el final
    if(barIdx===-1 && startIdx>=0 && allDays.length>0 && r.fecha>allDays[allDays.length-1].d){
      effEnd=allDays.length-1;
    }
    const hasBar=effStart>=0 && effEnd>=0 && effStart<=effEnd;

    var rowCls=isAniv?'row-aniv':(r.priori?'row-priori':'');
    html+='<tr class="'+rowCls+'">';
    html+='<td class="td-act">'+escapeHtml(r.act)+'</td>';
    if(isPlazo){
      // Extraer procedencia desde obs ("PLAZO | COT" → "COT")
      const obsRaw = (r.obs||'').replace(/^PLAZO\s*\|\s*/i,'').trim();
      const obsExtra = obsRaw ? '<span class="obs-text" style="font-size:7px;display:block;margin-top:1px;">'+escapeHtml(obsRaw)+'</span>' : '';
      html+='<td class="td-obs"><span class="plazo-badge">PLAZO</span>'+obsExtra+'</td>';
    } else if(r.isVirtualAnual){
      const obsTxt = r.obs ? r.obs : '';
      const fr = getFrecuencia(r);
      let badge='';
      if(fr==='anual')        badge='<span class="anual-badge" title="Se repite todos los años">ANUAL</span>';
      else if(fr==='mensual') badge='<span class="mensual-badge" title="Se repite todos los meses">MENSUAL</span>';
      else if(fr==='semanal') badge='<span class="semanal-badge" title="Se repite todas las semanas">SEMANAL</span>';
      // Badge va en una línea separada, debajo del texto, para que se vea más ordenado
      let cellInner = '';
      if(obsTxt) cellInner += '<span class="obs-text">'+escapeHtml(obsTxt)+'</span>';
      if(badge)  cellInner += '<span class="obs-badge-row">'+badge+'</span>';
      html+='<td class="td-obs">'+cellInner+'</td>';
    } else {
      html+='<td class="td-obs">'+escapeHtml(r.obs||'')+'</td>';
    }
    html+='<td class="td-term">'+fmtDate(r.fecha)+'</td>';
    html+='<td class="td-d" style="background:'+col.bg+';color:'+col.fg+';'+(col.hideNum?'border:1px solid #7AB034;':'')+'" title="'+(col.hideNum?'Vencido':dl)+'">'+(col.hideNum?'':dl)+'</td>';
    if(r.isVirtualAnual){
      // Fila virtual (recurrente): solo lápiz con menú contextual
      const parentId = r.parentAnualId;
      html+='<td class="td-del"><button class="edit-btn" onclick="openCtxMenu(event,'+jsArgAttr(parentId)+',true)" title="Opciones">&#9998;</button></td>';
    } else {
      // Actividad normal: solo lápiz con menú contextual
      html+='<td class="td-del"><button class="edit-btn" onclick="openCtxMenu(event,'+jsArgAttr(r.id)+',false)" title="Opciones">&#9998;</button></td>';
    }

    allDays.forEach((_,i)=>{
      const isToday=i===todayIdx;
      const isWknd=allDays[i].wknd;
      const isOther=allDays[i].otherMonth;
      const isExtra=allDays[i].isExtra===true;
      const tlStyle=isToday?'border-left:2.5px solid #e53935;':'';
      const fmap=getFeriados(allDays[i].d.getFullYear());
      const fKey=feriadoKey(allDays[i].d);
      const esFeriado=!!fmap[fKey];
      const ferNombre=esFeriado?fmap[fKey]:'';
      const ferArg=jsArgAttr(ferNombre);
      const ferAttr=esFeriado?' onmouseenter="showFeriadoTip(this,'+ferArg+')" onmouseleave="hideFeriadoTip()" onclick="showFeriadoTip(this,'+ferArg+')"':'';
      // Para SEMANAL/MENSUAL solo pintar el día específico de la semana/mes
      let paintBar=false;
      if(hasBar && i>=effStart && i<=effEnd){
        if(r.freq==='semanal'){
          const dow=typeof r.dow==='number'?r.dow:(r.fecha instanceof Date?r.fecha.getDay():-1);
          paintBar=allDays[i].d.getDay()===dow;
        } else if(r.freq==='mensual'){
          const dia=typeof r.dia==='number'?r.dia:(r.fecha instanceof Date?r.fecha.getDate():-1);
          paintBar=allDays[i].d.getDate()===dia;
        } else {
          paintBar=true;
        }
      }
      if(paintBar){
        let barShape;
        if(r.freq==='semanal'||r.freq==='mensual') barShape=' bar-single';
        else if(effStart===effEnd) barShape=' bar-single';
        else if(i===effStart)      barShape=' bar-start';
        else if(i===effEnd)        barShape=' bar-end';
        else                       barShape=' bar-mid';
        const ferCls=esFeriado?' feriado':'';
        const extCls=isExtra?' extra':'';
        // Para rango (puntual+fechaInicio): días pasados con opacidad reducida + % en transición
        // esRango: freq='rango' explícito, O puntual+fechaInicio anterior a fecha (compatibilidad)
        const esRango = r.fechaInicio instanceof Date && !isNaN(r.fechaInicio.getTime())
          && r.fechaInicio < r.fecha
          && (r.freq==='rango' || r.freq==='puntual');
        const esPasado = esRango && allDays[i].d < TODAY;
        const opacityStyle = esPasado ? 'opacity:0.35;' : '';
        // Mostrar % solo en la celda de hoy (si cae dentro de la barra) o en la primera celda futura
        let pctLabel = '';
        if(esRango && !esPasado && (isToday || (i===effStart && allDays[i].d >= TODAY) || (i>effStart && allDays[i-1] && allDays[i-1].d < TODAY))){
          const totalDias = Math.max(1, Math.round((r.fecha - r.fechaInicio) / 86400000));
          const diasPasados = Math.max(0, Math.min(totalDias, Math.round((TODAY - r.fechaInicio) / 86400000)));
          const pct = Math.round(diasPasados / totalDias * 100);
          if(pct > 0 && pct < 100) pctLabel = '<span style="font-size:7px;font-weight:800;color:#fff;text-shadow:0 0 3px rgba(0,0,0,.6);line-height:1;pointer-events:none;">'+pct+'%</span>';
        }
        html+='<td class="bar-cell'+barShape+ferCls+extCls+'" style="background:'+col.bg+' !important;'+opacityStyle+tlStyle+'"'+ferAttr+'>'+pctLabel+'</td>';
      } else {
        let cls='td-day'+(isWknd?' wknd':'')+(isOther?' othermonth':'')+(isToday?' today-col':'')+(esFeriado?' feriado':'')+(isExtra?' extra':'');
        html+='<td class="'+cls+'" style="'+tlStyle+'"'+ferAttr+'></td>';
      }
    });
    html+='</tr>';
  });

  html+='</tbody></table>';
  document.getElementById('gantt-wrap').innerHTML=html;

  // ── AUTO-AJUSTE: ensanchar columna ACTIVIDAD si algún texto no entra en 2 líneas ──
  ajustarAnchoColumnaActividad();

  // Stats — se calculan sobre byMonth (período visible) para que cuadren con lo que se ve en pantalla.
  // Cuando haces clic en un filtro, el número que aparece en el stat = exactamente las filas que se muestran.
  document.getElementById('s-total').textContent=byMonth.length;
  document.getElementById('s-venc').textContent=byMonth.filter(a=>diasRest(a.fecha)<0).length;
  document.getElementById('s-rojo').textContent=byMonth.filter(a=>{const d=diasRest(a.fecha);return d>=0&&d<=5;}).length;
  document.getElementById('s-naranja').textContent=byMonth.filter(a=>{const d=diasRest(a.fecha);return d>5&&d<=10;}).length;
  document.getElementById('s-amarillo').textContent=byMonth.filter(a=>{const d=diasRest(a.fecha);return d>10;}).length;
  document.getElementById('s-anivs').textContent=byMonth.filter(a=>a.type==='aniversario').length;
}


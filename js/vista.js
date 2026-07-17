function buildDaysForMonth(year, month){
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth  = new Date(year, month+1, 0);

  // Primer lunes de la semana que contiene el día 1
  const startDay = new Date(firstOfMonth);
  const dow = startDay.getDay();
  startDay.setDate(startDay.getDate() - (dow===0 ? 6 : dow-1));

  // Último día: fin del mes + 5 días calendario
  const endDay = new Date(lastOfMonth);
  endDay.setDate(endDay.getDate() + 5);

  const days = [];
  const cur = new Date(startDay);
  while(cur <= endDay){
    days.push({
      n: String(cur.getDate()).padStart(2,'0'),
      dn: DNAMES[cur.getDay()],
      d: new Date(cur),
      wknd: cur.getDay()===0 || cur.getDay()===6,
      otherMonth: cur.getMonth() !== month
    });
    cur.setDate(cur.getDate()+1);
  }
  return days;
}

function groupWeeks(days){
  const weeks = [];
  for(let i=0; i<days.length; i+=7){
    const chunk = days.slice(i, i+7);
    const lunes = chunk[0].d;
    const domingo = chunk[chunk.length-1].d;
    weeks.push({
      label: formatWeekRangeLabel(lunes, domingo),
      days: chunk
    });
  }
  return weeks;
}

function formatWeekRangeLabel(lunes, domingo){
  const cap = value => String(value||'').charAt(0).toUpperCase() + String(value||'').slice(1);
  const dia = d => String(d.getDate()).padStart(2,'0');
  const mes = d => cap(MSHORT[d.getMonth()]);
  const y = d => String(d.getFullYear()).slice(2);
  const sameMonth = lunes.getMonth() === domingo.getMonth() && lunes.getFullYear() === domingo.getFullYear();
  const sameYear = lunes.getFullYear() === domingo.getFullYear();

  if(sameMonth){
    return 'Semana del Lun '+dia(lunes)+' al Dom '+dia(domingo)+' '+mes(domingo);
  }
  if(sameYear){
    return 'Semana del Lun '+dia(lunes)+' '+mes(lunes)+' al Dom '+dia(domingo)+' '+mes(domingo);
  }
  return 'Semana del Lun '+dia(lunes)+' '+mes(lunes)+' '+y(lunes)+' al Dom '+dia(domingo)+' '+mes(domingo)+' '+y(domingo);
}

function getViewMonthYear(){
  if(currentMonthKey==='current') return {year:TODAY.getFullYear(), month:TODAY.getMonth()};
  if(currentMonthKey==='all') return {year:TODAY.getFullYear(), month:TODAY.getMonth()};
  if(currentMonthKey.startsWith('year-')){
    const y = Number(currentMonthKey.split('-')[1]);
    return {year:y, month:TODAY.getMonth(), isFullYear:true};
  }
  const parts = currentMonthKey.split('-');
  return {year:Number(parts[0]), month:Number(parts[1])};
}

// ── SELECTOR AÑO → MES (cascada) ─────────────────────────────

// Calcula qué años y meses tienen actividades, y cuál es el rango visible
function calcRangoYMeses(){
  const monthSet = {};
  const todayY_count = TODAY.getFullYear();
  const yMaxRange_count = todayY_count + 5;

  acts.forEach(a=>{
    const fr = getFrecuencia(a);
    if(fr==='anual'){
      if(typeof a.mes !== 'number' || a.mes<0 || a.mes>11) return;
      for(let y=todayY_count; y<=yMaxRange_count; y++){
        const k = y+'-'+a.mes;
        if(!monthSet[k]) monthSet[k]={year:y,month:a.mes,count:0};
        monthSet[k].count++;
      }
      return;
    }
    if(fr==='mensual' || fr==='semanal'){
      for(let y=todayY_count; y<=yMaxRange_count; y++){
        for(let m=0; m<12; m++){
          const k = y+'-'+m;
          if(!monthSet[k]) monthSet[k]={year:y,month:m,count:0};
          monthSet[k].count++;
        }
      }
      return;
    }
    if(!(a.fecha instanceof Date) || isNaN(a.fecha.getTime())) return;
    const k = a.fecha.getFullYear()+'-'+a.fecha.getMonth();
    if(!monthSet[k]) monthSet[k]={year:a.fecha.getFullYear(),month:a.fecha.getMonth(),count:0};
    monthSet[k].count++;
  });

  const todayY = TODAY.getFullYear(), todayM = TODAY.getMonth();
  let minY = todayY;
  let maxY = todayY + 2;
  acts.forEach(a=>{
    const fr = getFrecuencia(a);
    if(fr !== 'puntual') return;
    if(!(a.fecha instanceof Date) || isNaN(a.fecha.getTime())) return;
    const ay = a.fecha.getFullYear();
    if(ay > maxY) maxY = ay;
  });

  // Construir lista de años disponibles
  const years = [];
  for(let y=minY; y<=maxY; y++) years.push(y);

  // Construir lista de meses por año
  const allMonths=[];
  let curY=minY, curM=0;
  const endY=maxY, endM=11;
  while(curY < endY || (curY===endY && curM <= endM)){
    allMonths.push({year:curY, month:curM});
    curM++;
    if(curM>11){ curM=0; curY++; }
  }

  return {monthSet, years, allMonths, todayY, todayM};
}

function rebuildMonthSelect(){
  const {monthSet, years, allMonths, todayY, todayM} = calcRangoYMeses();
  const yearSel  = document.getElementById('year-select');
  const monthSel = document.getElementById('month-select');
  const monthLbl = document.getElementById('month-select-label');

  // Guardar selección previa
  const prevKey = currentMonthKey; // p.ej. "2027-5", "all", "current"

  // ── Poblar selector de años ──
  yearSel.innerHTML = '<option value="all">— Toda la Gantt —</option>';
  yearSel.innerHTML += '<option value="current">Año actual ('+todayY+')</option>';
  years.forEach(y=>{
    // Contar actividades en ese año
    const total = allMonths.filter(m=>m.year===y)
      .reduce((acc,m)=>{ const info=monthSet[m.year+'-'+m.month]; return acc+(info?info.count:0); }, 0);
    const sufijo = total ? ' ('+total+' act.)' : '';
    const esHoy  = y===todayY ? ' ← HOY' : '';
    yearSel.innerHTML += '<option value="'+y+'">'+y+sufijo+esHoy+'</option>';
  });

  // ── Restaurar estado ──
  let selectedYear = 'all';
  if(prevKey==='all'){
    selectedYear = 'all';
    yearSel.value = 'all';
    monthSel.style.display = 'none';
    monthLbl.style.display = 'none';
  } else if(prevKey==='current'){
    selectedYear = 'current';
    yearSel.value = 'current';
    _buildMonthsForYear(todayY, monthSet, allMonths, todayY, todayM, true);
    monthSel.value = todayY+'-'+todayM;
    monthSel.style.display = '';
    monthLbl.style.display = '';
  } else {
    // prevKey puede ser "YYYY-M" o "year-YYYY"
    let py;
    if(prevKey.startsWith('year-')){
      py = Number(prevKey.split('-')[1]);
    } else {
      py = Number(prevKey.split('-')[0]);
    }
    selectedYear = py;
    if([...yearSel.options].some(o=>o.value===String(py))){
      yearSel.value = String(py);
    } else {
      yearSel.value = 'all';
      selectedYear = 'all';
    }
    if(selectedYear !== 'all'){
      _buildMonthsForYear(py, monthSet, allMonths, todayY, todayM, true);
      if([...monthSel.options].some(o=>o.value===prevKey)){
        monthSel.value = prevKey;
      } else {
        monthSel.value = monthSel.options[0]?.value || '';
      }
      monthSel.style.display = '';
      monthLbl.style.display = '';
    } else {
      monthSel.style.display = 'none';
      monthLbl.style.display = 'none';
    }
  }

  // Sincronizar currentMonthKey con lo que quedó seleccionado
  if(yearSel.value==='all'){
    currentMonthKey = 'all';
  } else {
    currentMonthKey = monthSel.style.display!=='none' ? monthSel.value : yearSel.value;
  }
}

// Puebla el selector de meses para un año dado
function _buildMonthsForYear(year, monthSet, allMonths, todayY, todayM, conTodoElAnio){
  const monthSel = document.getElementById('month-select');
  const mesesDelAnio = allMonths.filter(m=>m.year===year);
  monthSel.innerHTML = '';

  // Opción "Todo el año"
  if(conTodoElAnio !== false){
    const optAll = document.createElement('option');
    optAll.value = 'year-'+year;
    optAll.textContent = '📅 Todo el año '+year;
    optAll.style.fontWeight = 'bold';
    monthSel.appendChild(optAll);
  }

  mesesDelAnio.forEach(m=>{
    const k = m.year+'-'+m.month;
    const info = monthSet[k];
    const sufijo = info ? ' ('+info.count+' act.)' : '';
    const esHoy  = (m.year===todayY && m.month===todayM) ? ' ← HOY' : '';
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = MNAMES[m.month]+' '+m.year+sufijo+esHoy;
    monthSel.appendChild(opt);
  });
}

// Cuando cambia el selector de AÑO
function onYearChange(){
  const yearSel  = document.getElementById('year-select');
  const monthSel = document.getElementById('month-select');
  const monthLbl = document.getElementById('month-select-label');
  const val = yearSel.value;

  // Resetear filtro de semana siempre que cambia el año
  currentWeekKey = 'all';

  if(val==='all'){
    monthSel.style.display = 'none';
    monthLbl.style.display = 'none';
    currentMonthKey = 'all';
    rebuildWeekSelect();
    render();
    return;
  }

  const {monthSet, allMonths, todayY, todayM} = calcRangoYMeses();
  const year = val==='current' ? todayY : Number(val);

  _buildMonthsForYear(year, monthSet, allMonths, todayY, todayM, true);

  monthSel.style.display = '';
  monthLbl.style.display = '';

  monthSel.value = 'year-'+year;
  currentMonthKey = 'year-'+year;
  rebuildWeekSelect();
  render();
}

// Cuando cambia el selector de MES
function onMonthChange(){
  currentMonthKey = document.getElementById('month-select').value;
  // Resetear filtro de semana siempre que cambia el mes
  currentWeekKey = 'all';
  selectedWeekKeys = new Set();
  rebuildWeekSelect();
  render();
}

function printGantt(){
  // ── 1. Determinar título dinámico según vista activa ──
  // Helper: lista números: [2] -> "2", [1,3] -> "1 Y 3", [1,2,3] -> "1, 2 Y 3"
  const listNums = (nums)=>{
    if(nums.length === 1) return String(nums[0]);
    if(nums.length === 2) return nums[0]+' Y '+nums[1];
    return nums.slice(0,-1).join(', ')+' Y '+nums[nums.length-1];
  };

  let titleText = 'GANTT';

  // CASO A: Modo extendido (botón "Imprimir extendido")
  if(extendedState.active && extendedState.selectedWeeks && extendedState.selectedWeeks.length){
    const sel = extendedState.selectedWeeks;
    const m1 = MNAMES[extendedState.baseMonth].toUpperCase();
    const y  = extendedState.baseYear;
    const fromMes = sel.filter(w => !w.isExtra);
    const fromExtra = sel.filter(w => w.isExtra);
    const totalMesAvailable = (typeof extModalCfg !== 'undefined' && extModalCfg.weeks) ? extModalCfg.weeks.length : 5;

    const next = new Date(extendedState.baseYear, extendedState.baseMonth + 1, 1);
    const m2 = MNAMES[next.getMonth()].toUpperCase();

    if(fromMes.length === totalMesAvailable && fromExtra.length === 0){
      titleText = 'GANTT MES DE '+m1+' '+y;
    } else if(fromMes.length === totalMesAvailable && fromExtra.length > 0){
      const sw = fromExtra.length>1 ? 'SEMANAS' : 'SEMANA';
      titleText = 'GANTT MES DE '+m1+' '+y+' + '+sw+' '+listNums(fromExtra.map(w=>w.weekNum))+' DE '+m2;
    } else if(fromMes.length > 0 && fromExtra.length === 0){
      // Solo semanas del mes (sin extras): "GANTT MAYO 2026 - SEMANAS 1, 2 Y 3"
      const sw = fromMes.length>1 ? 'SEMANAS' : 'SEMANA';
      if(fromMes.length === 1){
        // 1 sola semana: usar formato "(DD AL DD)"
        const w = fromMes[0];
        const d1 = String(w.lunes.getDate()).padStart(2,'0');
        const d2 = String(w.domingo.getDate()).padStart(2,'0');
        titleText = 'GANTT MES DE '+m1+' '+y+' - SEMANA '+w.weekNum+' ('+d1+' AL '+d2+')';
      } else {
        titleText = 'GANTT '+m1+' '+y+' - '+sw+' '+listNums(fromMes.map(w=>w.weekNum));
      }
    } else if(fromMes.length === 0 && fromExtra.length > 0){
      // Solo semanas del mes siguiente
      const sw = fromExtra.length>1 ? 'SEMANAS' : 'SEMANA';
      titleText = 'GANTT '+m2+' '+y+' - '+sw+' '+listNums(fromExtra.map(w=>w.weekNum));
    } else {
      // Mezcla: "GANTT - SEMANAS 4, 5 DE MAYO + SEMANAS 1, 2 Y 3 DE JUNIO"
      const swM = fromMes.length>1 ? 'SEMANAS' : 'SEMANA';
      const swE = fromExtra.length>1 ? 'SEMANAS' : 'SEMANA';
      titleText = 'GANTT - '+swM+' '+listNums(fromMes.map(w=>w.weekNum))+' DE '+m1+' + '+swE+' '+listNums(fromExtra.map(w=>w.weekNum))+' DE '+m2;
    }
  }
  // CASO B: Selección de semanas directamente en pantalla (selectedWeekKeys)
  else if(selectedWeekKeys && selectedWeekKeys.size > 0){
    // Resolver el mes base actual
    let baseYear, baseMonth;
    if(currentMonthKey === 'current'){
      baseYear = TODAY.getFullYear();
      baseMonth = TODAY.getMonth();
    } else {
      const parts = currentMonthKey.split('-');
      baseYear = Number(parts[0]);
      baseMonth = Number(parts[1]);
    }
    const m1 = MNAMES[baseMonth].toUpperCase();
    const y  = baseYear;

    // Obtener todas las semanas con su número desde el cache del dropdown
    // Si no está disponible, reconstruir
    let weeksCache = (typeof weekDropdownOpenList !== 'undefined' && weekDropdownOpenList.length)
        ? weekDropdownOpenList : [];
    if(!weeksCache.length){
      // Reconstruir minimal
      const semanasMes = generarSemanasDelMes(baseYear, baseMonth);
      const nextDate = new Date(baseYear, baseMonth+1, 1);
      const semanasSig = generarSemanasDelMes(nextDate.getFullYear(), nextDate.getMonth()).slice(0,4);
      const wkKey = (lunes)=> lunes.getFullYear()+'-'+String(lunes.getMonth()+1).padStart(2,'0')+'-'+String(lunes.getDate()).padStart(2,'0');
      semanasMes.forEach((s,i)=>{ weeksCache.push({key:wkKey(s.lunes), lunes:s.lunes, domingo:s.domingo, num:i+1, isExtra:false}); });
      semanasSig.forEach((s,i)=>{ weeksCache.push({key:wkKey(s.lunes), lunes:s.lunes, domingo:s.domingo, num:i+1, isExtra:true}); });
    }

    // Filtrar a las que están seleccionadas
    const sel = weeksCache.filter(w => selectedWeekKeys.has(w.key));
    sel.sort((a,b)=>a.lunes - b.lunes);
    const fromMes = sel.filter(w => !w.isExtra);
    const fromExtra = sel.filter(w => w.isExtra);

    // Calcular cuántas semanas tiene el mes en total
    const totalMesAvailable = generarSemanasDelMes(baseYear, baseMonth).length;
    const next = new Date(baseYear, baseMonth + 1, 1);
    const m2 = MNAMES[next.getMonth()].toUpperCase();

    if(fromMes.length === totalMesAvailable && fromExtra.length === 0){
      titleText = 'GANTT MES DE '+m1+' '+y;
    } else if(fromMes.length === totalMesAvailable && fromExtra.length > 0){
      const sw = fromExtra.length>1 ? 'SEMANAS' : 'SEMANA';
      titleText = 'GANTT MES DE '+m1+' '+y+' + '+sw+' '+listNums(fromExtra.map(w=>w.num))+' DE '+m2;
    } else if(fromMes.length > 0 && fromExtra.length === 0){
      if(fromMes.length === 1){
        // 1 sola semana
        const w = fromMes[0];
        const d1 = String(w.lunes.getDate()).padStart(2,'0');
        const d2 = String(w.domingo.getDate()).padStart(2,'0');
        titleText = 'GANTT MES DE '+m1+' '+y+' - SEMANA '+w.num+' ('+d1+' AL '+d2+')';
      } else {
        const sw = 'SEMANAS';
        titleText = 'GANTT '+m1+' '+y+' - '+sw+' '+listNums(fromMes.map(w=>w.num));
      }
    } else if(fromMes.length === 0 && fromExtra.length > 0){
      if(fromExtra.length === 1){
        const w = fromExtra[0];
        const d1 = String(w.lunes.getDate()).padStart(2,'0');
        const d2 = String(w.domingo.getDate()).padStart(2,'0');
        titleText = 'GANTT MES DE '+m2+' '+y+' - SEMANA '+w.num+' ('+d1+' AL '+d2+')';
      } else {
        const sw = 'SEMANAS';
        titleText = 'GANTT '+m2+' '+y+' - '+sw+' '+listNums(fromExtra.map(w=>w.num));
      }
    } else {
      // Mezcla: "GANTT - SEMANAS 4, 5 DE MAYO + SEMANAS 1, 2 Y 3 DE JUNIO"
      const swM = fromMes.length>1 ? 'SEMANAS' : 'SEMANA';
      const swE = fromExtra.length>1 ? 'SEMANAS' : 'SEMANA';
      titleText = 'GANTT - '+swM+' '+listNums(fromMes.map(w=>w.num))+' DE '+m1+' + '+swE+' '+listNums(fromExtra.map(w=>w.num))+' DE '+m2;
    }
  }
  // CASO C: Toda la Gantt
  else if(currentMonthKey === 'all'){
    titleText = 'GANTT';
  }
  // CASO D: Año completo
  else if(currentMonthKey.startsWith('year-')){
    const y = currentMonthKey.split('-')[1];
    titleText = 'GANTT AÑO ' + y;
  }
  // CASO E: Mes específico (sin semanas seleccionadas)
  else {
    const vm = getViewMonthYear();
    titleText = 'GANTT MES DE '+MNAMES[vm.month].toUpperCase()+' '+vm.year;
  }

  // ── 2. Clonar la tabla y reescribir el <colgroup> COMPLETO con porcentajes ──
  const wrap = document.getElementById('gantt-wrap');
  const tableEl = wrap.querySelector('table.gantt');
  if(!tableEl){ alert('No se encontró la tabla Gantt.'); return; }
  const tableClone = tableEl.cloneNode(true);

  const oldCols = tableClone.querySelectorAll('colgroup col');
  const totalCols = oldCols.length;
  const nDayCols = Math.max(1, totalCols - 5);

  // ── ELIMINAR FÍSICAMENTE las columnas TÉRMINO, DÍAS y DEL ──
  // (en vez de ocultarlas con CSS, que causaba desalineación con el colgroup)
  // Eliminar todas las celdas con esas clases
  tableClone.querySelectorAll(
    '.th-col-term, .th-col-dias, .th-col-del, .td-term, .td-d, .td-del'
  ).forEach(el => el.remove());
  // Ajustar el colspan="5" del título de la primera fila (que ahora tiene 2 columnas, ACT+OBS)
  const titleTh = tableClone.querySelector('th.th-title');
  if(titleTh){
    titleTh.setAttribute('colspan', '2');
    // Reemplazar el texto del título por el nuevo titleText (sin "CARTA GANTT MAAH")
    titleTh.innerHTML = '■&nbsp; ' + titleText;
  }

  // Reparto proporcional según cantidad de días (escala inversa)
  let pctAct, pctObs;
  if(nDayCols <= 7){          pctAct = 30; pctObs = 14; }
  else if(nDayCols <= 14){    pctAct = 26; pctObs = 12; }
  else if(nDayCols <= 31){    pctAct = 23; pctObs = 10; }
  else if(nDayCols <= 45){    pctAct = 20; pctObs = 9;  }
  else {                      pctAct = 18; pctObs = 8;  }
  const pctRestante = 100 - pctAct - pctObs;
  const pctDay = (pctRestante / nDayCols).toFixed(3);

  // Tamaño de fuente adaptable para los números de día
  let dayFontPt;
  if(nDayCols <= 7){          dayFontPt = 8.5; }
  else if(nDayCols <= 14){    dayFontPt = 8;   }
  else if(nDayCols <= 31){    dayFontPt = 6.5; }
  else if(nDayCols <= 45){    dayFontPt = 5.5; }
  else {                      dayFontPt = 5;   }

  // Reconstruir colgroup SIN las columnas eliminadas (solo ACT, OBS, días)
  let newCols = '';
  newCols += '<col style="width:'+pctAct+'%;">';
  newCols += '<col style="width:'+pctObs+'%;">';
  for(let i=0; i<nDayCols; i++){
    newCols += '<col style="width:'+pctDay+'%;">';
  }
  const oldCg = tableClone.querySelector('colgroup');
  if(oldCg) oldCg.innerHTML = newCols;

  const tableHTML = tableClone.outerHTML;

  // ── 3. CSS de impresión ──
  const printCSS = `
    @page { size: landscape; margin: 8mm 6mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; }

    /* RESET QUIRÚRGICO: anular SOLO los anchos px específicos heredados de la pantalla.
       NO usar selectores globales (table.gantt th, td) porque eso anula el colgroup. */
    table.gantt th.th-col-act, table.gantt td.td-act {
      width: auto !important; max-width: none !important; min-width: 0 !important;
    }
    table.gantt th.th-col-obs, table.gantt td.td-obs {
      width: auto !important; max-width: none !important; min-width: 0 !important;
    }
    table.gantt th.th-daynum, table.gantt th.th-dayname,
    table.gantt td.td-day, table.gantt td.bar-cell {
      width: auto !important; max-width: none !important; min-width: 0 !important;
    }

    table.gantt {
      border-collapse: collapse !important;
      font-size: 6.5pt !important;
      white-space: nowrap !important;
      table-layout: fixed !important;
      width: 100% !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    table.gantt th, table.gantt td {
      border: 0.5px solid #888 !important;
      padding: 0 !important;
      text-align: center !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* Ocultar fila 1 del thead (título azul interno) y columnas no imprimibles */
    /* Mostrar la fila de título azul (donde irá "GANTT MES DE MAYO 2026") */
    table.gantt thead tr:first-child { display: table-row !important; }
    table.gantt th.th-title {
      background: #1a3f6f !important;
      color: #fff !important;
      font-size: 11pt !important;
      font-weight: 700 !important;
      text-align: center !important;
      padding: 6px 8px !important;
      letter-spacing: 0.5px !important;
      text-transform: uppercase !important;
    }
    table.gantt th.th-week {
      background: #1a3f6f !important;
      color: #fff !important;
      font-size: 5.8pt !important;
      font-weight: 600 !important;
      padding: 2px 3px !important;
      line-height: 1.15 !important;
      text-align: center !important;
      white-space: normal !important;
      vertical-align: middle !important;
    }
    table.gantt th.th-week .week-prefix,
    table.gantt th.th-week .week-range {
      display: block !important;
      text-align: center !important;
      white-space: normal !important;
    }
    table.gantt th.th-week .week-prefix {
      font-size: 5.4pt !important;
      font-weight: 700 !important;
    }
    table.gantt th.th-week .week-range {
      font-size: 6.1pt !important;
      font-weight: 800 !important;
      text-transform: uppercase !important;
    }
    .td-del, .th-col-del { display: none !important; }
    .edit-btn { display: none !important; }
    .td-term, .th-col-term, .td-d, .th-col-dias { display: none !important; }

    /* ANULAR el borde rojo HOY en impresión (no aplica en vista personalizada) */
    .today-col { border-left: 0.5px solid #888 !important; }
    .th-daynum.today-col, .th-dayname.today-col {
      background: #2c5282 !important; color: #c8d8f0 !important;
    }
    .th-dayname.today-col { color: #8ab0d8 !important; }
    .today-th-label { display: none !important; }

    /* ACTIVIDAD: 2 líneas máximo con quiebre automático */
    table.gantt th.th-col-act {
      font-size: 7pt !important; text-align: left !important; padding: 2px 4px !important;
      white-space: normal !important; word-wrap: break-word !important;
      overflow-wrap: break-word !important; line-height: 1.2 !important;
      vertical-align: middle !important;
      background: #1a3f6f !important; color: #fff !important;
    }
    table.gantt td.td-act {
      text-align: left !important; padding: 2px 4px !important; font-size: 6.5pt !important;
      background: #fff !important; color: #000 !important; line-height: 1.2 !important;
      vertical-align: middle !important;
      white-space: normal !important; word-wrap: break-word !important;
      overflow-wrap: break-word !important;
      text-transform: uppercase !important; font-weight: 500 !important;
      /* Altura mínima = 2 líneas para que TODAS las filas queden parejas */
      height: 22px !important;
    }
    /* Aplicar la misma altura mínima a TODAS las celdas de la fila para uniformidad */
    table.gantt tbody tr { height: 22px !important; }
    table.gantt tbody tr td { height: 22px !important; }

    /* OBS: 2 líneas con quiebre automático */
    table.gantt th.th-col-obs {
      font-size: 6.5pt !important; padding: 2px 3px !important; line-height: 1.15 !important;
      white-space: normal !important; word-wrap: break-word !important;
      overflow-wrap: break-word !important; vertical-align: middle !important;
      background: #1a3f6f !important; color: #fff !important;
    }
    table.gantt td.td-obs {
      font-size: 6pt !important; background: #fff !important; color: #000 !important;
      padding: 2px 3px !important; vertical-align: middle !important;
      line-height: 1.25 !important;
      white-space: normal !important; word-wrap: break-word !important;
      overflow-wrap: break-word !important;
      text-align: center !important; text-transform: uppercase !important;
      height: 22px !important;
    }
    /* Forzar el badge SEMANAL / PLAZO / ANUAL etc. a una línea propia debajo del texto */
    table.gantt td.td-obs .badge, table.gantt td.td-obs span[style*="background"],
    table.gantt td.td-obs > span:last-child {
      display: block !important;
      margin-top: 1px !important;
      width: fit-content !important;
      margin-left: auto !important;
      margin-right: auto !important;
    }

    /* CELDAS DE DÍA: altura UNIFORME en toda la tabla */
    table.gantt td.td-day, table.gantt td.bar-cell {
      height: 22px !important; line-height: 22px !important;
      padding: 0 !important; vertical-align: middle !important;
    }
    table.gantt th.th-daynum {
      height: 16px !important; line-height: 16px !important;
      padding: 1px 0 !important;
      font-size: ${dayFontPt}pt !important;
      background: #2c5282 !important; color: #c8d8f0 !important;
      font-weight: 600 !important; vertical-align: middle !important;
    }
    table.gantt th.th-daynum.wknd {
      background: #1e3a5f !important; color: #7888aa !important;
    }
    table.gantt th.th-dayname {
      height: 13px !important; line-height: 13px !important;
      padding: 0 !important;
      font-size: ${Math.max(4.5, dayFontPt-1.5)}pt !important;
      background: #2c5282 !important; color: #8ab0d8 !important;
      vertical-align: middle !important;
    }
    table.gantt th.th-dayname.wknd { background: #1e3a5f !important; }

    /* Headers azules de las columnas fijas */
    table.gantt th.th-title {
      background: #1a3f6f !important; color: #fff !important;
      font-size: 6.5pt !important; padding: 2px 4px !important;
    }

    /* Días del mes siguiente (modo extendido) */
    table.gantt th.th-daynum.extra { background: #a06310 !important; color: #fbe6c4 !important; }
    table.gantt th.th-daynum.extra.wknd { background: #7a4a0c !important; color: #c4a575 !important; }
    table.gantt th.th-dayname.extra { background: #a06310 !important; color: #fbe6c4 !important; }
    table.gantt th.th-dayname.extra.wknd { background: #7a4a0c !important; color: #c4a575 !important; }
    table.gantt td.td-day.extra { background: #fdf3e0 !important; }
    table.gantt td.td-day.extra.wknd { background: #f0e0c0 !important; }

    /* Fondos de día normales */
    table.gantt td.td-day { background: #e8ecf0 !important; }
    table.gantt td.td-day.wknd { background: #d0d5dd !important; }
    table.gantt td.td-day.othermonth { background: #cdd2da !important; opacity: .6; }
    table.gantt td.bar-cell { background: inherit; }
    /* Separadores visibles entre celdas de barra para que se vean como cuadrados individuales */
    table.gantt td.bar-cell.bar-start,
    table.gantt td.bar-cell.bar-mid {
      border-right: 1.5px solid rgba(255,255,255,0.5) !important;
    }
    /* Bordes redondeados de la barra respetados en impresión */
    table.gantt td.bar-cell.bar-single { border-radius: 4px !important; }
    table.gantt td.bar-cell.bar-start  { border-radius: 4px 0 0 4px !important; }
    table.gantt td.bar-cell.bar-end    { border-radius: 0 4px 4px 0 !important; }
    table.gantt td.bar-cell.bar-mid    { border-radius: 0 !important; }

    /* Aniversarios */
    table.gantt tr.row-aniv td.td-act {
      color: #5a3c00 !important; font-style: italic !important; font-weight: 600 !important;
    }
    table.gantt tr.row-aniv td.td-act, table.gantt tr.row-aniv td.td-obs,
    table.gantt tr.row-aniv td.td-day { background: #fffde7 !important; }
    table.gantt tr.row-aniv td.td-day.wknd { background: #f0ead0 !important; }

    /* Plazo badge */
    .plazo-badge {
      background: #8B0000 !important; color: #fff !important;
      font-size: 6pt !important; padding: 1px 2px !important; border-radius: 2px !important;
    }
  `;

  // Abrir ventana nueva
  const pw = window.open('', '_blank', 'width=1200,height=700');
  if(!pw){ alert('Active las ventanas emergentes para imprimir.'); return; }

  pw.document.write(`<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8">
    <title>${titleText}</title>
    <style>${printCSS}</style>
  </head><body>
    ${tableHTML}
    <script>
      window.onload = function(){
        window.focus();
        window.print();
        setTimeout(function(){ window.close(); }, 800);
      };
    <\/script>
  </body></html>`);
  pw.document.close();
}

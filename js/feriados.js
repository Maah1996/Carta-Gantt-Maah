// ── FIX 4: FERIADOS CHILE ────────────────────────────────────
function getFeriadosChile(year){
  // Calcular Semana Santa (algoritmo de Meeus/Jones/Butcher)
  function easterDate(y){
    const a=y%19,b=Math.floor(y/100),c=y%100;
    const d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25);
    const g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
    const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7;
    const m=Math.floor((a+11*h+22*l)/451);
    const month=Math.floor((h+l-7*m+114)/31)-1;
    const day=((h+l-7*m+114)%31)+1;
    return new Date(y,month,day);
  }
  const easter=easterDate(year);
  const viernesSanto=new Date(easter); viernesSanto.setDate(easter.getDate()-2);
  const juevesSanto=new Date(easter); juevesSanto.setDate(easter.getDate()-3);

  const fk=(m,d,n)=>({key:year+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'),nombre:n});
  const fd=(dt,n)=>({key:dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'),nombre:n});

  const fijos=[
    fk(1,1,'Año Nuevo'),
    fk(5,1,'Día del Trabajo'),
    fk(5,21,'Día de las Glorias Navales'),
    fk(6,20,'Día Nacional de los Pueblos Indígenas'),
    fk(6,29,'San Pedro y San Pablo'),
    fk(7,16,'Día de la Virgen del Carmen'),
    fk(8,15,'Asunción de la Virgen'),
    fk(9,18,'Fiestas Patrias — Independencia'),
    fk(9,19,'Día de las Glorias del Ejército'),
    fk(10,12,'Día del Encuentro de Dos Mundos'),
    fk(10,27,'Día de las Iglesias Evangélicas y Protestantes'),
    fk(11,1,'Día de Todos los Santos'),
    fk(12,8,'Inmaculada Concepción'),
    fk(12,25,'Navidad'),
    fd(juevesSanto,'Jueves Santo'),
    fd(viernesSanto,'Viernes Santo'),
  ];

  const map={};
  fijos.forEach(f=>{ map[f.key]=f.nombre; });
  return map;
}

// Cache de feriados por año
const feriadosCache={};
function getFeriados(year){
  if(!feriadosCache[year]) feriadosCache[year]=getFeriadosChile(year);
  return feriadosCache[year];
}
function feriadoKey(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

// Panel de feriados del mes visible
function renderFeriadosPanel(year, month, isTodaGantt){
  const list=document.getElementById('feriados-list');
  if(!list)return;
  if(isTodaGantt){
    list.innerHTML='<span style="color:#888;font-style:italic;">Selecciona un mes específico para ver sus feriados</span>';
    return;
  }
  const fmap=getFeriados(year);
  const dnames=['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
  const feriadosMes=[];
  for(const key in fmap){
    const [y,m,d]=key.split('-').map(Number);
    if(y===year && (m-1)===month){
      const dt=new Date(y,m-1,d);
      feriadosMes.push({dia:d, nombreDia:dnames[dt.getDay()], motivo:fmap[key]});
    }
  }
  feriadosMes.sort((a,b)=>a.dia-b.dia);
  if(!feriadosMes.length){
    list.innerHTML='<span style="color:#888;font-style:italic;">No hay feriados este mes</span>';
    return;
  }
  list.innerHTML=feriadosMes.map(f=>
    '<span style="background:#fff;border:1px solid #ffd966;border-radius:4px;padding:2px 8px;font-size:10px;color:#5a4000;display:inline-block;">'+
    '<strong style="color:#854f0b;">'+f.nombreDia+' '+String(f.dia).padStart(2,'0')+'</strong> · '+f.motivo+
    '</span>'
  ).join(' ');
}

// Tooltip de feriados
const tooltip=document.getElementById('feriado-tooltip');
function showFeriadoTip(el,nombre){
  tooltip.textContent=nombre;
  tooltip.style.display='block';
  const r=el.getBoundingClientRect();
  tooltip.style.left=Math.min(r.left,window.innerWidth-200)+'px';
  tooltip.style.top=(r.top-tooltip.offsetHeight-6+window.scrollY)+'px';
}
function hideFeriadoTip(){ tooltip.style.display='none'; }
document.addEventListener('click',hideFeriadoTip);

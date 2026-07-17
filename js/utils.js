// ── UTILS ────────────────────────────────────────────────────
function escapeHtml(value){
  const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  return String(value ?? '').replace(/[&<>"']/g, ch=>map[ch]);
}
function escapeAttr(value){
  return escapeHtml(value).replace(/`/g,'&#96;');
}
function jsArg(value){
  return JSON.stringify(String(value ?? ''))
    .replace(/</g,'\\u003C')
    .replace(/>/g,'\\u003E')
    .replace(/&/g,'\\u0026')
    .replace(/\u2028/g,'\\u2028')
    .replace(/\u2029/g,'\\u2029');
}
function jsArgAttr(value){
  return escapeAttr(jsArg(value));
}

function diasRest(fecha){
  const t = new Date(fecha); t.setHours(0,0,0,0);
  return Math.round((t - TODAY) / 86400000);
}
function getColor(diff, isAniv){
  // Vencidos: verde claro — aplica a todos incluidos aniversarios
  if(diff < 0)  return {bg:'#9DCB47',fg:'#9DCB47', hideNum:true};
  if(isAniv)    return {bg:'#c8960a',fg:'#fff', hideNum:false};
  // 0–5 días: rojo + número blanco
  if(diff <= 5) return {bg:'#FF0000',fg:'#fff', hideNum:false};
  // 5–10 días: naranja + número negro
  if(diff <= 10)return {bg:'#FFB400',fg:'#000', hideNum:false};
  // 10–365 días: amarillo + número negro
  if(diff<=365) return {bg:'#FFEB00',fg:'#000', hideNum:false};
  return              {bg:'#2e7d32',fg:'#fff', hideNum:false};
}
function filterGroup(diff, isAniv){
  // Los aniversarios van al grupo 'aniv' SOLO cuando el filtro 'aniv' está activo.
  // Para los otros filtros (amarillo, naranja, rojo, venc) se clasifican por días igual que el resto.
  if(diff < 0) return 'venc';
  if(diff <= 5) return 'rojo';
  if(diff <= 10) return 'naranja';
  return 'amarillo'; // sin límite superior — incluye todo lo que esté a más de 10 días
}
// Función separada para el filtro 'aniv' (solo por tipo)
function matchesFilter(a, filterKey){
  if(currentTipoFilter === '__rgdoc__' && !a.fromRGDOC) return false;
  if(currentTipoFilter !== null && currentTipoFilter !== '__rgdoc__' && a.type !== currentTipoFilter) return false;
  if(filterKey==='all') return true;
  if(filterKey==='aniv') return a.type==='aniversario';
  const diff=diasRest(a.fecha);
  return filterGroup(diff, a.type==='aniversario') === filterKey;
}
function fmtDate(d){
  return String(d.getDate()).padStart(2,'0')+'/'+MSHORT[d.getMonth()]+'/'+String(d.getFullYear()).slice(2);
}
function dLabel(diff){
  if(diff===0) return 'HOY';
  return (diff<0?'':'+') + diff + 'd';
}
function toUpper(str){ return (str||'').toUpperCase().trim(); }

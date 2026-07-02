/* ================= ESTADO LOCAL (cache de lo que hay en Supabase) ================= */
let state = {
  hectareas: 0,
  propiedades: [],
  animales: [],
  stock: [],
  gastos: [],
  vehiculos: [],
  medicamentos: [],
  veterinarios: [],
};
let stockTabActual = 'animal';
let animalFiltroActual = 'Todos';

/* ================= CARGA INICIAL DESDE SUPABASE ================= */
async function loadAll(){
  const [cfg, prop, anim, stk, gas, veh, med, vet] = await Promise.all([
    supabaseClient.from('config').select('*').eq('id',1).single(),
    supabaseClient.from('propiedades').select('*').order('id'),
    supabaseClient.from('animales').select('*').order('id'),
    supabaseClient.from('stock').select('*').order('id'),
    supabaseClient.from('gastos').select('*').order('fecha',{ascending:false}),
    supabaseClient.from('vehiculos').select('*').order('id'),
    supabaseClient.from('medicamentos').select('*').order('id'),
    supabaseClient.from('veterinarios').select('*').order('id'),
  ]);

  if(cfg.error) console.error('config', cfg.error);
  state.hectareas = cfg.data ? cfg.data.hectareas : 0;
  state.propiedades = prop.data || [];
  state.animales = anim.data || [];
  state.stock = stk.data || [];
  state.gastos = (gas.data || []).map(g=>({...g, desc:g.descripcion}));
  state.vehiculos = (veh.data || []).map(v=>({...v, ident:v.identificacion}));
  state.medicamentos = (med.data || []).map(m=>({...m, venc:m.vencimiento || '—'}));
  state.veterinarios = (vet.data || []).map(v=>({...v, tel:v.telefono, dir:v.direccion}));

  renderAll();
}

function showConnError(err){
  console.error(err);
  document.getElementById('pageTitle').textContent = 'Error de conexión con Supabase';
  document.getElementById('alertBox') && (document.getElementById('alertBox').innerHTML =
    `<div class="empty">No se pudo conectar a la base de datos. Revisá js/config.js (SUPABASE_URL / SUPABASE_ANON_KEY) y que hayas ejecutado supabase/schema.sql.</div>`);
}

/* ================= NAVEGACION ================= */
const titles = {
  inicio:["Panel","Resumen del campo"],
  animales:["Hacienda","Administración de animales"],
  stock:["Insumos","Alimentos y despensa"],
  gastos:["Finanzas","Gastos fijos y variables"],
  vehiculos:["Bienes","Vehículos y equipamiento"],
  sanidad:["Sanidad","Medicamentos y veterinarios"],
  mejoras:["Ideas","Mejoras sugeridas"],
};
document.getElementById('navTabs').addEventListener('click', e=>{
  const btn = e.target.closest('button[data-tab]');
  if(!btn) return;
  document.querySelectorAll('#navTabs button').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
  document.getElementById('pathLabel').textContent = titles[btn.dataset.tab][0];
  document.getElementById('pageTitle').textContent = titles[btn.dataset.tab][1];
});

/* ================= HELPERS ================= */
function money(n){ return '$ ' + Number(n).toLocaleString('es-AR',{minimumFractionDigits:0}); }

/* ================= INICIO ================= */
function renderInicio(){
  const totalAnimales = state.animales.length;
  const stockBajo = state.stock.filter(s=>s.cant<=s.min).length;
  const medBajo = state.medicamentos.filter(m=>m.cant<=m.min).length;

  document.getElementById('dashStats').innerHTML = `
    <div class="stat"><div class="num">${state.hectareas}</div><div class="lbl">Hectáreas</div></div>
    <div class="stat"><div class="num">${totalAnimales}</div><div class="lbl">Animales registrados</div></div>
    <div class="stat"><div class="num">${state.vehiculos.length}</div><div class="lbl">Vehículos y bienes</div></div>
    <div class="stat ${(stockBajo+medBajo)>0?'alert':''}"><div class="num">${stockBajo+medBajo}</div><div class="lbl">Alertas de stock</div></div>
  `;

  document.getElementById('propList').innerHTML = state.propiedades.map(p=>`
    <li><span>${p.nombre}</span><span class="tag">${p.tipo}</span></li>
  `).join('') || `<div class="empty">Sin propiedades cargadas.</div>`;

  const alerts = [
    ...state.stock.filter(s=>s.cant<=s.min).map(s=>`Falta reponer <b>${s.item}</b> (${s.cant} ${s.unidad}, mínimo ${s.min}) — ${s.cat==='animal'?'alimento para animales':'despensa'}`),
    ...state.medicamentos.filter(m=>m.cant<=m.min).map(m=>`Falta reponer medicamento <b>${m.nombre}</b> (${m.cant} unid., mínimo ${m.min})`),
  ];
  document.getElementById('alertBox').innerHTML = alerts.length
    ? `<ul class="improve-list">${alerts.map(a=>`<li>${a}</li>`).join('')}</ul>`
    : `<div class="empty">Sin alertas activas por el momento.</div>`;

  document.getElementById('hectareasInput').value = state.hectareas;
}
async function guardarHectareas(){
  const val = Number(document.getElementById('hectareasInput').value)||0;
  const {error} = await supabaseClient.from('config').update({hectareas:val}).eq('id',1);
  if(error) return showConnError(error);
  state.hectareas = val;
  renderInicio();
}

/* ================= ANIMALES ================= */
function renderAnimalFiltro(){
  const tipos = ['Todos', ...new Set(state.animales.map(a=>a.tipo))];
  document.getElementById('animalFiltro').innerHTML = tipos.map(t=>
    `<button class="${t===animalFiltroActual?'active':''}" onclick="filtrarAnimales('${t}')">${t}</button>`
  ).join('');
}
function filtrarAnimales(t){ animalFiltroActual = t; renderAnimales(); }
async function agregarAnimal(){
  const tipo = document.getElementById('anTipo').value;
  const nombre = document.getElementById('anNombre').value.trim() || '(sin identificar)';
  const edad = Number(document.getElementById('anEdad').value)||0;
  const sexo = document.getElementById('anSexo').value;
  const {data, error} = await supabaseClient.from('animales').insert({tipo,nombre,edad,sexo}).select().single();
  if(error) return showConnError(error);
  state.animales.push(data);
  document.getElementById('anNombre').value='';
  document.getElementById('anEdad').value='';
  renderAnimalFiltro(); renderAnimales(); renderInicio();
}
async function bajaAnimal(id){
  const {error} = await supabaseClient.from('animales').delete().eq('id', id);
  if(error) return showConnError(error);
  state.animales = state.animales.filter(a=>a.id!==id);
  renderAnimalFiltro(); renderAnimales(); renderInicio();
}
function renderAnimales(){
  renderAnimalFiltro();
  const lista = animalFiltroActual==='Todos' ? state.animales : state.animales.filter(a=>a.tipo===animalFiltroActual);
  if(!lista.length){
    document.getElementById('animalTablaWrap').innerHTML = `<div class="empty">No hay animales cargados en esta categoría.</div>`;
    return;
  }
  document.getElementById('animalTablaWrap').innerHTML = `
  <table><thead><tr><th>Tipo</th><th>Identificación</th><th>Sexo</th><th class="num">Edad (años)</th><th></th></tr></thead>
  <tbody>
  ${lista.map(a=>`<tr>
    <td>${a.tipo}</td><td>${a.nombre}</td><td>${a.sexo}</td><td class="num">${a.edad}</td>
    <td><button class="btn small danger" onclick="bajaAnimal(${a.id})">Dar de baja</button></td>
  </tr>`).join('')}
  </tbody></table>`;
}

/* ================= STOCK ================= */
function setStockTab(t){
  stockTabActual = t;
  document.getElementById('stockTabAnimal').classList.toggle('active', t==='animal');
  document.getElementById('stockTabDespensa').classList.toggle('active', t==='despensa');
  document.getElementById('stockFormTitle').textContent = 'Nuevo insumo — ' + (t==='animal' ? 'Alimento para animales' : 'Despensa (casa)');
  document.getElementById('stockListTitle').textContent = t==='animal' ? 'Stock de alimentos para animales' : 'Stock de despensa';
  renderStock();
}
async function agregarStock(){
  const item = document.getElementById('stItem').value.trim();
  if(!item) return;
  const cant = Number(document.getElementById('stCant').value)||0;
  const unidad = document.getElementById('stUnidad').value.trim()||'unid.';
  const min = Number(document.getElementById('stMin').value)||0;
  const {data, error} = await supabaseClient.from('stock').insert({cat:stockTabActual,item,cant,unidad,min}).select().single();
  if(error) return showConnError(error);
  state.stock.push(data);
  document.getElementById('stItem').value='';document.getElementById('stCant').value='';
  document.getElementById('stUnidad').value='';document.getElementById('stMin').value='';
  renderStock(); renderInicio();
}
async function bajaStock(id){
  const {error} = await supabaseClient.from('stock').delete().eq('id', id);
  if(error) return showConnError(error);
  state.stock = state.stock.filter(s=>s.id!==id);
  renderStock(); renderInicio();
}
function renderStock(){
  const lista = state.stock.filter(s=>s.cat===stockTabActual);
  if(!lista.length){
    document.getElementById('stockTablaWrap').innerHTML = `<div class="empty">No hay insumos cargados todavía.</div>`;
    return;
  }
  document.getElementById('stockTablaWrap').innerHTML = `
  <table><thead><tr><th>Insumo</th><th class="num">Cantidad</th><th>Unidad</th><th class="num">Mínimo</th><th>Estado</th><th></th></tr></thead>
  <tbody>
  ${lista.map(s=>{
    const bajo = s.cant<=s.min;
    return `<tr>
      <td>${s.item}</td><td class="num">${s.cant}</td><td>${s.unidad}</td><td class="num">${s.min}</td>
      <td><span class="pill ${bajo?'low':'ok'}">${bajo?'Falta reponer':'OK'}</span></td>
      <td><button class="btn small danger" onclick="bajaStock(${s.id})">Quitar</button></td>
    </tr>`;
  }).join('')}
  </tbody></table>`;
}

/* ================= GASTOS ================= */
async function agregarGasto(){
  const categoria = document.getElementById('gaCategoria').value;
  const tipo = document.getElementById('gaTipo').value;
  const descripcion = document.getElementById('gaDesc').value.trim() || categoria;
  const monto = Number(document.getElementById('gaMonto').value)||0;
  const fecha = document.getElementById('gaFecha').value || new Date().toISOString().slice(0,10);
  const {data, error} = await supabaseClient.from('gastos').insert({categoria,tipo,descripcion,monto,fecha}).select().single();
  if(error) return showConnError(error);
  state.gastos.unshift({...data, desc:data.descripcion});
  document.getElementById('gaDesc').value='';document.getElementById('gaMonto').value='';document.getElementById('gaFecha').value='';
  renderGastos(); renderInicio();
}
async function bajaGasto(id){
  const {error} = await supabaseClient.from('gastos').delete().eq('id', id);
  if(error) return showConnError(error);
  state.gastos = state.gastos.filter(g=>g.id!==id);
  renderGastos(); renderInicio();
}
function renderGastos(){
  const totalFijo = state.gastos.filter(g=>g.tipo==='Fijo').reduce((a,g)=>a+Number(g.monto),0);
  const totalVar = state.gastos.filter(g=>g.tipo==='Variable').reduce((a,g)=>a+Number(g.monto),0);
  document.getElementById('gastoResumen').innerHTML = `
    <div class="stat"><div class="num">${money(totalFijo)}</div><div class="lbl">Gastos fijos</div></div>
    <div class="stat"><div class="num">${money(totalVar)}</div><div class="lbl">Gastos variables</div></div>
    <div class="stat"><div class="num">${money(totalFijo+totalVar)}</div><div class="lbl">Total registrado</div></div>
  `;
  if(!state.gastos.length){
    document.getElementById('gastoTablaWrap').innerHTML = `<div class="empty">Todavía no hay gastos registrados.</div>`;
    return;
  }
  const ordenados = [...state.gastos].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  document.getElementById('gastoTablaWrap').innerHTML = `
  <table><thead><tr><th>Fecha</th><th>Categoría</th><th>Tipo</th><th>Descripción</th><th class="num">Monto</th><th></th></tr></thead>
  <tbody>
  ${ordenados.map(g=>`<tr>
    <td class="mono">${g.fecha}</td><td>${g.categoria}</td>
    <td><span class="pill ${g.tipo==='Fijo'?'fijo':'variable'}">${g.tipo}</span></td>
    <td>${g.desc}</td><td class="num">${money(g.monto)}</td>
    <td><button class="btn small danger" onclick="bajaGasto(${g.id})">Quitar</button></td>
  </tr>`).join('')}
  </tbody></table>`;
}

/* ================= VEHICULOS ================= */
async function agregarVehiculo(){
  const tipo = document.getElementById('veTipo').value;
  const modelo = document.getElementById('veModelo').value.trim() || '(sin especificar)';
  const identificacion = document.getElementById('vePatente').value.trim() || '—';
  const estado = document.getElementById('veEstado').value;
  const {data, error} = await supabaseClient.from('vehiculos').insert({tipo,modelo,identificacion,estado}).select().single();
  if(error) return showConnError(error);
  state.vehiculos.push({...data, ident:data.identificacion});
  document.getElementById('veModelo').value='';document.getElementById('vePatente').value='';
  renderVehiculos(); renderInicio();
}
async function bajaVehiculo(id){
  const {error} = await supabaseClient.from('vehiculos').delete().eq('id', id);
  if(error) return showConnError(error);
  state.vehiculos = state.vehiculos.filter(v=>v.id!==id);
  renderVehiculos(); renderInicio();
}
function renderVehiculos(){
  if(!state.vehiculos.length){
    document.getElementById('vehTablaWrap').innerHTML = `<div class="empty">No hay vehículos ni bienes cargados.</div>`;
    return;
  }
  document.getElementById('vehTablaWrap').innerHTML = `
  <table><thead><tr><th>Tipo</th><th>Marca / Modelo</th><th>Identificación</th><th>Estado</th><th></th></tr></thead>
  <tbody>
  ${state.vehiculos.map(v=>`<tr>
    <td>${v.tipo}</td><td>${v.modelo}</td><td class="mono">${v.ident}</td>
    <td><span class="pill ${v.estado==='Operativo'?'ok':'low'}">${v.estado}</span></td>
    <td><button class="btn small danger" onclick="bajaVehiculo(${v.id})">Dar de baja</button></td>
  </tr>`).join('')}
  </tbody></table>`;
}

/* ================= SANIDAD ================= */
async function agregarMedicamento(){
  const nombre = document.getElementById('meNombre').value.trim();
  if(!nombre) return;
  const cant = Number(document.getElementById('meCant').value)||0;
  const min = Number(document.getElementById('meMin').value)||0;
  const vencimiento = document.getElementById('meVenc').value || null;
  const {data, error} = await supabaseClient.from('medicamentos').insert({nombre,cant,min,vencimiento}).select().single();
  if(error) return showConnError(error);
  state.medicamentos.push({...data, venc:data.vencimiento || '—'});
  document.getElementById('meNombre').value='';document.getElementById('meCant').value='';
  document.getElementById('meMin').value='';document.getElementById('meVenc').value='';
  renderMedicamentos(); renderInicio();
}
async function bajaMedicamento(id){
  const {error} = await supabaseClient.from('medicamentos').delete().eq('id', id);
  if(error) return showConnError(error);
  state.medicamentos = state.medicamentos.filter(m=>m.id!==id);
  renderMedicamentos(); renderInicio();
}
function renderMedicamentos(){
  if(!state.medicamentos.length){
    document.getElementById('medTablaWrap').innerHTML = `<div class="empty">No hay medicamentos cargados.</div>`;
    return;
  }
  document.getElementById('medTablaWrap').innerHTML = `
  <table><thead><tr><th>Medicamento</th><th class="num">Cantidad</th><th class="num">Mínimo</th><th>Vencimiento</th><th>Estado</th><th></th></tr></thead>
  <tbody>
  ${state.medicamentos.map(m=>{
    const bajo = m.cant<=m.min;
    return `<tr>
      <td>${m.nombre}</td><td class="num">${m.cant}</td><td class="num">${m.min}</td><td class="mono">${m.venc}</td>
      <td><span class="pill ${bajo?'low':'ok'}">${bajo?'Falta reponer':'OK'}</span></td>
      <td><button class="btn small danger" onclick="bajaMedicamento(${m.id})">Quitar</button></td>
    </tr>`;
  }).join('')}
  </tbody></table>`;
}
async function agregarVet(){
  const nombre = document.getElementById('vetNombre').value.trim();
  if(!nombre) return;
  const telefono = document.getElementById('vetTel').value.trim()||'—';
  const direccion = document.getElementById('vetDir').value.trim()||'—';
  const {data, error} = await supabaseClient.from('veterinarios').insert({nombre,telefono,direccion}).select().single();
  if(error) return showConnError(error);
  state.veterinarios.push({...data, tel:data.telefono, dir:data.direccion});
  document.getElementById('vetNombre').value='';document.getElementById('vetTel').value='';document.getElementById('vetDir').value='';
  renderVets();
}
async function bajaVet(id){
  const {error} = await supabaseClient.from('veterinarios').delete().eq('id', id);
  if(error) return showConnError(error);
  state.veterinarios = state.veterinarios.filter(v=>v.id!==id);
  renderVets();
}
function renderVets(){
  if(!state.veterinarios.length){
    document.getElementById('vetListWrap').innerHTML = `<div class="empty">No hay veterinarios cargados.</div>`;
    return;
  }
  document.getElementById('vetListWrap').innerHTML = state.veterinarios.map(v=>`
    <div class="vet-card">
      <div>
        <div class="name">${v.nombre}</div>
        <div class="meta">${v.tel} · ${v.dir}</div>
      </div>
      <div style="display:flex;gap:8px;">
        <a class="btn small" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.dir)}">Ver en Google Maps</a>
        <button class="btn small danger" onclick="bajaVet(${v.id})">Quitar</button>
      </div>
    </div>
  `).join('');
}

/* ================= INIT ================= */
function renderAll(){
  renderInicio();
  renderAnimales();
  renderStock();
  renderGastos();
  renderVehiculos();
  renderMedicamentos();
  renderVets();
}
loadAll().catch(showConnError);

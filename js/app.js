/* ================= ESTADO LOCAL (cache de lo que hay en Supabase) ================= */
let state = {
  hectareas: 0,
  propiedades: [],
  animales: [],
  stock: [],
  gastos: [],
  ingresos: [],
  vehiculos: [],
  medicamentos: [],
  veterinarios: [],
  cargas: [], // combustible de todos los vehículos (se filtra por vehiculo_id al mostrar)
};
let stockTabActual = 'animal';
let animalFiltroActual = 'Todos';
let chartMes = null;
let chartCategoria = null;
let detalleActual = { tabla:null, id:null };
let mantenimientoVehiculoId = null;

/* ================= AUTENTICACIÓN ================= */
async function hacerLogin(){
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  const errBox = document.getElementById('loginError');
  errBox.style.display = 'none';
  if(!email || !pass){
    errBox.textContent = 'Completá email y contraseña.';
    errBox.style.display = 'block';
    return;
  }
  const {data, error} = await supabaseClient.auth.signInWithPassword({email, password: pass});
  if(error){
    errBox.textContent = 'No pudimos iniciar sesión: revisá el email y la contraseña.';
    errBox.style.display = 'block';
    return;
  }
  await onLoginOk(data.session);
}
async function hacerLogout(){
  await supabaseClient.auth.signOut();
  document.querySelector('.app').classList.remove('ready');
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPass').value = '';
}
async function onLoginOk(session){
  document.getElementById('loginScreen').style.display = 'none';
  document.querySelector('.app').classList.add('ready');
  document.getElementById('userEmailLabel').textContent = session.user.email;
  await loadAll();
}
async function checkSessionOnLoad(){
  const {data} = await supabaseClient.auth.getSession();
  if(data.session){
    await onLoginOk(data.session);
  }
}

/* ================= CARGA INICIAL DESDE SUPABASE ================= */
async function loadAll(){
  const [cfg, prop, anim, stk, gas, ing, veh, med, vet, carg] = await Promise.all([
    supabaseClient.from('config').select('*').eq('id',1).single(),
    supabaseClient.from('propiedades').select('*').order('id'),
    supabaseClient.from('animales').select('*').order('id'),
    supabaseClient.from('stock').select('*').order('id'),
    supabaseClient.from('gastos').select('*').order('fecha',{ascending:false}),
    supabaseClient.from('ingresos').select('*').order('fecha',{ascending:false}),
    supabaseClient.from('vehiculos').select('*').order('id'),
    supabaseClient.from('medicamentos').select('*').order('id'),
    supabaseClient.from('veterinarios').select('*').order('id'),
    supabaseClient.from('combustible_cargas').select('*').order('fecha',{ascending:false}),
  ]);

  if(cfg.error) console.error('config', cfg.error);
  state.hectareas = cfg.data ? cfg.data.hectareas : 0;
  state.propiedades = prop.data || [];
  state.animales = anim.data || [];
  state.stock = stk.data || [];
  state.gastos = (gas.data || []).map(g=>({...g, desc:g.descripcion}));
  state.ingresos = (ing.data || []).map(i=>({...i, desc:i.descripcion}));
  state.vehiculos = (veh.data || []).map(v=>({...v, ident:v.identificacion}));
  state.medicamentos = (med.data || []).map(m=>({...m, venc:m.vencimiento || '—'}));
  state.veterinarios = (vet.data || []).map(v=>({...v, tel:v.telefono, dir:v.direccion}));
  state.cargas = carg.data || [];

  renderAll();
}

function showConnError(err){
  console.error(err);
  document.getElementById('pageTitle').textContent = 'Error de conexión con Supabase';
  const box = document.getElementById('alertBox');
  if(box) box.innerHTML = `<div class="empty">No se pudo completar la operación. Revisá la consola (F12) para más detalle.</div>`;
}

/* ================= NAVEGACION ================= */
const titles = {
  inicio:["Panel","Resumen del campo"],
  dashboard:["Panel","Dashboard financiero"],
  animales:["Hacienda","Administración de animales"],
  stock:["Insumos","Alimentos y despensa"],
  ingresos:["Finanzas","Ingresos operativos"],
  gastos:["Finanzas","Gastos fijos y variables"],
  vehiculos:["Bienes","Vehículos y equipamiento"],
  sanidad:["Sanidad","Medicamentos y veterinarios"],
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
  if(btn.dataset.tab === 'dashboard') renderDashboard();
});

/* ================= HELPERS ================= */
function money(n){ return '$ ' + Number(n).toLocaleString('es-AR',{minimumFractionDigits:0}); }
const PALETA = ['#A8562E','#3D4A2A','#C9A15A','#566B3B','#7C8F5A','#7E3F22','#E4C98A'];

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

/* ================= DASHBOARD ================= */
function renderDashboard(){
  const totalIngresos = state.ingresos.reduce((a,i)=>a+Number(i.monto),0);
  const totalGastos = state.gastos.reduce((a,g)=>a+Number(g.monto),0);
  const balance = totalIngresos - totalGastos;

  document.getElementById('dashCards').innerHTML = `
    <div class="dash-card pos"><div class="lbl">Ingresos totales</div><div class="num">${money(totalIngresos)}</div></div>
    <div class="dash-card neg"><div class="lbl">Egresos totales</div><div class="num">${money(totalGastos)}</div></div>
    <div class="dash-card ${balance>=0?'pos':'neg'}"><div class="lbl">Balance</div><div class="num">${money(balance)}</div></div>
    <div class="dash-card"><div class="lbl">Registros de gasto</div><div class="num">${state.gastos.length}</div></div>
  `;

  // ---- Gráfico 1: gastos por mes (últimos 6 meses) ----
  const hoy = new Date();
  const meses = [];
  for(let i=5;i>=0;i--){
    const d = new Date(hoy.getFullYear(), hoy.getMonth()-i, 1);
    meses.push({key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label:d.toLocaleDateString('es-AR',{month:'short',year:'2-digit'})});
  }
  const totalesPorMes = meses.map(m=>
    state.gastos.filter(g=>g.fecha && g.fecha.startsWith(m.key)).reduce((a,g)=>a+Number(g.monto),0)
  );
  const ctx1 = document.getElementById('chartGastosMes').getContext('2d');
  if(chartMes) chartMes.destroy();
  chartMes = new Chart(ctx1, {
    type:'bar',
    data:{ labels: meses.map(m=>m.label), datasets:[{ data: totalesPorMes, backgroundColor:'#A8562E', borderRadius:5, maxBarThickness:36 }] },
    options:{
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>money(c.raw)}}},
      scales:{ y:{ beginAtZero:true, grid:{color:'#EAE0C8'}, ticks:{color:'#566B3B',font:{size:11}} },
               x:{ grid:{display:false}, ticks:{color:'#566B3B',font:{size:11}} } }
    }
  });

  // ---- Gráfico 2: gasto por categoría ----
  const categorias = [...new Set(state.gastos.map(g=>g.categoria))];
  const totalesPorCat = categorias.map(c=> state.gastos.filter(g=>g.categoria===c).reduce((a,g)=>a+Number(g.monto),0));
  const ctx2 = document.getElementById('chartGastosCategoria').getContext('2d');
  if(chartCategoria) chartCategoria.destroy();
  chartCategoria = new Chart(ctx2, {
    type:'bar',
    data:{ labels: categorias, datasets:[{ data: totalesPorCat, backgroundColor: PALETA, borderRadius:5 }] },
    options:{
      indexAxis:'y',
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>money(c.raw)}}},
      scales:{ x:{ beginAtZero:true, grid:{color:'#EAE0C8'}, ticks:{color:'#566B3B',font:{size:11}} },
               y:{ grid:{display:false}, ticks:{color:'#566B3B',font:{size:11}} } }
    }
  });
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
  <table><thead><tr><th>Tipo</th><th>Identificación</th><th>Sexo</th><th class="num">Edad (años)</th><th></th><th></th></tr></thead>
  <tbody>
  ${lista.map(a=>`<tr>
    <td>${a.tipo}</td><td>${a.nombre}</td><td>${a.sexo}</td><td class="num">${a.edad}</td>
    <td><button class="btn small" onclick="abrirDetalle('animales',${a.id})">Ver detalle</button></td>
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

/* ================= INGRESOS ================= */
async function agregarIngreso(){
  const categoria = document.getElementById('inCategoria').value;
  const descripcion = document.getElementById('inDesc').value.trim() || categoria;
  const monto = Number(document.getElementById('inMonto').value)||0;
  const fecha = document.getElementById('inFecha').value || new Date().toISOString().slice(0,10);
  const {data, error} = await supabaseClient.from('ingresos').insert({categoria,descripcion,monto,fecha}).select().single();
  if(error) return showConnError(error);
  state.ingresos.unshift({...data, desc:data.descripcion});
  document.getElementById('inDesc').value='';document.getElementById('inMonto').value='';document.getElementById('inFecha').value='';
  renderIngresos();
}
async function bajaIngreso(id){
  const {error} = await supabaseClient.from('ingresos').delete().eq('id', id);
  if(error) return showConnError(error);
  state.ingresos = state.ingresos.filter(i=>i.id!==id);
  renderIngresos();
}
function renderIngresos(){
  const total = state.ingresos.reduce((a,i)=>a+Number(i.monto),0);
  const esteMes = new Date().toISOString().slice(0,7);
  const totalMes = state.ingresos.filter(i=>i.fecha && i.fecha.startsWith(esteMes)).reduce((a,i)=>a+Number(i.monto),0);
  document.getElementById('ingresoResumen').innerHTML = `
    <div class="stat"><div class="num">${money(total)}</div><div class="lbl">Total registrado</div></div>
    <div class="stat"><div class="num">${money(totalMes)}</div><div class="lbl">Este mes</div></div>
    <div class="stat"><div class="num">${state.ingresos.length}</div><div class="lbl">Movimientos</div></div>
  `;
  if(!state.ingresos.length){
    document.getElementById('ingresoTablaWrap').innerHTML = `<div class="empty">Todavía no hay ingresos registrados.</div>`;
    return;
  }
  const ordenados = [...state.ingresos].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  document.getElementById('ingresoTablaWrap').innerHTML = `
  <table><thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th class="num">Monto</th><th></th><th></th></tr></thead>
  <tbody>
  ${ordenados.map(i=>`<tr>
    <td class="mono">${i.fecha}</td><td>${i.categoria}</td><td>${i.desc}</td><td class="num">${money(i.monto)}</td>
    <td><button class="btn small" onclick="abrirDetalle('ingresos',${i.id})">Ver detalle</button></td>
    <td><button class="btn small danger" onclick="bajaIngreso(${i.id})">Quitar</button></td>
  </tr>`).join('')}
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
  <table><thead><tr><th>Fecha</th><th>Categoría</th><th>Tipo</th><th>Descripción</th><th class="num">Monto</th><th></th><th></th></tr></thead>
  <tbody>
  ${ordenados.map(g=>`<tr>
    <td class="mono">${g.fecha}</td><td>${g.categoria}</td>
    <td><span class="pill ${g.tipo==='Fijo'?'fijo':'variable'}">${g.tipo}</span></td>
    <td>${g.desc}</td><td class="num">${money(g.monto)}</td>
    <td><button class="btn small" onclick="abrirDetalle('gastos',${g.id})">Ver detalle</button></td>
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
  <table><thead><tr><th>Tipo</th><th>Marca / Modelo</th><th>Identificación</th><th class="num">Km</th><th>Estado</th><th></th><th></th></tr></thead>
  <tbody>
  ${state.vehiculos.map(v=>`<tr>
    <td>${v.tipo}</td><td>${v.modelo}</td><td class="mono">${v.ident}</td><td class="num">${v.kilometraje ?? 0}</td>
    <td><span class="pill ${v.estado==='Operativo'?'ok':'low'}">${v.estado}</span></td>
    <td><button class="btn small" onclick="abrirMantenimiento(${v.id})">Mantenimiento</button></td>
    <td><button class="btn small danger" onclick="bajaVehiculo(${v.id})">Dar de baja</button></td>
  </tr>`).join('')}
  </tbody></table>`;
}

/* ---- Mantenimiento de vehículo ---- */
function abrirMantenimiento(id){
  const v = state.vehiculos.find(x=>x.id===id);
  if(!v) return;
  mantenimientoVehiculoId = id;
  document.getElementById('maintTitle').textContent = `Mantenimiento — ${v.modelo}`;
  document.getElementById('maNumInterno').value = v.numero_interno || '';
  document.getElementById('maKm').value = v.kilometraje || 0;
  document.getElementById('maUltService').value = v.ultimo_service || '';
  document.getElementById('maRecorrido').value = v.recorrido_habitual || '';
  document.getElementById('cbFecha').value='';document.getElementById('cbLitros').value='';
  document.getElementById('cbKm').value='';document.getElementById('cbCosto').value='';
  renderCargas();
  document.getElementById('maintModal').classList.add('open');
}
function cerrarMantenimiento(){
  document.getElementById('maintModal').classList.remove('open');
  mantenimientoVehiculoId = null;
}
async function guardarMantenimiento(){
  if(!mantenimientoVehiculoId) return;
  const numero_interno = document.getElementById('maNumInterno').value.trim();
  const kilometraje = Number(document.getElementById('maKm').value)||0;
  const ultimo_service = document.getElementById('maUltService').value || null;
  const recorrido_habitual = document.getElementById('maRecorrido').value.trim();
  const {error} = await supabaseClient.from('vehiculos')
    .update({numero_interno, kilometraje, ultimo_service, recorrido_habitual})
    .eq('id', mantenimientoVehiculoId);
  if(error) return showConnError(error);
  const v = state.vehiculos.find(x=>x.id===mantenimientoVehiculoId);
  Object.assign(v, {numero_interno, kilometraje, ultimo_service, recorrido_habitual});
  renderVehiculos();
}
async function agregarCarga(){
  if(!mantenimientoVehiculoId) return;
  const fecha = document.getElementById('cbFecha').value || new Date().toISOString().slice(0,10);
  const litros = Number(document.getElementById('cbLitros').value)||0;
  const kilometraje = Number(document.getElementById('cbKm').value)||null;
  const costo = Number(document.getElementById('cbCosto').value)||null;
  const {data, error} = await supabaseClient.from('combustible_cargas')
    .insert({vehiculo_id:mantenimientoVehiculoId, fecha, litros, kilometraje, costo}).select().single();
  if(error) return showConnError(error);
  state.cargas.unshift(data);
  document.getElementById('cbFecha').value='';document.getElementById('cbLitros').value='';
  document.getElementById('cbKm').value='';document.getElementById('cbCosto').value='';
  renderCargas();
}
async function bajaCarga(id){
  const {error} = await supabaseClient.from('combustible_cargas').delete().eq('id', id);
  if(error) return showConnError(error);
  state.cargas = state.cargas.filter(c=>c.id!==id);
  renderCargas();
}
function renderCargas(){
  const lista = state.cargas.filter(c=>c.vehiculo_id===mantenimientoVehiculoId)
    .sort((a,b)=>b.fecha.localeCompare(a.fecha));
  if(!lista.length){
    document.getElementById('cargasTablaWrap').innerHTML = `<div class="empty">Sin cargas de combustible registradas.</div>`;
    return;
  }
  document.getElementById('cargasTablaWrap').innerHTML = `
  <table><thead><tr><th>Fecha</th><th class="num">Litros</th><th class="num">Km</th><th class="num">Costo</th><th></th></tr></thead>
  <tbody>
  ${lista.map(c=>`<tr>
    <td class="mono">${c.fecha}</td><td class="num">${c.litros}</td><td class="num">${c.kilometraje ?? '—'}</td>
    <td class="num">${c.costo!=null ? money(c.costo) : '—'}</td>
    <td><button class="btn small danger" onclick="bajaCarga(${c.id})">Quitar</button></td>
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
  <table><thead><tr><th>Medicamento</th><th class="num">Cantidad</th><th class="num">Mínimo</th><th>Vencimiento</th><th>Estado</th><th></th><th></th></tr></thead>
  <tbody>
  ${state.medicamentos.map(m=>{
    const bajo = m.cant<=m.min;
    return `<tr>
      <td>${m.nombre}</td><td class="num">${m.cant}</td><td class="num">${m.min}</td><td class="mono">${m.venc}</td>
      <td><span class="pill ${bajo?'low':'ok'}">${bajo?'Falta reponer':'OK'}</span></td>
      <td><button class="btn small" onclick="abrirDetalle('medicamentos',${m.id})">Ver detalle</button></td>
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

/* ================= DETALLE + PDF (animales / gastos / ingresos / medicamentos) ================= */
function abrirDetalle(tabla, id){
  const arr = state[tabla];
  const item = arr.find(x=>x.id===id);
  if(!item) return;
  detalleActual = {tabla, id};

  let campos = [];
  if(tabla==='animales'){
    document.getElementById('detailTitle').textContent = item.nombre;
    document.getElementById('detailSub').textContent = 'Ficha del animal';
    campos = [['Tipo',item.tipo],['Sexo',item.sexo],['Edad',item.edad+' años'],['Alta',item.created_at ? item.created_at.slice(0,10) : '—']];
  } else if(tabla==='gastos'){
    document.getElementById('detailTitle').textContent = item.desc;
    document.getElementById('detailSub').textContent = 'Detalle del gasto';
    campos = [['Categoría',item.categoria],['Tipo',item.tipo],['Monto',money(item.monto)],['Fecha',item.fecha]];
  } else if(tabla==='ingresos'){
    document.getElementById('detailTitle').textContent = item.desc;
    document.getElementById('detailSub').textContent = 'Detalle del ingreso';
    campos = [['Categoría',item.categoria],['Monto',money(item.monto)],['Fecha',item.fecha]];
  } else if(tabla==='medicamentos'){
    document.getElementById('detailTitle').textContent = item.nombre;
    document.getElementById('detailSub').textContent = 'Detalle del medicamento';
    campos = [['Cantidad',item.cant],['Mínimo',item.min],['Vencimiento',item.venc]];
  }
  document.getElementById('detailGrid').innerHTML = campos.map(([k,v])=>`
    <div class="detail-item"><div class="k">${k}</div><div class="v">${v}</div></div>
  `).join('');

  renderPdfLink(item.pdf_url);
  document.getElementById('detailModal').classList.add('open');
}
function renderPdfLink(url){
  const box = document.getElementById('pdfCurrentLink');
  box.innerHTML = url
    ? `<a href="${url}" target="_blank" rel="noopener">Ver PDF adjunto</a>`
    : `<span style="color:var(--olive-2);">Sin PDF cargado todavía</span>`;
}
function cerrarDetalle(){
  document.getElementById('detailModal').classList.remove('open');
  detalleActual = {tabla:null, id:null};
}
async function subirPdf(ev){
  const file = ev.target.files[0];
  if(!file || !detalleActual.tabla) return;
  const {tabla, id} = detalleActual;
  const path = `${tabla}/${id}/${Date.now()}_${file.name}`;
  const {error: upErr} = await supabaseClient.storage.from('adjuntos').upload(path, file, {upsert:true});
  if(upErr) return showConnError(upErr);
  const { data: pub } = supabaseClient.storage.from('adjuntos').getPublicUrl(path);
  const url = pub.publicUrl;
  const {error} = await supabaseClient.from(tabla).update({pdf_url:url}).eq('id', id);
  if(error) return showConnError(error);

  const item = state[tabla].find(x=>x.id===id);
  if(item) item.pdf_url = url;
  renderPdfLink(url);

  if(tabla==='animales') renderAnimales();
  if(tabla==='gastos') renderGastos();
  if(tabla==='ingresos') renderIngresos();
  if(tabla==='medicamentos') renderMedicamentos();
}

/* ================= EXPORTAR A EXCEL ================= */
function exportExcel(){
  const wb = XLSX.utils.book_new();
  const hoja = (arr, cols) => XLSX.utils.json_to_sheet(arr.map(r=>{
    const o = {};
    cols.forEach(([k,label])=> o[label] = r[k]);
    return o;
  }));
  XLSX.utils.book_append_sheet(wb, hoja(state.animales, [['tipo','Tipo'],['nombre','Identificación'],['sexo','Sexo'],['edad','Edad']]), 'Animales');
  XLSX.utils.book_append_sheet(wb, hoja(state.stock, [['cat','Categoría'],['item','Insumo'],['cant','Cantidad'],['unidad','Unidad'],['min','Mínimo']]), 'Stock');
  XLSX.utils.book_append_sheet(wb, hoja(state.ingresos, [['fecha','Fecha'],['categoria','Categoría'],['desc','Descripción'],['monto','Monto']]), 'Ingresos');
  XLSX.utils.book_append_sheet(wb, hoja(state.gastos, [['fecha','Fecha'],['categoria','Categoría'],['tipo','Tipo'],['desc','Descripción'],['monto','Monto']]), 'Gastos');
  XLSX.utils.book_append_sheet(wb, hoja(state.vehiculos, [['tipo','Tipo'],['modelo','Modelo'],['ident','Identificación'],['kilometraje','Km'],['estado','Estado']]), 'Vehiculos');
  XLSX.utils.book_append_sheet(wb, hoja(state.medicamentos, [['nombre','Medicamento'],['cant','Cantidad'],['min','Mínimo'],['venc','Vencimiento']]), 'Medicamentos');
  XLSX.utils.book_append_sheet(wb, hoja(state.veterinarios, [['nombre','Nombre'],['tel','Teléfono'],['dir','Dirección']]), 'Veterinarios');
  XLSX.writeFile(wb, 'tres_manantiales_reporte.xlsx');
}

/* ================= EXPORT / IMPORT (respaldo JSON) ================= */
function exportData(){
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'tres_manantiales_respaldo.json';
  a.click();
  URL.revokeObjectURL(url);
}
function importData(){
  alert('La importación manual ya no aplica: los datos ahora se guardan directamente en Supabase.');
}

/* ================= INIT ================= */
function renderAll(){
  renderInicio();
  renderAnimales();
  renderStock();
  renderIngresos();
  renderGastos();
  renderVehiculos();
  renderMedicamentos();
  renderVets();
}
checkSessionOnLoad();

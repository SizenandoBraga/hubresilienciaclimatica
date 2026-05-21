import { auth, db } from "./firebase-init.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const LOGIN_PAGE = "./login.html";
const COOPERATIVAS_PAGE = "./cooperativas.html";
const PUBLIC_DASHBOARD_DOC = "index";

let charts = {};

const navButtons = document.querySelectorAll(".gov-nav-btn[data-section]");
const sections = document.querySelectorAll(".gov-section");
const pageSubtitle = document.getElementById("pageSubtitle");

const logoutBtn = document.getElementById("logoutBtn");
const loggedUserName = document.getElementById("loggedUserName");
const loggedUserMeta = document.getElementById("loggedUserMeta");
const loggedUserAvatar = document.getElementById("loggedUserAvatar");

const syncDashboardBtn = document.getElementById("syncDashboardBtn");
const syncDashboardStatus = document.getElementById("syncDashboardStatus");

const SECTION_TITLES = {
  painel: "Visão executiva das cooperativas, territórios, usuários e operação.",
  cooperativas: "Relação analítica das cooperativas ativas.",
  usuarios: "Gestão consolidada de usuários e participantes.",
  territorios: "Visão operacional por território."
};

function byId(id){
  return document.getElementById(id);
}

function setText(id,value){
  const el = byId(id);
  if(el) el.textContent = String(value ?? 0);
}

function lower(value){
  return String(value || "").trim().toLowerCase();
}

function normalizeText(value){
  return String(value || "").trim();
}

function formatNumber(value){
  return Number(value || 0).toLocaleString("pt-BR");
}

function formatKg(value){
  return `${formatNumber(Math.round(Number(value || 0)))} kg`;
}

function normalizeRole(data = {}){
  if(data.role) return lower(data.role);
  if(data.roles?.governanca) return "governanca";
  if(data.roles?.admin) return "admin";
  if(data.roles?.brigadista) return "brigadista";
  return "usuario";
}

function isGovernancaUser(userData = {}){
  const role = normalizeRole(userData);

  return lower(userData.status) === "active" && (
    role === "governanca" ||
    role === "gestor" ||
    userData.roles?.governanca === true
  );
}

function isActive(item = {}){
  const status = lower(item.status || item.situacao || item.approvalStatus);
  return item.active !== false &&
    item.ativo !== false &&
    status !== "inactive" &&
    status !== "inativo" &&
    status !== "cancelado" &&
    status !== "rejected" &&
    status !== "rejeitado";
}

function getDate(item = {}){
  const raw =
    item.createdAt?.toDate?.() ||
    item.createdAt ||
    item.createdAtISO ||
    item.data ||
    item.dataColeta ||
    item.operationDate ||
    item.updatedAt?.toDate?.() ||
    item.updatedAt ||
    null;

  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getTerritoryId(item = {}){
  return normalizeText(
    item.territoryId ||
    item.territory ||
    item.territoryCode ||
    item.cooperativaId ||
    item.crgrId ||
    item.code ||
    item.codigo ||
    ""
  );
}

function getTerritoryLabel(item = {}){
  return normalizeText(
    item.territoryLabel ||
    item.name ||
    item.title ||
    item.label ||
    item.cooperativaNome ||
    item.cooperativa ||
    item.nome ||
    getTerritoryId(item)
  );
}

function sumNumericFromItem(item){
  if(typeof item === "number") return item;
  if(!item || typeof item !== "object") return 0;
  if(typeof item.peso === "number") return item.peso;
  if(typeof item.kg === "number") return item.kg;
  if(typeof item.quantidade === "number") return item.quantidade;
  if(typeof item.total === "number") return item.total;
  return 0;
}

function sumObjectNumericValues(obj){
  if(!obj || typeof obj !== "object") return 0;

  return Object.keys(obj).reduce((acc,key)=>{
    return acc + sumNumericFromItem(obj[key]);
  },0);
}

function getResiduoSeco(coleta = {}){
  let total = 0;

  if(typeof coleta.totalKg === "number") total += coleta.totalKg;
  if(typeof coleta.pesoRecebido === "number") total += coleta.pesoRecebido;
  if(typeof coleta.pesoResiduoSecoKg === "number") total += coleta.pesoResiduoSecoKg;

  if(coleta.recebimento) total += sumObjectNumericValues(coleta.recebimento);
  if(coleta.materiais) total += sumObjectNumericValues(coleta.materiais);
  if(coleta.residuos) total += sumObjectNumericValues(coleta.residuos);

  return total;
}

function getRejeito(coleta = {}){
  let total = 0;

  const direct =
    coleta.rejeito ||
    coleta.rejeitoKg ||
    coleta.totalRejeito ||
    coleta.pesoRejeitoKg;

  total += Number(direct || 0);

  const sources = [coleta.recebimento, coleta.materiais, coleta.residuos];

  sources.forEach((source)=>{
    if(!source || typeof source !== "object") return;

    Object.keys(source).forEach((key)=>{
      if(lower(key).includes("rejeito")){
        total += sumNumericFromItem(source[key]);
      }
    });
  });

  return total;
}

async function loadCollectionSafe(name){
  try{
    const snap = await getDocs(query(collection(db,name),orderBy("createdAt","desc")));
    return snap.docs.map((d)=>({id:d.id,...d.data()}));
  }catch{
    try{
      const snap = await getDocs(collection(db,name));
      return snap.docs.map((d)=>({id:d.id,...d.data()}));
    }catch(error){
      console.warn(`Não foi possível ler ${name}:`,error);
      return [];
    }
  }
}

async function loadUserProfile(uid){
  const snap = await getDoc(doc(db,"users",uid));
  return snap.exists() ? {id:snap.id,...snap.data()} : null;
}

async function loadAllData(){
  const [users,participants,coletas,approvalRequests,territories,cooperativas,crgrs] =
    await Promise.all([
      loadCollectionSafe("users"),
      loadCollectionSafe("participants"),
      loadCollectionSafe("coletas"),
      loadCollectionSafe("approvalRequests"),
      loadCollectionSafe("territories"),
      loadCollectionSafe("cooperativas"),
      loadCollectionSafe("crgrs")
    ]);

  const rawCoops = [...territories,...cooperativas,...crgrs];

  return {
    users,
    participants,
    coletas,
    approvalRequests,
    crgrs: rawCoops
  };
}

function buildCooperativasAtivas({users,participants,coletas,crgrs}){
  const map = new Map();

  function ensure(id,label){
    if(!id) return;

    if(!map.has(id)){
      map.set(id,{
        id,
        code:id,
        name:label || id,
        usuarios:0,
        participantes:0,
        coletas:0,
        residuo:0,
        rejeito:0,
        active:true
      });
    }
  }

  crgrs.filter(isActive).forEach((item)=>{
    const id = getTerritoryId(item) || item.id;
    ensure(id,getTerritoryLabel(item));
  });

  users.forEach((item)=>{
    const id = getTerritoryId(item);
    ensure(id,getTerritoryLabel(item));
    if(map.has(id)) map.get(id).usuarios += 1;
  });

  participants.filter(isActive).forEach((item)=>{
    const id = getTerritoryId(item);
    ensure(id,getTerritoryLabel(item));
    if(map.has(id)) map.get(id).participantes += 1;
  });

  coletas.filter(isActive).forEach((item)=>{
    const id = getTerritoryId(item);
    ensure(id,getTerritoryLabel(item));

    if(map.has(id)){
      const coop = map.get(id);
      coop.coletas += 1;
      coop.residuo += getResiduoSeco(item);
      coop.rejeito += getRejeito(item);
    }
  });

  return Array.from(map.values())
    .filter((item)=>item.active !== false)
    .sort((a,b)=>String(a.name).localeCompare(String(b.name),"pt-BR"));
}

function showSection(sectionName){
  navButtons.forEach((btn)=>{
    btn.classList.toggle("is-active",btn.dataset.section === sectionName);
  });

  sections.forEach((section)=>{
    section.classList.toggle("is-visible",section.id === `section-${sectionName}`);
  });

  if(pageSubtitle){
    pageSubtitle.textContent = SECTION_TITLES[sectionName] || SECTION_TITLES.painel;
  }
}

function renderLoggedUser(profile = {},authUser = {}){
  const name =
    profile.name ||
    profile.fullName ||
    profile.displayName ||
    authUser.displayName ||
    profile.email ||
    authUser.email ||
    "Usuário";

  if(loggedUserName) loggedUserName.textContent = name;

  if(loggedUserMeta){
    loggedUserMeta.textContent = profile.email || authUser.email || "Governança";
  }

  if(loggedUserAvatar){
    loggedUserAvatar.textContent = name.charAt(0).toUpperCase();
  }
}

function renderKPIs(data){
  const cooperativas = data.cooperativas;
  const participants = data.participants.filter(isActive);
  const coletas = data.coletas.filter(isActive);

  const residuo = coletas.reduce((acc,item)=>acc + getResiduoSeco(item),0);
  const rejeito = coletas.reduce((acc,item)=>acc + getRejeito(item),0);

  setText("metricCooperativasAtivas",cooperativas.length);
  setText("metricParticipantes",formatNumber(participants.length));
  setText("metricColetas",formatNumber(coletas.length));
  setText("metricResiduoSeco",formatKg(residuo));

  return {residuo,rejeito};
}

function destroyChart(id){
  if(charts[id]){
    charts[id].destroy();
    delete charts[id];
  }
}

function renderChart(id,options){
  const el = byId(id);
  if(!el || typeof ApexCharts === "undefined") return;

  destroyChart(id);

  charts[id] = new ApexCharts(el,options);
  charts[id].render();
}

function buildMonthlySeries(coletas){
  const map = new Map();

  coletas.filter(isActive).forEach((item)=>{
    const date = getDate(item);
    if(!date) return;

    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
    const label = date.toLocaleDateString("pt-BR",{month:"short",year:"2-digit"});

    if(!map.has(key)) map.set(key,{key,label,total:0});
    map.get(key).total += 1;
  });

  return Array.from(map.values())
    .sort((a,b)=>a.key.localeCompare(b.key))
    .slice(-12);
}

function renderCharts({coletas,cooperativas,residuo,rejeito}){
  const monthly = buildMonthlySeries(coletas);
  const totalMaterial = Math.max(residuo + rejeito,1);
  const eficiencia = Math.round((residuo / totalMaterial) * 100);

  renderChart("chartColetasMes",{
    chart:{type:"area",height:330,toolbar:{show:false},fontFamily:"Archivo Condensed"},
    series:[{name:"Coletas",data:monthly.map((i)=>i.total)}],
    xaxis:{categories:monthly.map((i)=>i.label)},
    stroke:{curve:"smooth",width:4},
    fill:{type:"gradient",gradient:{shadeIntensity:.35,opacityFrom:.45,opacityTo:.05}},
    colors:["#81B92A"],
    dataLabels:{enabled:false},
    grid:{borderColor:"rgba(60,58,57,.08)"},
    tooltip:{theme:"light"}
  });

  renderChart("chartComposicao",{
    chart:{type:"donut",height:330,fontFamily:"Archivo Condensed"},
    series:[Math.round(residuo),Math.round(rejeito)],
    labels:["Resíduo seco","Rejeito"],
    colors:["#81B92A","#EF6B22"],
    legend:{position:"bottom"},
    plotOptions:{pie:{donut:{size:"72%"}}},
    dataLabels:{enabled:true}
  });

  renderChart("chartEficiencia",{
    chart:{type:"radialBar",height:330,fontFamily:"Archivo Condensed"},
    series:[eficiencia],
    colors:["#53ACDE"],
    labels:["Eficiência"],
    plotOptions:{
      radialBar:{
        hollow:{size:"62%"},
        dataLabels:{
          value:{fontSize:"42px",fontWeight:800,formatter:(v)=>`${v}%`}
        }
      }
    }
  });

  const ranking = [...cooperativas]
    .sort((a,b)=>b.residuo - a.residuo)
    .slice(0,8);

  renderChart("chartRankingCooperativas",{
    chart:{type:"bar",height:350,toolbar:{show:false},fontFamily:"Archivo Condensed"},
    series:[{name:"Resíduo seco kg",data:ranking.map((i)=>Math.round(i.residuo))}],
    xaxis:{categories:ranking.map((i)=>i.name)},
    plotOptions:{bar:{horizontal:true,borderRadius:8}},
    colors:["#3C3A39"],
    dataLabels:{enabled:true},
    grid:{borderColor:"rgba(60,58,57,.08)"}
  });
}

function renderCooperativas(cooperativas){
  setText("activeCoopsCount",`${cooperativas.length} ativas`);

  const cards = byId("cooperativasCards");
  if(cards){
    cards.innerHTML = cooperativas.map((item)=>`
      <article class="coop-card">
        <h3>${item.name}</h3>
        <p>${item.code}</p>
        <div class="coop-card-metrics">
          <div><span>Coletas</span><strong>${formatNumber(item.coletas)}</strong></div>
          <div><span>Seco</span><strong>${formatKg(item.residuo)}</strong></div>
          <div><span>Rejeito</span><strong>${formatKg(item.rejeito)}</strong></div>
        </div>
      </article>
    `).join("");
  }

  const tbody = byId("cooperativasTableBody");
  if(tbody){
    tbody.innerHTML = cooperativas.map((item)=>{
      const total = Math.max(item.residuo + item.rejeito,1);
      const eficiencia = Math.round((item.residuo / total) * 100);

      return `
        <tr>
          <td>${item.name}</td>
          <td>${item.code}</td>
          <td>${formatNumber(item.usuarios)}</td>
          <td>${formatNumber(item.participantes)}</td>
          <td>${formatNumber(item.coletas)}</td>
          <td>${formatKg(item.residuo)}</td>
          <td>${formatKg(item.rejeito)}</td>
          <td>${eficiencia}%</td>
          <td><span class="status-pill">Ativa</span></td>
        </tr>
      `;
    }).join("");
  }
}

function renderUsuarios(users,participants){
  const tbody = byId("usersTableBody");

  const unified = [
    ...users.map((item)=>({
      name:item.name || item.displayName || item.email || "Usuário",
      email:item.email || "-",
      territory:item.territoryLabel || item.territoryId || "-",
      role:normalizeRole(item),
      status:isActive(item) ? "Ativo" : "Inativo"
    })),
    ...participants.map((item)=>({
      name:item.name || item.fullName || "Participante",
      email:item.email || "-",
      territory:item.territoryLabel || item.territoryId || "-",
      role:"participante",
      status:isActive(item) ? "Ativo" : "Pendente"
    }))
  ];

  setText("usersTotal",unified.length);
  setText("usersAtivos",unified.filter((i)=>i.status === "Ativo").length);
  setText("usersAdmins",users.filter((i)=>normalizeRole(i) === "admin").length);
  setText("usersGovernanca",users.filter((i)=>["governanca","gestor"].includes(normalizeRole(i))).length);

  if(!tbody) return;

  tbody.innerHTML = unified.map((item)=>`
    <tr>
      <td>${item.name}</td>
      <td>${item.email}</td>
      <td>${item.territory}</td>
      <td>${item.role}</td>
      <td><span class="status-pill ${item.status !== "Ativo" ? "inactive" : ""}">${item.status}</span></td>
    </tr>
  `).join("");
}

function renderTerritorios(cooperativas){
  const tbody = byId("territoriosTableBody");
  if(!tbody) return;

  tbody.innerHTML = cooperativas.map((item)=>`
    <tr>
      <td>${item.name}</td>
      <td>${item.code}</td>
      <td>${formatNumber(item.usuarios)}</td>
      <td>${formatNumber(item.participantes)}</td>
      <td>${formatNumber(item.coletas)}</td>
      <td>${formatKg(item.residuo)}</td>
      <td>${formatKg(item.rejeito)}</td>
      <td><span class="status-pill">Ativo</span></td>
    </tr>
  `).join("");
}

async function savePublicDashboardData(data){
  await setDoc(
    doc(db,"publicDashboard",PUBLIC_DASHBOARD_DOC),
    {
      cooperativasAtivas:data.cooperativas.length,
      participantes:data.participants.length,
      coletas:data.coletas.length,
      residuoSeco:data.residuo,
      rejeito:data.rejeito,
      updatedAt:serverTimestamp()
    },
    {merge:true}
  );
}

function setSyncStatus(text){
  if(syncDashboardStatus) syncDashboardStatus.textContent = text;
}

function bindEvents(){
  navButtons.forEach((btn)=>{
    btn.addEventListener("click",()=>showSection(btn.dataset.section));
  });

  logoutBtn?.addEventListener("click",async()=>{
    await signOut(auth);
    window.location.href = LOGIN_PAGE;
  });

  syncDashboardBtn?.addEventListener("click",async()=>{
    setSyncStatus("Atualizando indicadores...");
    const raw = await loadAllData();
    const cooperativas = buildCooperativasAtivas(raw);
    const coletas = raw.coletas.filter(isActive);
    const residuo = coletas.reduce((acc,item)=>acc + getResiduoSeco(item),0);
    const rejeito = coletas.reduce((acc,item)=>acc + getRejeito(item),0);

    await savePublicDashboardData({
      cooperativas,
      participants:raw.participants,
      coletas,
      residuo,
      rejeito
    });

    setSyncStatus(`Atualizado em ${new Date().toLocaleString("pt-BR")}`);
  });
}

async function loadGovernanca(){
  const raw = await loadAllData();
  const cooperativas = buildCooperativasAtivas(raw);
  const totals = renderKPIs({...raw,cooperativas});

  renderCharts({...raw,cooperativas,...totals});
  renderCooperativas(cooperativas);
  renderUsuarios(raw.users,raw.participants);
  renderTerritorios(cooperativas);
}

bindEvents();

onAuthStateChanged(auth,async(user)=>{
  if(!user){
    window.location.href = LOGIN_PAGE;
    return;
  }

  try{
    const profile = await loadUserProfile(user.uid);

    if(!profile || !isGovernancaUser(profile)){
      window.location.href = COOPERATIVAS_PAGE;
      return;
    }

    renderLoggedUser(profile,user);
    await loadGovernanca();

    setSyncStatus("Indicadores carregados.");
  }catch(error){
    console.error(error);
    window.location.href = LOGIN_PAGE;
  }
});
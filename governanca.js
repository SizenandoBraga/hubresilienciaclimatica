
import {
  auth as authVP,
  db as dbVP
} from "./firebase-init-vp.js";

import {
  db as dbPC
} from "./firebase-init-pc.js";

import {
  db as dbCOADESC
} from "./firebase-init-coadesc.js";
import {
  db as dbGuardioes
} from "./firebase-init-guardioes.js";

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
let COOPERATIVAS_CACHE = [];
let USERS_CACHE = [];
let PARTICIPANTS_CACHE = [];
let TERRITORIOS_CACHE = [];

const filterCoopSearch = document.getElementById("filterCoopSearch");
const filterCoopStatus = document.getElementById("filterCoopStatus");
const clearCoopFilters = document.getElementById("clearCoopFilters");

const filterUserSearch = document.getElementById("filterUserSearch");
const filterUserRole = document.getElementById("filterUserRole");
const filterUserStatus = document.getElementById("filterUserStatus");
const clearUserFilters = document.getElementById("clearUserFilters");

const filterTerritorySearch = document.getElementById("filterTerritorySearch");
const filterTerritoryStatus = document.getElementById("filterTerritoryStatus");
const clearTerritoryFilters = document.getElementById("clearTerritoryFilters");

let GUARDIOES_CACHE = [];

const filterGuardiaoSearch = document.getElementById("filterGuardiaoSearch");
const filterGuardiaoCooperativa = document.getElementById("filterGuardiaoCooperativa");
const filterGuardiaoStatus = document.getElementById("filterGuardiaoStatus");
const clearGuardiaoFilters = document.getElementById("clearGuardiaoFilters");

const FIREBASE_SOURCES = [
  {
    id: "vila-pinto",
    name: "Vila Pinto",
    db: dbVP
  },
  {
    id: "cooadesc",
    name: "COOADESC",
    db: dbCOADESC
  },
  {
    id: "padre-cacique",
    name: "Padre Cacique",
    db: dbPC
  }
];

const auth = authGuardioes;

const AUTH_SOURCES = [
  {
    id: "guardioes",
    name: "Guardiões Urbanos",
    auth: authGuardioes
  },
  {
    id: "vila-pinto",
    name: "Vila Pinto",
    auth: authVP
  }
];

const LOGIN_PAGE = "./login.html";
const COOPERATIVAS_PAGE = "./cooperativas.html"; // mantido apenas por compatibilidade
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
  territorios: "Visão operacional por território.",
  acessos: "Monitoramento de acessos públicos e logados da plataforma.",
  guardioes: "Solicitações recebidas pelo cadastro público dos Guardiões Urbanos."
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
function normalizeCooperativaId(value = ""){

  return lower(value)
    .trim()

    /* remove prefixos duplicados */
    .replace(/^crgr[-_]/,"")

    /* normaliza separadores */
    .replace(/_/g,"-")

    /* aliases */
    .replace(/^coadesc$/,"cooadesc")
    .replace(/^crgr-cooadesc$/,"cooadesc")
    .replace(/^crgr-coadesc$/,"cooadesc")
    .replace(/^crgr-vila-pinto$/,"vila-pinto")
    .replace(/^padre_cacique$/,"padre-cacique")
    .replace(/^crgr-padre-cacique$/,"padre-cacique");
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
  const status = lower(userData.status || "active");

  const isActiveProfile =
    status === "active" ||
    status === "ativo" ||
    userData.active === true ||
    userData.ativo === true;

  return isActiveProfile && (
    role === "governanca" ||
    role === "gestor" ||
    role === "superadmin" ||
    role === "admin_master" ||
    userData.roles?.governanca === true ||
    userData.roles?.gestor === true ||
    userData.roles?.superadmin === true ||
    userData.roles?.admin_master === true
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

  const raw =
    item.territoryId ||
    item.territory ||
    item.territoryCode ||
    item.cooperativaId ||
    item.crgrId ||
    item.sourceId ||
    item.firebaseSource ||
    item.code ||
    item.codigo ||
    "";

  return normalizeCooperativaId(
    normalizeText(raw)
  );
}

function getTerritoryLabel(item = {}){
  return normalizeText(
    item.cooperativaNome ||
    item.nomeCooperativa ||
    item.cooperativeName ||
    item.cooperativa ||
    item.territoryLabel ||
    item.title ||
    item.label ||
    item.nome ||
    item.name ||
    getTerritoryId(item)
  );
}
function isRealCooperativaDoc(item = {}){

  const id =
    getTerritoryId(item) ||
    item.id ||
    "";

  const role = normalizeRole(item);

  const type = lower(
    item.type ||
    item.tipo ||
    item.profile ||
    item.userType ||
    item.collectionType ||
    ""
  );

  if(!id) return false;

  const looksLikeUser =
    Boolean(item.email) ||
    Boolean(item.uid) ||
    Boolean(item.roles) ||

    role === "admin" ||
    role === "governanca" ||
    role === "gestor" ||
    role === "usuario" ||
    role === "brigadista";

  const explicitlyCoop =
    type.includes("cooperativa") ||
    type.includes("territorio") ||
    type.includes("território") ||
    type.includes("crgr") ||

    Boolean(item.cooperativaNome) ||
    Boolean(item.nomeCooperativa) ||
    Boolean(item.cooperativeName) ||
    Boolean(item.territoryLabel) ||
    Boolean(item.code) ||
    Boolean(item.codigo);

  return explicitlyCoop && !looksLikeUser;
}

function formatCooperativaNameFromId(id = ""){

  const normalized =
  normalizeCooperativaId(id);

  const names = {

    "vila-pinto":"Vila Pinto",
    "crgr-vila-pinto":"Vila Pinto",

    "cooadesc":"COOADESC",
    "coadesc":"COOADESC",
    "crgr-cooadesc":"COOADESC",

    "padre-cacique":"Padre Cacique",
    "crgr-padre-cacique":"Padre Cacique"
  };

  if(names[normalized]){
    return names[normalized];
  }

  return String(id)
    .replace(/[-_]/g," ")
    .replace(/\b\w/g,(letter)=>
      letter.toUpperCase()
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
async function loadGuardioesSolicitacoes(){
  const diretas = await loadCollectionSafeFromDb(
    dbGuardioes,
    "solicitacoes_guardioes",
    {
      id: "guardioes",
      name: "Guardiões Urbanos"
    }
  );

  if (diretas.length) return diretas;

  const subcolecoes = await Promise.all(
    FIREBASE_SOURCES.map((source) =>
      loadCollectionSafeFromDb(
        dbGuardioes,
        `cooperativas/${source.id}/solicitacoes`,
        source
      )
    )
  );

  return subcolecoes.flat();
}

function filterGuardioes(items = []){
  const search = normalizeFilter(filterGuardiaoSearch?.value || "");
  const cooperativa = filterGuardiaoCooperativa?.value || "__all__";
  const status = filterGuardiaoStatus?.value || "__all__";

  return items.filter((item) => {
    const itemCoop = normalizeCooperativaId(item.cooperativa || item.cooperativaId || "");
    const itemStatus = lower(item.status || "solicitado");

    if (cooperativa !== "__all__" && itemCoop !== cooperativa) return false;
    if (status !== "__all__" && itemStatus !== status) return false;

    if (search) {
      const haystack = normalizeFilter([
        item.nome,
        item.name,
        item.whatsapp,
        item.endereco,
        item.cep,
        item.cooperativa,
        item.status
      ].join(" "));

      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

function formatGuardiaoDate(item = {}){
  const date = getDate(item);

  if (!date) return "-";

  return date.toLocaleString("pt-BR");
}

function renderGuardioes(items = []){
  GUARDIOES_CACHE = items;

  const filtered = filterGuardioes(items);

  setText("guardioesTotal", filtered.length);
  setText("guardioesVilaPinto", filtered.filter((i) =>
    normalizeCooperativaId(i.cooperativa) === "vila-pinto"
  ).length);

  setText("guardioesCooadesc", filtered.filter((i) =>
    normalizeCooperativaId(i.cooperativa) === "cooadesc"
  ).length);

  setText("guardioesPadreCacique", filtered.filter((i) =>
    normalizeCooperativaId(i.cooperativa) === "padre-cacique"
  ).length);

  const tbody = byId("guardioesTableBody");
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">Nenhuma solicitação encontrada.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((item) => {
    const coopId = normalizeCooperativaId(
      item.cooperativa || item.cooperativaId || ""
    );

    const status = lower(item.status || "solicitado");

    const whatsappLimpo = String(item.whatsapp || "").replace(/\D/g, "");

    const whatsappLink = whatsappLimpo
      ? `https://wa.me/55${whatsappLimpo}`
      : "#";

    return `
      <tr>
        <td>${formatGuardiaoDate(item)}</td>
        <td>${item.nome || item.name || "-"}</td>

        <td>
          <a href="${whatsappLink}" target="_blank" rel="noopener noreferrer">
            ${item.whatsapp || "-"}
          </a>
        </td>

        <td>${item.endereco || "-"}</td>
        <td>${item.cep || "-"}</td>
        <td>${formatCooperativaNameFromId(coopId)}</td>

        <td>
          <span class="status-pill ${status === "contatado" ? "" : "inactive"}">
            ${status}
          </span>
        </td>

        <td>
          <a
            href="${whatsappLink}"
            target="_blank"
            rel="noopener noreferrer"
            class="gov-filter-btn"
          >
            WhatsApp
          </a>
        </td>
      </tr>
    `;
  }).join("");
}

async function loadCollectionSafeFromDb(dbInstance, name, source = {}) {
  try {
    const snap = await getDocs(
      query(
        collection(dbInstance, name),
        orderBy("createdAt", "desc")
      )
    );

    return snap.docs.map((d) => ({
      id: d.id,
      sourceId: source.id,
      sourceName: source.name,
      firebaseSource: source.id,
      ...d.data()
    }));
  } catch {
    try {
      const snap = await getDocs(collection(dbInstance, name));

      return snap.docs.map((d) => ({
        id: d.id,
        sourceId: source.id,
        sourceName: source.name,
        firebaseSource: source.id,
        ...d.data()
      }));
    } catch (error) {
      console.warn(`Não foi possível ler ${name} em ${source.name}:`, error);
      return [];
    }
  }
}

async function loadCollectionFromAllDbs(name) {
  const results = await Promise.all(
    FIREBASE_SOURCES.map((source) =>
      loadCollectionSafeFromDb(source.db, name, source)
    )
  );

  return results.flat();
}

async function loadUserProfile(uid) {
  try {
    const snap = await getDoc(
      doc(dbGuardioes, "users", uid)
    );

    if (snap.exists()) {
      return {
        id: snap.id,
        sourceId: "guardioes",
        sourceName: "Guardiões Urbanos",
        ...snap.data()
      };
    }
  } catch (error) {
    console.warn("Erro ao buscar usuário no banco dos Guardiões:", error);
  }

  for (const source of FIREBASE_SOURCES) {
    try {
      const snap = await getDoc(
        doc(source.db, "users", uid)
      );

      if (snap.exists()) {
        return {
          id: snap.id,
          sourceId: source.id,
          sourceName: source.name,
          ...snap.data()
        };
      }
    } catch (error) {
      console.warn(`Erro ao buscar usuário em ${source.name}:`, error);
    }
  }

  return null;
}

async function loadAllData() {
  const [
    users,
    participants,
    coletas,
    approvalRequests,
    territories,
    cooperativas,
    crgrs,
    accessLogs
  ] = await Promise.all([
    loadCollectionFromAllDbs("users"),
    loadCollectionFromAllDbs("participants"),
    loadCollectionFromAllDbs("coletas"),
    loadCollectionFromAllDbs("approvalRequests"),
    loadCollectionFromAllDbs("territories"),
    loadCollectionFromAllDbs("cooperativas"),
    loadCollectionFromAllDbs("crgrs"),
    loadCollectionFromAllDbs("accessLogs")
  ]);

  const rawCoops = [...territories, ...cooperativas, ...crgrs];

  return {
    users,
    participants,
    coletas,
    approvalRequests,
    crgrs: rawCoops,
    accessLogs
  };
}

function buildCooperativasAtivas({
  users,
  participants,
  coletas,
  crgrs
}){

  const map = new Map();

  function ensureCooperativaBase(source = {}) {
    const id = normalizeCooperativaId(source.id);

    if (!id) return;

    if (!map.has(id)) {
      map.set(id, {
        id,
        code: id,
        name: source.name || formatCooperativaNameFromId(id),
        usuarios: 0,
        participantes: 0,
        coletas: 0,
        residuo: 0,
        rejeito: 0,
        active: true
      });
    }
  }

  FIREBASE_SOURCES.forEach(ensureCooperativaBase);

  function ensureRealCooperativa(item = {}){

    const id =
      getTerritoryId(item) ||
      item.id;

    if(!id) return;

    if(!map.has(id)){

      map.set(id,{

        id,

        code:id,

        name:
          getTerritoryLabel(item) ||
          formatCooperativaNameFromId(id),

        usuarios:0,
        participantes:0,
        coletas:0,
        residuo:0,
        rejeito:0,

        active:true
      });
    }
  }

  /*
    IMPORTANTE:
    Apenas collections reais podem criar cooperativas.
  */

  crgrs
    .filter(isActive)
    .filter(isRealCooperativaDoc)
    .forEach(ensureRealCooperativa);

  /*
    Fallback caso collections estejam vazias
  */

  if(map.size === 0){

    const ids = new Set();

    users.forEach((item)=>{

      const id = getTerritoryId(item) || item.sourceId || item.firebaseSource;

      if(id) ids.add(id);
    });

    participants.forEach((item)=>{

      const id = getTerritoryId(item) || item.sourceId || item.firebaseSource;

      if(id) ids.add(id);
    });

    coletas.forEach((item)=>{

      const id = getTerritoryId(item) || item.sourceId || item.firebaseSource;

      if(id) ids.add(id);
    });

    ids.forEach((id)=>{

      map.set(id,{

        id,

        code:id,

        name:
          formatCooperativaNameFromId(id),

        usuarios:0,
        participantes:0,
        coletas:0,
        residuo:0,
        rejeito:0,

        active:true
      });
    });
  }

  /*
    Usuários
  */

  users.forEach((item)=>{

    const id = getTerritoryId(item);

    if(!map.has(id)) return;

    map.get(id).usuarios += 1;
  });

  /*
    Participantes
  */

  participants
    .filter(isActive)
    .forEach((item)=>{

      const id = getTerritoryId(item) || item.sourceId || item.firebaseSource;

      if(!map.has(id)) return;

      map.get(id).participantes += 1;
    });

  /*
    Coletas
  */

  coletas
    .filter(isActive)
    .forEach((item)=>{

      const id = getTerritoryId(item) || item.sourceId || item.firebaseSource;

      if(!map.has(id)) return;

      const coop = map.get(id);

      coop.coletas += 1;

      coop.residuo +=
        getResiduoSeco(item);

      coop.rejeito +=
        getRejeito(item);
    });

  return Array
    .from(map.values())

    .filter((item)=>
      item.active !== false
    )

    .sort((a,b)=>
      String(a.name)
        .localeCompare(
          String(b.name),
          "pt-BR"
        )
    );
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
    chart:{type:"area",height:330,toolbar:{show:false},fontFamily:"Archivo"},
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
    chart:{type:"donut",height:330,fontFamily:"Archivo"},
    series:[Math.round(residuo),Math.round(rejeito)],
    labels:["Resíduo seco","Rejeito"],
    colors:["#81B92A","#EF6B22"],
    legend:{position:"bottom"},
    plotOptions:{pie:{donut:{size:"72%"}}},
    dataLabels:{enabled:true}
  });

  renderChart("chartEficiencia",{
    chart:{type:"radialBar",height:330,fontFamily:"Archivo"},
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
    chart:{type:"bar",height:350,toolbar:{show:false},fontFamily:"Archivo"},
    series:[{name:"Resíduo seco kg",data:ranking.map((i)=>Math.round(i.residuo))}],
    xaxis:{categories:ranking.map((i)=>i.name)},
    plotOptions:{bar:{horizontal:true,borderRadius:8}},
    colors:["#3C3A39"],
    dataLabels:{enabled:true},
    grid:{borderColor:"rgba(60,58,57,.08)"}
  });
}

function renderCooperativas(cooperativas){
  COOPERATIVAS_CACHE = cooperativas;

  const filtered = filterCooperativas(cooperativas);
  cooperativas = filtered;
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

function renderUsuarios(users, participants) {
  USERS_CACHE = users;
  PARTICIPANTS_CACHE = participants;

  const tbody = byId("usersTableBody");
  const unified = filterUsuarios(users, participants);

  setText("usersTotal", unified.length);
  setText("usersAtivos", unified.filter((i) => i.status === "Ativo").length);
  setText("usersAdmins", unified.filter((i) => i.role === "admin").length);
  setText("usersGovernanca", unified.filter((i) =>
    ["governanca", "gestor"].includes(i.role)
  ).length);

  if (!tbody) return;

  tbody.innerHTML = unified.map((item) => `
    <tr>
      <td>${item.name}</td>
      <td>${item.email}</td>
      <td>${item.territory}</td>
      <td>${item.role}</td>
      <td>
        <span class="status-pill ${item.status !== "Ativo" ? "inactive" : ""}">
          ${item.status}
        </span>
      </td>
    </tr>
  `).join("");
}

function renderTerritorios(cooperativas){
  TERRITORIOS_CACHE = cooperativas;
  cooperativas = filterTerritorios(cooperativas);
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
function normalizeFilter(value){
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function filterCooperativas(items = []){
  const search = normalizeFilter(filterCoopSearch?.value || "");
  const status = filterCoopStatus?.value || "__all__";

  return items.filter((item) => {
    if (status === "ativa" && item.active === false) return false;
    if (status === "inativa" && item.active !== false) return false;

    if (search) {
      const haystack = normalizeFilter([
        item.name,
        item.code,
        item.id
      ].join(" "));

      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

function filterUsuarios(users = [], participants = []) {
  const search = normalizeFilter(filterUserSearch?.value || "");
  const roleFilter = filterUserRole?.value || "__all__";
  const statusFilter = filterUserStatus?.value || "__all__";

  const unified = [
    ...users.map((item) => ({
      name: item.name || item.displayName || item.email || "Usuário",
      email: item.email || "-",
      territory:
        item.sourceName ||
        formatCooperativaNameFromId(item.sourceId || item.territoryId) ||
        "-",
      role: normalizeRole(item),
      status: isActive(item) ? "Ativo" : "Inativo"
    })),

    ...participants.map((item) => ({
      name: item.name || item.fullName || item.nome || "Participante",
      email: item.email || "-",
      territory:
        item.sourceName ||
        formatCooperativaNameFromId(item.sourceId || item.territoryId) ||
        "-",
      role: "participante",
      status: isActive(item) ? "Ativo" : "Pendente"
    }))
  ];

  return unified.filter((item) => {
    if (roleFilter !== "__all__" && item.role !== roleFilter) return false;
    if (statusFilter === "ativo" && item.status !== "Ativo") return false;
    if (statusFilter === "inativo" && item.status === "Ativo") return false;

    if (search) {
      const haystack = normalizeFilter([
        item.name,
        item.email,
        item.territory,
        item.role,
        item.status
      ].join(" "));

      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

function filterTerritorios(items = []){
  const search = normalizeFilter(filterTerritorySearch?.value || "");
  const status = filterTerritoryStatus?.value || "__all__";

  return items.filter((item) => {
    if (status === "ativo" && item.active === false) return false;
    if (status === "inativo" && item.active !== false) return false;

    if (search) {
      const haystack = normalizeFilter([
        item.name,
        item.code,
        item.id
      ].join(" "));

      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}
async function savePublicDashboardData(data){
  await setDoc(
   doc(dbGuardioes,"publicDashboard",PUBLIC_DASHBOARD_DOC),
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
  filterGuardiaoSearch?.addEventListener("input", () =>
  renderGuardioes(GUARDIOES_CACHE)
);

filterGuardiaoCooperativa?.addEventListener("change", () =>
  renderGuardioes(GUARDIOES_CACHE)
);

filterGuardiaoStatus?.addEventListener("change", () =>
  renderGuardioes(GUARDIOES_CACHE)
);

clearGuardiaoFilters?.addEventListener("click", () => {
  if (filterGuardiaoSearch) filterGuardiaoSearch.value = "";
  if (filterGuardiaoCooperativa) filterGuardiaoCooperativa.value = "__all__";
  if (filterGuardiaoStatus) filterGuardiaoStatus.value = "__all__";

  renderGuardioes(GUARDIOES_CACHE);
});

  navButtons.forEach((btn)=>{
    btn.addEventListener("click",()=>showSection(btn.dataset.section));
  });

  logoutBtn?.addEventListener("click",async()=>{
    await Promise.allSettled(
      AUTH_SOURCES.map((source) => signOut(source.auth))
    );

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

filterCoopSearch?.addEventListener("input", () => renderCooperativas(COOPERATIVAS_CACHE));
filterCoopStatus?.addEventListener("change", () => renderCooperativas(COOPERATIVAS_CACHE));
clearCoopFilters?.addEventListener("click", () => {
  if (filterCoopSearch) filterCoopSearch.value = "";
  if (filterCoopStatus) filterCoopStatus.value = "__all__";
  renderCooperativas(COOPERATIVAS_CACHE);
});

filterUserSearch?.addEventListener("input", () => renderUsuarios(USERS_CACHE, PARTICIPANTS_CACHE));
filterUserRole?.addEventListener("change", () => renderUsuarios(USERS_CACHE, PARTICIPANTS_CACHE));
filterUserStatus?.addEventListener("change", () => renderUsuarios(USERS_CACHE, PARTICIPANTS_CACHE));
clearUserFilters?.addEventListener("click", () => {
  if (filterUserSearch) filterUserSearch.value = "";
  if (filterUserRole) filterUserRole.value = "__all__";
  if (filterUserStatus) filterUserStatus.value = "__all__";
  renderUsuarios(USERS_CACHE, PARTICIPANTS_CACHE);
});

filterTerritorySearch?.addEventListener("input", () => renderTerritorios(TERRITORIOS_CACHE));
filterTerritoryStatus?.addEventListener("change", () => renderTerritorios(TERRITORIOS_CACHE));
clearTerritoryFilters?.addEventListener("click", () => {
  if (filterTerritorySearch) filterTerritorySearch.value = "";
  if (filterTerritoryStatus) filterTerritoryStatus.value = "__all__";
  renderTerritorios(TERRITORIOS_CACHE);
});
}

function accessDate(item = {}) {
  const raw =
    item.createdAt?.toDate?.() ||
    item.createdAt ||
    item.createdAtISO ||
    item.date ||
    null;

  const date = raw instanceof Date ? raw : new Date(raw);

  return Number.isNaN(date.getTime()) ? null : date;
}

function accessTerritory(item = {}) {
  const id = normalizeCooperativaId(
    item.territoryId ||
    item.cooperativeId ||
    item.cooperativaId ||
    item.cooperativeName ||
    item.cooperativa ||
    "geral"
  );

  if (id === "vila-pinto") return "Vila Pinto";
  if (id === "cooadesc") return "COOADESC";
  if (id === "padre-cacique") return "Padre Cacique";

  return "Geral";
}

function accessDevice(item = {}) {
  const ua = lower(item.userAgent || "");

  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return "Celular";
  }

  if (ua.includes("tablet") || ua.includes("ipad")) {
    return "Tablet";
  }

  return "Computador";
}

function renderAccessDashboard(accessLogs = []) {
  const now = new Date();

  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const last7Start = new Date(todayStart);
  last7Start.setDate(last7Start.getDate() - 6);

  const total = accessLogs.length;

  const today = accessLogs.filter((item) => {
    const date = accessDate(item);
    return date && date >= todayStart;
  }).length;

  const last7 = accessLogs.filter((item) => {
    const date = accessDate(item);
    return date && date >= last7Start;
  }).length;

  const logged = accessLogs.filter((item) => {
    return item.userId || item.userEmail;
  }).length;

  setText("accessTotal", formatNumber(total));
  setText("accessToday", formatNumber(today));
  setText("accessLast7Days", formatNumber(last7));
  setText("accessLogged", formatNumber(logged));

  renderAccessCharts(accessLogs);
  renderAccessTable(accessLogs);
}

function renderAccessCharts(accessLogs = []) {
  const coopMap = new Map();

  accessLogs.forEach((item) => {
    const label = accessTerritory(item);
    coopMap.set(label, (coopMap.get(label) || 0) + 1);
  });

  const coopItems = Array.from(coopMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  renderChart("chartAccessByCoop", {
    chart: {
      type: "bar",
      height: 350,
      toolbar: { show: false },
      fontFamily: "Archivo"
    },
    series: [
      {
        name: "Acessos",
        data: coopItems.map((item) => item.total)
      }
    ],
    xaxis: {
      categories: coopItems.map((item) => item.name)
    },
    plotOptions: {
      bar: {
        borderRadius: 8,
        columnWidth: "48%"
      }
    },
    colors: ["#81B92A"],
    dataLabels: { enabled: true },
    grid: { borderColor: "rgba(60,58,57,.08)" }
  });

  const publicos = accessLogs.filter((item) => {
    return item.pageType === "publica" || !item.userId;
  }).length;

  const logados = accessLogs.filter((item) => {
    return item.pageType === "logada" || item.userId;
  }).length;

  renderChart("chartAccessType", {
    chart: {
      type: "donut",
      height: 330,
      fontFamily: "Archivo"
    },
    series: [publicos, logados],
    labels: ["Público", "Logado"],
    colors: ["#53ACDE", "#EF6B22"],
    legend: { position: "bottom" },
    plotOptions: {
      pie: {
        donut: { size: "72%" }
      }
    }
  });
}

function renderAccessTable(accessLogs = []) {
  const tbody = byId("accessLogsTableBody");

  if (!tbody) return;

  const rows = [...accessLogs]
    .sort((a, b) => {
      const dateA = accessDate(a)?.getTime() || 0;
      const dateB = accessDate(b)?.getTime() || 0;
      return dateB - dateA;
    })
    .slice(0, 50);

  tbody.innerHTML = rows.map((item) => {
    const date = accessDate(item);

    return `
      <tr>
        <td>${date ? date.toLocaleString("pt-BR") : "-"}</td>
        <td>${item.page || item.url || "-"}</td>
        <td>${accessTerritory(item)}</td>
        <td>${item.userName || item.userEmail || "Visitante"}</td>
        <td>
          <span class="status-pill ${item.userId ? "" : "inactive"}">
            ${item.userId ? "Logado" : "Público"}
          </span>
        </td>
        <td>${accessDevice(item)}</td>
      </tr>
    `;
  }).join("");
}


/* =========================================================
   LOG DE ACESSO LOCAL, COMPATÍVEL COM VERCEL
========================================================= */

async function registerAccessLogSafe({
  db,
  auth,
  page,
  pageType,
  territoryId,
  cooperativeName,
  userProfile
}) {
  try {
    const user = auth?.currentUser || null;
    const logRef = doc(collection(db, "accessLogs"));

    await setDoc(logRef, {
      page: page || "governanca",
      pageType: pageType || "logada",
      territoryId: territoryId || "governanca",
      cooperativeName: cooperativeName || "Governança NSRU",
      userId: user?.uid || userProfile?.id || null,
      userEmail: user?.email || userProfile?.email || null,
      userName:
        userProfile?.displayName ||
        userProfile?.name ||
        userProfile?.nome ||
        user?.displayName ||
        user?.email ||
        "Usuário",
      userAgent: navigator.userAgent || "",
      url: window.location.href,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("Log de acesso ignorado:", error);
  }
}

function waitForAuthUser(authInstance) {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(
      authInstance,
      (user) => {
        unsubscribe();
        resolve(user || null);
      },
      () => {
        unsubscribe();
        resolve(null);
      }
    );
  });
}

async function getActiveAuthUser() {
  for (const source of AUTH_SOURCES) {
    const user = source.auth.currentUser || await waitForAuthUser(source.auth);

    if (user) {
      return {
        source,
        auth: source.auth,
        user
      };
    }
  }

  return {
    source: null,
    auth: auth,
    user: null
  };
}

async function loadGovernanca(){
  const raw = await loadAllData();

  const guardioes = await loadGuardioesSolicitacoes();

  const cooperativas = buildCooperativasAtivas(raw);
  const totals = renderKPIs({...raw,cooperativas});

  renderCharts({...raw,cooperativas,...totals});
  renderCooperativas(cooperativas);
  renderUsuarios(raw.users,raw.participants);
  renderTerritorios(cooperativas);
  renderAccessDashboard(raw.accessLogs || []);
  renderGuardioes(guardioes);
}
bindEvents();

async function initGovernancaPage() {
  const active = await getActiveAuthUser();

  if (!active.user) {
    window.location.href = LOGIN_PAGE;
    return;
  }

  try {
    const profile = await loadUserProfile(active.user.uid);

    if (!profile || !isGovernancaUser(profile)) {
      console.warn("Perfil sem permissão de governança:", profile);
      window.location.href = LOGIN_PAGE;
      return;
    }

    renderLoggedUser(profile, active.user);

    await registerAccessLogSafe({
      db: dbGuardioes,
      auth: active.auth,
      page: "governanca",
      pageType: "logada",
      territoryId: "governanca",
      cooperativeName: "Governança NSRU",
      userProfile: profile
    });

    await loadGovernanca();

    setSyncStatus("Indicadores carregados.");
  } catch (error) {
    console.error("Erro ao iniciar governança:", error);
    setSyncStatus("Erro ao carregar indicadores. Veja o console.");
  }
}

initGovernancaPage();
const efficiencyModal = document.getElementById("efficiencyModal");
const openEfficiencyModal = document.getElementById("openEfficiencyModal");
const closeEfficiencyModal = document.getElementById("closeEfficiencyModal");

openEfficiencyModal?.addEventListener("click", () => {
  efficiencyModal?.classList.add("show");
});

closeEfficiencyModal?.addEventListener("click", () => {
  efficiencyModal?.classList.remove("show");
});

efficiencyModal?.addEventListener("click", (event) => {
  if (event.target === efficiencyModal) {
    efficiencyModal.classList.remove("show");
  }
});
import { auth, db } from "./firebase.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  collection, doc, getDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const fmt = (n, dec=1) => (Number(n)||0).toLocaleString("pt-BR", {minimumFractionDigits:dec, maximumFractionDigits:dec});

function setDbStatus(text, ok=true){
  $("dbStatus").textContent = text;
  $("dbStatus").className = ok ? "text-emerald-700 font-extrabold" : "text-red-600 font-extrabold";
}

function isGov(profile){
  const role = profile?.role || null;
  const roles = profile?.roles || {};
  return role === "governanca" || role === "admin" || role === "gestor" || roles.admin === true || roles.gestor === true;
}

async function getUserProfile(uid){
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/* =========================
   MENU / VIEWS (mantém tudo)
========================= */
function initMenu(){
  const btns = document.querySelectorAll(".navbtn");
  btns.forEach(b=>{
    b.addEventListener("click", ()=>{
      btns.forEach(x=>x.classList.remove("active"));
      b.classList.add("active");

      const viewId = b.dataset.view;
      document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
      $(viewId).classList.remove("hidden");

      if(viewId === "viewMapa" && map) setTimeout(()=> map.invalidateSize(), 150);
    });
  });
}

/* =========================
   DADOS (novos módulos adicionados)
========================= */
let cooperativas = [];
let coletasCache = [];

let coopUnsub = null;
let coletasUnsub = null;

/* -------- Cooperativas (CRUD) -------- */
function safeJSON(text, fallback){
  try{ if(!text.trim()) return fallback; return JSON.parse(text); }
  catch{ return fallback; }
}

function fillCoopSelects(){
  const opts = cooperativas
    .slice()
    .sort((a,b)=> (a.nome||"").localeCompare(b.nome||""))
    .map(c=> `<option value="${c.id}">${c.nome} • ${c.territorio || "—"}</option>`)
    .join("");

  $("mapCoopSelect").innerHTML = `<option value="">Todas as cooperativas</option>` + opts;
  $("coletasCoopSelect").innerHTML = `<option value="">Todas as cooperativas</option>` + opts;
}

function renderCoopList(){
  const q = ($("coopSearch").value || "").trim().toLowerCase();
  const wrap = $("coopList");
  wrap.innerHTML = "";

  const list = cooperativas
    .filter(c=>{
      if(!q) return true;
      return (c.nome||"").toLowerCase().includes(q) || (c.territorio||"").toLowerCase().includes(q);
    })
    .sort((a,b)=> (a.nome||"").localeCompare(b.nome||""));

  $("coopsMeta").textContent = `${list.length} item(ns)`;

  if(!list.length){
    wrap.innerHTML = `<div class="py-8 text-center text-sm text-slate-500">Nenhuma cooperativa.</div>`;
    return;
  }

  list.forEach(c=>{
    const row = document.createElement("div");
    row.className = "py-3 flex items-start justify-between gap-3";
    row.innerHTML = `
      <div>
        <div class="font-extrabold">${c.nome || "—"}</div>
        <div class="text-xs text-slate-500">${c.territorio || "—"} • ${c.ativa ? "Ativa" : "Inativa"}</div>
        <div class="text-xs text-slate-500">${c.responsavel || ""} ${c.contato ? "• "+c.contato : ""}</div>
      </div>
      <div class="flex gap-2">
        <button class="btnGhost" data-act="edit">Editar</button>
        <button class="btnGhost" data-act="del">Excluir</button>
      </div>
    `;
    row.querySelector('[data-act="edit"]').addEventListener("click", ()=> loadCoopToForm(c));
    row.querySelector('[data-act="del"]').addEventListener("click", ()=> deleteCoop(c.id));
    wrap.appendChild(row);
  });
}

function loadCoopToForm(c){
  $("coopId").value = c.id;
  $("coopNome").value = c.nome || "";
  $("coopTerritorio").value = c.territorio || "";
  $("coopResp").value = c.responsavel || "";
  $("coopContato").value = c.contato || "";
  $("coopAtiva").value = String(!!c.ativa);
  $("coopPontos").value = JSON.stringify(c.pontos || [], null, 2);
  $("coopCobertura").value = JSON.stringify((c.cobertura?.coords) || [], null, 2);
  $("coopMsg").textContent = "Editando cooperativa (salve para atualizar).";
}

function clearCoopForm(){
  $("coopId").value = "";
  $("coopNome").value = "";
  $("coopTerritorio").value = "";
  $("coopResp").value = "";
  $("coopContato").value = "";
  $("coopAtiva").value = "true";
  $("coopPontos").value = "";
  $("coopCobertura").value = "";
  $("coopMsg").textContent = "";
}

async function saveCoop(e){
  e.preventDefault();
  $("coopMsg").textContent = "Salvando…";

  const id = $("coopId").value || null;
  const nome = $("coopNome").value.trim();
  const territorio = $("coopTerritorio").value.trim();
  const responsavel = $("coopResp").value.trim() || null;
  const contato = $("coopContato").value.trim() || null;
  const ativa = $("coopAtiva").value === "true";

  const pontos = safeJSON($("coopPontos").value, []);
  const coberturaCoords = safeJSON($("coopCobertura").value, []);

  const payload = {
    nome, territorio, responsavel, contato, ativa,
    pontos: Array.isArray(pontos) ? pontos : [],
    cobertura: { coords: Array.isArray(coberturaCoords) ? coberturaCoords : [] },
    updatedAt: serverTimestamp()
  };

  try{
    if(id){
      await updateDoc(doc(db, "cooperativas", id), payload);
      $("coopMsg").textContent = "Atualizado ✅";
    }else{
      await addDoc(collection(db, "cooperativas"), { ...payload, createdAt: serverTimestamp() });
      $("coopMsg").textContent = "Criado ✅";
      clearCoopForm();
    }
  }catch(err){
    console.error(err);
    $("coopMsg").textContent = "Erro ao salvar: " + (err.code || err.message || "erro");
  }
}

async function deleteCoop(id){
  const ok = confirm("Excluir cooperativa? (não apaga coletas automaticamente)");
  if(!ok) return;
  try{ await deleteDoc(doc(db, "cooperativas", id)); }
  catch(err){ console.error(err); alert("Erro ao excluir: " + (err.code || err.message)); }
}

function watchCooperativas(){
  if(coopUnsub) coopUnsub();
  const qy = query(collection(db, "cooperativas"), orderBy("nome","asc"));
  coopUnsub = onSnapshot(qy, (snap)=>{
    cooperativas = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    $("coopCount").textContent = cooperativas.length;

    fillCoopSelects();
    renderCoopList();
    renderMap();
    renderColetas();
    renderKPIs();
  }, (err)=>{
    console.error(err);
    setDbStatus(err.code || "erro", false);
  });
}

/* -------- Mapa (Leaflet) -------- */
let map = null;
let layerPolys = null;
let layerMarkers = null;

function initMap(){
  map = L.map("map").setView([-30.0346, -51.2177], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);
  layerPolys = L.layerGroup().addTo(map);
  layerMarkers = L.layerGroup().addTo(map);
}

function renderMap(){
  if(!map) return;

  const coopId = $("mapCoopSelect").value || "";
  layerPolys.clearLayers();
  layerMarkers.clearLayers();

  const list = coopId ? cooperativas.filter(c=>c.id === coopId) : cooperativas;
  const bounds = [];

  list.forEach(c=>{
    const coords = c?.cobertura?.coords || [];
    if(Array.isArray(coords) && coords.length >= 3){
      const latlngs = coords
        .filter(p => typeof p.lat === "number" && typeof p.lng === "number")
        .map(p => [p.lat, p.lng]);

      if(latlngs.length >= 3){
        const poly = L.polygon(latlngs, { weight:2, opacity:0.9 }).addTo(layerPolys);
        poly.bindPopup(`<b>${c.nome}</b><br/>${c.territorio || ""}`);
        latlngs.forEach(ll=>bounds.push(ll));
      }
    }

    const pts = Array.isArray(c.pontos) ? c.pontos : [];
    pts.forEach(p=>{
      if(typeof p.lat !== "number" || typeof p.lng !== "number") return;
      const m = L.marker([p.lat, p.lng]).addTo(layerMarkers);
      m.bindPopup(`<b>${p.label || "Ponto"}</b><br/>${c.nome}`);
      bounds.push([p.lat, p.lng]);
    });
  });

  if(bounds.length){
    map.fitBounds(L.latLngBounds(bounds).pad(0.15));
    $("mapHint").textContent = `${list.length} cooperativa(s) exibida(s) • ${bounds.length} elemento(s)`;
  }else{
    $("mapHint").textContent = "Sem cobertura/pontos cadastrados ainda.";
  }
}

/* -------- Coletas (lista + filtro) -------- */
function isoToBr(iso){
  if(!iso || typeof iso !== "string") return "—";
  const [y,m,d] = iso.split("-");
  if(!y||!m||!d) return iso;
  return `${d}/${m}/${y}`;
}

function normalizeColeta(d){
  const num = (x)=> Number(x||0);

  const recKg =
    num(d.pesoResiduoSecoKg) ||
    (num(d.plasticoKg)+num(d.papelMistoKg)+num(d.papelaoKg)+num(d.aluminioMetalKg)+num(d.vidroKg)+num(d.sacariaKg)+num(d.isoporKg)+num(d.oleoKg)) ||
    0;

  const rejKg =
    (num(d.pesoRejeitoKg) + num(d.pesoNaoComercializadoKg)) ||
    num(d.pesoRejeitoGeralKg) ||
    0;

  return {
    id: d.__id,
    cooperativaId: d.cooperativaId || "",
    cooperativaNome: d.cooperativaNome || "",
    opDate: d.opDate || "",
    deliveryType: d.deliveryType || "",
    flowType: d.flowType || "",
    obs: (d.observacao || "").toString(),
    recKg,
    rejKg,
    raw: d
  };
}

function renderColetas(){
  const coopId = ($("coletasCoopSelect").value || "").trim();
  const s = ($("coletasSearch").value || "").trim().toLowerCase();

  const wrap = $("coletasRows");
  wrap.innerHTML = "";

  const list = coletasCache
    .filter(x=>{
      if(coopId && x.cooperativaId !== coopId) return false;
      if(s){
        const a = (x.obs||"").toLowerCase();
        const b = (x.raw.codigoFamilia || x.raw.codigoCondominio || x.raw.linkedId || "").toString().toLowerCase();
        if(!(a.includes(s) || b.includes(s))) return false;
      }
      return true;
    })
    .slice(0, 200);

  if(!list.length){
    wrap.innerHTML = `<div class="py-8 text-center text-sm text-slate-500">Nenhuma coleta encontrada.</div>`;
    return;
  }

  list.forEach(x=>{
    const coopName =
      x.cooperativaNome ||
      cooperativas.find(c=>c.id===x.cooperativaId)?.nome ||
      "—";

    const row = document.createElement("div");
    row.className = "grid grid-cols-12 gap-3 py-2 text-xs";
    row.innerHTML = `
      <div class="col-span-2 font-extrabold">${coopName}</div>
      <div class="col-span-2">${x.opDate ? isoToBr(x.opDate) : "—"}</div>
      <div class="col-span-2">${x.deliveryType || "—"}</div>
      <div class="col-span-2">${x.flowType || "—"}</div>
      <div class="col-span-1 text-right">${fmt(x.recKg,1)}</div>
      <div class="col-span-1 text-right">${fmt(x.rejKg,1)}</div>
      <div class="col-span-2 text-slate-500">${x.obs ? x.obs.slice(0,60) : "—"}</div>
    `;
    wrap.appendChild(row);
  });
}

function watchColetas(){
  if(coletasUnsub) coletasUnsub();
  const qy = query(collection(db, "coletasSeletivas"), orderBy("opDate","desc"), limit(2000));
  coletasUnsub = onSnapshot(qy, (snap)=>{
    const raw = snap.docs.map(d=>({ __id:d.id, ...d.data() }));
    coletasCache = raw.map(normalizeColeta);

    $("coletasCount").textContent = coletasCache.length;
    renderColetas();
    renderKPIs();
  }, (err)=>{
    console.error(err);
    setDbStatus(err.code || "erro", false);
  });
}

/* -------- KPIs (mantém os originais + adiciona coops/coletas) -------- */
function renderKPIs(){
  // ORIGINAIS (se você ainda não tem coleções, fica 0 por enquanto)
  // (Você pode ligar depois em coleções reais: crgr, users, planos, alertas)
  $("kpiCRGR").textContent = $("crgrCount").textContent || "0";
  $("kpiUsers").textContent = $("usersCount").textContent || "0";
  $("kpiPlanos").textContent = "0";
  $("kpiAlertas").textContent = "0";

  // NOVOS
  const coopsAtivas = cooperativas.filter(c=>c.ativa).length;

  let kg = 0;
  let rej = 0;
  coletasCache.forEach(x=>{
    kg += (Number(x.recKg)||0);
    rej += (Number(x.rejKg)||0);
  });

  $("kpiCoops").textContent = String(coopsAtivas);
  $("kpiKg").textContent = fmt(kg, 1);
  $("kpiRej").textContent = fmt(rej, 1);
}

/* =========================
   INIT / AUTH GUARD
========================= */
function wireUI(){
  initMenu();

  $("btnLogout").addEventListener("click", async ()=>{
    await signOut(auth);
    window.location.href = "./login.html";
  });

  // Cooperativas
  $("coopSearch").addEventListener("input", renderCoopList);
  $("coopForm").addEventListener("submit", saveCoop);
  $("btnClearCoop").addEventListener("click", clearCoopForm);

  // Mapa
  $("mapCoopSelect").addEventListener("change", renderMap);
  $("btnFitMap").addEventListener("click", renderMap);

  // Coletas
  $("coletasCoopSelect").addEventListener("change", renderColetas);
  $("coletasSearch").addEventListener("input", renderColetas);
}

onAuthStateChanged(auth, async (user)=>{
  if(!user){
    window.location.href = "./login.html";
    return;
  }

  $("whoami").textContent = user.email || user.uid;

  try{
    setDbStatus("conectando…", true);

    const profile = await getUserProfile(user.uid);
    if(!isGov(profile)){
      alert("Acesso negado: esta área é apenas para Governança/Admin.");
      window.location.href = "./cooperativa.html";
      return;
    }

    setDbStatus("ok ✅", true);

    wireUI();
    initMap();

    // watchers novos
    watchCooperativas();
    watchColetas();

    // contadores antigos (por enquanto placeholder)
    $("crgrCount").textContent = "0";
    $("usersCount").textContent = "0";
    renderKPIs();

  }catch(err){
    console.error(err);
    setDbStatus("erro", false);
    alert("Erro carregando governança: " + (err.code || err.message));
  }
});
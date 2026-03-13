(() => {
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

  // =========================
  // Cursor glow (leve)
  // =========================
  const glow = $("#cursorGlow");
  const motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  if (glow && motionOK && !coarsePointer){
    let raf = null, x = 0, y = 0;
    window.addEventListener("mousemove", (e) => {
      x = e.clientX; y = e.clientY;
      if (!raf){
        raf = requestAnimationFrame(() => {
          document.documentElement.style.setProperty("--mx", x);
          document.documentElement.style.setProperty("--my", y);
          glow.style.opacity = "1";
          raf = null;
        });
      }
    });
    window.addEventListener("mouseleave", () => glow.style.opacity = "0");
  }

  // =========================
  // Theme toggle (persist)
  // =========================
  const THEME_KEY = "hub_theme";
  const btnTheme = $("#btnTheme");

  function setTheme(theme){
    document.documentElement.setAttribute("data-theme", theme);
    const isDark = theme === "dark";
    if (btnTheme){
      btnTheme.setAttribute("aria-pressed", String(isDark));
      $(".theme-ico", btnTheme).textContent = isDark ? "☀️" : "🌙";
      $(".theme-text", btnTheme).textContent = isDark ? "Light" : "Dark";
    }
    try{ localStorage.setItem(THEME_KEY, theme); } catch {}
  }

  const savedTheme = (() => {
    try{ return localStorage.getItem(THEME_KEY); } catch { return null; }
  })();

  if (savedTheme){
    setTheme(savedTheme);
  } else {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }

  btnTheme?.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    setTheme(cur === "dark" ? "light" : "dark");
  });

  // =========================
  // User menu dropdown
  // =========================
  const userBtn = $("#userBtn");
  const userMenu = $("#userMenu");

  function closeUserMenu(){
    userMenu?.classList.remove("open");
    userBtn?.setAttribute("aria-expanded", "false");
  }
  function toggleUserMenu(){
    if (!userMenu || !userBtn) return;
    const isOpen = userMenu.classList.toggle("open");
    userBtn.setAttribute("aria-expanded", String(isOpen));
  }

  userBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleUserMenu();
  });

  document.addEventListener("click", () => closeUserMenu());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeUserMenu();
  });

  // =========================
  // Navigation (SPA feel)
  // =========================
  const pages = $$("[data-page]");
  const menuItems = $$("[data-nav]");

  function showPage(name){
    pages.forEach(p => p.classList.toggle("show", p.dataset.page === name));
    // sidebar active
    $$(".menu-item[data-nav]").forEach(a => a.classList.toggle("active", a.dataset.nav === name));
    closeUserMenu();
    // scroll to top of main
    $("#main")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  menuItems.forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const name = el.dataset.nav;
      if (name) showPage(name);
    });
  });

  // =========================
  // Território select + labels
  // =========================
  const territorioSelect = $("#territorioSelect");
  const territorioNome = $("#territorioNome");
  const territorioLabel = $("#territorioLabel");

  function territorioText(){
    const opt = territorioSelect?.selectedOptions?.[0];
    return opt ? opt.textContent.trim() : "Território";
  }

  function syncTerritorioUI(){
    const t = territorioText();
    if (territorioNome) territorioNome.textContent = t;
    if (territorioLabel) territorioLabel.textContent = t;
  }

  territorioSelect?.addEventListener("change", () => {
    syncTerritorioUI();
    // aqui você pode recalcular KPIs conforme território real
  });
  syncTerritorioUI();

  // =========================
  // Filtro "somente meus dados"
  // =========================
  const t1 = $("#toggleMeusDados");
  const t2 = $("#toggleMeusDados2");

  function syncToggles(from){
    const val = !!from.checked;
    if (from === t1 && t2) t2.checked = val;
    if (from === t2 && t1) t1.checked = val;

    // Simulação simples nos KPIs
    const kTerr = $("#kpiTerritorio");
    const kMeus = $("#kpiMeus");
    if (val){
      kTerr && (kTerr.textContent = "12");
      kMeus && (kMeus.textContent = "6");
    } else {
      kTerr && (kTerr.textContent = "12");
      kMeus && (kMeus.textContent = "—");
    }
  }

  t1?.addEventListener("change", () => syncToggles(t1));
  t2?.addEventListener("change", () => syncToggles(t2));

  // =========================
  // Trilhas (progresso + "certificado")
  // =========================
  const PROG_KEY = "hub_trilhas_progress";

  function loadProgress(){
    try{
      return JSON.parse(localStorage.getItem(PROG_KEY) || "{}");
    }catch{ return {}; }
  }
  function saveProgress(data){
    try{ localStorage.setItem(PROG_KEY, JSON.stringify(data)); } catch {}
  }

  function calcTrailPct(prefix, prog){
    const keys = [`${prefix}-e1`, `${prefix}-e2`, `${prefix}-e3`];
    const done = keys.filter(k => prog[k]).length;
    return Math.round((done / keys.length) * 100);
  }

  function updateTrailUI(){
    const prog = loadProgress();
    const pct1 = calcTrailPct("t1", prog);
    const pct2 = calcTrailPct("t2", prog);

    $("#pT1") && ($("#pT1").textContent = String(pct1));
    $("#barT1") && ($("#barT1").style.width = pct1 + "%");
    $("#btnCertT1") && ($("#btnCertT1").disabled = pct1 < 100);

    $("#pT2") && ($("#pT2").textContent = String(pct2));
    $("#barT2") && ($("#barT2").style.width = pct2 + "%");
    $("#btnCertT2") && ($("#btnCertT2").disabled = pct2 < 100);

    // KPI geral (média)
    const avg = Math.round((pct1 + pct2) / 2);
    $("#kpiProgresso") && ($("#kpiProgresso").textContent = `${avg}%`);
  }

  $$("[data-step]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-step");
      if (!key) return;
      const prog = loadProgress();
      prog[key] = true;
      saveProgress(prog);
      btn.textContent = "Concluída ✓";
      btn.disabled = true;
      updateTrailUI();
    });

    // estado inicial
    const prog = loadProgress();
    const key = btn.getAttribute("data-step");
    if (key && prog[key]){
      btn.textContent = "Concluída ✓";
      btn.disabled = true;
    }
  });

  $("#btnCertT1")?.addEventListener("click", () => {
    alert("Certificado (demo): gerar PDF aqui quando conectar o backend.");
  });
  $("#btnCertT2")?.addEventListener("click", () => {
    alert("Certificado (demo): gerar PDF aqui quando conectar o backend.");
  });

  updateTrailUI();

  // =========================
  // Coletas (localStorage)
  // =========================
  const COLETAS_KEY = "hub_coletas";
  const formColeta = $("#formColeta");
  const listEl = $("#coletasList");
  const emptyEl = $("#coletasEmpty");

  const btnDia = $("#btnColetaDia");
  const btnParcial = $("#btnColetaParcial");
  const coletaTipo = $("#coletaTipo");
  const coletaData = $("#coletaData");
  const formTitle = $("#formTitle");
  const formHint = $("#formHint");

  function todayISO(){
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function loadColetas(){
    try{ return JSON.parse(localStorage.getItem(COLETAS_KEY) || "[]"); }catch{ return []; }
  }
  function saveColetas(items){
    try{ localStorage.setItem(COLETAS_KEY, JSON.stringify(items)); } catch {}
  }

  function setFormMode(mode){
    if (!coletaTipo) return;
    coletaTipo.value = mode;
    if (formTitle) formTitle.textContent = mode === "dia" ? "Registrar coleta do dia" : "Registrar coleta parcial";
    if (formHint) formHint.textContent = mode === "dia"
      ? "Use para consolidar o total do dia."
      : "Use quando houver mais de uma entrada no mesmo dia.";
  }

  btnDia?.addEventListener("click", () => setFormMode("dia"));
  btnParcial?.addEventListener("click", () => setFormMode("parcial"));

  // default date
  if (coletaData && !coletaData.value) coletaData.value = todayISO();

  function renderColetas(){
    if (!listEl) return;
    const items = loadColetas().slice().reverse();
    listEl.innerHTML = "";
    if (!items.length){
      emptyEl && (emptyEl.style.display = "block");
      listEl.appendChild(emptyEl);
      return;
    }
    emptyEl && (emptyEl.style.display = "none");

    items.forEach(item => {
      const el = document.createElement("div");
      el.className = "coleta-item";
      el.innerHTML = `
        <div>
          <strong>${item.tipo === "dia" ? "Coleta do dia" : "Coleta parcial"} • ${item.categoriaLabel}</strong>
          <p>${item.peso} kg ${item.obs ? `• ${escapeHtml(item.obs)}` : ""}</p>
        </div>
        <div class="coleta-meta">
          ${escapeHtml(item.data)}<br/>
          <span class="muted">${escapeHtml(item.territorio)}</span>
        </div>
      `;
      listEl.appendChild(el);
    });
  }

  function escapeHtml(str){
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  formColeta?.addEventListener("submit", (e) => {
    e.preventDefault();

    const data = $("#coletaData")?.value || todayISO();
    const tipo = $("#coletaTipo")?.value || "dia";
    const pesoRaw = $("#coletaPeso")?.value || "0";
    const peso = Number(pesoRaw);
    const categoria = $("#coletaCategoria")?.value || "mistos";
    const obs = $("#coletaObs")?.value?.trim() || "";

    if (!Number.isFinite(peso) || peso < 0){
      alert("Informe um peso válido.");
      return;
    }

    const categoriaLabelMap = {
      mistos: "Recicláveis mistos",
      papel: "Papel/Papelão",
      plastico: "Plástico",
      vidro: "Vidro",
      metal: "Metal",
      rejeito: "Rejeito",
    };

    const items = loadColetas();
    items.push({
      id: crypto?.randomUUID?.() || String(Date.now()),
      data,
      tipo,
      peso: peso.toFixed(1).replace(".0",""),
      categoria,
      categoriaLabel: categoriaLabelMap[categoria] || categoria,
      obs,
      territorio: territorioText(),
      createdAt: Date.now(),
    });
    saveColetas(items);

    // reset leve
    $("#coletaPeso").value = "";
    $("#coletaObs").value = "";
    renderColetas();

    // feedback
    alert("Coleta salva!");
  });

  $("#btnLimparColeta")?.addEventListener("click", () => {
    $("#coletaPeso").value = "";
    $("#coletaObs").value = "";
  });

  $("#btnLimparHistorico")?.addEventListener("click", () => {
    if (!confirm("Deseja limpar o histórico de coletas (neste navegador)?")) return;
    saveColetas([]);
    renderColetas();
  });

  coletaTipo?.addEventListener("change", () => setFormMode(coletaTipo.value));

  // inicial
  setFormMode(coletaTipo?.value || "dia");
  renderColetas();

  // =========================
  // Form contato (demo)
  // =========================
  $("#formContato")?.addEventListener("submit", (e) => {
    e.preventDefault();
    alert("Mensagem enviada (demo). Integre com backend quando quiser.");
    e.target.reset();
  });

  // =========================
  // Sair (demo)
  // =========================
  function doSair(){
    alert("Sair (demo). Direcione para login.html aqui.");
    // window.location.href = "login.html";
  }
  $("#btnSair")?.addEventListener("click", doSair);
  $("#btnSairTop")?.addEventListener("click", doSair);

})();
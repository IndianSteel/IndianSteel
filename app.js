(function () {
  "use strict";

  const app = document.getElementById("app");
  const INR = "\u20B9";
  const DB_NAME = "indiansteel-pwa-db";
  const DB_STORE = "kv";
  const DATA_KEY = "daily-sales-data-v1";
  const SESSION_KEY = "daily-sales-session-v1";
  const DRIVE_CONFIG_KEY = "daily-sales-drive-config-v1";
  const DRIVE_FILE_NAME = "indiansteel_daily_sales_sync.json";
  const GOOGLE_DRIVE_CLIENT_ID = "18090278328-i9k2i3e78062hbfhpu7pkhe1s7uvuhql.apps.googleusercontent.com";
  const GOOGLE_DRIVE_FOLDER_ID = "1uqSmcaXlqAzGZ1QR0JctoORJsLNQrmy3";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive openid email profile";
  const BUILT_IN_ADMINS = new Set(["indianssteel@gmail.com", "onlineuse0123@gmail.com"]);
  const DEFAULT_ITEMS = [
    "Old MS Round Pipe",
    "Old G.I. Round Pipe",
    "Old MS Square Pipe",
    "Old G.I. Square Pipe",
    "T Angle",
    "L Angle",
    "I Beam",
    "Channel",
    "Profile Sheet (Patra)",
    "New Profile Sheet",
    "Small Nali Sheet (Patra)",
    "Plain G.I. Sheet"
  ];
  const DEFAULT_ACCOUNTS = ["Indian Steel", "Abbu", "Sahbe Alam", "Aajam", "Sahezad"];

  let data = null;
  let session = {};
  let driveConfig = {};
  let googleTokenClient = null;
  let googleScriptPromise = null;
  let saveTimer = 0;
  let renderTimer = 0;
  let syncTimer = 0;

  const ui = {
    screen: "dashboard",
    settlementTab: "advance",
    reportRange: "Daily",
    recentOpen: "",
    historyOpen: "",
    historySearch: "",
    historyFrom: "",
    historyTo: "",
    addOpen: false,
    addStep: "Customer",
    addDraft: null,
    advanceOpen: false,
    advanceDraft: null,
    dueInvoice: "",
    dueDraft: null,
    profileOpen: false,
    message: "",
    error: ""
  };

  const sync = {
    status: "Offline ready",
    busy: false,
    dirty: false,
    token: "",
    tokenExpiresAt: 0,
    fileId: "",
    lastSyncAt: 0,
    lastRemoteCheckAt: 0
  };

  const icons = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chart: '<path d="M4 19V5"/><path d="M8 19v-7"/><path d="M12 19V8"/><path d="M16 19v-4"/><path d="M20 19H3"/>',
    stock: '<path d="M4 7h16v13H4z"/><path d="M8 7V4h8v3"/><path d="M8 12h8"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    delete: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="m13 6 5 5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 5v6h6"/><path d="M12 7v5l3 2"/>',
    sync: '<path d="M20 7h-6a6 6 0 0 0-10 3"/><path d="m20 7-3-3"/><path d="M4 17h6a6 6 0 0 0 10-3"/><path d="m4 17 3 3"/>',
    print: '<path d="M7 8V4h10v4"/><path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v6H7z"/>',
    wallet: '<path d="M4 7h16v12H4z"/><path d="M16 12h4v4h-4z"/><path d="M4 7l3-3h10l3 3"/>',
    whatsapp: ""
  };

  function svg(name) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ""}</svg>`;
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function money(value) {
    return `${INR} ${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
  }

  function numberText(value) {
    return Math.round(Number(value || 0)).toLocaleString("en-IN");
  }

  function nowDate() {
    return new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function nowTime() {
    return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }

  function onlyDigits(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 10);
  }

  function cleanAmount(value) {
    const cleaned = String(value || "").replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    return parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
  }

  function amountValue(value) {
    return Number(cleanAmount(value) || 0);
  }

  function titleCaseName(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trimStart()
      .split(" ")
      .map(part => part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : "")
      .join(" ");
  }

  function id() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function defaultData() {
    return {
      entries: [],
      advanceRecords: [],
      itemCatalog: DEFAULT_ITEMS.slice(),
      stockItems: [],
      itemRates: {},
      accountOptions: DEFAULT_ACCOUNTS.slice(),
      businessProfile: {
        name: "Indian Steel",
        mobile: "8898644245",
        email: "indiansteel@gmail.com",
        logoUri: ""
      },
      adminControls: { users: [], updatedAt: 0 },
      userActivity: [],
      deletedLedgerEntryKeys: [],
      deletedAdvanceRecordKeys: {}
    };
  }

  function normalizeDriveConfig(raw) {
    return {
      clientId: GOOGLE_DRIVE_CLIENT_ID,
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      fileName: DRIVE_FILE_NAME
    };
  }

  function driveConfigured() {
    return Boolean(driveConfig.clientId && driveConfig.folderId);
  }

  function persistDriveConfig() {
    void writeStore(DRIVE_CONFIG_KEY, driveConfig);
  }

  function uniqStrings(values, fallback) {
    const list = (Array.isArray(values) ? values : [])
      .map(value => String(value || "").trim())
      .filter(Boolean);
    const out = [];
    [...list, ...fallback].forEach(value => {
      if (!out.some(existing => existing.toLowerCase() === value.toLowerCase())) out.push(value);
    });
    return out;
  }

  function normalizeData(raw) {
    const base = defaultData();
    const source = raw && typeof raw === "object" ? raw : {};
    if (Array.isArray(source.advances) && !Array.isArray(source.advanceRecords)) {
      source.advanceRecords = source.advances;
    }
    const normalized = {
      ...base,
      ...source,
      entries: Array.isArray(source.entries) ? source.entries.map(normalizeEntry) : [],
      advanceRecords: Array.isArray(source.advanceRecords) ? source.advanceRecords.map(normalizeAdvance) : [],
      itemCatalog: uniqStrings(source.itemCatalog, DEFAULT_ITEMS),
      stockItems: Array.isArray(source.stockItems) ? source.stockItems.map(normalizeStock).filter(Boolean) : [],
      itemRates: source.itemRates && typeof source.itemRates === "object" ? source.itemRates : {},
      accountOptions: uniqStrings(source.accountOptions, DEFAULT_ACCOUNTS),
      businessProfile: { ...base.businessProfile, ...(source.businessProfile || {}) },
      adminControls: source.adminControls && typeof source.adminControls === "object" ? source.adminControls : base.adminControls,
      userActivity: Array.isArray(source.userActivity) ? source.userActivity : [],
      deletedLedgerEntryKeys: Array.isArray(source.deletedLedgerEntryKeys) ? source.deletedLedgerEntryKeys.filter(Boolean) : [],
      deletedAdvanceRecordKeys: source.deletedAdvanceRecordKeys && typeof source.deletedAdvanceRecordKeys === "object" ? source.deletedAdvanceRecordKeys : {}
    };
    normalized.entries = mergeDuplicateEntries(normalized.entries).filter(entry => !isEntryDeleted(entry, normalized.deletedLedgerEntryKeys));
    normalized.advanceRecords = mergeDuplicateAdvances(normalized.advanceRecords).filter(record => !isAdvanceDeleted(record, normalized.deletedAdvanceRecordKeys));
    return normalized;
  }

  function normalizeEntry(entry) {
    return {
      id: entry.id || id(),
      kind: entry.kind || "Sale",
      customer: titleCaseName(entry.customer || ""),
      subtitle: entry.subtitle || "",
      invoiceNo: entry.invoiceNo || "",
      dateLabel: entry.dateLabel || nowDate(),
      timeLabel: entry.timeLabel || "",
      amount: Math.round(Number(entry.amount || 0)),
      paidAmount: Math.round(Number(entry.paidAmount || 0)),
      itemName: entry.itemName || "",
      mobileNumber: onlyDigits(entry.mobileNumber || ""),
      cashPaidAmount: Math.round(Number(entry.cashPaidAmount || 0)),
      onlinePaidAmount: Math.round(Number(entry.onlinePaidAmount || 0)),
      cashAccount: entry.cashAccount || "Indian Steel",
      onlineAccount: entry.onlineAccount || "Indian Steel",
      saleItems: Array.isArray(entry.saleItems) ? entry.saleItems.map(normalizeSaleItem) : [],
      advancePaymentApplied: Math.round(Number(entry.advancePaymentApplied || 0)),
      previousDueApplied: Math.round(Number(entry.previousDueApplied || 0)),
      purchasedAmount: Math.round(Number(entry.purchasedAmount || 0)),
      cuttingCharge: Math.round(Number(entry.cuttingCharge || 0)),
      discountAmount: Math.round(Number(entry.discountAmount || 0)),
      duePaymentHistory: Array.isArray(entry.duePaymentHistory) ? entry.duePaymentHistory.map(normalizeDueHistory) : [],
      dueSnapshotTotal: Math.round(Number(entry.dueSnapshotTotal || 0)),
      dueSnapshotPaid: Math.round(Number(entry.dueSnapshotPaid || 0)),
      dueSnapshotDue: Math.round(Number(entry.dueSnapshotDue || 0)),
      sourceSaleNumber: entry.sourceSaleNumber || "",
      expenseCategory: entry.expenseCategory || "Others",
      dueDate: entry.dueDate || ""
    };
  }

  function normalizeSaleItem(item) {
    return {
      product: item.product || "",
      quantity: String(item.quantity || ""),
      rate: String(item.rate || ""),
      amount: Math.round(Number(item.amount || 0))
    };
  }

  function normalizeDueHistory(item) {
    return {
      dateTime: item.dateTime || "",
      amount: Math.round(Number(item.amount || 0)),
      cashAmount: Math.round(Number(item.cashAmount || 0)),
      onlineAmount: Math.round(Number(item.onlineAmount || 0)),
      cashAccount: item.cashAccount || "Indian Steel",
      onlineAccount: item.onlineAccount || "Indian Steel"
    };
  }

  function normalizeAdvance(record) {
    return {
      id: record.id || id(),
      customer: titleCaseName(record.customer || ""),
      mobile: onlyDigits(record.mobile || ""),
      dateTime: record.dateTime || `${nowDate()}, ${nowTime()}`,
      itemNames: Array.isArray(record.itemNames) ? record.itemNames.filter(Boolean) : [],
      itemRates: record.itemRates && typeof record.itemRates === "object" ? record.itemRates : {},
      method: record.method || paymentModeLabel(record.cashAmount, record.onlineAmount),
      cashAmount: Number(record.cashAmount || 0),
      onlineAmount: Number(record.onlineAmount || 0),
      layout: record.layout || "Split",
      cashAccount: record.cashAccount || "Indian Steel",
      onlineAccount: record.onlineAccount || "Indian Steel",
      consumedSaleNumber: record.consumedSaleNumber || "",
      consumedDateTime: record.consumedDateTime || "",
      usageHistory: Array.isArray(record.usageHistory) ? record.usageHistory.map(item => ({
        saleNumber: item.saleNumber || "",
        dateTime: item.dateTime || "",
        amountUsed: Math.round(Number(item.amountUsed || 0))
      })) : [],
      updatedAt: Number(record.updatedAt || Date.now())
    };
  }

  function normalizeStock(item) {
    const name = String(item && item.name || "").trim();
    if (!name) return null;
    return {
      name,
      quantity: Number(item.quantity || 0),
      lowStockLimit: Number(item.lowStockLimit || 0),
      updatedAt: Number(item.updatedAt || Date.now())
    };
  }

  function paymentModeLabel(cash, online) {
    const c = Number(cash || 0);
    const o = Number(online || 0);
    if (c > 0 && o > 0) return "Cash + Online";
    if (c > 0) return "Cash";
    if (o > 0) return "Online";
    return "-";
  }

  function entryNaturalKey(entry) {
    return [
      entry.kind,
      entry.invoiceNo,
      entry.customer.toLowerCase(),
      entry.mobileNumber,
      entry.dateLabel,
      entry.amount
    ].join("|");
  }

  function entryIdentityKeys(entry) {
    return [entry.id, entryNaturalKey(entry)].filter(Boolean);
  }

  function advanceNaturalKey(record) {
    return [
      record.customer.toLowerCase(),
      record.mobile,
      record.dateTime,
      Math.round((record.cashAmount + record.onlineAmount) * 100) / 100
    ].join("|");
  }

  function advanceIdentityKeys(record) {
    return [record.id, advanceNaturalKey(record)].filter(Boolean);
  }

  function isEntryDeleted(entry, deletedKeys) {
    return entryIdentityKeys(entry).some(key => deletedKeys.includes(key));
  }

  function isAdvanceDeleted(record, deletedMap) {
    return advanceIdentityKeys(record).some(key => Object.prototype.hasOwnProperty.call(deletedMap, key));
  }

  function mergeDuplicateEntries(entries) {
    const map = new Map();
    entries.forEach(entry => {
      const key = entry.id || entryNaturalKey(entry);
      const existing = map.get(key) || map.get(entryNaturalKey(entry));
      if (!existing) {
        map.set(key, entry);
        return;
      }
      existing.duePaymentHistory = uniqueBy([...existing.duePaymentHistory, ...entry.duePaymentHistory], item =>
        `${item.dateTime}|${item.amount}|${item.cashAmount}|${item.onlineAmount}|${item.cashAccount}|${item.onlineAccount}`
      );
      existing.paidAmount = Math.max(existing.paidAmount, entry.paidAmount);
    });
    return Array.from(map.values()).sort((a, b) => entryRank(b) - entryRank(a));
  }

  function mergeDuplicateAdvances(records) {
    const map = new Map();
    records.forEach(record => {
      const key = record.id || advanceNaturalKey(record);
      const natural = advanceNaturalKey(record);
      const existing = map.get(key) || map.get(natural);
      if (!existing) {
        map.set(key, record);
        return;
      }
      const newer = record.updatedAt >= existing.updatedAt ? record : existing;
      newer.usageHistory = uniqueBy([...existing.usageHistory, ...record.usageHistory], item =>
        `${item.saleNumber}|${item.dateTime}|${item.amountUsed}`
      );
      newer.itemNames = uniqStrings([...existing.itemNames, ...record.itemNames], []);
      map.set(key, newer);
    });
    return Array.from(map.values()).sort((a, b) => parseDateRank(b.dateTime) - parseDateRank(a.dateTime));
  }

  function uniqueBy(items, keyFn) {
    const seen = new Set();
    return items.filter(item => {
      const key = keyFn(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function parseDateRank(label) {
    const value = Date.parse(String(label || "").replace(/(\d{2}) ([A-Za-z]{3}) (\d{4})/, "$2 $1 $3"));
    return Number.isFinite(value) ? value : 0;
  }

  function entryRank(entry) {
    return parseDateRank(`${entry.dateLabel} ${entry.timeLabel || ""}`) || parseDateRank(entry.dateLabel);
  }

  function saleDue(entry) {
    if (entry.kind !== "Sale") return 0;
    return Math.max(0, Number(entry.amount || 0) - Number(entry.paidAmount || 0));
  }

  function dashboardSales(entry) {
    if (entry.kind === "Sale") return Number(entry.paidAmount || 0);
    if (entry.kind === "Payment" && isDuePaymentReceipt(entry)) return Number(entry.amount || entry.paidAmount || 0);
    return 0;
  }

  function isDuePaymentReceipt(entry) {
    return entry.kind === "Payment" && String(entry.subtitle || "").toLowerCase().startsWith("due payment");
  }

  async function openDb() {
    if (!("indexedDB" in window)) return null;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function readStore(key) {
    try {
      const db = await openDb();
      if (!db) throw new Error("No IndexedDB");
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readonly");
        const request = tx.objectStore(DB_STORE).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (_) {
      try {
        return JSON.parse(localStorage.getItem(key) || "null");
      } catch (error) {
        return null;
      }
    }
  }

  async function writeStore(key, value) {
    try {
      const db = await openDb();
      if (!db) throw new Error("No IndexedDB");
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (_) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  function persist({ syncAfter = true } = {}) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void writeStore(DATA_KEY, data);
    }, 80);
    if (syncAfter) {
      sync.dirty = true;
      queueSync("local-change");
    }
    scheduleRender();
  }

  function persistSession() {
    void writeStore(SESSION_KEY, session);
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 0);
  }

  function hasLocalBusinessData() {
    return Boolean(data.entries.length || data.advanceRecords.length || data.stockItems.length);
  }

  function canOpenApp() {
    return Boolean(session.email || session.localOnly || hasLocalBusinessData());
  }

  function totals() {
    const today = nowDate();
    const sales = data.entries.reduce((sum, entry) => sum + dashboardSales(entry), 0);
    const todaySales = data.entries.filter(entry => entry.dateLabel === today).reduce((sum, entry) => sum + dashboardSales(entry), 0);
    const monthlySales = sales;
    const advanceTotal = data.advanceRecords.reduce((sum, record) => sum + Number(record.cashAmount || 0) + Number(record.onlineAmount || 0), 0);
    const dueTotal = data.entries.reduce((sum, entry) => sum + saleDue(entry), 0);
    return { sales, todaySales, monthlySales, advanceTotal, dueTotal };
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }

  function render() {
    if (!data) return;
    if (!canOpenApp()) {
      app.innerHTML = loginScreen();
      bind();
      return;
    }
    const page = ui.screen === "dashboard" ? dashboardScreen()
      : ui.screen === "settlements" ? settlementsScreen()
      : ui.screen === "reports" ? reportsScreen()
      : ui.screen === "stock" ? stockScreen()
      : historyScreen();
    app.innerHTML = page + bottomNav() + overlays() + printMarkup();
    bind();
  }

  function loginScreen() {
    const offlineNote = navigator.onLine
      ? "Login with your approved Gmail account to open dashboard, reports, settlements, and sync."
      : "Internet is needed for first login. After one login this app opens offline.";
    const statusText = sync.status && sync.status.toLowerCase().includes("failed")
      ? "Google login failed. Please try again."
      : sync.status;
    return `
      <main class="login-screen apk-login">
        <div class="login-blue-panel"></div>
        <section class="apk-login-content">
          <p class="login-kicker">Welcome to</p>
          <h1>Indian Steel</h1>
          <div class="login-logo-ring">
            <img class="login-logo" src="./icons/indian-steel-logo.png" alt="Indian Steel">
          </div>
          <section class="card login-card">
            <h2>Secure Business Access</h2>
            <p>${esc(offlineNote)}</p>
            <button class="primary-button google-login-button" data-action="google-login">
              ${svg("user")}
              <span>Login with Gmail</span>
            </button>
            ${hasLocalBusinessData() ? '<button class="secondary-button" data-action="continue-local">Open Offline Data</button>' : ""}
            <p class="login-status ${statusText && statusText.toLowerCase().includes("failed") ? "error-text" : ""}">${esc(ui.error || statusText || "Ready")}</p>
          </section>
          <p class="developer-label">Developed By</p>
          <p class="developer-name">Ceres Canopus Private Limited</p>
        </section>
      </main>`;
  }

  function driveSetupBox() {
    return "";
  }

  function dashboardScreen() {
    const t = totals();
    const recent = data.entries.slice().sort((a, b) => entryRank(b) - entryRank(a)).slice(0, 6);
    const weekly = weeklySales();
    const trend = dashboardTrend(t.todaySales);
    return `
      <main class="page dashboard-page">
        <section class="dashboard-hero-stack">
          <section class="hero">
            <div class="hero-top">
              <button class="icon-button" data-action="profile" aria-label="Profile">${svg("menu")}</button>
              <div class="hero-title">Dashboard</div>
              <button class="icon-button" data-screen="history" aria-label="History">${svg("bell")}</button>
            </div>
            <h2>${esc(greeting())}, ${esc(dashboardUserName())} &#128075;</h2>
            <p>Here's what's happening today.</p>
          </section>
          <section class="card summary-main dashboard-summary">
            <div class="section-title">
              <h2>Today's Summary</h2>
              <span class="summary-date">${svg("calendar")}<span>${esc(nowDate())}</span></span>
            </div>
            <span class="summary-label">Total Sales</span>
            <div class="summary-amount-row">
              <div class="amount-xl">${esc(money(t.todaySales))}.00</div>
              <div class="trend-stack ${trend.direction > 0 ? "up" : trend.direction < 0 ? "down" : "flat"}">
                <b>${trend.direction > 0 ? "&uarr; " : trend.direction < 0 ? "&darr; " : ""}${Math.abs(trend.value).toFixed(1)}%</b>
                <span>vs Yesterday</span>
              </div>
            </div>
          </section>
        </section>
        <section class="grid-3 dashboard-stats">
          ${statCard("Monthly Sales", money(t.monthlySales), "wallet", "green", 'data-screen="reports" data-report="Monthly"')}
          ${statCard("Advances", money(t.advanceTotal), "card", "blue", 'data-settlement-open="advance"')}
          ${statCard("Due Payments", money(t.dueTotal), "card", "red", 'data-settlement-open="due"')}
        </section>
        <section class="card section dashboard-section">
          <div class="section-title"><h2>Sales Overview (Last 7 Days)</h2><button class="link-button" data-screen="reports">View All</button></div>
          ${dashboardChart(weekly)}
        </section>
        <section class="card section dashboard-section recent-section">
          <div class="section-title"><h2>Recent Entries</h2><button class="link-button history-icon-button" data-screen="history" aria-label="Open history">${svg("history")}</button></div>
          ${recent.length ? recent.map((entry, index) => dashboardEntryRow(entry) + (index < recent.length - 1 ? '<div class="divider"></div>' : "")).join("") : '<div class="empty">No entries yet.</div>'}
        </section>
      </main>`;
  }

  function dashboardUserName() {
    const raw = session.name || session.email || data.businessProfile.name || "Indian Steel";
    const name = String(raw).split("@")[0].split(/\s+/)[0] || "Indian Steel";
    return titleCaseName(name);
  }

  function dashboardTrend(todaySales) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const label = yesterday.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const yesterdaySales = data.entries
      .filter(entry => entry.dateLabel === label)
      .reduce((sum, entry) => sum + dashboardSales(entry), 0);
    const direction = todaySales > yesterdaySales ? 1 : todaySales < yesterdaySales ? -1 : 0;
    if (yesterdaySales <= 0 && todaySales <= 0) return { value: 0, direction };
    if (yesterdaySales <= 0) return { value: 100, direction };
    return { value: ((todaySales - yesterdaySales) / yesterdaySales) * 100, direction };
  }

  function dashboardChart(items) {
    const width = 340;
    const height = 132;
    const left = 28;
    const right = 8;
    const top = 0;
    const bottom = 22;
    const chartHeight = height - top - bottom;
    const chartWidth = width - left - right;
    const axisStep = salesChartStep(items.map(item => Number(item.value || 0)));
    const chartMax = axisStep * 3;
    const axisValues = [chartMax, axisStep * 2, axisStep, 0];
    const points = items.map((item, index) => {
      const x = left + (items.length <= 1 ? chartWidth : (chartWidth / (items.length - 1)) * index);
      const y = top + chartHeight - (Number(item.value || 0) / Math.max(1, chartMax)) * chartHeight;
      return { ...item, x, y };
    });
    const path = curvedSvgPath(points);
    const area = `M${points[0].x.toFixed(1)} ${top + chartHeight} L${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} ${curvedSvgSegments(points)} L${points[points.length - 1].x.toFixed(1)} ${top + chartHeight} Z`;
    return `
      <div class="dashboard-chart">
        <svg viewBox="0 0 ${width} ${height}" aria-label="Sales overview chart" role="img">
          ${axisValues.map((value, index) => {
            const y = top + (chartHeight / 3) * index;
            return `<line class="chart-grid" x1="${left}" y1="${y.toFixed(1)}" x2="${width - right}" y2="${y.toFixed(1)}"></line><text class="chart-y" x="0" y="${(y + 4).toFixed(1)}">${esc(compactChartAxisValue(value))}</text>`;
          }).join("")}
          <path class="chart-area" d="${area}"></path>
          <path class="chart-line" d="${path}"></path>
          ${points.map(point => `<circle class="chart-dot-halo" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.5"></circle><circle class="chart-dot" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="2"></circle>`).join("")}
          ${points.map(point => `<text class="chart-x" x="${point.x.toFixed(1)}" y="${height - 5}">${esc(point.shortLabel)}</text>`).join("")}
        </svg>
      </div>`;
  }

  function curvedSvgPath(points) {
    return `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} ${curvedSvgSegments(points)}`;
  }

  function curvedSvgSegments(points) {
    return points.slice(0, -1).map((start, index) => {
      const end = points[index + 1];
      const midX = (start.x + end.x) / 2;
      return `C${midX.toFixed(1)} ${start.y.toFixed(1)} ${midX.toFixed(1)} ${end.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
    }).join(" ");
  }

  function salesChartStep(values) {
    const maxValue = Math.max(0, ...values);
    const rawStep = Math.max(maxValue / 3, 1000);
    const candidates = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];
    return candidates.find(value => value >= rawStep) || Math.ceil(rawStep / 1000000) * 1000000;
  }

  function compactChartAxisValue(value) {
    const amount = Math.round(Number(value || 0));
    if (amount <= 0) return "0";
    if (amount >= 100000 && amount % 100000 === 0) return `${String(amount / 100000).padStart(2, "0")}L`;
    if (amount >= 1000 && amount % 1000 === 0) return `${String(amount / 1000).padStart(2, "0")}K`;
    return String(amount);
  }

  function syncBadge() {
    const label = sync.busy ? "Syncing Drive" : navigator.onLine ? sync.status : "Offline ready";
    return `<span class="status-pill">${svg(sync.busy ? "sync" : "card")}<span>${esc(label)}</span></span>`;
  }

  function statCard(title, value, iconName, tone, attrs) {
    return `
      <button class="card stat-card" ${attrs}>
        <span class="tile ${tone}">${svg(iconName)}</span>
        <small>${esc(title)}</small>
        <b class="${tone === "red" ? "red" : tone === "green" ? "green" : ""}">${esc(value)}</b>
      </button>`;
  }

  function weeklySales() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const label = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const shortLabel = date.toLocaleDateString("en-GB", { day: "2-digit" });
      const value = data.entries.filter(entry => entry.dateLabel === label).reduce((sum, entry) => sum + dashboardSales(entry), 0);
      days.push({ label, shortLabel, value });
    }
    return days;
  }

  function dashboardEntryRow(entry) {
    const due = saleDue(entry);
    const amount = entry.kind === "Sale"
      ? due > 0 ? `<span class="money">${esc(money(entry.amount))}</span> <span class="money red">- ${esc(money(due))}</span>` : `<span class="money">${esc(money(entry.amount))}</span>`
      : `<span class="money">${esc(money(entry.amount || entry.paidAmount))}</span>`;
    const key = entry.id;
    const open = ui.recentOpen === key;
    const dateCaption = entry.timeLabel ? `${esc(entry.dateLabel)},<br>${esc(entry.timeLabel)}` : esc(entry.dateLabel);
    return `
      <div class="dashboard-entry-row" data-toggle-entry="${esc(key)}" data-source="recent">
        <span class="tile blue">${svg(entry.kind === "Payment" ? "card" : "chart")}</span>
        <span class="row-main">
          <b>${esc(entry.customer || "Walk-in Customer")}</b>
          <span>${esc(entry.subtitle || entry.kind || entry.invoiceNo)}</span>
        </span>
        <span class="dashboard-entry-meta">${amount}<small>${dateCaption}</small></span>
        <button class="mini-action danger" data-delete-entry="${esc(entry.id)}" aria-label="Delete">${svg("delete")}</button>
      </div>
      ${open ? entryDetail(entry, { source: "recent" }) : ""}`;
  }

  function entryRow(entry, source) {
    const due = saleDue(entry);
    const amount = entry.kind === "Sale"
      ? due > 0 ? `<span class="money">${esc(money(entry.amount))}</span> <span class="money red">- ${esc(money(due))}</span>` : `<span class="money">${esc(money(entry.amount))}</span>`
      : `<span class="money">${esc(money(entry.amount || entry.paidAmount))}</span>`;
    const key = entry.id;
    const open = (source === "history" ? ui.historyOpen : ui.recentOpen) === key;
    return `
      <div class="entry-row" data-toggle-entry="${esc(key)}" data-source="${esc(source)}">
        <span class="tile blue">${svg(entry.kind === "Payment" ? "card" : "chart")}</span>
        <span class="row-main">
          <b>${esc(entry.customer || "Walk-in Customer")}</b>
          <span>${esc(entry.itemName || entry.subtitle || entry.kind)}</span>
          <span>${esc(entry.subtitle || entry.invoiceNo)}</span>
        </span>
        <span class="row-right">${amount}<br>${esc(entry.dateLabel)} ${esc(entry.timeLabel)}</span>
      </div>
      ${open ? entryDetail(entry, { source }) : ""}`;
  }

  function entryDetail(entry, options = {}) {
    const summary = entryDetailSummary(entry);
    const saleItems = entry.saleItems.length ? entry.saleItems : [{ product: entry.itemName || "-", quantity: "", rate: "", amount: summary.purchasedAmount }];
    const isDueReceipt = isDuePaymentReceipt(entry);
    const showDelete = options.source !== "recent";
    return `
      <div class="detail-box entry-detail">
        <div class="detail-top">
          <div class="detail-info">
            ${detailInline("Sale Number", summary.saleNumber)}
            ${detailInline("Mobile Number", entry.mobileNumber || "-")}
          </div>
          <div class="detail-actions">
            ${showDelete ? `<button class="mini-action danger" data-delete-entry="${esc(entry.id)}" aria-label="Delete">${svg("delete")}</button>` : ""}
            ${!isDueReceipt ? `<button class="mini-action whatsapp-action" data-share-entry="${esc(entry.id)}" aria-label="Share">${whatsappIcon()}</button>` : ""}
          </div>
        </div>
        <div class="detail-divider"></div>
        <h3 class="detail-heading">Item Purchased:</h3>
        <div class="detail-item-list">${saleItems.map((item, index) => detailItemBlock(item, index)).join("")}</div>
        <h3 class="detail-heading payment-heading">Payment Details:</h3>
        <section class="detail-payment-box">
          ${summary.adjustments.map(row => detailAmountRow(row.label, row.value)).join("")}
          <div class="detail-payment-modes">
            ${detailPayMode("Cash", summary.cashPaid, summary.cashAccount)}
            ${detailPayMode("Online", summary.onlinePaid, summary.onlineAccount)}
          </div>
          ${detailAmountRow("Total Amount", summary.totalAmount, true)}
          ${summary.showPaidDue ? detailAmountRow("Paid Amount", summary.paidAmount) + detailAmountRow("Due Payment", summary.dueAmount) : ""}
          ${summary.historyItems.length ? detailHistoryCard(summary) : ""}
        </section>
      </div>`;
  }

  function entryDetailSummary(entry) {
    const dueReceipt = isDuePaymentReceipt(entry);
    const historyItems = entry.duePaymentHistory || [];
    const historyPaid = historyItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalAmount = dueReceipt ? Number(entry.dueSnapshotTotal || entry.amount || 0) : Number(entry.amount || 0);
    const paidAfterHistory = dueReceipt ? Number(entry.dueSnapshotPaid || entry.paidAmount || 0) : Number(entry.paidAmount || 0);
    const paidAmount = Math.max(0, paidAfterHistory - historyPaid);
    const dueAmount = Math.max(0, totalAmount - paidAmount);
    const purchasedAmount = Number(entry.purchasedAmount || totalAmount || 0);
    const cuttingCharge = Number(entry.cuttingCharge || 0);
    const discountAmount = Number(entry.discountAmount || 0);
    const adjustments = [];
    const hasAdjustments = Boolean(
      cuttingCharge > 0 ||
      discountAmount > 0 ||
      Number(entry.advancePaymentApplied || 0) > 0 ||
      Number(entry.previousDueApplied || 0) > 0 ||
      (purchasedAmount > 0 && purchasedAmount !== totalAmount)
    );
    if (hasAdjustments) adjustments.push({ label: "Purchased Amount", value: purchasedAmount });
    if (cuttingCharge > 0) adjustments.push({ label: "Cutting Charge", value: cuttingCharge });
    if (discountAmount > 0) adjustments.push({ label: "Discount Amount", value: discountAmount });
    if (Number(entry.advancePaymentApplied || 0) > 0) adjustments.push({ label: "Advance Payment", value: entry.advancePaymentApplied });
    if (Number(entry.previousDueApplied || 0) > 0) adjustments.push({ label: "Due Payment", value: entry.previousDueApplied });
    const cashPaid = Number(entry.cashPaidAmount || 0);
    const rawOnlinePaid = Number(entry.onlinePaidAmount || 0);
    const onlinePaid = cashPaid === 0 && rawOnlinePaid === 0 && paidAmount > 0 ? paidAmount : rawOnlinePaid;
    return {
      saleNumber: dueReceipt ? entry.sourceSaleNumber || entry.invoiceNo || "-" : entry.invoiceNo || entry.sourceSaleNumber || "-",
      purchasedAmount,
      totalAmount,
      paidAmount,
      dueAmount,
      cashPaid,
      onlinePaid,
      cashAccount: cashPaid > 0 ? entry.cashAccount || "Indian Steel" : "-",
      onlineAccount: onlinePaid > 0 ? entry.onlineAccount || "Indian Steel" : "-",
      adjustments,
      showPaidDue: dueReceipt || dueAmount > 0 || historyItems.length > 0,
      historyItems,
      historyStartPaid: paidAmount
    };
  }

  function detailInline(label, value) {
    return `<div class="detail-inline"><b>${esc(label.toUpperCase())} :</b><span>${esc(value || "-")}</span></div>`;
  }

  function detailItemBlock(item, index) {
    return `
      <article class="detail-item-card">
        <div class="detail-item-name">${index + 1}. ${esc(String(item.product || "Sale Item").toUpperCase())}</div>
        <div class="detail-pill-grid">
          ${detailSmallPill("Qty.", item.quantity || "")}
          ${detailSmallPill("Rate", item.rate || "")}
        </div>
        ${detailSmallPill("Amount", numberText(item.amount), "amount")}
      </article>`;
  }

  function detailSmallPill(label, value, extraClass = "") {
    return `<div class="detail-small-pill ${extraClass}"><span>${esc(label.toUpperCase())}</span><b>${esc(value || "")}</b></div>`;
  }

  function detailAmountRow(label, value, bold = false) {
    return `<div class="detail-amount-row ${bold ? "bold" : ""}"><span>${esc(label.toUpperCase())}</span><b>${esc(numberText(value))}</b></div>`;
  }

  function detailPayMode(label, amount, account) {
    const active = Number(amount || 0) > 0;
    return `
      <div class="detail-pay-mode ${active ? "active" : "disabled"}">
        <span>${esc(label)}</span>
        <b>${esc(numberText(amount))}</b>
      </div>`;
  }

  function detailHistoryCard(summary) {
    let runningPaid = summary.historyStartPaid;
    return `
      <div class="detail-history-card">
        <h3 class="detail-heading">History:</h3>
        ${summary.historyItems.map((item, index) => {
          runningPaid = Math.min(summary.totalAmount, runningPaid + Number(item.amount || 0));
          const runningDue = Math.max(0, summary.totalAmount - runningPaid);
          return `<div class="detail-history-row"><span>${index + 1}.</span><div>${detailAmountRow("Paid Amount", item.amount, true)}${detailAmountRow("Due Amount", runningDue)}</div></div>`;
        }).join("")}
      </div>`;
  }

  function whatsappIcon() {
    return '<img class="whatsapp-icon" src="./icons/whatsapp-icon.png" alt="">';
  }

  function settlementsScreen() {
    return `
      <main class="page">
        ${blueHeader("Settlements")}
        <div class="tabs">
          <button class="tab ${ui.settlementTab === "advance" ? "active" : ""}" data-settlement-tab="advance">Advance Payment</button>
          <button class="tab ${ui.settlementTab === "due" ? "active" : ""}" data-settlement-tab="due">Due Payment</button>
        </div>
        <section class="content">${ui.settlementTab === "advance" ? advanceTab() : dueTab()}</section>
      </main>`;
  }

  function advanceTab() {
    const total = data.advanceRecords.reduce((sum, record) => sum + Number(record.cashAmount || 0) + Number(record.onlineAmount || 0), 0);
    return `
      <div class="grid-3" style="grid-template-columns:minmax(0,1fr) 58px minmax(0,1fr);align-items:center">
        <div class="card total-card"><small>Advance Entries</small><b>${data.advanceRecords.length}</b></div>
        <button class="round-add" data-action="open-advance">${svg("plus")}</button>
        <div class="card total-card"><small>Advance Total</small><b class="orange">${esc(money(total))}</b></div>
      </div>
      ${data.advanceRecords.length ? data.advanceRecords.map(record => `
        <article class="card settlement-row">
          <span class="tile blue">${svg("card")}</span>
          <span class="row-main"><b>${esc(record.customer)}</b><span>${esc(record.dateTime)}</span></span>
          <span class="row-right"><span class="money orange">${esc(money(Number(record.cashAmount || 0) + Number(record.onlineAmount || 0)))}</span><br>${esc(record.method)}</span>
          <button class="mini-action danger" data-delete-advance="${esc(record.id)}">${svg("delete")}</button>
        </article>`).join("") : '<section class="card section empty">No advance payments available yet.</section>'}`;
  }

  function dueTab() {
    const dueEntries = data.entries.filter(entry => entry.kind === "Sale" && (saleDue(entry) > 0 || entry.duePaymentHistory.length));
    const dueOpen = dueEntries.filter(entry => saleDue(entry) > 0);
    const total = dueOpen.reduce((sum, entry) => sum + saleDue(entry), 0);
    return `
      <div class="grid-2" style="margin:10px 16px">
        <div class="card total-card"><small>Due Customers</small><b>${dueOpen.length}</b></div>
        <div class="card total-card"><small>Due Amount</small><b class="red">${esc(money(total))}</b></div>
      </div>
      ${dueEntries.length ? dueEntries.map(entry => `
        <article class="card settlement-row">
          <span class="tile red">${svg("card")}</span>
          <span class="row-main"><b>${esc(entry.customer)}</b><span>${esc(entry.dateLabel)}, ${esc(entry.timeLabel)}</span></span>
          <span class="row-right"><span class="money red">${esc(money(saleDue(entry)))}</span></span>
          ${saleDue(entry) > 0 ? `<button class="mini-action" data-open-due="${esc(entry.invoiceNo)}">${svg("edit")}</button>` : '<span></span>'}
        </article>`).join("") : '<section class="card section empty">No due payments pending right now.</section>'}`;
  }

  function reportsScreen() {
    const t = totals();
    const ranges = ["Daily", "Weekly", "Monthly", "Yearly", "Custom"];
    return `
      <main class="page">
        ${blueHeader("Reports")}
        <div class="tabs">${ranges.map(range => `<button class="tab ${ui.reportRange === range ? "active" : ""}" data-report-range="${range}">${range}</button>`).join("")}</div>
        <section class="content">
          <div class="grid-2" style="margin:10px 16px">
            <div class="card total-card"><small>Total Sales</small><b>${esc(money(t.sales))}</b></div>
            <div class="card total-card"><small>Monthly Sales</small><b>${esc(money(t.monthlySales))}</b></div>
            <div class="card total-card"><small>Advances</small><b class="orange">${esc(money(t.advanceTotal))}</b></div>
            <div class="card total-card"><small>Due Payments</small><b class="red">${esc(money(t.dueTotal))}</b></div>
          </div>
          <section class="card section"><div class="section-title"><h2>${esc(ui.reportRange)} Trend</h2></div><div class="chart">${weeklySales().map(item => `<div class="bar" style="height:${Math.max(8, Math.min(124, item.value / 5000 * 124))}px"></div>`).join("")}</div></section>
        </section>
      </main>`;
  }

  function stockScreen() {
    return `
      <main class="page">
        ${blueHeader("Stock")}
        <section class="section card">
          <div class="section-title"><h2>Stock Items</h2><button class="link-button" data-action="add-stock">Add</button></div>
          <div class="form-row">
            <input class="field" data-stock-name placeholder="Item name">
            <input class="field" data-stock-qty inputmode="decimal" placeholder="Qty">
          </div>
        </section>
        ${data.stockItems.length ? data.stockItems.map(item => `
          <article class="card stock-row">
            <span class="tile blue">${svg("stock")}</span>
            <span class="row-main"><b>${esc(item.name)}</b><span>Low limit ${esc(numberText(item.lowStockLimit))}</span></span>
            <span class="row-right"><span class="money">${esc(numberText(item.quantity))}</span></span>
            <button class="mini-action danger" data-delete-stock="${esc(item.name)}">${svg("delete")}</button>
          </article>`).join("") : '<section class="card section empty">No stock items yet.</section>'}
      </main>`;
  }

  function historyScreen() {
    const entries = filteredHistoryEntries();
    const grouped = groupBy(entries, entry => entry.dateLabel || "-");
    const dateSelected = ui.historyFrom || ui.historyTo;
    return `
      <main class="page">
        ${blueHeader("History")}
        <section class="history-tools">
          <input class="field" data-history-search placeholder="Search customer, item or price" value="${esc(ui.historySearch)}">
          <div class="date-row">
            <input class="field" type="date" data-history-from value="${esc(ui.historyFrom)}">
            <input class="field" type="date" data-history-to value="${esc(ui.historyTo)}">
            <button class="print-button" ${dateSelected ? "" : "disabled"} data-action="print-history">${svg("print")}</button>
          </div>
        </section>
        ${Object.keys(grouped).length ? Object.entries(grouped).map(([date, rows]) => `
          <section class="card section">
            <div class="section-title"><h2>${esc(date)}</h2><h3>${esc(money(rows.reduce((sum, entry) => sum + dashboardSales(entry), 0)))}</h3></div>
            ${rows.map(entry => entryRow(entry, "history")).join('<div class="divider"></div>')}
          </section>`).join("") : '<section class="card section empty">No entries found.</section>'}
      </main>`;
  }

  function filteredHistoryEntries() {
    const query = ui.historySearch.trim().toLowerCase();
    const from = ui.historyFrom ? Date.parse(ui.historyFrom) : 0;
    const to = ui.historyTo ? Date.parse(ui.historyTo) + 86400000 - 1 : Infinity;
    return data.entries
      .filter(entry => {
        const text = `${entry.customer} ${entry.itemName} ${entry.invoiceNo} ${entry.amount}`.toLowerCase();
        const rank = parseDateRank(entry.dateLabel);
        return (!query || text.includes(query)) && rank >= from && rank <= to;
      })
      .sort((a, b) => entryRank(b) - entryRank(a));
  }

  function groupBy(items, keyFn) {
    return items.reduce((acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }

  function blueHeader(title) {
    return `
      <header class="blue-header">
        <button class="icon-button" data-screen="dashboard">${svg("home")}</button>
        <h1>${esc(title)}</h1>
        <button class="icon-button" data-action="profile">${svg("user")}</button>
      </header>`;
  }

  function bottomNav() {
    const items = [
      ["dashboard", "home", "Dashboard"],
      ["settlements", "card", "Settlements"],
      ["add", "plus", ""],
      ["reports", "chart", "Reports"],
      ["stock", "stock", "Stock"]
    ];
    return `<nav class="bottom-nav">
      ${items.map(([screen, iconName, label]) => screen === "add"
        ? `<button class="nav-plus" data-action="open-add" aria-label="Add entry">${svg(iconName)}</button>`
        : `<button class="nav-item ${ui.screen === screen ? "active" : ""}" data-screen="${screen}">${svg(iconName)}<span>${label}</span></button>`).join("")}
    </nav>`;
  }

  function overlays() {
    return [
      ui.addOpen ? addEntrySheet() : "",
      ui.advanceOpen ? advanceSheet() : "",
      ui.dueInvoice ? duePaymentSheet() : "",
      ui.profileOpen ? profileSheet() : ""
    ].join("");
  }

  function addEntrySheet() {
    const steps = ["Customer", "Item", "Payment", "Preview"];
    return `
      <div class="overlay" data-overlay-close="add">
        <section class="sheet" data-sheet>
          <div class="sheet-head">
            <button class="icon-button" data-action="close-add">${svg("close")}</button>
            <b>Add New Entry</b>
            <span></span>
          </div>
          <div class="step-tabs">${steps.map(step => `<button class="step-tab ${ui.addStep === step ? "active" : ""}" data-add-step="${step}">${step}</button>`).join("")}</div>
          <div class="sheet-body">${addStepBody()}</div>
          <div class="sheet-actions">
            ${ui.error ? `<div class="message error">${esc(ui.error)}</div>` : ""}
            <button class="save-button" data-action="add-next">${ui.addStep === "Preview" ? "SAVE" : "SAVE"}</button>
          </div>
        </section>
      </div>`;
  }

  function addStepBody() {
    const draft = ui.addDraft;
    if (ui.addStep === "Customer") {
      return `
        <div class="form-grid">
          <label class="label">Sale Number</label>
          <input class="field" value="${esc(draft.saleNumber)}" readonly>
          <label class="label">Date</label>
          <input class="field" type="date" data-draft="date" value="${esc(draft.date)}">
          <label class="label">Customer Name *</label>
          <input class="field" data-draft="customer" value="${esc(draft.customer)}" autocomplete="name">
          <label class="label">Mobile Number</label>
          <input class="field" data-draft="mobile" value="${esc(draft.mobile)}" inputmode="numeric" maxlength="10">
        </div>`;
    }
    if (ui.addStep === "Item") {
      return `
        <div class="form-grid">
          ${draft.items.map((item, index) => `
            <section class="card payment-card">
              <div class="section-title"><h2>Item ${index + 1}</h2>${draft.items.length > 1 ? `<button class="link-button" data-remove-item="${index}">Remove</button>` : ""}</div>
              <div class="form-grid">
                <select class="select-field" data-item-field="product" data-item-index="${index}">
                  <option value="">Select item</option>
                  ${data.itemCatalog.map(name => `<option ${item.product === name ? "selected" : ""}>${esc(name)}</option>`).join("")}
                </select>
                <div class="form-row">
                  <input class="field" data-item-field="quantity" data-item-index="${index}" inputmode="decimal" placeholder="Qty" value="${esc(item.quantity)}">
                  <input class="field" data-item-field="rate" data-item-index="${index}" inputmode="decimal" placeholder="Rate" value="${esc(item.rate)}">
                </div>
                <input class="field" data-item-field="amount" data-item-index="${index}" inputmode="decimal" placeholder="Amount" value="${esc(item.amount)}">
              </div>
            </section>`).join("")}
          <button class="secondary-button" data-action="add-item-row">Add Item</button>
        </div>`;
    }
    if (ui.addStep === "Payment") {
      const purchased = purchasedAmount(draft);
      const total = payableAmount(draft);
      return `
        <section class="card payment-card">
          <div class="form-grid">
            <div class="strip"><button data-action="toggle-discount" type="button">Purchased Amount</button><span>${esc(money(purchased))}</span></div>
            ${(draft.discountOpen || amountValue(draft.discountAmount) > 0) ? `<input class="field" data-draft="discountAmount" inputmode="decimal" placeholder="Discount Amount" value="${esc(draft.discountAmount)}">` : ""}
            <input class="field" data-draft="cuttingCharge" inputmode="decimal" placeholder="Cutting Charge" value="${esc(draft.cuttingCharge)}">
            <div class="pay-modes">
              ${payMode("Cash", "cash", draft.cash)}
              ${payMode("Online", "online", draft.online)}
            </div>
            <div class="strip"><span>Total Amount</span><span>${esc(money(total))}</span></div>
          </div>
        </section>`;
    }
    return previewBody();
  }

  function payMode(label, key, value) {
    return `
      <label class="pay-mode ${amountValue(value) > 0 ? "active" : ""}">
        <span>${label}</span>
        <input class="field" data-draft="${key}" data-pay-field="${key}" inputmode="decimal" value="${esc(value)}" placeholder="0">
      </label>`;
  }

  function previewBody() {
    const draft = ui.addDraft;
    const purchased = purchasedAmount(draft);
    const cutting = Math.round(amountValue(draft.cuttingCharge));
    const discount = Math.round(amountValue(draft.discountAmount));
    const total = payableAmount(draft);
    const paid = Math.min(total, Math.round(amountValue(draft.cash) + amountValue(draft.online)));
    return `
      <div class="form-grid">
        <section class="card payment-card">
          <div class="split-line"><span>Sale Number</span><span>${esc(draft.saleNumber)}</span></div>
          <div class="split-line"><span>Customer Name</span><span>${esc(draft.customer)}</span></div>
          <div class="split-line"><span>Mobile Number</span><span>${esc(draft.mobile || "-")}</span></div>
        </section>
        <section class="card payment-card">
          <h3 class="label">Item Purchased</h3>
          ${draft.items.map((item, index) => `<div class="split-line"><span>${index + 1}. ${esc(item.product || "-")}</span><span>${esc(money(amountValue(item.amount)))}</span></div>`).join("")}
        </section>
        <section class="card payment-card">
          <h3 class="label">Payment Details</h3>
          <div class="split-line"><span>Purchased Amount</span><span>${esc(money(purchased))}</span></div>
          ${cutting > 0 ? `<div class="split-line"><span>Cutting Charge</span><span>${esc(money(cutting))}</span></div>` : ""}
          ${discount > 0 ? `<div class="split-line"><span>Discount Amount</span><span>${esc(money(discount))}</span></div>` : ""}
          <div class="split-line"><span>Total Amount</span><span>${esc(money(total))}</span></div>
          <div class="split-line"><span>Paid Amount</span><span>${esc(money(paid))}</span></div>
          ${total - paid > 0 ? `<div class="split-line"><span>Due Payment</span><span>${esc(money(total - paid))}</span></div>` : ""}
        </section>
      </div>`;
  }

  function advanceSheet() {
    const draft = ui.advanceDraft;
    return `
      <div class="overlay" data-overlay-close="advance">
        <section class="sheet" data-sheet>
          <div class="sheet-head">
            <button class="icon-button" data-action="close-advance">${svg("close")}</button>
            <b>Advance Payment Entry</b>
            <span></span>
          </div>
          <div></div>
          <div class="sheet-body">
            <div class="form-grid">
              <label class="label">Customer Name</label>
              <input class="field" data-advance="customer" value="${esc(draft.customer)}">
              <label class="label">Mobile Number</label>
              <input class="field" data-advance="mobile" inputmode="numeric" maxlength="10" value="${esc(draft.mobile)}">
              <label class="label">Item List</label>
              <input class="field" data-advance="items" value="${esc(draft.items)}" placeholder="Items separated by comma">
              <section class="card payment-card">
                <div class="pay-modes">
                  ${advancePayMode("Cash", "cash", draft.cash)}
                  ${advancePayMode("Online", "online", draft.online)}
                </div>
                <div style="height:8px"></div>
                <div class="strip"><span>Total Amount</span><span>${esc(money(amountValue(draft.cash) + amountValue(draft.online)))}</span></div>
              </section>
            </div>
          </div>
          <div class="sheet-actions">
            ${ui.error ? `<div class="message error">${esc(ui.error)}</div>` : ""}
            <button class="save-button" data-action="save-advance">SAVE</button>
          </div>
        </section>
      </div>`;
  }

  function advancePayMode(label, key, value) {
    return `<label class="pay-mode ${amountValue(value) > 0 ? "active" : ""}"><span>${label}</span><input class="field" data-advance="${key}" inputmode="decimal" value="${esc(value)}" placeholder="0"></label>`;
  }

  function duePaymentSheet() {
    const sale = data.entries.find(entry => entry.invoiceNo === ui.dueInvoice);
    if (!sale) return "";
    const draft = ui.dueDraft;
    const due = saleDue(sale);
    return `
      <div class="overlay" data-overlay-close="due">
        <section class="sheet" data-sheet>
          <div class="sheet-head">
            <button class="icon-button" data-action="close-due">${svg("close")}</button>
            <b>Due Payment</b>
            <span></span>
          </div>
          <div></div>
          <div class="sheet-body">
            <div class="form-grid">
              <div class="strip"><span>Due Amount</span><span>${esc(money(due))}</span></div>
              <section class="card payment-card">
                <div class="pay-modes">
                  ${duePayMode("Cash", "cash", draft.cash)}
                  ${duePayMode("Online", "online", draft.online)}
                </div>
                <div style="height:8px"></div>
                <div class="strip"><span>Paid Amount</span><span>${esc(money(amountValue(draft.cash) + amountValue(draft.online)))}</span></div>
              </section>
            </div>
          </div>
          <div class="sheet-actions">
            ${ui.error ? `<div class="message error">${esc(ui.error)}</div>` : ""}
            <button class="save-button" data-action="save-due">SAVE</button>
          </div>
        </section>
      </div>`;
  }

  function duePayMode(label, key, value) {
    return `<label class="pay-mode ${amountValue(value) > 0 ? "active" : ""}"><span>${label}</span><input class="field" data-due="${key}" inputmode="decimal" value="${esc(value)}" placeholder="0"></label>`;
  }

  function profileSheet() {
    const signedText = session.email ? `Signed in as ${session.email}` : "Local offline mode";
    return `
      <div class="overlay" data-overlay-close="profile">
        <section class="sheet" data-sheet>
          <div class="sheet-head">
            <button class="icon-button" data-action="close-profile">${svg("close")}</button>
            <b>Profile</b>
            <span></span>
          </div>
          <div></div>
          <div class="sheet-body">
            <section class="card payment-card">
              <img class="login-logo" src="./icons/indian-steel-logo.png" alt="Indian Steel">
              <div class="section-title"><h2>${esc(data.businessProfile.name || "Indian Steel")}</h2></div>
              <p class="muted">${esc(signedText)}</p>
              <p class="muted">${esc(sync.status)}</p>
              <div class="form-grid">
                <button class="primary-button" data-action="sync-now">${sync.busy ? "Syncing Drive..." : "Sync with Drive"}</button>
                <button class="secondary-button" data-action="google-login">${session.email ? "Reconnect Google" : "Login with Google"}</button>
                ${session.email || session.localOnly ? '<button class="secondary-button" data-action="logout">Logout on this device</button>' : ""}
              </div>
            </section>
          </div>
          <div class="sheet-actions"><button class="save-button" data-action="close-profile">DONE</button></div>
        </section>
      </div>`;
  }

  function printMarkup() {
    const entries = filteredHistoryEntries();
    return `<div class="receipt-print"><h1>History</h1>${entries.map(entry => `<p><b>${esc(entry.dateLabel)}</b> ${esc(entry.customer)} ${esc(entry.invoiceNo)} ${esc(money(entry.amount))}</p>`).join("")}</div>`;
  }

  function purchasedAmount(draft) {
    return Math.round(draft.items.reduce((sum, item) => sum + amountValue(item.amount), 0));
  }

  function payableAmount(draft) {
    return Math.max(0, Math.round(purchasedAmount(draft) + amountValue(draft.cuttingCharge) - amountValue(draft.discountAmount)));
  }

  function newAddDraft() {
    return {
      saleNumber: nextSaleNumber(),
      date: new Date().toISOString().slice(0, 10),
      customer: "",
      mobile: "",
      items: [{ product: "", quantity: "", rate: "", amount: "" }],
      cuttingCharge: "0",
      discountAmount: "0",
      discountOpen: false,
      cash: "0",
      online: "0",
      cashAccount: "Indian Steel",
      onlineAccount: "Indian Steel"
    };
  }

  function nextSaleNumber() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const year = now.getFullYear();
    const count = data ? data.entries.filter(entry => entry.kind === "Sale").length + 1 : 1;
    return `#${month}-${day}-${year}/${count}`;
  }

  function dateInputToLabel(value) {
    if (!value) return nowDate();
    const date = new Date(`${value}T12:00:00`);
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  function createSaleFromDraft() {
    const draft = ui.addDraft;
    const purchased = purchasedAmount(draft);
    const total = payableAmount(draft);
    const cash = Math.round(amountValue(draft.cash));
    const online = Math.round(amountValue(draft.online));
    const paid = Math.min(total, cash + online);
    const items = draft.items.map(item => ({
      product: item.product,
      quantity: item.quantity,
      rate: item.rate,
      amount: Math.round(amountValue(item.amount))
    }));
    return normalizeEntry({
      id: id(),
      kind: "Sale",
      customer: titleCaseName(draft.customer).trim() || "Walk-in Customer",
      subtitle: `Sale - ${draft.saleNumber}`,
      invoiceNo: draft.saleNumber,
      dateLabel: dateInputToLabel(draft.date),
      timeLabel: nowTime(),
      amount: total,
      paidAmount: paid,
      itemName: items.map(item => item.product).filter(Boolean).join(", "),
      mobileNumber: onlyDigits(draft.mobile),
      cashPaidAmount: Math.min(cash, paid),
      onlinePaidAmount: Math.min(online, paid),
      cashAccount: draft.cashAccount,
      onlineAccount: draft.onlineAccount,
      saleItems: items,
      purchasedAmount: purchased,
      cuttingCharge: Math.round(amountValue(draft.cuttingCharge)),
      discountAmount: Math.round(amountValue(draft.discountAmount))
    });
  }

  function validateAddStep() {
    ui.error = "";
    const draft = ui.addDraft;
    if (ui.addStep === "Customer") {
      draft.customer = titleCaseName(draft.customer).trim();
      draft.mobile = onlyDigits(draft.mobile);
      if (!draft.customer) return fail("Customer name is required.");
      if (draft.mobile && draft.mobile.length !== 10) return fail("Mobile number must be exactly 10 digits.");
    }
    if (ui.addStep === "Item") {
      draft.items = draft.items.map(item => ({
        ...item,
        product: item.product.trim(),
        amount: cleanAmount(item.amount)
      })).filter(item => item.product || amountValue(item.amount) > 0);
      if (!draft.items.length || !draft.items.every(item => item.product && amountValue(item.amount) > 0)) {
        return fail("Add item name and amount before continuing.");
      }
    }
    if (ui.addStep === "Payment" && payableAmount(draft) <= 0) return fail("Total amount must be greater than 0.");
    return true;
  }

  function fail(message) {
    ui.error = message;
    scheduleRender();
    return false;
  }

  function handleAddNext() {
    const steps = ["Customer", "Item", "Payment", "Preview"];
    if (!validateAddStep()) return;
    const index = steps.indexOf(ui.addStep);
    if (ui.addStep === "Preview") {
      data.entries.unshift(createSaleFromDraft());
      data = normalizeData(data);
      ui.addOpen = false;
      ui.addDraft = null;
      ui.screen = "dashboard";
      sync.status = "Entry saved locally";
      persist();
      return;
    }
    ui.addStep = steps[index + 1];
    scheduleRender();
  }

  function bind() {
    document.querySelectorAll("[data-screen]").forEach(el => el.addEventListener("click", () => {
      ui.screen = el.dataset.screen;
      ui.recentOpen = "";
      ui.historyOpen = "";
      scheduleRender();
    }));
    document.querySelectorAll("[data-action]").forEach(el => el.addEventListener("click", event => handleAction(event, el.dataset.action)));
    document.querySelectorAll("[data-settlement-open]").forEach(el => el.addEventListener("click", () => {
      ui.settlementTab = el.dataset.settlementOpen;
      ui.screen = "settlements";
      scheduleRender();
    }));
    document.querySelectorAll("[data-settlement-tab]").forEach(el => el.addEventListener("click", () => {
      ui.settlementTab = el.dataset.settlementTab;
      scheduleRender();
    }));
    document.querySelectorAll("[data-report-range]").forEach(el => el.addEventListener("click", () => {
      ui.reportRange = el.dataset.reportRange;
      scheduleRender();
    }));
    document.querySelectorAll("[data-report]").forEach(el => el.addEventListener("click", () => {
      ui.reportRange = el.dataset.report;
    }));
    document.querySelectorAll("[data-toggle-entry]").forEach(el => el.addEventListener("click", event => {
      if (event.target.closest("button")) return;
      const key = el.dataset.toggleEntry;
      if (el.dataset.source === "history") {
        ui.historyOpen = ui.historyOpen === key ? "" : key;
      } else {
        ui.recentOpen = ui.recentOpen === key ? "" : key;
      }
      scheduleRender();
    }));
    document.querySelectorAll("[data-overlay-close]").forEach(el => el.addEventListener("click", event => {
      if (event.target.closest("[data-sheet]")) return;
      closeOverlay(el.dataset.overlayClose);
    }));
    document.querySelectorAll("[data-add-step]").forEach(el => el.addEventListener("click", () => {
      ui.addStep = el.dataset.addStep;
      ui.error = "";
      scheduleRender();
    }));
    document.querySelectorAll("[data-draft]").forEach(el => el.addEventListener("input", () => updateAddDraft(el)));
    document.querySelectorAll("[data-item-field]").forEach(el => el.addEventListener("input", () => updateItemDraft(el)));
    document.querySelectorAll("[data-advance]").forEach(el => el.addEventListener("input", () => {
      const key = el.dataset.advance;
      ui.advanceDraft[key] = key === "customer" ? titleCaseName(el.value) : key === "mobile" ? onlyDigits(el.value) : key === "cash" || key === "online" ? cleanAmount(el.value) : el.value;
      if (el.value !== ui.advanceDraft[key]) el.value = ui.advanceDraft[key];
      scheduleRender();
    }));
    document.querySelectorAll("[data-due]").forEach(el => el.addEventListener("input", () => {
      const key = el.dataset.due;
      ui.dueDraft[key] = cleanAmount(el.value);
      balanceDueDraft(key);
      scheduleRender();
    }));
    document.querySelectorAll("[data-config]").forEach(el => el.addEventListener("input", () => {
      driveConfig = normalizeDriveConfig({
        ...driveConfig,
        [el.dataset.config]: el.value
      });
    }));
    document.querySelectorAll("[data-remove-item]").forEach(el => el.addEventListener("click", () => {
      ui.addDraft.items.splice(Number(el.dataset.removeItem), 1);
      scheduleRender();
    }));
    document.querySelectorAll("[data-delete-entry]").forEach(el => el.addEventListener("click", () => deleteEntry(el.dataset.deleteEntry)));
    document.querySelectorAll("[data-delete-advance]").forEach(el => el.addEventListener("click", () => deleteAdvance(el.dataset.deleteAdvance)));
    document.querySelectorAll("[data-open-due]").forEach(el => el.addEventListener("click", () => openDueSheet(el.dataset.openDue)));
    document.querySelectorAll("[data-delete-stock]").forEach(el => el.addEventListener("click", () => deleteStock(el.dataset.deleteStock)));
    document.querySelectorAll("[data-share-entry]").forEach(el => el.addEventListener("click", () => shareEntry(el.dataset.shareEntry)));
    const historySearch = document.querySelector("[data-history-search]");
    if (historySearch) historySearch.addEventListener("input", () => {
      ui.historySearch = historySearch.value;
      scheduleRender();
    });
    const historyFrom = document.querySelector("[data-history-from]");
    if (historyFrom) historyFrom.addEventListener("input", () => {
      ui.historyFrom = historyFrom.value;
      scheduleRender();
    });
    const historyTo = document.querySelector("[data-history-to]");
    if (historyTo) historyTo.addEventListener("input", () => {
      ui.historyTo = historyTo.value;
      scheduleRender();
    });
  }

  function handleAction(event, action) {
    event.preventDefault();
    if (action === "google-login") return void loginWithGoogle();
    if (action === "save-drive-config") {
      driveConfig = normalizeDriveConfig();
      persistDriveConfig();
      sync.status = driveConfigured() ? "Sync ready" : "Sync setup required";
      ui.error = driveConfigured() ? "" : "Google sync is not configured in this app.";
    }
    if (action === "continue-local") {
      session.localOnly = true;
      persistSession();
      scheduleRender();
    }
    if (action === "profile") ui.profileOpen = true;
    if (action === "close-profile") ui.profileOpen = false;
    if (action === "open-add") {
      ui.addOpen = true;
      ui.addStep = "Customer";
      ui.addDraft = newAddDraft();
      ui.error = "";
    }
    if (action === "close-add") closeOverlay("add");
    if (action === "add-next") handleAddNext();
    if (action === "add-item-row") ui.addDraft.items.push({ product: "", quantity: "", rate: "", amount: "" });
    if (action === "toggle-discount") ui.addDraft.discountOpen = true;
    if (action === "open-advance") {
      ui.advanceOpen = true;
      ui.advanceDraft = { customer: "", mobile: "", items: "", cash: "0", online: "0" };
      ui.error = "";
    }
    if (action === "close-advance") closeOverlay("advance");
    if (action === "save-advance") saveAdvance();
    if (action === "close-due") closeOverlay("due");
    if (action === "save-due") saveDuePayment();
    if (action === "sync-now") void syncNow({ manual: true });
    if (action === "logout") {
      session = {};
      sync.token = "";
      sync.status = "Logged out on this device";
      persistSession();
    }
    if (action === "add-stock") addStock();
    if (action === "print-history") window.print();
    scheduleRender();
  }

  function closeOverlay(name) {
    if (name === "add") ui.addOpen = false;
    if (name === "advance") ui.advanceOpen = false;
    if (name === "due") ui.dueInvoice = "";
    if (name === "profile") ui.profileOpen = false;
    ui.error = "";
    scheduleRender();
  }

  function updateAddDraft(el) {
    const key = el.dataset.draft;
    let value = el.value;
    if (key === "customer") value = titleCaseName(value);
    if (key === "mobile") value = onlyDigits(value);
    if (["cash", "online", "cuttingCharge", "discountAmount"].includes(key)) value = cleanAmount(value);
    ui.addDraft[key] = value;
    if (el.value !== value) el.value = value;
    if (key === "cash" || key === "online") balancePaymentDraft(key);
    scheduleRender();
  }

  function updateItemDraft(el) {
    const index = Number(el.dataset.itemIndex);
    const field = el.dataset.itemField;
    const item = ui.addDraft.items[index];
    if (!item) return;
    item[field] = field === "product" ? el.value : cleanAmount(el.value);
    if (field === "quantity" || field === "rate") {
      const qty = amountValue(item.quantity);
      const rate = amountValue(item.rate);
      if (qty > 0 && rate > 0) item.amount = String(Math.round(qty * rate));
    }
    if (field === "amount" && amountValue(item.quantity) > 0) {
      const rate = amountValue(item.amount) / amountValue(item.quantity);
      item.rate = rate ? String(Math.round(rate * 100) / 100) : item.rate;
    }
    scheduleRender();
  }

  function balancePaymentDraft(lastEdited) {
    const total = payableAmount(ui.addDraft);
    if (lastEdited === "cash") {
      const cash = Math.min(amountValue(ui.addDraft.cash), total);
      ui.addDraft.cash = String(cash);
      ui.addDraft.online = String(Math.max(0, total - cash));
    } else {
      const online = Math.min(amountValue(ui.addDraft.online), total);
      ui.addDraft.online = String(online);
      ui.addDraft.cash = String(Math.max(0, total - online));
    }
  }

  function balanceDueDraft(lastEdited) {
    const sale = data.entries.find(entry => entry.invoiceNo === ui.dueInvoice);
    if (!sale) return;
    const due = saleDue(sale);
    if (lastEdited === "cash") {
      const cash = Math.min(amountValue(ui.dueDraft.cash), due);
      ui.dueDraft.cash = String(cash);
      ui.dueDraft.online = String(Math.max(0, due - cash));
    } else {
      const online = Math.min(amountValue(ui.dueDraft.online), due);
      ui.dueDraft.online = String(online);
      ui.dueDraft.cash = String(Math.max(0, due - online));
    }
  }

  function saveAdvance() {
    const draft = ui.advanceDraft;
    draft.customer = titleCaseName(draft.customer).trim();
    draft.mobile = onlyDigits(draft.mobile);
    if (!draft.customer) return void fail("Customer name is required.");
    if (draft.mobile.length !== 10) return void fail("Mobile number must be exactly 10 digits.");
    const total = amountValue(draft.cash) + amountValue(draft.online);
    if (total <= 0) return void fail("Advance amount must be greater than 0.");
    const record = normalizeAdvance({
      id: id(),
      customer: draft.customer,
      mobile: draft.mobile,
      dateTime: `${nowDate()}, ${nowTime()}`,
      itemNames: draft.items.split(",").map(item => item.trim()).filter(Boolean),
      method: paymentModeLabel(draft.cash, draft.online),
      cashAmount: amountValue(draft.cash),
      onlineAmount: amountValue(draft.online),
      layout: "Split",
      updatedAt: Date.now()
    });
    data.advanceRecords.unshift(record);
    data = normalizeData(data);
    ui.advanceOpen = false;
    sync.status = "Advance saved locally";
    persist();
  }

  function openDueSheet(invoiceNo) {
    const sale = data.entries.find(entry => entry.invoiceNo === invoiceNo);
    if (!sale) return;
    ui.dueInvoice = invoiceNo;
    ui.dueDraft = { cash: "0", online: String(saleDue(sale)) };
    ui.error = "";
    scheduleRender();
  }

  function saveDuePayment() {
    const sale = data.entries.find(entry => entry.invoiceNo === ui.dueInvoice);
    if (!sale) return;
    const due = saleDue(sale);
    const cash = Math.round(amountValue(ui.dueDraft.cash));
    const online = Math.round(amountValue(ui.dueDraft.online));
    const paid = Math.min(due, cash + online);
    if (paid <= 0) return void fail("Enter payment amount.");
    const historyItem = normalizeDueHistory({
      dateTime: `${nowDate()}, ${nowTime()}`,
      amount: paid,
      cashAmount: Math.min(cash, paid),
      onlineAmount: Math.min(online, paid),
      cashAccount: "Indian Steel",
      onlineAccount: "Indian Steel"
    });
    sale.paidAmount = Math.min(sale.amount, sale.paidAmount + paid);
    sale.duePaymentHistory = uniqueBy([...sale.duePaymentHistory, historyItem], item => `${item.dateTime}|${item.amount}|${item.cashAmount}|${item.onlineAmount}`);
    data.entries.unshift(normalizeEntry({
      id: id(),
      kind: "Payment",
      customer: sale.customer,
      subtitle: `Due Payment - ${sale.invoiceNo}`,
      invoiceNo: `DUE-${Date.now()}`,
      dateLabel: nowDate(),
      timeLabel: nowTime(),
      amount: paid,
      paidAmount: paid,
      itemName: sale.itemName,
      mobileNumber: sale.mobileNumber,
      cashPaidAmount: historyItem.cashAmount,
      onlinePaidAmount: historyItem.onlineAmount,
      saleItems: sale.saleItems,
      purchasedAmount: sale.purchasedAmount,
      cuttingCharge: sale.cuttingCharge,
      discountAmount: sale.discountAmount,
      duePaymentHistory: sale.duePaymentHistory,
      dueSnapshotTotal: sale.amount,
      dueSnapshotPaid: sale.paidAmount,
      dueSnapshotDue: saleDue(sale),
      sourceSaleNumber: sale.invoiceNo
    }));
    data = normalizeData(data);
    ui.dueInvoice = "";
    sync.status = "Due payment saved locally";
    persist();
  }

  function deleteEntry(entryId) {
    const entry = data.entries.find(item => item.id === entryId);
    if (!entry) return;
    entryIdentityKeys(entry).forEach(key => {
      if (!data.deletedLedgerEntryKeys.includes(key)) data.deletedLedgerEntryKeys.unshift(key);
    });
    data.entries = data.entries.filter(item => item.id !== entryId);
    persist();
  }

  function deleteAdvance(recordId) {
    const record = data.advanceRecords.find(item => item.id === recordId);
    if (!record) return;
    const deletedAt = Date.now();
    advanceIdentityKeys(record).forEach(key => { data.deletedAdvanceRecordKeys[key] = deletedAt; });
    data.advanceRecords = data.advanceRecords.filter(item => item.id !== recordId);
    persist();
  }

  function addStock() {
    const nameEl = document.querySelector("[data-stock-name]");
    const qtyEl = document.querySelector("[data-stock-qty]");
    const name = titleCaseName(nameEl && nameEl.value || "").trim();
    const qty = amountValue(qtyEl && qtyEl.value || "0");
    if (!name) return;
    const existing = data.stockItems.find(item => item.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.quantity = qty;
      existing.updatedAt = Date.now();
    } else {
      data.stockItems.push({ name, quantity: qty, lowStockLimit: 0, updatedAt: Date.now() });
    }
    data.itemCatalog = uniqStrings([...data.itemCatalog, name], DEFAULT_ITEMS);
    persist();
  }

  function deleteStock(name) {
    data.stockItems = data.stockItems.filter(item => item.name !== name);
    persist();
  }

  async function shareEntry(entryId) {
    const entry = data.entries.find(item => item.id === entryId);
    if (!entry) return;
    const text = `${data.businessProfile.name || "Indian Steel"}\n${entry.customer}\n${entry.invoiceNo}\nTotal: ${money(entry.amount)}\nPaid: ${money(entry.paidAmount)}\nDue: ${money(saleDue(entry))}`;
    if (navigator.share) {
      await navigator.share({ title: "Sales Receipt", text }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    }
  }

  async function loginWithGoogle() {
    ui.error = "";
    if (!driveConfigured()) {
      ui.error = "Google sync is not configured in this app.";
      scheduleRender();
      return;
    }
    if (!navigator.onLine) {
      ui.error = "Internet is needed for Google login.";
      scheduleRender();
      return;
    }
    try {
      const token = await requestAccessToken({ prompt: "consent" });
      sync.token = token.access_token;
      sync.tokenExpiresAt = Date.now() + Math.max(10, Number(token.expires_in || 3600) - 60) * 1000;
      const profile = await fetchGoogleProfile();
      const email = (profile.email || session.email || "").toLowerCase();
      if (email && !isAllowedEmail(email)) {
        throw new Error("This Gmail is not approved in app access controls.");
      }
      session = {
        email,
        name: profile.name || email,
        lastLoginAt: Date.now(),
        localOnly: false
      };
      persistSession();
      sync.status = "Google connected";
      await syncNow({ manual: true });
    } catch (error) {
      ui.error = error.message || "Google login failed.";
      sync.status = "Google reconnect needed";
    }
    scheduleRender();
  }

  function isAllowedEmail(email) {
    const normalized = String(email || "").toLowerCase();
    const rules = Array.isArray(data.adminControls && data.adminControls.users) ? data.adminControls.users : [];
    if (!rules.length) return true;
    return BUILT_IN_ADMINS.has(normalized) || rules.some(rule => String(rule.email || "").toLowerCase() === normalized);
  }

  async function loadGoogleIdentity() {
    if (window.google && google.accounts && google.accounts.oauth2) return;
    if (googleScriptPromise) return googleScriptPromise;
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Unable to load Google login."));
      document.head.appendChild(script);
    });
    return googleScriptPromise;
  }

  async function requestAccessToken({ prompt = "" } = {}) {
    await loadGoogleIdentity();
    return new Promise((resolve, reject) => {
      googleTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: driveConfig.clientId,
        scope: DRIVE_SCOPE,
        callback: response => {
          if (response.error) reject(new Error(response.error_description || response.error));
          else resolve(response);
        }
      });
      googleTokenClient.requestAccessToken({ prompt });
    });
  }

  async function ensureToken({ manual = false } = {}) {
    if (sync.token && Date.now() < sync.tokenExpiresAt) return true;
    if (!session.email) return false;
    try {
      const token = await requestAccessToken({ prompt: manual ? "consent" : "" });
      sync.token = token.access_token;
      sync.tokenExpiresAt = Date.now() + Math.max(10, Number(token.expires_in || 3600) - 60) * 1000;
      return true;
    } catch (_) {
      sync.status = "Reconnect Google to sync";
      return false;
    }
  }

  async function fetchGoogleProfile() {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${sync.token}` }
    });
    if (!response.ok) return {};
    return response.json();
  }

  function queueSync(reason) {
    if (!navigator.onLine || !session.email) {
      sync.status = navigator.onLine ? "Saved locally" : "Offline changes pending";
      return;
    }
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => void syncNow({ manual: false, reason }), 500);
  }

  async function syncNow({ manual = false, reason = "auto" } = {}) {
    if (sync.busy) {
      sync.dirty = true;
      return;
    }
    if (!navigator.onLine) {
      sync.status = "Offline changes pending";
      scheduleRender();
      return;
    }
    if (!session.email) {
      sync.status = "Login needed for Drive sync";
      scheduleRender();
      return;
    }
    if (!driveConfigured()) {
      sync.status = "Sync setup required";
      if (manual) ui.error = "Google sync is not configured in this app.";
      scheduleRender();
      return;
    }
    const tokenReady = await ensureToken({ manual });
    if (!tokenReady) {
      if (manual) ui.profileOpen = true;
      scheduleRender();
      return;
    }
    sync.busy = true;
    sync.status = "Syncing Drive";
    scheduleRender();
    try {
      const remote = await downloadDriveData();
      const before = JSON.stringify(data);
      const merged = normalizeData(remote ? mergeData(remote, data) : data);
      data = merged;
      await writeStore(DATA_KEY, data);
      const after = JSON.stringify(data);
      if (sync.dirty || before !== after || !remote || reason === "local-change") {
        await uploadDriveData(data);
      }
      sync.dirty = false;
      sync.lastSyncAt = Date.now();
      sync.lastRemoteCheckAt = Date.now();
      sync.status = "Drive synced";
    } catch (error) {
      sync.status = `Drive sync failed: ${error.message || "check access"}`;
    } finally {
      sync.busy = false;
      scheduleRender();
    }
  }

  async function driveFetch(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${sync.token}`
      }
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || response.statusText || "Drive request failed");
    }
    return response;
  }

  async function findDriveFile() {
    if (sync.fileId) return sync.fileId;
    const q = encodeURIComponent(`'${driveConfig.folderId}' in parents and name='${driveConfig.fileName}' and trashed=false`);
    const fields = encodeURIComponent("files(id,name,modifiedTime)");
    const response = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&spaces=drive`);
    const json = await response.json();
    const file = (json.files || [])[0];
    sync.fileId = file ? file.id : "";
    return sync.fileId;
  }

  async function downloadDriveData() {
    const fileId = await findDriveFile();
    if (!fileId) return null;
    const response = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    return normalizeData(await response.json());
  }

  async function uploadDriveData(payload) {
    const metadata = {
      name: driveConfig.fileName,
      mimeType: "application/json",
      parents: sync.fileId ? undefined : [driveConfig.folderId]
    };
    const boundary = `indiansteel-${Date.now()}`;
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(payload),
      `--${boundary}--`
    ].join("\r\n");
    const fileId = await findDriveFile();
    const url = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
    const response = await driveFetch(url, {
      method: fileId ? "PATCH" : "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body
    });
    const json = await response.json();
    sync.fileId = json.id || fileId || sync.fileId;
  }

  function mergeData(remoteRaw, localRaw) {
    const remote = normalizeData(remoteRaw);
    const local = normalizeData(localRaw);
    const deletedLedgerEntryKeys = uniqueBy([...local.deletedLedgerEntryKeys, ...remote.deletedLedgerEntryKeys], key => key).slice(0, 1000);
    const deletedAdvanceRecordKeys = { ...remote.deletedAdvanceRecordKeys, ...local.deletedAdvanceRecordKeys };
    const entries = mergeDuplicateEntries([...remote.entries, ...local.entries]).filter(entry => !isEntryDeleted(entry, deletedLedgerEntryKeys));
    const advanceRecords = mergeDuplicateAdvances([...remote.advanceRecords, ...local.advanceRecords]).filter(record => !isAdvanceDeleted(record, deletedAdvanceRecordKeys));
    return {
      entries,
      advanceRecords,
      itemCatalog: uniqStrings([...local.itemCatalog, ...remote.itemCatalog], DEFAULT_ITEMS),
      stockItems: mergeStock(remote.stockItems, local.stockItems),
      itemRates: { ...remote.itemRates, ...local.itemRates },
      accountOptions: uniqStrings([...local.accountOptions, ...remote.accountOptions], DEFAULT_ACCOUNTS),
      businessProfile: { ...remote.businessProfile, ...local.businessProfile },
      adminControls: (local.adminControls.updatedAt || 0) >= (remote.adminControls.updatedAt || 0) ? local.adminControls : remote.adminControls,
      userActivity: uniqueBy([...remote.userActivity, ...local.userActivity], item => item.email || JSON.stringify(item)),
      deletedLedgerEntryKeys,
      deletedAdvanceRecordKeys
    };
  }

  function mergeStock(remote, local) {
    const map = new Map();
    [...remote, ...local].forEach(item => {
      const key = item.name.toLowerCase();
      const existing = map.get(key);
      if (!existing || item.updatedAt >= existing.updatedAt) map.set(key, item);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async function boot() {
    const [savedData, savedSession, savedDriveConfig] = await Promise.all([
      readStore(DATA_KEY),
      readStore(SESSION_KEY),
      readStore(DRIVE_CONFIG_KEY)
    ]);
    data = normalizeData(savedData);
    session = savedSession || {};
    driveConfig = normalizeDriveConfig(savedDriveConfig);
    persistDriveConfig();
    sync.status = navigator.onLine ? "Ready" : "Offline ready";
    render();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
    window.addEventListener("online", () => {
      sync.status = "Back online";
      queueSync("online");
      scheduleRender();
    });
    window.addEventListener("offline", () => {
      sync.status = "Offline ready";
      scheduleRender();
    });
    if (session.email && navigator.onLine) {
      setTimeout(() => void syncNow({ manual: false, reason: "startup" }), 700);
    }
    setInterval(() => {
      if (!session.email || !navigator.onLine || sync.busy) return;
      if (sync.dirty) {
        queueSync("dirty-interval");
      } else if (Date.now() - sync.lastRemoteCheckAt > 15000) {
        void syncNow({ manual: false, reason: "remote-check" });
      }
    }, 3000);
  }

  boot().catch(error => {
    app.innerHTML = `<main class="login-screen"><section class="card login-card"><h1>IndianSteel</h1><p>${esc(error.message || "Unable to start app.")}</p></section></main>`;
  });
})();

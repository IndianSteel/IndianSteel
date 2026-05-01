(function () {
  "use strict";

  const app = document.getElementById("app");
  const INR = "\u20B9";
  const DB_NAME = "indiansteel-pwa-db";
  const DB_STORE = "kv";
  const DATA_KEY = "daily-sales-data-v1";
  const SESSION_KEY = "daily-sales-session-v1";
  const DRIVE_CONFIG_KEY = "daily-sales-drive-config-v1";
  const APP_BUILD_VERSION = "20260501-profile-logo-23";
  const DRIVE_FILE_NAME = "indiansteel_daily_sales_sync.json";
  const GOOGLE_DRIVE_CLIENT_ID = "18090278328-i9k2i3e78062hbfhpu7pkhe1s7uvuhql.apps.googleusercontent.com";
  const GOOGLE_DRIVE_FOLDER_ID = "1uqSmcaXlqAzGZ1QR0JctoORJsLNQrmy3";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive openid email profile";
  const BUILT_IN_ADMINS = new Set(["indianssteel@gmail.com", "onlineuse0123@gmail.com"]);
  const RECEIPT_PAGE_WIDTH = 595;
  const RECEIPT_PAGE_HEIGHT = 842;
  const RECEIPT_LOGO_SRC = "./icons/receipt-logo.png";
  const RECEIPT_STAMP_SRC = "./icons/receipt-stamp-signature.png";
  const BUSINESS_LOGO_SRC = `./icons/indian-steel-logo.png?v=${APP_BUILD_VERSION}`;
  const DEFAULT_BUSINESS_NAME = "Indian Steel";
  const INDIAN_STEEL_OWNER_MOBILE = "8898644245";
  const INDIAN_STEEL_OWNER_NAME = "Saheb Alam";
  const INDIAN_STEEL_RECEIPT_EMAIL = "indianssteel@gmail.com";
  const INDIAN_STEEL_BUSINESS_EMAIL = "indiansteel@gmail.com";
  const INDIAN_STEEL_MAPS_URL = "https://www.google.com/maps/place/Indian+Steel/@19.1376069,73.0507051,17z/data=!3m1!4b1!4m6!3m5!1s0x3be7c1ef7e5ce01d:0x8c89fa91b0bb5596!8m2!3d19.1376069!4d73.0507051!16s%2Fg%2F11s65w7sc8?entry=ttu";
  const INDIAN_STEEL_RECEIPT_ADDRESS = "Shop No. 2, Goverdhan Hotel, Near Perfect Granite, Mumbra Panvel Road, Uttarshiv, Thane, Maharashtra - 400612.";
  const ACCESS_ROLES = ["Admin", "Staff", "Viewer"];
  const ACCESS_PAGES = [
    { key: "History", label: "History", screen: "history" },
    { key: "Settlements", label: "Settlements", screen: "settlements" },
    { key: "Reports", label: "Reports", screen: "reports" },
    { key: "Stock", label: "Stock", screen: "stock" },
    { key: "BusinessProfile", label: "Business Profile", screen: "business-profile" },
    { key: "BackupRestore", label: "Backup & Restore", screen: "backup-restore" },
    { key: "DataBackup", label: "Data Backup", screen: "data-backup" },
    { key: "Settings", label: "Settings", screen: "settings" }
  ];
  const ACCESS_PAGE_BY_SCREEN = ACCESS_PAGES.reduce((map, page) => ({ ...map, [page.screen]: page.key }), {});
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
  let receiptAssetsPromise = null;
  let entryDropdownPointer = null;
  let entryDropdownDismissalInstalled = false;
  const ENTRY_DROPDOWN_TAP_SLOP = 8;

  const ui = {
    screen: "dashboard",
    settlementTab: "advance",
    reportRange: "Daily",
    recentOpen: "",
    historyOpen: "",
    historySearch: "",
    historyFrom: "",
    historyTo: "",
    historyDatePicker: "",
    historyCalendarMonth: "",
    addOpen: false,
    addStep: "Customer",
    addDraft: null,
    advanceOpen: false,
    advanceDraft: null,
    dueInvoice: "",
    dueDraft: null,
    profileDraft: null,
    profileStatus: "",
    profileStatusError: false,
    backupStatus: "",
    backupStatusError: false,
    adminDraft: null,
    adminMessage: "",
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
    business: '<path fill="currentColor" stroke="none" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>',
    cloud: '<path fill="currentColor" stroke="none" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h.71C7.37 7.69 9.48 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3s-1.34 3-3 3z"/>',
    settings: '<path fill="currentColor" stroke="none" d="M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.37-.31-.6-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.47 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.5.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.08-.48 0-.6.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.08.65-.08.98s.03.66.08.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.37.31.6.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.08.48 0 .6-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z"/>',
    info: '<path fill="currentColor" stroke="none" d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-10h2V7h-2v3z"/>',
    logout: '<path fill="currentColor" stroke="none" d="M10.09 15.59 11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.1 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>',
    "arrow-left": '<path fill="currentColor" stroke="none" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2z"/>',
    undo: '<path fill="currentColor" stroke="none" d="M12.5 8c-2.65 0-5.03 1.06-6.77 2.77L3 8v7h7l-2.85-2.85C8.51 10.82 10.39 10 12.5 10c3.54 0 6.55 2.31 7.6 5.5l1.9-.63C20.68 10.86 16.91 8 12.5 8z"/>',
    light: '<path fill="currentColor" stroke="none" d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2v2zm18 0h2v-2h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2h-2zm0 18v2h2v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58 4.58 5.99 6 7.4c.39.39 1.03.39 1.42 0 .39-.39.39-1.03 0-1.42L5.99 4.58zm12.02 0-1.41 1.41c-.39.39-.39 1.03 0 1.42.39.39 1.03.39 1.42 0l1.41-1.41-1.42-1.42zM4.58 18.01l1.41 1.41 1.42-1.42c.39-.39.39-1.03 0-1.42-.39-.39-1.03-.39-1.42 0l-1.41 1.43zm12.02-.01 1.41 1.41 1.41-1.41-1.41-1.41c-.39-.39-1.03-.39-1.42 0-.38.38-.38 1.02.01 1.41z"/>',
    dark: '<path fill="currentColor" stroke="none" d="M9.37 5.51C9.19 6.15 9.1 6.82 9.1 7.5c0 4.14 3.36 7.5 7.5 7.5.68 0 1.35-.09 1.99-.27C17.53 17.29 15 19 12.1 19c-3.86 0-7-3.14-7-7 0-2.9 1.71-5.43 4.27-6.49zM12.1 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c4.15 0 7.64-2.81 8.68-6.64.14-.51-.33-.98-.84-.84-.72.2-1.47.3-2.24.3-3.03 0-5.5-2.47-5.5-5.5 0-.77.1-1.52.3-2.24.14-.51-.33-.98-.84-.84C7.83 4.36 5.02 7.85 5.02 12c0 .69.08 1.36.23 2C4.83 13.09 4.6 12.07 4.6 11c0-4.42 3.58-8 8-8-.17 0-.33 0-.5 0z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chart: '<path d="M4 19V5"/><path d="M8 19v-7"/><path d="M12 19V8"/><path d="M16 19v-4"/><path d="M20 19H3"/>',
    stock: '<path d="M4 7h16v13H4z"/><path d="M8 7V4h8v3"/><path d="M8 12h8"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    delete: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="m13 6 5 5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    "chevron-left": '<path d="m15 18-6-6 6-6"/>',
    "chevron-right": '<path fill="currentColor" stroke="none" d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>',
    user: '<path fill="currentColor" stroke="none" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>',
    history: '<path fill="currentColor" stroke="none" d="M13 3a9 9 0 0 0-9 9H1l4 4 4-4H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3Zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12Z"/>',
    sync: '<path d="M20 7h-6a6 6 0 0 0-10 3"/><path d="m20 7-3-3"/><path d="M4 17h6a6 6 0 0 0 10-3"/><path d="m4 17 3 3"/>',
    print: '<path d="M7 8V4h10v4"/><path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v6H7z"/>',
    wallet: '<path d="M4 7h16v12H4z"/><path d="M16 12h4v4h-4z"/><path d="M4 7l3-3h10l3 3"/>',
    whatsapp: ""
  };

  const profileIcons = {
    business: '<path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zM6 15H4v-2h2v2zM6 11H4V9h2v2zM6 7H4V5h2v2zM10 19H8v-2h2v2zM10 15H8v-2h2v2zM10 11H8V9h2v2zM10 7H8V5h2v2zM20 19h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zM18 11h-2v2h2v-2zM18 15h-2v2h2v-2z"/>',
    cloud: '<path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h.71C7.37 7.69 9.48 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3s-1.34 3-3 3z"/>',
    settings: '<path d="M19.43 12.98c.04-.32.07-.64.07-.98 0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.09-.16-.26-.25-.44-.25-.06 0-.12.01-.17.03l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.06-.02-.12-.03-.18-.03-.17 0-.34.09-.43.25l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98 0 .33.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.09.16.26.25.44.25.06 0 .12-.01.17-.03l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.06.02.12.03.18.03.17 0 .34-.09.43-.25l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM17.45 11.27c.04.31.05.52.05.73 0 .21-.02.43-.05.73l-.14 1.13.89.7 1.08.84-.7 1.21-1.27-.51-1.04-.42-.9.68c-.43.32-.84.56-1.25.73l-1.06.43-.16 1.13-.2 1.35h-1.4l-.19-1.35-.16-1.13-1.06-.43c-.43-.18-.83-.41-1.23-.71l-.91-.7-1.06.43-1.27.51-.7-1.21 1.08-.84.89-.7-.14-1.13c-.03-.31-.05-.54-.05-.74s.02-.43.05-.73l.14-1.13-.89-.7-1.08-.84.7-1.21 1.27.51 1.04.42.9-.68c.43-.32.84-.56 1.25-.73l1.06-.43.16-1.13.2-1.35h1.39l.19 1.35.16 1.13 1.06.43c.43.18.83.41 1.23.71l.91.7 1.06-.43 1.27-.51.7 1.21-1.07.85-.89.7.14 1.13zM12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zM12 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>',
    user: '<path d="M12 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m0 10c2.7 0 5.8 1.29 6 2H6c.23-.72 3.31-2 6-2m0-12C9.79 4 8 5.79 8 8s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zM12 14c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>',
    info: '<path d="M11 7h2v2h-2zM11 11h2v6h-2zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>',
    chevron: '<path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>'
  };

  function svg(name) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ""}</svg>`;
  }

  function profileSvg(name) {
    return `<svg class="profile-svg profile-svg-${name}" viewBox="0 0 24 24" aria-hidden="true">${profileIcons[name] || ""}</svg>`;
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
        name: DEFAULT_BUSINESS_NAME,
        mobile: "",
        email: "",
        logoUri: ""
      },
      adminControls: { users: [], nonAdminVisibility: defaultVisibilitySettings(), updatedAt: 0 },
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

  function defaultVisibilitySettings() {
    return {
      dashboardSummaryCardsVisible: true,
      dashboardSalesOverviewVisible: true,
      historyDailySalesTotalVisible: true,
      historyPrintButtonVisible: true,
      advanceTotalVisible: true,
      dueAmountTotalVisible: true
    };
  }

  function normalizeVisibilitySettings(raw, fallback = defaultVisibilitySettings()) {
    const source = raw && typeof raw === "object" ? raw : {};
    const value = key => Object.prototype.hasOwnProperty.call(source, key) ? source[key] !== false : fallback[key] !== false;
    return {
      dashboardSummaryCardsVisible: value("dashboardSummaryCardsVisible"),
      dashboardSalesOverviewVisible: value("dashboardSalesOverviewVisible"),
      historyDailySalesTotalVisible: value("historyDailySalesTotalVisible"),
      historyPrintButtonVisible: value("historyPrintButtonVisible"),
      advanceTotalVisible: value("advanceTotalVisible"),
      dueAmountTotalVisible: value("dueAmountTotalVisible")
    };
  }

  function normalizeRole(value) {
    const text = String(value || "").trim().toLowerCase();
    return ACCESS_ROLES.find(role => role.toLowerCase() === text) || "Viewer";
  }

  function normalizeAccessPage(value) {
    const text = String(value || "").replace(/[^a-z]/gi, "").toLowerCase();
    const page = ACCESS_PAGES.find(item =>
      item.key.toLowerCase() === text || item.label.replace(/[^a-z]/gi, "").toLowerCase() === text
    );
    return page ? page.key : "";
  }

  function normalizeAccessPages(values) {
    const list = Array.isArray(values) ? values : [];
    return uniqueBy(list.map(normalizeAccessPage).filter(Boolean), key => key);
  }

  function normalizeAdminControls(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const nonAdminVisibility = normalizeVisibilitySettings(source.nonAdminVisibility, defaultVisibilitySettings());
    return {
      users: Array.isArray(source.users) ? source.users.map(rule => {
        const role = normalizeRole(rule && rule.role);
        const isAdmin = role === "Admin";
        const canWrite = isAdmin || (role === "Staff" && rule && rule.canWrite === true);
        const defaultDelete = isAdmin || (role === "Staff" && canWrite);
        return {
          email: String(rule && rule.email || "").trim().toLowerCase(),
          role,
          canWrite,
          canDeleteRecentEntries: isAdmin || (role === "Staff" && (Object.prototype.hasOwnProperty.call(rule || {}, "canDeleteRecentEntries") ? rule.canDeleteRecentEntries === true : defaultDelete)),
          canDeleteAdvanceEntries: isAdmin || (role === "Staff" && (Object.prototype.hasOwnProperty.call(rule || {}, "canDeleteAdvanceEntries") ? rule.canDeleteAdvanceEntries === true : defaultDelete)),
          canDeleteDueEntries: isAdmin || (role === "Staff" && (Object.prototype.hasOwnProperty.call(rule || {}, "canDeleteDueEntries") ? rule.canDeleteDueEntries === true : defaultDelete)),
          pages: normalizeAccessPages(rule && rule.pages),
          visibility: isAdmin ? defaultVisibilitySettings() : normalizeVisibilitySettings(rule && rule.visibility, nonAdminVisibility)
        };
      }).filter(rule => rule.email) : [],
      nonAdminVisibility,
      updatedAt: Number(source.updatedAt || 0)
    };
  }

  function normalizeBusinessProfile(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      name: String(source.name || "").trim() || DEFAULT_BUSINESS_NAME,
      mobile: onlyDigits(source.mobile || source.phone || ""),
      email: String(source.email || "").trim(),
      logoUri: normalizeBusinessLogoUri(source.logoUri || source.logo || "")
    };
  }

  function normalizeBusinessLogoUri(value) {
    const logo = String(value || "").trim();
    return isDefaultBusinessLogoUri(logo) ? "" : logo;
  }

  function isDefaultBusinessLogoUri(value) {
    const logo = String(value || "").trim().replace(/^\.?\//, "").toLowerCase();
    return !logo || logo === "icons/indian-steel-logo.png";
  }

  function isDefaultBusinessName(value) {
    return !String(value || "").trim() || String(value || "").trim().toLowerCase() === DEFAULT_BUSINESS_NAME.toLowerCase();
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
      businessProfile: normalizeBusinessProfile({ ...base.businessProfile, ...(source.businessProfile || {}) }),
      adminControls: normalizeAdminControls(source.adminControls),
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
    return entry.kind === "Payment" && (
      String(entry.sourceSaleNumber || "").trim().length > 0 ||
      String(entry.subtitle || "").toLowerCase().startsWith("due payment")
    );
  }

  function canShareSalesReceipt(entry) {
    return entry && entry.kind === "Sale";
  }

  function hasEntryDetailDropdown(entry) {
    return !!entry && (entry.kind === "Sale" || isDuePaymentReceipt(entry));
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

  function hasOpenEntryDropdown() {
    return Boolean(ui.recentOpen || ui.historyOpen);
  }

  function isEntryDropdownTapSurface(target) {
    if (!target || !target.closest) return false;
    if (target.closest("[data-entry-dropdown]")) return true;
    const trigger = target.closest("[data-toggle-entry]");
    if (!trigger) return false;
    return !target.closest("button,a,input,select,textarea,label");
  }

  function closeEntryDropdowns() {
    if (!hasOpenEntryDropdown()) return;
    ui.recentOpen = "";
    ui.historyOpen = "";
    scheduleRender();
  }

  function setupEntryDropdownDismissal() {
    if (entryDropdownDismissalInstalled) return;
    entryDropdownDismissalInstalled = true;
    document.addEventListener("pointerdown", event => {
      entryDropdownPointer = {
        x: event.clientX,
        y: event.clientY,
        moved: false
      };
    }, true);
    document.addEventListener("pointermove", event => {
      if (!entryDropdownPointer) return;
      const movedX = Math.abs(event.clientX - entryDropdownPointer.x);
      const movedY = Math.abs(event.clientY - entryDropdownPointer.y);
      if (movedX > ENTRY_DROPDOWN_TAP_SLOP || movedY > ENTRY_DROPDOWN_TAP_SLOP) {
        entryDropdownPointer.moved = true;
      }
    }, true);
    document.addEventListener("pointercancel", () => {
      entryDropdownPointer = null;
    }, true);
    document.addEventListener("pointerup", event => {
      const pointer = entryDropdownPointer;
      entryDropdownPointer = null;
      if (!pointer || pointer.moved || !hasOpenEntryDropdown()) return;
      if (isEntryDropdownTapSurface(event.target)) return;
      closeEntryDropdowns();
    }, true);
  }

  function hasLocalBusinessData() {
    return Boolean(data.entries.length || data.advanceRecords.length || data.stockItems.length);
  }

  function canOpenApp() {
    return Boolean(session.email || session.localOnly || hasLocalBusinessData());
  }

  function normalizedSessionEmail() {
    return String(session.email || "").toLowerCase();
  }

  function isCurrentAdmin() {
    return currentUserAccess().isAdmin;
  }

  function currentAccessRule() {
    const email = normalizedSessionEmail();
    const rules = Array.isArray(data && data.adminControls && data.adminControls.users) ? data.adminControls.users : [];
    return rules.find(rule => String(rule.email || "").toLowerCase() === email) || null;
  }

  function currentUserAccess() {
    const email = normalizedSessionEmail();
    const localAdmin = !email && session.localOnly;
    if (localAdmin || BUILT_IN_ADMINS.has(email)) {
      return {
        email,
        role: "Admin",
        isAdmin: true,
        canWrite: true,
        canDeleteRecentEntries: true,
        canDeleteAdvanceEntries: true,
        canDeleteDueEntries: true,
        pages: ACCESS_PAGES.map(page => page.key),
        visibility: defaultVisibilitySettings()
      };
    }
    const rule = currentAccessRule();
    const role = normalizeRole(rule && rule.role);
    const isAdmin = role === "Admin";
    const canWrite = isAdmin || (role === "Staff" && rule && rule.canWrite === true);
    const pages = normalizeAccessPages(rule && rule.pages);
    if (isAdmin) ACCESS_PAGES.forEach(page => pages.includes(page.key) || pages.push(page.key));
    if (canWrite && !pages.includes("DataBackup")) pages.push("DataBackup");
    const fallback = normalizeVisibilitySettings(data && data.adminControls && data.adminControls.nonAdminVisibility, defaultVisibilitySettings());
    return {
      email,
      role,
      isAdmin,
      canWrite,
      canDeleteRecentEntries: isAdmin || (role === "Staff" && rule && rule.canDeleteRecentEntries === true),
      canDeleteAdvanceEntries: isAdmin || (role === "Staff" && rule && rule.canDeleteAdvanceEntries === true),
      canDeleteDueEntries: isAdmin || (role === "Staff" && rule && rule.canDeleteDueEntries === true),
      pages,
      visibility: isAdmin ? defaultVisibilitySettings() : normalizeVisibilitySettings(rule && rule.visibility, fallback)
    };
  }

  function canOpenScreen(screen) {
    const access = currentUserAccess();
    if (access.isAdmin) return true;
    if (["dashboard", "profile", "about-us"].includes(screen)) return true;
    if (screen === "add") return access.canWrite;
    if (screen === "admin-control") return false;
    if (screen === "data-backup") return access.canWrite || access.pages.includes("DataBackup");
    const pageKey = ACCESS_PAGE_BY_SCREEN[screen];
    return Boolean(pageKey && access.pages.includes(pageKey));
  }

  function canWriteData() {
    return currentUserAccess().canWrite;
  }

  function effectiveVisibility() {
    return currentUserAccess().visibility;
  }

  function setThemeMode(mode) {
    session.themeMode = mode === "dark" ? "dark" : "light";
    applyThemeMode();
    persistSession();
  }

  function appThemeMode() {
    return session.themeMode === "dark" ? "dark" : "light";
  }

  function applyThemeMode() {
    document.documentElement.dataset.theme = appThemeMode();
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
    applyThemeMode();
    if (!canOpenApp()) {
      app.innerHTML = loginScreen();
      bind();
      return;
    }
    if (!canOpenScreen(ui.screen)) {
      ui.screen = "dashboard";
    }
    const page = ui.screen === "dashboard" ? dashboardScreen()
      : ui.screen === "settlements" ? settlementsScreen()
      : ui.screen === "reports" ? reportsScreen()
      : ui.screen === "stock" ? stockScreen()
      : ui.screen === "profile" ? profileScreen()
      : ui.screen === "business-profile" ? businessProfileScreen()
      : ui.screen === "backup-restore" ? backupRestoreScreen()
      : ui.screen === "data-backup" ? dataBackupScreen()
      : ui.screen === "settings" ? settingsScreen()
      : ui.screen === "admin-control" ? adminControlScreen()
      : ui.screen === "about-us" ? aboutUsScreen()
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
    const visibility = effectiveVisibility();
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
        ${visibility.dashboardSummaryCardsVisible ? `<section class="grid-3 dashboard-stats">
          ${statCard("Monthly Sales", money(t.monthlySales), "wallet", "green", 'data-screen="reports" data-report="Monthly"')}
          ${statCard("Advances", money(t.advanceTotal), "card", "blue", 'data-settlement-open="advance"')}
          ${statCard("Due Payments", money(t.dueTotal), "card", "red", 'data-settlement-open="due"')}
        </section>` : ""}
        ${visibility.dashboardSalesOverviewVisible ? `<section class="card section dashboard-section">
          <div class="section-title"><h2>Sales Overview (Last 7 Days)</h2><button class="link-button" data-screen="reports">View All</button></div>
          ${dashboardChart(weekly)}
        </section>` : ""}
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
    const width = 312;
    const height = 116;
    const axisStep = salesChartStep(items.map(item => Number(item.value || 0)));
    const chartMax = axisStep * 3;
    const axisValues = [chartMax, axisStep * 2, axisStep, 0];
    const points = items.map((item, index) => {
      const x = items.length <= 1 ? 0 : (width / (items.length - 1)) * index;
      const y = height - (Number(item.value || 0) / Math.max(1, chartMax)) * height;
      return { ...item, x, y };
    });
    const path = curvedSvgPath(points);
    const area = `M${points[0].x.toFixed(1)} ${height} L${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} ${curvedSvgSegments(points)} L${points[points.length - 1].x.toFixed(1)} ${height} Z`;
    return `
      <div class="dashboard-chart">
        <div class="chart-axis">${axisValues.map(value => `<span>${esc(compactChartAxisValue(value))}</span>`).join("")}</div>
        <div class="chart-main">
        <svg viewBox="0 0 ${width} ${height}" aria-label="Sales overview chart" role="img">
          ${axisValues.map((value, index) => {
            const y = (height / 3) * index;
            return `<line class="chart-grid" x1="0" y1="${y.toFixed(1)}" x2="${width}" y2="${y.toFixed(1)}"></line>`;
          }).join("")}
          <path class="chart-area" d="${area}"></path>
          <path class="chart-line" d="${path}"></path>
          ${points.map(point => `<circle class="chart-dot-halo" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.5"></circle><circle class="chart-dot" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="2"></circle>`).join("")}
        </svg>
        <div class="chart-labels">${points.map(point => `<span>${esc(point.shortLabel)}</span>`).join("")}</div>
        </div>
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
    const hasDropdown = hasEntryDetailDropdown(entry);
    const open = hasDropdown && ui.recentOpen === key;
    const dateCaption = entry.timeLabel ? `${esc(entry.dateLabel)},<br>${esc(entry.timeLabel)}` : esc(entry.dateLabel);
    const showDelete = currentUserAccess().canDeleteRecentEntries;
    return `
      <div class="dashboard-entry-row ${showDelete ? "has-delete" : "no-delete"} ${hasDropdown ? "is-expandable" : ""} ${open ? "is-open" : ""}" ${hasDropdown ? `data-toggle-entry="${esc(key)}" data-source="recent"` : ""}>
        <span class="tile blue">${svg(entry.kind === "Payment" ? "card" : "chart")}</span>
        <span class="row-main">
          <b>${esc(entry.customer || "Walk-in Customer")}</b>
          <span>${esc(entry.subtitle || entry.kind || entry.invoiceNo)}</span>
        </span>
        <span class="dashboard-entry-meta">${amount}<small>${dateCaption}</small></span>
        ${showDelete ? `<button class="mini-action danger" data-delete-entry="${esc(entry.id)}" aria-label="Delete">${svg("delete")}</button>` : ""}
      </div>
      ${open ? entryDetail(entry, { source: "recent" }) : ""}`;
  }

  function entryRow(entry, source) {
    const due = saleDue(entry);
    const amount = entry.kind === "Sale"
      ? due > 0 ? `<span class="money">${esc(money(entry.amount))}</span> <span class="money red">- ${esc(money(due))}</span>` : `<span class="money">${esc(money(entry.amount))}</span>`
      : `<span class="money">${esc(money(entry.amount || entry.paidAmount))}</span>`;
    const key = entry.id;
    const hasDropdown = hasEntryDetailDropdown(entry);
    const open = hasDropdown && (source === "history" ? ui.historyOpen : ui.recentOpen) === key;
    const showRowDelete = source === "history" && currentUserAccess().canDeleteRecentEntries;
    const timeCaption = source === "history"
      ? entry.timeLabel || entry.invoiceNo || ""
      : `${entry.dateLabel || ""} ${entry.timeLabel || ""}`.trim();
    return `
      <div class="entry-row ${showRowDelete ? "has-delete" : ""} ${hasDropdown ? "is-expandable" : ""} ${open ? "is-open" : ""}" ${hasDropdown ? `data-toggle-entry="${esc(key)}" data-source="${esc(source)}"` : ""}>
        <span class="tile blue">${svg(entry.kind === "Payment" ? "card" : "chart")}</span>
        <span class="row-main">
          <b>${esc(entry.customer || "Walk-in Customer")}</b>
          <span>${esc(entry.itemName || entry.subtitle || entry.kind)}</span>
          <span>${esc(entry.subtitle || entry.invoiceNo)}</span>
        </span>
        <span class="row-right">${amount}<br>${esc(timeCaption)}</span>
        ${showRowDelete ? `<button class="mini-action danger" data-delete-entry="${esc(entry.id)}" aria-label="Delete">${svg("delete")}</button>` : ""}
      </div>
      ${open ? entryDetail(entry, { source }) : ""}`;
  }

  function entryDetail(entry, options = {}) {
    const summary = entryDetailSummary(entry);
    const saleItems = entry.saleItems.length ? entry.saleItems : [{ product: entry.itemName || "-", quantity: "", rate: "", amount: summary.purchasedAmount }];
    return `
      <div class="detail-box entry-detail" data-entry-dropdown>
        <div class="detail-top">
          <div class="detail-info">
            ${detailInline("Sale Number", summary.saleNumber)}
            ${detailInline("Mobile Number", entry.mobileNumber || "-")}
          </div>
          <div class="detail-actions">
            ${canShareSalesReceipt(entry) ? `<button class="mini-action whatsapp-action" data-share-entry="${esc(entry.id)}" aria-label="Share">${whatsappIcon()}</button>` : ""}
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
    const showTotal = effectiveVisibility().advanceTotalVisible !== false;
    const showAdd = canWriteData();
    const columns = showAdd && showTotal ? "minmax(0,1fr) 58px minmax(0,1fr)" : showAdd ? "minmax(0,1fr) 58px" : showTotal ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)";
    return `
      <div class="grid-3" style="grid-template-columns:${columns};align-items:center">
        <div class="card total-card"><small>Advance Entries</small><b>${data.advanceRecords.length}</b></div>
        ${showAdd ? `<button class="round-add" data-action="open-advance">${svg("plus")}</button>` : ""}
        ${showTotal ? `<div class="card total-card"><small>Advance Total</small><b class="orange">${esc(money(total))}</b></div>` : ""}
      </div>
      ${data.advanceRecords.length ? data.advanceRecords.map(record => `
        <article class="card settlement-row">
          <span class="tile blue">${svg("card")}</span>
          <span class="row-main"><b>${esc(record.customer)}</b><span>${esc(record.dateTime)}</span></span>
          <span class="row-right"><span class="money orange">${esc(money(Number(record.cashAmount || 0) + Number(record.onlineAmount || 0)))}</span><br>${esc(record.method)}</span>
          ${currentUserAccess().canDeleteAdvanceEntries ? `<button class="mini-action danger" data-delete-advance="${esc(record.id)}">${svg("delete")}</button>` : "<span></span>"}
        </article>`).join("") : '<section class="card section empty">No advance payments available yet.</section>'}`;
  }

  function dueTab() {
    const dueEntries = data.entries.filter(entry => entry.kind === "Sale" && (saleDue(entry) > 0 || entry.duePaymentHistory.length));
    const dueOpen = dueEntries.filter(entry => saleDue(entry) > 0);
    const total = dueOpen.reduce((sum, entry) => sum + saleDue(entry), 0);
    const showTotal = effectiveVisibility().dueAmountTotalVisible !== false;
    return `
      <div class="${showTotal ? "grid-2" : "grid-3"}" style="margin:10px 16px;${showTotal ? "" : "grid-template-columns:minmax(0,1fr)"}">
        <div class="card total-card"><small>Due Customers</small><b>${dueOpen.length}</b></div>
        ${showTotal ? `<div class="card total-card"><small>Due Amount</small><b class="red">${esc(money(total))}</b></div>` : ""}
      </div>
      ${dueEntries.length ? dueEntries.map(entry => `
        <article class="card settlement-row">
          <span class="tile red">${svg("card")}</span>
          <span class="row-main"><b>${esc(entry.customer)}</b><span>${esc(entry.dateLabel)}, ${esc(entry.timeLabel)}</span></span>
          <span class="row-right"><span class="money red">${esc(money(saleDue(entry)))}</span></span>
          ${saleDue(entry) > 0 && canWriteData() ? `<button class="mini-action" data-open-due="${esc(entry.invoiceNo)}">${svg("edit")}</button>` : '<span></span>'}
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
    const visibility = effectiveVisibility();
    const showPrintButton = visibility.historyPrintButtonVisible !== false;
    const showDailySalesTotal = visibility.historyDailySalesTotalVisible !== false;
    return `
      <main class="page">
        ${blueHeader("History")}
        <section class="history-tools">
          <input class="field" data-history-search placeholder="Search customer, item or price" value="${esc(ui.historySearch)}">
          <div class="date-row ${showPrintButton ? "with-print" : "without-print"}">
            ${historyDateBox("from", "From", "From date", ui.historyFrom, "", ui.historyTo || todayInputDate())}
            ${historyDateBox("to", "To", "To date", ui.historyTo, ui.historyFrom, todayInputDate())}
            ${showPrintButton ? `<button class="print-button" ${dateSelected ? "" : "disabled"} data-action="print-history">${svg("print")}</button>` : ""}
          </div>
        </section>
        ${Object.keys(grouped).length ? Object.entries(grouped).map(([date, rows]) => `
          <section class="card section history-date-card">
            <div class="section-title">
              <h2>${esc(historyTitleForDate(date))}</h2>
              ${showDailySalesTotal ? `<h3>Total sales Amount = ${esc(money(rows.reduce((sum, entry) => sum + dashboardSales(entry), 0)))}</h3>` : ""}
            </div>
            <div class="history-entry-list">
              ${rows.map(entry => `<div class="history-entry-card">${entryRow(entry, "history")}</div>`).join("")}
            </div>
          </section>`).join("") : '<section class="card section empty">No entries found.</section>'}
      </main>`;
  }

  function historyDateBox(kind, label, placeholder, value, min, max) {
    const text = value ? dateInputToLabel(value) : placeholder;
    return `
      <button class="history-date-box ${value ? "has-value" : ""}" type="button" data-history-date="${esc(kind)}" data-min-date="${esc(min)}" data-max-date="${esc(max)}">
        <span class="history-date-icon">${svg("calendar")}</span>
        <span class="history-date-copy">
          <small>${esc(label)}</small>
          <strong>${esc(text)}</strong>
        </span>
      </button>`;
  }

  function historyCalendarDialog() {
    const target = ui.historyDatePicker;
    if (target !== "from" && target !== "to") return "";
    const selected = target === "from" ? ui.historyFrom : ui.historyTo;
    const bounds = historyPickerBounds(target);
    const month = normalizeMonthInput(ui.historyCalendarMonth || selected || bounds.max || todayInputDate());
    const cells = calendarMonthCells(month);
    const previousMonth = shiftMonthInput(month, -1);
    const nextMonth = shiftMonthInput(month, 1);
    const previousEnabled = monthHasAllowedDate(previousMonth, bounds);
    const nextEnabled = monthHasAllowedDate(nextMonth, bounds);
    const title = inputDateObject(month).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    return `
      <div class="overlay calendar-overlay" data-overlay-close="history-calendar">
        <section class="calendar-dialog" data-sheet>
          <div class="calendar-dialog-title">
            <b>Select Date</b>
            <button class="calendar-close" type="button" data-action="close-history-calendar">X</button>
          </div>
          <div class="calendar-month-bar">
            <button class="calendar-nav" type="button" data-action="history-calendar-prev" ${previousEnabled ? "" : "disabled"}>${svg("chevron-left")}</button>
            <span>${esc(title)}</span>
            <button class="calendar-nav" type="button" data-action="history-calendar-next" ${nextEnabled ? "" : "disabled"}>${svg("chevron-right")}</button>
          </div>
          <div class="calendar-weekdays">
            ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => `<span>${day}</span>`).join("")}
          </div>
          <div class="calendar-grid">
            ${cells.map(cell => {
              const allowed = isDateAllowedForHistory(cell.input, bounds);
              const selectedClass = selected === cell.input ? " selected" : "";
              const outsideClass = cell.inMonth ? "" : " outside";
              return `<button class="calendar-day${selectedClass}${outsideClass}" type="button" data-calendar-day="${esc(cell.input)}" ${allowed ? "" : "disabled"}>${cell.day}</button>`;
            }).join("")}
          </div>
        </section>
      </div>`;
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

  function historyTitleForDate(label) {
    const rank = parseDateRank(label);
    if (!rank) return label || "-";
    return new Date(rank).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function todayInputDate() {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  }

  function inputDateObject(input) {
    return new Date(`${input || todayInputDate()}T12:00:00`);
  }

  function inputDateFromObject(date) {
    const copy = new Date(date.getTime());
    copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
    return copy.toISOString().slice(0, 10);
  }

  function normalizeMonthInput(input) {
    const date = inputDateObject(input);
    date.setDate(1);
    return inputDateFromObject(date);
  }

  function shiftMonthInput(input, delta) {
    const date = inputDateObject(normalizeMonthInput(input));
    date.setMonth(date.getMonth() + delta, 1);
    return inputDateFromObject(date);
  }

  function endOfMonthInput(input) {
    const date = inputDateObject(normalizeMonthInput(input));
    date.setMonth(date.getMonth() + 1, 0);
    return inputDateFromObject(date);
  }

  function calendarMonthCells(monthInput) {
    const monthStart = inputDateObject(normalizeMonthInput(monthInput));
    const currentMonth = monthStart.getMonth();
    const start = new Date(monthStart.getTime());
    start.setDate(monthStart.getDate() - monthStart.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getTime());
      date.setDate(start.getDate() + index);
      return {
        input: inputDateFromObject(date),
        day: date.getDate(),
        inMonth: date.getMonth() === currentMonth
      };
    });
  }

  function historyPickerBounds(target) {
    const today = todayInputDate();
    const min = target === "to" ? ui.historyFrom : "";
    let max = today;
    if (target === "from" && ui.historyTo && ui.historyTo < max) max = ui.historyTo;
    return { min, max };
  }

  function isDateAllowedForHistory(input, bounds) {
    if (bounds.min && input < bounds.min) return false;
    if (bounds.max && input > bounds.max) return false;
    return true;
  }

  function monthHasAllowedDate(monthInput, bounds) {
    const monthStart = normalizeMonthInput(monthInput);
    const monthEnd = endOfMonthInput(monthStart);
    if (bounds.min && monthEnd < bounds.min) return false;
    if (bounds.max && monthStart > bounds.max) return false;
    return true;
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
        <h1>${esc(title)}</h1>
      </header>`;
  }

  function bottomNav() {
    const baseItems = [
      ["dashboard", "home", "Dashboard"],
      ["settlements", "card", "Settlements"],
      ["add", "plus", ""],
      ["reports", "chart", "Reports"],
      ["stock", "stock", "Stock"]
    ];
    const items = baseItems.filter(([screen]) => screen === "add" ? canWriteData() : canOpenScreen(screen));
    return `<nav class="bottom-nav" style="grid-template-columns:repeat(${Math.max(1, items.length)},minmax(0,1fr))">
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
      ui.historyDatePicker ? historyCalendarDialog() : ""
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

  function profileLogoSrc(value) {
    const source = String(value || "").trim();
    if (isDefaultBusinessLogoUri(source)) return BUSINESS_LOGO_SRC;
    if (/^(data:image\/|https?:\/\/|\.?\/)/i.test(source)) return source;
    return BUSINESS_LOGO_SRC;
  }

  function businessLogo(className = "profile-logo-img", value = data.businessProfile.logoUri) {
    return `<img class="${className}" src="${esc(profileLogoSrc(value))}" alt="Indian Steel">`;
  }

  function profileScreen() {
    const profile = data.businessProfile || {};
    const access = currentUserAccess();
    const contact = profile.mobile || session.email || profile.email || "";
    const profileName = displayBusinessProfileName(profile);
    const rows = [];
    if (canOpenScreen("business-profile")) rows.push(["Business Profile", "business", "business-profile"]);
    if (canOpenScreen("backup-restore")) rows.push(["Backup & Restore", "cloud", "backup-restore"]);
    if (canOpenScreen("data-backup")) rows.push(["Data Backup", "cloud", "data-backup"]);
    if (canOpenScreen("settings")) rows.push(["Settings", "settings", "settings"]);
    if (access.isAdmin) rows.push(["Admin Control", "user", "admin-control"]);
    rows.push(["About Us", "info", "about-us"]);
    return `
      <main class="page profile-page">
        ${blueHeader("Profile")}
        <section class="profile-content">
          <section class="profile-card">
            <div class="profile-logo-circle">${businessLogo()}</div>
            <div class="profile-card-copy">
              <h2>${esc(profileName)}</h2>
              <p class="${access.isAdmin ? "profile-role admin" : "profile-role"}">${esc(access.role)}</p>
              <p>${esc(contact)}</p>
            </div>
          </section>
          <section class="profile-menu">
            ${rows.map(([title, iconName, screen], index) => `
              <button class="profile-menu-row" data-screen="${screen}">
                <span class="profile-menu-icon">${profileSvg(iconName)}</span>
                <span>${esc(title)}</span>
                <i>${profileSvg("chevron")}</i>
              </button>
              ${index < rows.length - 1 ? '<div class="profile-menu-divider"></div>' : ""}
            `).join("")}
          </section>
          <section class="profile-footer">
            ${session.email ? `<button class="profile-logout-button" data-action="logout">${svg("logout")}<span>Logout</span></button>` : ""}
            <p>Developed by Ceres Canopus Private Limited.</p>
          </section>
        </section>
      </main>`;
  }

  function displayBusinessProfileName(profile) {
    const savedName = String(profile && profile.name || "").trim();
    const sessionName = String(session.name || "").trim();
    if (isDefaultBusinessName(savedName) && sessionName && !sessionName.includes("@")) {
      return titleCaseName(sessionName);
    }
    return savedName || DEFAULT_BUSINESS_NAME;
  }

  function profileEditHeader(title, backScreen = "profile") {
    return `
      <header class="profile-edit-header">
        <button class="profile-back-button" data-screen="${backScreen}" aria-label="Back">${svg("arrow-left")}</button>
        <h1>${esc(title)}</h1>
      </header>`;
  }

  function ensureProfileDraft() {
    if (!ui.profileDraft) {
      ui.profileDraft = {
        name: data.businessProfile.name || DEFAULT_BUSINESS_NAME,
        mobile: onlyDigits(data.businessProfile.mobile || ""),
        email: session.email || data.businessProfile.email || "",
        logoUri: data.businessProfile.logoUri || ""
      };
    }
    return ui.profileDraft;
  }

  function businessProfileScreen() {
    const draft = ensureProfileDraft();
    const email = session.email || draft.email || data.businessProfile.email || "";
    return `
      <main class="page profile-edit-page">
        ${profileEditHeader("Business Profile")}
        <section class="profile-edit-content wide">
          <section class="profile-section-card business-profile-form">
            <button class="business-logo-picker" data-action="choose-profile-logo" aria-label="Select Profile Logo">
              ${businessLogo("business-logo-preview", draft.logoUri)}
            </button>
            <button class="profile-logo-label" data-action="choose-profile-logo">Select Profile Logo</button>
            <input class="hidden-file" type="file" accept="image/*" data-profile-logo-file>
            <label class="profile-field-label">Name</label>
            <input class="field profile-field" data-profile-field="name" value="${esc(draft.name)}">
            <label class="profile-field-label">Mobile Number</label>
            <input class="field profile-field" data-profile-field="mobile" inputmode="numeric" maxlength="10" value="${esc(draft.mobile)}">
            <label class="profile-field-label">Mail ID</label>
            <input class="field profile-field" value="${esc(email)}" readonly>
            <button class="profile-primary-button" data-action="save-business-profile">Save</button>
            ${ui.profileStatus ? `<p class="profile-status ${ui.profileStatusError ? "error" : "success"}">${esc(ui.profileStatus)}</p>` : ""}
          </section>
        </section>
      </main>`;
  }

  function settingsScreen() {
    const mode = appThemeMode();
    return `
      <main class="page profile-edit-page">
        ${profileEditHeader("Settings")}
        <section class="profile-edit-content">
          <section class="settings-card">
            <h2>Appearance</h2>
            <p>Choose how IndianSteel should look on this phone.</p>
            <div class="theme-buttons">
              ${settingsThemeButton("light", "Light", "Bright business theme", "light", mode === "light")}
              ${settingsThemeButton("dark", "Dark", "Low-light business theme", "dark", mode === "dark")}
            </div>
          </section>
          <section class="settings-card">
            <h2>Account & Security</h2>
            <p>Login access and company account status.</p>
            ${settingsInfoLine("Login required", "Enabled", "success")}
            ${settingsInfoLine("Signed in Gmail", session.email || "Not connected", session.email ? "" : "warning")}
            ${settingsInfoLine("Access control", "Google test users + shared Drive folder")}
          </section>
          <section class="settings-card">
            <h2>Backup & Data</h2>
            <p>Shortcuts for sync, backup, and restore.</p>
            ${settingsInfoLine("Auto sync", "Instant changes + background check", "blue")}
            ${settingsInfoLine("Last Drive status", sync.status, sync.status.toLowerCase().includes("failed") ? "error" : sync.status.toLowerCase().includes("sync") ? "blue" : "success")}
            ${canOpenScreen("data-backup") ? settingsActionRow("Data Backup", "Open Drive sync details", "cloud", "data-backup") : ""}
            ${canOpenScreen("backup-restore") ? settingsActionRow("Backup & Restore", "Create or restore local backup file", "undo", "backup-restore") : ""}
          </section>
          ${canOpenScreen("business-profile") ? `
            <section class="settings-card">
              <h2>Business Setup</h2>
              <p>Company name, number, email, and logo.</p>
              ${settingsActionRow("Business Profile", "Edit saved business profile", "business", "business-profile")}
            </section>` : ""}
          <section class="settings-card">
            <h2>App Info</h2>
            <p>Current app setup and storage mode.</p>
            ${settingsInfoLine("App name", "IndianSteel")}
            ${settingsInfoLine("Company", "Indian Steel")}
            ${settingsInfoLine("Storage", "Offline local data + Google Drive JSON")}
            ${settingsInfoLine("Drive file", DRIVE_FILE_NAME)}
          </section>
          <section class="settings-card">
            <h2>Theme Preview</h2>
            <div class="theme-preview">
              <span>${svg(mode === "dark" ? "dark" : "light")}</span>
              <div><b>${mode === "dark" ? "Dark" : "Light"} mode selected</b><small>Saved automatically on this phone.</small></div>
            </div>
          </section>
          <p class="profile-page-note">More settings will be added here as we complete the remaining app pages.</p>
        </section>
      </main>`;
  }

  function settingsThemeButton(mode, title, description, iconName, selected) {
    return `
      <button class="theme-button ${selected ? "active" : ""}" data-theme-mode="${mode}">
        ${svg(iconName)}
        <b>${esc(title)}</b>
        <span>${esc(description)}</span>
      </button>`;
  }

  function settingsInfoLine(label, value, tone = "") {
    return `<div class="settings-info-line"><span>${esc(label)}</span><b class="${tone}">${esc(value)}</b></div>`;
  }

  function settingsActionRow(title, description, iconName, screen) {
    return `
      <button class="settings-action-row" data-screen="${screen}">
        <span>${svg(iconName)}</span>
        <i><b>${esc(title)}</b><small>${esc(description)}</small></i>
        ${svg("chevron-right")}
      </button>`;
  }

  function backupRestoreScreen() {
    const canRestore = canWriteData();
    return `
      <main class="page profile-edit-page">
        ${profileEditHeader("Backup & Restore")}
        <section class="profile-edit-content">
          <section class="profile-section-card">
            <h2>Local Data Summary</h2>
            <div class="backup-chip-grid">
              ${backupSummaryChip("Entries", data.entries.length)}
              ${backupSummaryChip("Advances", data.advanceRecords.length)}
              ${backupSummaryChip("Items", data.itemCatalog.length)}
              ${backupSummaryChip("Accounts", data.accountOptions.length)}
            </div>
            <p class="settings-muted-copy">Backup includes sales, dues, advances, item rates, accounts, and business profile.</p>
          </section>
          ${backupActionCard("Create Backup", "Save a complete offline copy as a JSON file. Keep it in Drive, WhatsApp, or phone storage.", "Create Backup File", "cloud", "blue", "create-backup", true)}
          ${backupActionCard("Restore From File", canRestore ? "Choose a previous IndianSteel backup. This replaces current local data on this phone." : "Restore changes data and needs write access from admin.", canRestore ? "Choose Backup File" : "Write Access Required", "undo", "orange", "choose-restore", canRestore)}
          <input class="hidden-file" type="file" accept="application/json,text/plain,.json" data-restore-file>
          ${ui.backupStatus ? `<div class="profile-alert ${ui.backupStatusError ? "error" : "success"}">${esc(ui.backupStatus)}</div>` : ""}
        </section>
      </main>`;
  }

  function backupSummaryChip(label, value) {
    return `<div class="backup-summary-chip"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
  }

  function backupActionCard(title, description, buttonText, iconName, tone, action, enabled) {
    return `
      <section class="profile-section-card backup-action-card">
        <div class="backup-action-head">
          <span class="${tone}">${svg(iconName)}</span>
          <div><h2>${esc(title)}</h2><p>${esc(description)}</p></div>
        </div>
        <button class="profile-primary-button ${tone}" data-action="${action}" ${enabled ? "" : "disabled"}>${esc(buttonText)}</button>
      </section>`;
  }

  function dataBackupScreen() {
    const hasDriveLogin = Boolean(session.email);
    const canSync = canWriteData();
    const failed = sync.status.toLowerCase().includes("failed");
    const tone = !hasDriveLogin || !canSync ? "warning" : failed ? "error" : sync.busy ? "blue" : "success";
    const statusText = !hasDriveLogin
      ? "Login with Gmail first to use Drive backup."
      : !canSync
        ? "Read-only access. Drive sync needs write permission."
        : sync.busy
          ? "Syncing Drive..."
          : sync.status;
    return `
      <main class="page profile-edit-page">
        ${profileEditHeader("Data Backup")}
        <section class="profile-edit-content">
          <section class="profile-section-card">
            <div class="drive-card-head">
              <span>${svg("cloud")}</span>
              <div><h2>Google Drive Backup</h2><p>${esc(session.email || "No Gmail connected")}</p></div>
            </div>
            <div class="profile-alert ${tone}">${esc(statusText)}</div>
          </section>
          ${backupActionCard("Sync with Drive", canSync ? "Uploads this phone's latest data and downloads changes from the shared IndianSteel Drive file." : "Drive sync changes shared data and needs write access from admin.", sync.busy ? "Syncing Drive..." : canSync ? "Sync with Drive" : "Write Access Required", "cloud", "blue", "sync-now", hasDriveLogin && canSync && !sync.busy)}
          <section class="profile-section-card">
            <h2>What Gets Synced</h2>
            <div class="backup-chip-grid">
              ${backupSummaryChip("Entries", data.entries.length)}
              ${backupSummaryChip("Advances", data.advanceRecords.length)}
              ${backupSummaryChip("Items", data.itemCatalog.length)}
              ${backupSummaryChip("Accounts", data.accountOptions.length)}
            </div>
            ${dataBackupInfoRow("Saved changes sync immediately while Gmail is connected.")}
            ${dataBackupInfoRow("Background Drive checks are throttled so large pages stay smooth.")}
            ${dataBackupInfoRow("Manual sync is safe to press anytime after entries are saved.")}
            ${dataBackupInfoRow("Offline entries stay on this phone and sync when internet returns.")}
          </section>
          <section class="profile-section-card">
            <h2>Drive File</h2>
            ${dataBackupDetailLine("File", DRIVE_FILE_NAME)}
            ${dataBackupDetailLine("Folder", "IndianSteel shared Drive folder")}
            ${dataBackupDetailLine("Mode", "Merge sync, not blind replace")}
          </section>
        </section>
      </main>`;
  }

  function dataBackupInfoRow(text) {
    return `<div class="data-backup-info-row"><span></span><p>${esc(text)}</p></div>`;
  }

  function dataBackupDetailLine(label, value) {
    return `<div class="data-backup-detail-line"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  }

  function aboutUsScreen() {
    return `
      <main class="page profile-edit-page">
        ${profileEditHeader("About Us")}
        <section class="profile-edit-content">
          <section class="about-hero-card">
            <div class="about-logo-circle"><img src="./icons/indian-steel-logo.png" alt="Indian Steel"></div>
            <div>
              <h2>IndianSteel</h2>
              <p>Daily sales and business control app for Indian Steel.</p>
              <span>Version 1.0</span>
            </div>
          </section>
          <section class="settings-card">
            <h2>About IndianSteel</h2>
            <p>Built for daily sales, collection, and backup work.</p>
            <p class="settings-muted-copy">IndianSteel keeps Indian Steel's sales entries, advance payments, due collections, reports, stock view, and Drive backup in one compact phone-friendly workspace.</p>
            ${aboutFeatureRow("chart", "Sales records", "Recent entries, customer details, payment split, and due snapshots.")}
            ${aboutFeatureRow("card", "Payments", "Advance payment, due payment, cash, online, and account tracking.")}
            ${aboutFeatureRow("chart", "Reports and stock", "Daily, weekly, monthly reporting with stock page access when allowed.")}
            ${aboutFeatureRow("cloud", "Data backup", "Offline local storage with Google Drive sync for shared backup.")}
          </section>
          <section class="settings-card">
            <h2>Business</h2>
            <p>Indian Steel company owner and contact details.</p>
            ${settingsInfoLine("Owner", INDIAN_STEEL_OWNER_NAME)}
            ${settingsInfoLine("Mobile", INDIAN_STEEL_OWNER_MOBILE)}
            ${settingsInfoLine("Gmail", INDIAN_STEEL_BUSINESS_EMAIL)}
          </section>
          <section class="settings-card">
            <h2>Developer</h2>
            <p>Developed by Ceres Canopus Private Limited.</p>
            <p class="settings-muted-copy">Ceres Canopus Private Limited developed this custom IndianSteel app for business use, local record keeping, and managed Google Drive backup.</p>
            ${settingsInfoLine("Company", "Ceres Canopus Private Limited")}
            ${settingsInfoLine("Status", "Active private limited company")}
            ${settingsInfoLine("Incorporated", "08 Jul 2024")}
            ${settingsInfoLine("Location", "Thane, Maharashtra, India")}
            ${settingsInfoLine("CIN", "U85500MH2024PTC428441")}
          </section>
          <p class="profile-page-note">Developed by Ceres Canopus Private Limited.</p>
        </section>
      </main>`;
  }

  function aboutFeatureRow(iconName, title, description) {
    return `
      <div class="about-feature-row">
        <span>${svg(iconName)}</span>
        <div><b>${esc(title)}</b><small>${esc(description)}</small></div>
      </div>`;
  }

  function adminControlScreen() {
    const draft = ensureAdminDraft();
    const effective = effectiveAdminDraft(draft);
    const savedRules = (data.adminControls.users || []).slice().sort((a, b) => a.email.localeCompare(b.email));
    const activeUsers = (data.userActivity || []).slice().sort((a, b) => Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0));
    return `
      <main class="page profile-edit-page">
        ${profileEditHeader("Admin Control")}
        <section class="profile-edit-content admin-content">
          <section class="settings-card">
            <h2>Admin Account</h2>
            <p>Manage who can open pages and write data.</p>
            ${settingsInfoLine("Admin Gmail", Array.from(BUILT_IN_ADMINS).join(", "))}
            ${settingsInfoLine("Signed in", session.email || "Not connected", isCurrentAdmin() ? "success" : "warning")}
            ${settingsInfoLine("Active tracking", `${activeUsers.length} login${activeUsers.length === 1 ? "" : "s"} recorded`, "blue")}
          </section>
          <section class="profile-section-card admin-form">
            <h2>Add / Update User</h2>
            <p class="settings-muted-copy">Choose role, page access, delete rights, and visible totals.</p>
            <label class="profile-field-label">Gmail address</label>
            <input class="field profile-field" data-admin-field="email" placeholder="user@gmail.com" value="${esc(draft.email)}">
            <div class="admin-segment-row">
              ${ACCESS_ROLES.map(role => `<button class="admin-chip ${effective.role === role ? "active" : ""}" data-admin-role="${role}">${role}</button>`).join("")}
            </div>
            <button class="admin-write-row ${effective.canWrite ? "active" : ""}" data-action="toggle-admin-write" ${effective.role === "Staff" ? "" : "disabled"}>
              <span></span>
              <i><b>Write access</b><small>${effective.role === "Admin" ? "Always enabled for Admin role." : effective.role === "Staff" ? "Allows Add Entry, edits, restores, and Data Backup." : "Available only for Staff role."}</small></i>
            </button>
            <h3 class="admin-subtitle">Delete Permissions</h3>
            <div class="admin-three-grid">
              ${adminPermissionChip("Recent", effective.canDeleteRecentEntries, effective.role === "Staff", "recent")}
              ${adminPermissionChip("Advance", effective.canDeleteAdvanceEntries, effective.role === "Staff", "advance")}
              ${adminPermissionChip("Due", effective.canDeleteDueEntries, effective.role === "Staff", "due")}
            </div>
            <p class="settings-muted-copy compact">Admin gets all delete rights. Viewer cannot delete records.</p>
            <h3 class="admin-subtitle">Display Visibility</h3>
            ${adminVisibilityRow("Dashboard summary cards", "Monthly Sales, Advances, and Due Payments.", effective.visibility.dashboardSummaryCardsVisible, !effective.isAdmin, "dashboardSummaryCardsVisible")}
            ${adminVisibilityRow("Dashboard sales overview", "Sales Overview chart card on Dashboard.", effective.visibility.dashboardSalesOverviewVisible, !effective.isAdmin, "dashboardSalesOverviewVisible")}
            ${adminVisibilityRow("History daily total", "Total sales amount inside History date groups.", effective.visibility.historyDailySalesTotalVisible, !effective.isAdmin, "historyDailySalesTotalVisible")}
            ${adminVisibilityRow("History print button", "Print selected History date range as PDF.", effective.visibility.historyPrintButtonVisible, !effective.isAdmin, "historyPrintButtonVisible")}
            ${adminVisibilityRow("Advance total", "Advance Total card on Settlements.", effective.visibility.advanceTotalVisible, !effective.isAdmin, "advanceTotalVisible")}
            ${adminVisibilityRow("Due amount total", "Due Amount card on Settlements.", effective.visibility.dueAmountTotalVisible, !effective.isAdmin, "dueAmountTotalVisible")}
            <p class="settings-muted-copy compact">Admin accounts always see all dashboard cards and totals. Staff and viewers follow this user's settings.</p>
            <h3 class="admin-subtitle">Visible Pages</h3>
            <div class="admin-page-grid">
              ${ACCESS_PAGES.map(page => adminPageChip(page, effective)).join("")}
            </div>
            <p class="settings-muted-copy compact">Dashboard and Profile stay available. Data Backup is added automatically for write users.</p>
            <button class="profile-primary-button" data-action="save-admin-rule">${svg("user")}<span>Save User Access</span></button>
            ${ui.adminMessage ? `<p class="profile-status ${ui.adminMessage.toLowerCase().includes("saved") ? "success" : "warning"}">${esc(ui.adminMessage)}</p>` : ""}
          </section>
          <section class="profile-section-card">
            <h2>Active Logins</h2>
            <p class="settings-muted-copy">Tap a Gmail to load it into the access form.</p>
            ${activeUsers.length ? activeUsers.map((record, index) => adminActivityRow(record, index < activeUsers.length - 1)).join("") : adminEmptyText("No active login has synced yet.")}
          </section>
          <section class="profile-section-card">
            <h2>Saved User Rules</h2>
            <p class="settings-muted-copy">${esc(adminUpdatedText(data.adminControls.updatedAt))}</p>
            ${savedRules.length ? savedRules.map((rule, index) => adminRuleRow(rule, index < savedRules.length - 1)).join("") : adminEmptyText("No rules saved yet. Users without a rule can only open Dashboard and Profile.")}
          </section>
        </section>
      </main>`;
  }

  function ensureAdminDraft() {
    if (!ui.adminDraft) ui.adminDraft = blankAdminDraft();
    return ui.adminDraft;
  }

  function blankAdminDraft(email = "") {
    return {
      email: String(email || "").trim().toLowerCase(),
      role: "Viewer",
      canWrite: false,
      canDeleteRecentEntries: false,
      canDeleteAdvanceEntries: false,
      canDeleteDueEntries: false,
      pages: [],
      visibility: defaultVisibilitySettings()
    };
  }

  function effectiveAdminDraft(draft) {
    const role = normalizeRole(draft.role);
    const isAdmin = role === "Admin";
    const canWrite = isAdmin || (role === "Staff" && draft.canWrite === true);
    const pages = isAdmin ? ACCESS_PAGES.map(page => page.key) : normalizeAccessPages(draft.pages);
    if (canWrite && !pages.includes("DataBackup")) pages.push("DataBackup");
    return {
      ...draft,
      role,
      isAdmin,
      canWrite,
      canDeleteRecentEntries: isAdmin || (role === "Staff" && draft.canDeleteRecentEntries === true),
      canDeleteAdvanceEntries: isAdmin || (role === "Staff" && draft.canDeleteAdvanceEntries === true),
      canDeleteDueEntries: isAdmin || (role === "Staff" && draft.canDeleteDueEntries === true),
      pages,
      visibility: isAdmin ? defaultVisibilitySettings() : normalizeVisibilitySettings(draft.visibility, defaultVisibilitySettings())
    };
  }

  function adminPermissionChip(label, selected, enabled, key) {
    return `<button class="admin-chip ${selected ? "active" : ""}" data-admin-delete="${key}" ${enabled ? "" : "disabled"}>${esc(label)}</button>`;
  }

  function adminVisibilityRow(title, description, visible, enabled, key) {
    return `
      <button class="admin-visibility-row" data-admin-visibility="${key}" ${enabled ? "" : "disabled"}>
        <i><b>${esc(title)}</b><small>${esc(description)}</small></i>
        <span class="${visible ? "shown" : "hidden"}">${enabled ? visible ? "Shown" : "Hidden" : "Always"}</span>
      </button>`;
  }

  function adminPageChip(page, effective) {
    const forced = effective.isAdmin || (page.key === "DataBackup" && effective.canWrite);
    const selected = effective.pages.includes(page.key);
    return `<button class="admin-chip ${selected ? "active" : ""}" data-admin-page="${page.key}" ${forced ? "disabled" : ""}>${esc(page.label)}</button>`;
  }

  function adminEmptyText(text) {
    return `<div class="admin-empty">${esc(text)}</div>`;
  }

  function adminActivityRow(record, showDivider) {
    const status = adminActivityStatus(record.lastSeenAt);
    return `
      <button class="admin-activity-row" data-admin-select-email="${esc(record.email)}">
        <span>${svg("user")}</span>
        <i><b>${esc(record.email)}</b><small>Last seen ${esc(relativeActivityText(record.lastSeenAt))}</small></i>
        <em class="${status.tone}">${esc(status.text)}</em>
      </button>
      ${showDivider ? '<div class="profile-menu-divider"></div>' : ""}`;
  }

  function adminRuleRow(rule, showDivider) {
    const role = normalizeRole(rule.role);
    const pageLabels = role === "Admin"
      ? "All pages"
      : normalizeAccessPages(rule.pages).map(key => (ACCESS_PAGES.find(page => page.key === key) || {}).label).filter(Boolean).join(", ") || "Dashboard, Profile only";
    return `
      <div class="admin-rule-row">
        <div>
          <b>${esc(rule.email)}</b>
          <small class="${rule.canWrite ? "blue" : ""}">${esc(role)} - ${rule.canWrite ? "Write enabled" : "Read only"}</small>
          <small>Delete: ${esc(deletePermissionText(rule))}</small>
          <small>Summary: ${esc(visibilityPermissionText(rule.visibility))}</small>
          <small>${esc(pageLabels)}</small>
        </div>
        <span>
          <button data-admin-load="${esc(rule.email)}">Load</button>
          <button class="danger" data-admin-remove="${esc(rule.email)}">Remove</button>
        </span>
      </div>
      ${showDivider ? '<div class="profile-menu-divider"></div>' : ""}`;
  }

  function adminActivityStatus(lastSeenAt) {
    const age = Math.max(0, Date.now() - Number(lastSeenAt || 0));
    if (age <= 35000) return { text: "Active", tone: "success" };
    if (age <= 300000) return { text: "Recent", tone: "blue" };
    return { text: "Offline", tone: "" };
  }

  function relativeActivityText(lastSeenAt) {
    const time = Number(lastSeenAt || 0);
    if (!time) return "not available";
    const seconds = Math.floor(Math.max(0, Date.now() - time) / 1000);
    if (seconds < 10) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return new Date(time).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function adminUpdatedText(updatedAt) {
    const time = Number(updatedAt || 0);
    if (!time) return "No access rules saved yet.";
    return `Last updated ${new Date(time).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
  }

  function deletePermissionText(rule) {
    if (normalizeRole(rule.role) === "Admin") return "All";
    const labels = [];
    if (rule.canDeleteRecentEntries) labels.push("Recent");
    if (rule.canDeleteAdvanceEntries) labels.push("Advance");
    if (rule.canDeleteDueEntries) labels.push("Due");
    return labels.join(", ") || "None";
  }

  function visibilityPermissionText(visibility) {
    const value = normalizeVisibilitySettings(visibility, defaultVisibilitySettings());
    const hidden = [];
    if (!value.dashboardSummaryCardsVisible) hidden.push("Dashboard cards");
    if (!value.dashboardSalesOverviewVisible) hidden.push("Sales overview");
    if (!value.historyDailySalesTotalVisible) hidden.push("History total");
    if (!value.historyPrintButtonVisible) hidden.push("History print");
    if (!value.advanceTotalVisible) hidden.push("Advance total");
    if (!value.dueAmountTotalVisible) hidden.push("Due total");
    return hidden.length ? `Hidden: ${hidden.join(", ")}` : "All visible";
  }

  function printMarkup() {
    return "";
  }

  async function openHistoryPdf() {
    if (!(ui.historyFrom || ui.historyTo)) return;
    if (effectiveVisibility().historyPrintButtonVisible === false) return;
    const pdfWindow = window.open("", "_blank");
    if (pdfWindow) {
      pdfWindow.document.write("<!doctype html><title>History PDF</title><body style=\"font-family:Arial,sans-serif;padding:24px\">Creating History PDF...</body>");
      pdfWindow.document.close();
    }
    try {
      const file = await createHistoryPdfFile();
      openPdfBlob(file, pdfWindow);
    } catch (error) {
      if (pdfWindow && !pdfWindow.closed) pdfWindow.close();
      ui.error = "Unable to create history PDF.";
      scheduleRender();
    }
  }

  async function createHistoryPdfFile() {
    const blob = await createHistoryPdfBlob();
    const name = `${cleanFilePart(historyPdfTitle(ui.historyFrom, ui.historyTo)).replace(/^_+|_+$/g, "") || "History"}.pdf`;
    return new File([blob], name, { type: "application/pdf" });
  }

  async function createHistoryPdfBlob() {
    const scale = 2;
    const pageWidth = RECEIPT_PAGE_WIDTH;
    const pageHeight = RECEIPT_PAGE_HEIGHT;
    const margin = 24;
    const contentWidth = pageWidth - (margin * 2);
    const bottomLimit = pageHeight - 28;
    const groupedEntries = Object.entries(groupBy(filteredHistoryEntries(), entry => entry.dateLabel || "-"));
    const showDailySalesTotal = effectiveVisibility().historyDailySalesTotalVisible !== false;
    const canvases = [];
    let canvas = null;
    let ctx = null;
    let y = 92;

    const newPage = () => {
      canvas = document.createElement("canvas");
      canvas.width = pageWidth * scale;
      canvas.height = pageHeight * scale;
      ctx = canvas.getContext("2d", { alpha: false });
      ctx.scale(scale, scale);
      drawHistoryPageChrome(ctx, historyPdfRangeText(ui.historyFrom, ui.historyTo));
      canvases.push(canvas);
      y = 96;
    };
    const ensureSpace = height => {
      if (y + height > bottomLimit && y > 100) newPage();
    };

    newPage();
    if (!groupedEntries.length) {
      ensureSpace(74);
      drawHistoryRound(ctx, margin, y, pageWidth - margin, y + 58, 8, "#fff", "#e7ebf2");
      drawFit(ctx, "No entries found for the selected date range.", margin + 14, pageWidth - margin - 14, y + 33, 9.5, true);
    } else {
      groupedEntries.forEach(([dateLabel, dateEntries]) => {
        let index = 0;
        while (index < dateEntries.length) {
          const headerHeight = showDailySalesTotal ? 51 : 36;
          if (y + headerHeight + historyEntryHeight(dateEntries[index]) + 24 > bottomLimit) newPage();
          const availableHeight = bottomLimit - y;
          let chunkHeight = 17 + headerHeight + 14;
          let endIndex = index;
          while (endIndex < dateEntries.length) {
            const nextHeight = historyEntryHeight(dateEntries[endIndex]) + (endIndex === index ? 0 : 9);
            if (chunkHeight + nextHeight <= availableHeight || endIndex === index) {
              chunkHeight += nextHeight;
              endIndex += 1;
            } else {
              break;
            }
          }
          drawHistoryDateGroup(ctx, dateLabel, dateEntries, index, endIndex, y, chunkHeight, showDailySalesTotal, margin, contentWidth);
          y += chunkHeight + 10;
          index = endIndex;
          if (index < dateEntries.length) newPage();
        }
      });
    }

    const pages = canvases.map(item => ({
      imageBytes: dataUrlToBytes(item.toDataURL("image/jpeg", 0.94)),
      imageWidth: item.width,
      imageHeight: item.height
    }));
    return buildImagePagesPdf(pages);
  }

  function historyPdfTitle(fromDate, toDate) {
    const rangeText = historyPdfRangeText(fromDate, toDate);
    return rangeText ? `History - ${rangeText}` : "History";
  }

  function historyPdfRangeText(fromDate, toDate) {
    if (fromDate && toDate) return `${dateInputToLabel(fromDate)} to ${dateInputToLabel(toDate)}`;
    if (fromDate) return `From ${dateInputToLabel(fromDate)}`;
    if (toDate) return `Up to ${dateInputToLabel(toDate)}`;
    return "";
  }

  function drawHistoryPageChrome(ctx, rangeText) {
    ctx.fillStyle = "#f5f7fb";
    ctx.fillRect(0, 0, RECEIPT_PAGE_WIDTH, RECEIPT_PAGE_HEIGHT);
    ctx.fillStyle = "#0d5bdd";
    ctx.fillRect(0, 0, RECEIPT_PAGE_WIDTH, 62);
    drawFit(ctx, "History", 0, RECEIPT_PAGE_WIDTH, 39, 16, true, "center", "#fff");
    drawHistoryRound(ctx, 24, 72, RECEIPT_PAGE_WIDTH - 24, 88, 6, "#fff", "#e7ebf2");
    drawFit(ctx, rangeText || "History", 34, RECEIPT_PAGE_WIDTH - 34, 83, 8, false, "left", "#6b7280");
  }

  function drawHistoryDateGroup(ctx, dateLabel, entries, startIndex, endIndexExclusive, top, height, showDailySalesTotal, margin, contentWidth) {
    drawHistoryRound(ctx, margin, top, RECEIPT_PAGE_WIDTH - margin, top + height, 8, "#fff", "#e7ebf2");
    let currentY = top + 17;
    drawFit(ctx, historyTitleForDate(dateLabel), margin + 14, RECEIPT_PAGE_WIDTH - margin - 14, currentY, 13, true);
    currentY += 16;
    if (showDailySalesTotal) {
      drawFit(ctx, `Total sales Amount = ${money(entries.reduce((sum, entry) => sum + dashboardSales(entry), 0))}`, margin + 14, RECEIPT_PAGE_WIDTH - margin - 14, currentY, 9.5, true, "left", "#064bc0");
      currentY += 15;
    }
    currentY += 3;
    entries.slice(startIndex, endIndexExclusive).forEach(entry => {
      currentY += drawHistoryEntryCard(ctx, entry, margin + 14, currentY, contentWidth - 28) + 9;
    });
  }

  function historyEntryHeight(entry) {
    const itemHeight = historyItemSnapshots(entry).length * 44;
    const paymentRowsHeight = historyPaymentRows(entry).length * 20;
    const historyHeight = entryDetailSummary(entry).historyItems.length ? 17 + (entryDetailSummary(entry).historyItems.length * 38) : 0;
    return 54 + 8 + 34 + 20 + itemHeight + 18 + 82 + paymentRowsHeight + historyHeight + 30;
  }

  function historyItemSnapshots(entry) {
    if (entry.saleItems && entry.saleItems.length) return entry.saleItems;
    const fallbackAmount = entry.kind === "Sale"
      ? purchaseDisplayAmount(entry)
      : Number(entry.purchasedAmount || entry.dueSnapshotTotal || entry.amount || 0);
    return [{
      product: entry.itemName || entry.subtitle || "Sale Item",
      quantity: "",
      rate: "",
      amount: fallbackAmount
    }];
  }

  function historyPaymentRows(entry) {
    const summary = entryDetailSummary(entry);
    return [
      ...summary.adjustments,
      { label: "Total Amount", value: summary.totalAmount, bold: true },
      ...(summary.showPaidDue ? [
        { label: "Paid Amount", value: summary.paidAmount },
        { label: "Due Payment", value: summary.dueAmount }
      ] : [])
    ];
  }

  function drawHistoryEntryCard(ctx, entry, left, top, width) {
    const height = historyEntryHeight(entry);
    const summary = entryDetailSummary(entry);
    const innerLeft = left + 12;
    const innerWidth = width - 24;
    let currentY = top + 13;
    drawHistoryRound(ctx, left, top, left + width, top + height, 7, "#fff", "#e7ebf2");

    drawHistoryRound(ctx, innerLeft, currentY, innerLeft + 28, currentY + 28, 7, "#dbeafe", "#dbeafe");
    drawFit(ctx, "||", innerLeft + 5, innerLeft + 23, currentY + 19, 11, true, "center", "#0d5bdd");
    drawFit(ctx, entry.customer || "Walk-in Customer", innerLeft + 38, innerLeft + innerWidth - 90, currentY + 10, 9.5, true);
    drawFit(ctx, entry.itemName || entry.subtitle || entry.kind || "Sale", innerLeft + 38, innerLeft + innerWidth - 90, currentY + 22, 8, false, "left", "#6b7280");
    const due = saleDue(entry);
    const mainAmount = entry.kind === "Sale" ? Number(entry.amount || 0) : Number(entry.amount || entry.paidAmount || 0);
    drawFit(ctx, money(mainAmount), innerLeft + innerWidth - 94, innerLeft + innerWidth, currentY + 11, 9.5, true, "right", entry.kind === "Expense" ? "#ef4444" : "#10b981");
    if (due > 0) {
      drawFit(ctx, `- ${money(due)}`, innerLeft + innerWidth - 94, innerLeft + innerWidth, currentY + 23, 8, true, "right", "#ef4444");
    } else {
      drawFit(ctx, entry.timeLabel || entry.invoiceNo || "", innerLeft + innerWidth - 94, innerLeft + innerWidth, currentY + 23, 8, false, "right", "#6b7280");
    }
    currentY += 40;

    const detailTop = currentY;
    drawHistoryRound(ctx, innerLeft, detailTop, innerLeft + innerWidth, detailTop + height - 66, 6, "#fff", "#e7ebf2");
    currentY += 14;
    drawFit(ctx, `SALE NUMBER : ${summary.saleNumber || "-"}`, innerLeft + 10, innerLeft + innerWidth - 10, currentY, 7.5, true);
    currentY += 12;
    drawFit(ctx, `MOBILE NUMBER : ${entry.mobileNumber || "-"}`, innerLeft + 10, innerLeft + innerWidth - 10, currentY, 7.5, true);
    currentY += 18;
    drawFit(ctx, "ITEM PURCHASED:", innerLeft + 10, innerLeft + innerWidth - 10, currentY, 7.5, true);
    currentY += 8;
    historyItemSnapshots(entry).forEach((item, index) => {
      currentY += drawHistoryItemBlock(ctx, index, item, innerLeft + 10, currentY, innerWidth - 20) + 7;
    });
    currentY += 2;
    drawHistoryPaymentDetails(ctx, entry, summary, innerLeft + 10, currentY, innerWidth - 20);
    return height;
  }

  function drawHistoryItemBlock(ctx, index, item, left, top, width) {
    drawHistoryRound(ctx, left, top, left + width, top + 38, 6, "#fff", "#e7ebf2");
    drawFit(ctx, `${index + 1}. ${String(item.product || "Sale Item").toUpperCase()}`, left + 9, left + width - 9, top + 13, 9.5, true);
    const gap = 6;
    const boxTop = top + 19;
    const boxWidth = (width - 18 - (gap * 2)) / 3;
    drawHistoryMiniAmountRow(ctx, "Qty.", item.quantity || "-", left + 9, boxTop, boxWidth);
    drawHistoryMiniAmountRow(ctx, "Rate", item.rate || "-", left + 9 + boxWidth + gap, boxTop, boxWidth);
    drawHistoryMiniAmountRow(ctx, "Amount", numberText(item.amount), left + 9 + ((boxWidth + gap) * 2), boxTop, boxWidth);
    return 38;
  }

  function drawHistoryPaymentDetails(ctx, entry, summary, left, top, width) {
    let currentY = top;
    drawFit(ctx, "PAYMENT DETAILS:", left, left + width, currentY + 11, 7.5, true);
    currentY += 17;
    const boxTop = currentY;
    drawHistoryRound(ctx, left, boxTop, left + width, boxTop + 10, 7, "#fff", "#e7ebf2");
    currentY += 10;
    historyPaymentRows(entry).forEach((row, index) => {
      if (index > 0) currentY += 4;
      drawHistoryMiniAmountRow(ctx, row.label, numberText(row.value), left + 10, currentY, width - 20, row.bold);
      currentY += 16;
    });
    currentY += 8;
    const cardGap = 10;
    const cardWidth = (width - 20 - cardGap) / 2;
    drawHistoryPaymentCard(ctx, "Cash", summary.cashPaid, summary.cashAccount, left + 10, currentY, cardWidth);
    drawHistoryPaymentCard(ctx, "Online", summary.onlinePaid, summary.onlineAccount, left + 10 + cardWidth + cardGap, currentY, cardWidth);
    currentY += 74;

    if (summary.historyItems.length) {
      drawFit(ctx, "HISTORY:", left + 10, left + width - 10, currentY + 10, 7.5, true);
      currentY += 17;
      let runningPaid = summary.historyStartPaid;
      summary.historyItems.forEach((item, index) => {
        runningPaid = Math.min(summary.totalAmount, runningPaid + Number(item.amount || 0));
        const due = Math.max(0, summary.totalAmount - runningPaid);
        drawHistoryRound(ctx, left + 10, currentY, left + width - 10, currentY + 32, 5, "#f7faff", "#e7ebf2");
        drawFit(ctx, `${index + 1}. ${item.dateTime || "-"}`, left + 18, left + width - 18, currentY + 11, 8, false, "left", "#6b7280");
        drawFit(ctx, `Paid ${money(item.amount)}   Due ${money(due)}`, left + 18, left + width - 18, currentY + 24, 9.5, true);
        currentY += 37;
      });
    }
    drawHistoryStrokeRound(ctx, left, boxTop, left + width, currentY + 8, 7, "#e7ebf2");
  }

  function drawHistoryMiniAmountRow(ctx, label, value, left, top, width, bold = false) {
    const labelRight = left + (width * 0.52);
    drawHistoryRound(ctx, left, top, left + width, top + 16, 4, "#fff", "#e7ebf2");
    drawHistoryLine(ctx, labelRight, top, labelRight, top + 16, "#e7ebf2");
    drawFit(ctx, String(label || "").toUpperCase(), left + 8, labelRight - 5, top + 11, 7.5, true, "center");
    drawFit(ctx, value || "-", labelRight + 6, left + width - 8, top + 11, bold ? 9.5 : 8.8, bold, "center");
  }

  function drawHistoryPaymentCard(ctx, title, amount, account, left, top, width) {
    const active = Number(amount || 0) > 0;
    drawHistoryRound(ctx, left, top, left + width, top + 66, 7, active ? "#e2f8e9" : "#f0f3f8", active ? "#36c46b" : "#e7ebf2");
    drawFit(ctx, title, left + 9, left + width - 9, top + 15, 10, true, "left", active ? "#25a955" : "#6b7280");
    drawHistoryRound(ctx, left + 8, top + 24, left + width - 8, top + 43, 5, "#fff", "#e7ebf2");
    drawFit(ctx, numberText(amount), left + 12, left + width - 12, top + 38, 11.5, true, "center");
    if (active) {
      drawFit(ctx, "ACCOUNT", left + 8, left + width - 8, top + 53, 7.5, true, "center");
      drawFit(ctx, String(account || "Indian Steel").toUpperCase(), left + 8, left + width - 8, top + 63, 7.5, true, "center");
    }
  }

  function drawHistoryRound(ctx, left, top, right, bottom, radius, fillColor, strokeColor = "#e7ebf2", lineWidth = 1) {
    ctx.save();
    roundedPath(ctx, left, top, right - left, bottom - top, radius);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.restore();
  }

  function drawHistoryStrokeRound(ctx, left, top, right, bottom, radius, strokeColor = "#e7ebf2") {
    ctx.save();
    roundedPath(ctx, left, top, right - left, bottom - top, radius);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawHistoryLine(ctx, x1, y1, x2, y2, color = "#e7ebf2") {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
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
      if (!canOpenScreen(el.dataset.screen)) return;
      ui.screen = el.dataset.screen;
      ui.recentOpen = "";
      ui.historyOpen = "";
      ui.error = "";
      if (ui.screen === "business-profile") ui.profileDraft = null;
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
      if (event.target.closest("button,a,input,select,textarea,label")) return;
      toggleEntryDropdown(el.dataset.toggleEntry, el.dataset.source);
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
      ui.historyOpen = "";
      scheduleRender();
    });
    document.querySelectorAll("[data-history-date]").forEach(el => el.addEventListener("click", () => openHistoryDatePicker(el.dataset.historyDate)));
    document.querySelectorAll("[data-calendar-day]").forEach(el => el.addEventListener("click", () => selectHistoryDate(el.dataset.calendarDay)));
    document.querySelectorAll("[data-theme-mode]").forEach(el => el.addEventListener("click", () => {
      setThemeMode(el.dataset.themeMode);
      scheduleRender();
    }));
    document.querySelectorAll("[data-profile-field]").forEach(el => el.addEventListener("input", () => updateProfileDraft(el)));
    const profileLogoFile = document.querySelector("[data-profile-logo-file]");
    if (profileLogoFile) profileLogoFile.addEventListener("change", () => {
      const file = profileLogoFile.files && profileLogoFile.files[0];
      if (file) void readProfileLogo(file);
    });
    const restoreFile = document.querySelector("[data-restore-file]");
    if (restoreFile) restoreFile.addEventListener("change", () => {
      const file = restoreFile.files && restoreFile.files[0];
      if (file) void restoreBackupFile(file);
    });
    document.querySelectorAll("[data-admin-field]").forEach(el => el.addEventListener("input", () => {
      const draft = ensureAdminDraft();
      draft[el.dataset.adminField] = el.dataset.adminField === "email" ? String(el.value || "").trim().toLowerCase() : el.value;
      ui.adminMessage = "";
    }));
    document.querySelectorAll("[data-admin-role]").forEach(el => el.addEventListener("click", () => setAdminRole(el.dataset.adminRole)));
    document.querySelectorAll("[data-admin-delete]").forEach(el => el.addEventListener("click", () => toggleAdminDelete(el.dataset.adminDelete)));
    document.querySelectorAll("[data-admin-visibility]").forEach(el => el.addEventListener("click", () => toggleAdminVisibility(el.dataset.adminVisibility)));
    document.querySelectorAll("[data-admin-page]").forEach(el => el.addEventListener("click", () => toggleAdminPage(el.dataset.adminPage)));
    document.querySelectorAll("[data-admin-load]").forEach(el => el.addEventListener("click", () => loadAdminRule(el.dataset.adminLoad)));
    document.querySelectorAll("[data-admin-remove]").forEach(el => el.addEventListener("click", () => removeAdminRule(el.dataset.adminRemove)));
    document.querySelectorAll("[data-admin-select-email]").forEach(el => el.addEventListener("click", () => selectAdminEmail(el.dataset.adminSelectEmail)));
  }

  function toggleEntryDropdown(key, source) {
    if (!key) return;
    if (source === "history") {
      ui.historyOpen = ui.historyOpen === key ? "" : key;
      ui.recentOpen = "";
    } else {
      ui.recentOpen = ui.recentOpen === key ? "" : key;
      ui.historyOpen = "";
    }
  }

  function openHistoryDatePicker(target) {
    if (target !== "from" && target !== "to") return;
    const selected = target === "from" ? ui.historyFrom : ui.historyTo;
    const bounds = historyPickerBounds(target);
    ui.historyDatePicker = target;
    ui.historyCalendarMonth = normalizeMonthInput(selected || bounds.max || todayInputDate());
    ui.historyOpen = "";
    scheduleRender();
  }

  function selectHistoryDate(value) {
    if (!value || !ui.historyDatePicker) return;
    const target = ui.historyDatePicker;
    if (!isDateAllowedForHistory(value, historyPickerBounds(target))) return;
    if (target === "from") {
      ui.historyFrom = value;
      if (ui.historyTo && ui.historyTo < value) ui.historyTo = value;
    } else {
      ui.historyTo = value;
      if (ui.historyFrom && ui.historyFrom > value) ui.historyFrom = value;
    }
    ui.historyDatePicker = "";
    ui.historyCalendarMonth = "";
    ui.historyOpen = "";
    scheduleRender();
  }

  function shiftHistoryCalendar(delta) {
    if (!ui.historyDatePicker) return;
    const bounds = historyPickerBounds(ui.historyDatePicker);
    const nextMonth = shiftMonthInput(ui.historyCalendarMonth || todayInputDate(), delta);
    if (monthHasAllowedDate(nextMonth, bounds)) {
      ui.historyCalendarMonth = nextMonth;
    }
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
    if (action === "profile") ui.screen = "profile";
    if (action === "close-profile") ui.screen = "profile";
    if (action === "open-add") {
      if (!canWriteData()) return;
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
    if (action === "close-history-calendar") closeOverlay("history-calendar");
    if (action === "history-calendar-prev") shiftHistoryCalendar(-1);
    if (action === "history-calendar-next") shiftHistoryCalendar(1);
    if (action === "sync-now") void syncNow({ manual: true });
    if (action === "choose-profile-logo") {
      const input = document.querySelector("[data-profile-logo-file]");
      if (input) input.click();
    }
    if (action === "save-business-profile") saveBusinessProfile();
    if (action === "create-backup") createBackupFile();
    if (action === "choose-restore") {
      const input = document.querySelector("[data-restore-file]");
      if (input) input.click();
    }
    if (action === "toggle-admin-write") toggleAdminWrite();
    if (action === "save-admin-rule") saveAdminRule();
    if (action === "logout") {
      session = {};
      sync.token = "";
      sync.status = "Logged out on this device";
      persistSession();
    }
    if (action === "add-stock") addStock();
    if (action === "print-history") void openHistoryPdf();
    scheduleRender();
  }

  function closeOverlay(name) {
    if (name === "add") ui.addOpen = false;
    if (name === "advance") ui.advanceOpen = false;
    if (name === "due") ui.dueInvoice = "";
    if (name === "profile") ui.screen = "profile";
    if (name === "history-calendar") {
      ui.historyDatePicker = "";
      ui.historyCalendarMonth = "";
    }
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

  function updateProfileDraft(el) {
    const draft = ensureProfileDraft();
    const key = el.dataset.profileField;
    let value = el.value;
    if (key === "mobile") value = onlyDigits(value);
    draft[key] = value;
    if (el.value !== value) el.value = value;
    ui.profileStatus = "";
  }

  async function readProfileLogo(file) {
    if (!file || !file.type.startsWith("image/")) {
      ui.profileStatus = "Please choose an image file.";
      ui.profileStatusError = true;
      scheduleRender();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      ensureProfileDraft().logoUri = String(reader.result || "");
      ui.profileStatus = "";
      scheduleRender();
    };
    reader.onerror = () => {
      ui.profileStatus = "Unable to read selected logo.";
      ui.profileStatusError = true;
      scheduleRender();
    };
    reader.readAsDataURL(file);
  }

  function saveBusinessProfile() {
    const draft = ensureProfileDraft();
    const mobile = onlyDigits(draft.mobile);
    if (mobile.length !== 10) {
      ui.profileStatus = "Please enter a 10 digit mobile number.";
      ui.profileStatusError = true;
      scheduleRender();
      return;
    }
    data.businessProfile = {
      name: String(draft.name || "").trim() || "Indian Steel",
      mobile,
      email: session.email || draft.email || data.businessProfile.email || "",
      logoUri: draft.logoUri || ""
    };
    ui.profileDraft = { ...data.businessProfile };
    ui.profileStatus = "Profile saved successfully";
    ui.profileStatusError = false;
    sync.status = "Profile saved locally";
    persist();
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
    if (!canWriteData()) return;
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
    if (!canWriteData()) return;
    const sale = data.entries.find(entry => entry.invoiceNo === invoiceNo);
    if (!sale) return;
    ui.dueInvoice = invoiceNo;
    ui.dueDraft = { cash: "0", online: String(saleDue(sale)) };
    ui.error = "";
    scheduleRender();
  }

  function saveDuePayment() {
    if (!canWriteData()) return;
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
    if (!currentUserAccess().canDeleteRecentEntries) return;
    const entry = data.entries.find(item => item.id === entryId);
    if (!entry) return;
    entryIdentityKeys(entry).forEach(key => {
      if (!data.deletedLedgerEntryKeys.includes(key)) data.deletedLedgerEntryKeys.unshift(key);
    });
    data.entries = data.entries.filter(item => item.id !== entryId);
    persist();
  }

  function deleteAdvance(recordId) {
    if (!currentUserAccess().canDeleteAdvanceEntries) return;
    const record = data.advanceRecords.find(item => item.id === recordId);
    if (!record) return;
    const deletedAt = Date.now();
    advanceIdentityKeys(record).forEach(key => { data.deletedAdvanceRecordKeys[key] = deletedAt; });
    data.advanceRecords = data.advanceRecords.filter(item => item.id !== recordId);
    persist();
  }

  function addStock() {
    if (!canWriteData()) return;
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
    if (!canWriteData()) return;
    data.stockItems = data.stockItems.filter(item => item.name !== name);
    persist();
  }

  function backupFileName() {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "_");
    return `IndianSteel_Backup_${stamp}.json`;
  }

  function createBackupFile() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    ui.backupStatus = "Backup file created successfully";
    ui.backupStatusError = false;
    scheduleRender();
  }

  async function restoreBackupFile(file) {
    if (!canWriteData()) return;
    try {
      const raw = await file.text();
      const restored = normalizeData(JSON.parse(raw));
      data = restored;
      ui.backupStatus = "Backup restored on this device. Sync with Drive manually if you want to upload it.";
      ui.backupStatusError = false;
      sync.status = "Backup restored locally";
      persist();
    } catch (error) {
      ui.backupStatus = `Restore failed: ${error.message || "invalid backup file"}`;
      ui.backupStatusError = true;
      scheduleRender();
    }
  }

  function setAdminRole(role) {
    const draft = ensureAdminDraft();
    draft.role = normalizeRole(role);
    if (draft.role === "Admin") {
      draft.canWrite = true;
      draft.canDeleteRecentEntries = true;
      draft.canDeleteAdvanceEntries = true;
      draft.canDeleteDueEntries = true;
      draft.visibility = defaultVisibilitySettings();
    }
    if (draft.role === "Viewer") {
      draft.canWrite = false;
      draft.canDeleteRecentEntries = false;
      draft.canDeleteAdvanceEntries = false;
      draft.canDeleteDueEntries = false;
    }
    ui.adminMessage = "";
    scheduleRender();
  }

  function toggleAdminWrite() {
    const draft = ensureAdminDraft();
    if (normalizeRole(draft.role) !== "Staff") return;
    draft.canWrite = !draft.canWrite;
    ui.adminMessage = "";
    scheduleRender();
  }

  function toggleAdminDelete(key) {
    const draft = ensureAdminDraft();
    if (normalizeRole(draft.role) !== "Staff") return;
    const map = {
      recent: "canDeleteRecentEntries",
      advance: "canDeleteAdvanceEntries",
      due: "canDeleteDueEntries"
    };
    const field = map[key];
    if (!field) return;
    draft[field] = !draft[field];
    ui.adminMessage = "";
    scheduleRender();
  }

  function toggleAdminVisibility(key) {
    const draft = ensureAdminDraft();
    if (normalizeRole(draft.role) === "Admin") return;
    draft.visibility = normalizeVisibilitySettings(draft.visibility, defaultVisibilitySettings());
    if (!Object.prototype.hasOwnProperty.call(draft.visibility, key)) return;
    draft.visibility[key] = !draft.visibility[key];
    ui.adminMessage = "";
    scheduleRender();
  }

  function toggleAdminPage(key) {
    const draft = ensureAdminDraft();
    const effective = effectiveAdminDraft(draft);
    if (effective.isAdmin || (key === "DataBackup" && effective.canWrite)) return;
    const pageKey = normalizeAccessPage(key);
    if (!pageKey) return;
    draft.pages = normalizeAccessPages(draft.pages);
    draft.pages = draft.pages.includes(pageKey)
      ? draft.pages.filter(page => page !== pageKey)
      : [...draft.pages, pageKey];
    ui.adminMessage = "";
    scheduleRender();
  }

  function loadAdminRule(email) {
    const normalized = String(email || "").trim().toLowerCase();
    const rule = (data.adminControls.users || []).find(item => item.email === normalized);
    if (!rule) return;
    ui.adminDraft = {
      email: rule.email,
      role: normalizeRole(rule.role),
      canWrite: rule.canWrite === true,
      canDeleteRecentEntries: rule.canDeleteRecentEntries === true,
      canDeleteAdvanceEntries: rule.canDeleteAdvanceEntries === true,
      canDeleteDueEntries: rule.canDeleteDueEntries === true,
      pages: normalizeAccessPages(rule.pages),
      visibility: normalizeVisibilitySettings(rule.visibility, defaultVisibilitySettings())
    };
    ui.adminMessage = `Loaded ${rule.email}.`;
    scheduleRender();
  }

  function selectAdminEmail(email) {
    const normalized = String(email || "").trim().toLowerCase();
    const rule = (data.adminControls.users || []).find(item => item.email === normalized);
    if (rule) {
      loadAdminRule(normalized);
      return;
    }
    ui.adminDraft = blankAdminDraft(normalized);
    ui.adminMessage = `Selected ${normalized}. Add permissions and save.`;
    scheduleRender();
  }

  function removeAdminRule(email) {
    const normalized = String(email || "").trim().toLowerCase();
    data.adminControls.users = (data.adminControls.users || []).filter(rule => rule.email !== normalized);
    data.adminControls.updatedAt = Date.now();
    data = normalizeData(data);
    ui.adminMessage = `Removed ${normalized}.`;
    persist();
  }

  function saveAdminRule() {
    if (!isCurrentAdmin()) return;
    const draft = ensureAdminDraft();
    const email = String(draft.email || "").trim().toLowerCase();
    const effective = effectiveAdminDraft(draft);
    if (!email) {
      ui.adminMessage = "Enter a Gmail address first.";
      scheduleRender();
      return;
    }
    if (BUILT_IN_ADMINS.has(email)) {
      ui.adminMessage = "Admin Gmail always has full access.";
      scheduleRender();
      return;
    }
    const newRule = {
      email,
      role: effective.role,
      canWrite: effective.canWrite,
      canDeleteRecentEntries: effective.canDeleteRecentEntries,
      canDeleteAdvanceEntries: effective.canDeleteAdvanceEntries,
      canDeleteDueEntries: effective.canDeleteDueEntries,
      pages: effective.pages,
      visibility: effective.visibility
    };
    data.adminControls.users = [
      ...(data.adminControls.users || []).filter(rule => rule.email !== email),
      newRule
    ].sort((a, b) => a.email.localeCompare(b.email));
    data.adminControls.updatedAt = Date.now();
    data = normalizeData(data);
    ui.adminDraft = blankAdminDraft();
    ui.adminMessage = `Access saved for ${email}.`;
    sync.status = "Access controls saved locally";
    persist();
  }

  function recordUserActivity(email) {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized || !data) return;
    data.userActivity = [
      ...(data.userActivity || []).filter(item => String(item.email || "").toLowerCase() !== normalized),
      { email: normalized, lastSeenAt: Date.now() }
    ].sort((a, b) => Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0));
    void writeStore(DATA_KEY, data);
  }

  async function shareEntry(entryId) {
    const entry = data.entries.find(item => item.id === entryId);
    if (!canShareSalesReceipt(entry)) return;
    const title = `Sales Receipt ${entry.invoiceNo || ""}`.trim();
    try {
      const file = await createSalesReceiptPdfFile(entry);
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title, files: [file] }).catch(() => {});
        return;
      }
      openPdfBlob(file);
    } catch (error) {
      const text = `${data.businessProfile.name || "Indian Steel"}\n${entry.customer}\n${entry.invoiceNo}\nTotal: ${money(entry.amount)}\nPaid: ${money(originalSalePaidAmount(entry))}\nDue: ${money(Math.max(0, entry.amount - originalSalePaidAmount(entry)))}`;
      if (navigator.share) {
        await navigator.share({ title, text }).catch(() => {});
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      }
    }
  }

  async function createSalesReceiptPdfFile(entry) {
    const blob = await createSalesReceiptPdfBlob(entry);
    const invoicePart = cleanFilePart(entry.invoiceNo).replace(/^_+|_+$/g, "") || String(Date.now());
    return new File([blob], `SALES_RECEIPT_${invoicePart}.pdf`, { type: "application/pdf" });
  }

  async function createSalesReceiptPdfBlob(entry) {
    const assets = await loadReceiptAssets();
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = RECEIPT_PAGE_WIDTH * scale;
    canvas.height = RECEIPT_PAGE_HEIGHT * scale;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.scale(scale, scale);
    drawSalesReceiptCanvas(ctx, entry, assets);
    const jpegBytes = dataUrlToBytes(canvas.toDataURL("image/jpeg", 0.94));
    return buildSinglePagePdf({
      imageBytes: jpegBytes,
      imageWidth: canvas.width,
      imageHeight: canvas.height,
      annotations: receiptPdfAnnotations()
    });
  }

  function openPdfBlob(blob, targetWindow = null) {
    const url = URL.createObjectURL(blob);
    const opened = targetWindow && !targetWindow.closed ? targetWindow : window.open(url, "_blank", "noopener");
    if (targetWindow && !targetWindow.closed) {
      targetWindow.location.href = url;
    }
    if (!opened) {
      const link = document.createElement("a");
      link.href = url;
      link.download = blob.name || "SALES_RECEIPT.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function loadReceiptAssets() {
    if (!receiptAssetsPromise) {
      receiptAssetsPromise = Promise.all([
        loadImage(RECEIPT_LOGO_SRC),
        loadImage(RECEIPT_STAMP_SRC)
      ]).then(([logo, stamp]) => ({ logo, stamp }));
    }
    return receiptAssetsPromise;
  }

  function loadImage(src) {
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }

  function drawSalesReceiptCanvas(ctx, entry, assets) {
    const black = "#111827";
    const pageWidth = RECEIPT_PAGE_WIDTH;
    const pageHeight = RECEIPT_PAGE_HEIGHT;
    const purchasedItems = saleReceiptItems(entry);
    const defaultDateTime = [entry.dateLabel, entry.timeLabel].filter(Boolean).join(", ") || "-";
    const receiptPaidAmount = originalSalePaidAmount(entry);
    const dueAmount = Math.max(0, Number(entry.amount || 0) - receiptPaidAmount);
    const purchasedAmount = purchaseDisplayAmount(entry);
    const cuttingCharge = Number(entry.cuttingCharge || 0);
    const discountAmount = Number(entry.discountAmount || 0);
    const cashPaid = originalSaleCashPaidAmount(entry);
    const onlineRaw = originalSaleOnlinePaidAmount(entry);
    const displayOnlinePaid = cashPaid === 0 && onlineRaw === 0 && receiptPaidAmount > 0 ? receiptPaidAmount : onlineRaw;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, pageWidth, pageHeight);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.1;
    ctx.strokeRect(6, 5, pageWidth - 12, pageHeight - 10);
    drawImageFit(ctx, assets.logo, 248, 10, 347, 101);

    drawPhoneIcon(ctx, 508, 24);
    drawMailIcon(ctx, 508, 39);
    drawFit(ctx, INDIAN_STEEL_OWNER_MOBILE, 518, 588, 27, 6.6);
    drawFit(ctx, INDIAN_STEEL_RECEIPT_EMAIL, 518, 588, 42, 6.6);

    drawFit(ctx, "Buyer & Seller of Scaffolding and All Types of Scrap", 90, 505, 119, 13.5, true, "center");
    const addressBox = { left: 6, top: 130, right: pageWidth - 6, bottom: 148 };
    const addressCenterY = (addressBox.top + addressBox.bottom) / 2;
    drawRectStroke(ctx, addressBox.left, addressBox.top, addressBox.right, addressBox.bottom, 0.75);
    setReceiptFont(ctx, 7.8, false);
    const fittedAddress = fittedCanvasText(ctx, INDIAN_STEEL_RECEIPT_ADDRESS, addressBox.right - addressBox.left - 34);
    const groupWidth = 9 + 5 + ctx.measureText(fittedAddress).width;
    const groupLeft = addressBox.left + ((addressBox.right - addressBox.left - groupWidth) / 2);
    drawLocationIcon(ctx, groupLeft + 4.5, addressCenterY);
    drawFit(ctx, fittedAddress, groupLeft + 14, addressBox.right - 10, addressCenterY + 2.9, 7.8);

    const labelPaintSize = 8.8;
    const detailSize = 7.8;
    const infoBaseline = 164;
    const saleNumberLabel = "SALE NUMBER :";
    drawFit(ctx, saleNumberLabel, 18, 90, infoBaseline, labelPaintSize);
    const saleNumberLeft = 18 + measureReceiptText(ctx, saleNumberLabel, labelPaintSize) + 3;
    drawFit(ctx, entry.invoiceNo || "-", saleNumberLeft, 245, infoBaseline - 0.4, detailSize);
    drawRightDetailPair(ctx, "DATE & TIME :", defaultDateTime, defaultDateTime, infoBaseline, pageWidth - 18);

    drawFit(ctx, "SALES RECEIPT", 190, 405, 195, 12, true, "center");

    const customerBaseline = 236;
    const customerNameLabel = "CUSTOMER NAME :";
    drawFit(ctx, customerNameLabel, 18, 110, customerBaseline, labelPaintSize);
    drawFit(ctx, entry.customer || "-", 18 + measureReceiptText(ctx, customerNameLabel, labelPaintSize) + 3, 280, customerBaseline - 0.4, detailSize);
    drawRightDetailPair(ctx, "MOBILE NUMBER :", entry.mobileNumber || "", entry.mobileNumber || "0000000000", customerBaseline, pageWidth - 18);

    const itemTop = 248;
    const rowLeft = 56;
    const rowRight = 558;
    const productSeparator = 312;
    const qtySeparator = 392;
    const rateSeparator = 470;
    const firstRowTop = itemTop + 50;
    const rowHeight = 20;
    const rowGap = purchasedItems.length <= 3 ? 14 : 8;
    const itemRowsHeight = purchasedItems.length ? (purchasedItems.length * rowHeight) + ((purchasedItems.length - 1) * rowGap) : 0;
    const itemBottom = Math.max(itemTop + 112, firstRowTop + itemRowsHeight + 16);
    drawRectStroke(ctx, 18, itemTop, pageWidth - 18, itemBottom, 1.1);
    drawFit(ctx, "PURCHASED ITEM LIST:", 28, 170, itemTop + 17, labelPaintSize);
    drawFit(ctx, "QTY", productSeparator, qtySeparator, itemTop + 36, labelPaintSize, false, "center");
    drawFit(ctx, "RATE", qtySeparator, rateSeparator, itemTop + 36, labelPaintSize, false, "center");
    drawFit(ctx, "AMOUNT", rateSeparator, rowRight, itemTop + 36, labelPaintSize, false, "center");
    purchasedItems.forEach((item, index) => {
      const top = firstRowTop + (index * (rowHeight + rowGap));
      const bottom = top + rowHeight;
      if (bottom > itemBottom - 10) return;
      drawFit(ctx, `${index + 1}.`, 24, rowLeft - 5, bottom - 6, labelPaintSize, false, "right");
      drawRoundBox(ctx, rowLeft, top, rowRight, bottom, 8);
      [productSeparator, qtySeparator, rateSeparator].forEach(x => drawLine(ctx, x, top + 1, x, bottom - 1));
      drawFitCenter(ctx, item.product || "Sale Item", rowLeft + 10, top, productSeparator - 8, bottom, 8.1);
      drawFitCenter(ctx, item.quantity || "-", productSeparator + 5, top, qtySeparator - 5, bottom, 8.1);
      drawFitCenter(ctx, item.rate || "-", qtySeparator + 5, top, rateSeparator - 5, bottom, 8.1);
      drawFitCenter(ctx, receiptCurrency(item.amount), rateSeparator + 5, top, rowRight - 8, bottom, 9.1, true);
    });

    const paymentContentLeft = rowLeft;
    const paymentContentRight = rowRight;
    const paymentSummaryDivider = 318;
    const paymentSummaryRows = [
      ["PURCHASED AMOUNT", receiptCurrency(purchasedAmount)],
      ...(cuttingCharge > 0 ? [["CUTTING CHARGE", receiptCurrency(cuttingCharge)]] : []),
      ...(discountAmount > 0 ? [["DISCOUNT AMOUNT", receiptCurrency(discountAmount)]] : []),
      ["TOTAL AMOUNT", receiptCurrency(entry.amount)]
    ];
    const paymentTop = itemBottom + 17;
    const paymentSummaryTop = paymentTop + 48;
    const paymentSummaryStep = 21;
    const lastSummaryBottom = paymentSummaryTop + ((paymentSummaryRows.length - 1) * paymentSummaryStep) + 17;
    const paidDueLabelY = lastSummaryBottom + 15;
    const paidDueBoxTop = paidDueLabelY + 8;
    const paymentModeTop = paidDueBoxTop + 34;
    const footerTop = 808;
    const historyHeaderTop = paymentModeTop + 34;
    const historyRowTop = historyHeaderTop + 19;
    const historyRowHeight = 18;
    const dueHistoryRows = receiptDueHistoryRows(entry, receiptPaidAmount, Number(entry.amount || 0), footerTop, historyRowTop, historyRowHeight);
    const historyBottom = dueHistoryRows.length ? historyRowTop + (dueHistoryRows.length * historyRowHeight) : historyHeaderTop;
    const paymentBottom = dueHistoryRows.length ? historyBottom + 14 : paymentModeTop + 34;

    drawRectStroke(ctx, 18, paymentTop, pageWidth - 18, paymentBottom, 1.1);
    drawFit(ctx, "PAYMENT DETAILS:", 28, 210, paymentTop + 22, labelPaintSize);
    paymentSummaryRows.forEach((row, index) => {
      const top = paymentSummaryTop + (index * paymentSummaryStep);
      drawRoundBox(ctx, paymentContentLeft, top, paymentContentRight, top + 17, 8);
      drawLine(ctx, paymentSummaryDivider, top + 1, paymentSummaryDivider, top + 16);
      drawFitCenter(ctx, row[0], paymentContentLeft + 12, top, paymentSummaryDivider - 5, top + 17, labelPaintSize);
      drawFitCenter(ctx, row[1], paymentSummaryDivider + 7, top, paymentContentRight - 8, top + 17, 9.1, true);
    });

    const paidDueGap = 60;
    const paidDueBoxWidth = (paymentContentRight - paymentContentLeft - paidDueGap) / 2;
    const paidBoxLeft = paymentContentLeft;
    const paidBoxRight = paidBoxLeft + paidDueBoxWidth;
    const dueBoxRight = paymentContentRight;
    const dueBoxLeft = dueBoxRight - paidDueBoxWidth;
    drawFit(ctx, "PAID AMOUNT", paidBoxLeft, paidBoxRight, paidDueLabelY, labelPaintSize, false, "center");
    drawFit(ctx, "DUE AMOUNT", dueBoxLeft, dueBoxRight, paidDueLabelY, labelPaintSize, false, "center");
    drawRoundBox(ctx, paidBoxLeft, paidDueBoxTop, paidBoxRight, paidDueBoxTop + 20, 8);
    drawRoundBox(ctx, dueBoxLeft, paidDueBoxTop, dueBoxRight, paidDueBoxTop + 20, 8);
    drawFitCenter(ctx, receiptCurrency(receiptPaidAmount), paidBoxLeft, paidDueBoxTop, paidBoxRight, paidDueBoxTop + 20, 9.1, true);
    drawFitCenter(ctx, receiptCurrency(dueAmount), dueBoxLeft, paidDueBoxTop, dueBoxRight, paidDueBoxTop + 20, 9.1, true);

    const paymentModeLeft = paymentContentLeft;
    const paymentModeRight = paymentContentRight;
    const paymentModeWidth = paymentModeRight - paymentModeLeft;
    const cashLabelDivider = paymentModeLeft + (paymentModeWidth * (60 / 465));
    const onlineLabelDivider = paymentModeLeft + (paymentModeWidth * (235 / 465));
    const onlineValueDivider = paymentModeLeft + (paymentModeWidth * (340 / 465));
    drawRoundBox(ctx, paymentModeLeft, paymentModeTop, paymentModeRight, paymentModeTop + 20, 8);
    [cashLabelDivider, onlineLabelDivider, onlineValueDivider].forEach(x => drawLine(ctx, x, paymentModeTop + 1, x, paymentModeTop + 19));
    drawFitCenter(ctx, "CASH", paymentModeLeft + 5, paymentModeTop, cashLabelDivider - 4, paymentModeTop + 20, labelPaintSize);
    drawFitCenter(ctx, receiptCurrency(cashPaid), cashLabelDivider + 5, paymentModeTop, onlineLabelDivider - 5, paymentModeTop + 20, 9.1, true);
    drawFitCenter(ctx, "ONLINE", onlineLabelDivider + 5, paymentModeTop, onlineValueDivider - 4, paymentModeTop + 20, labelPaintSize);
    drawFitCenter(ctx, receiptCurrency(displayOnlinePaid), onlineValueDivider + 5, paymentModeTop, paymentModeRight - 6, paymentModeTop + 20, 9.1, true);

    if (dueHistoryRows.length) {
      drawFit(ctx, "HISTORY:", 28, 180, historyHeaderTop + 12, labelPaintSize);
      const serialRight = paymentContentLeft + 30;
      const dateRight = paymentContentLeft + 198;
      const paidRight = paymentContentLeft + 282;
      const dueRight = paymentContentLeft + 366;
      const cashRight = paymentContentLeft + 434;
      dueHistoryRows.forEach((row, index) => {
        const top = historyRowTop + (index * historyRowHeight);
        const bottom = top + 15;
        drawRoundBox(ctx, paymentContentLeft, top, paymentContentRight, bottom, 6);
        [serialRight, dateRight, paidRight, dueRight, cashRight].forEach(x => drawLine(ctx, x, top + 1, x, bottom - 1));
        drawFitCenter(ctx, row.serial, paymentContentLeft + 4, top, serialRight - 3, bottom, labelPaintSize);
        drawFitCenter(ctx, row.dateTime, serialRight + 4, top, dateRight - 4, bottom, 8.1);
        drawFitCenter(ctx, row.paidAmount, dateRight + 4, top, paidRight - 4, bottom, 7.4, true);
        drawFitCenter(ctx, row.dueAmount, paidRight + 4, top, dueRight - 4, bottom, 7.4, true);
        drawFitCenter(ctx, row.cashAmount, dueRight + 4, top, cashRight - 4, bottom, 7.4, true);
        drawFitCenter(ctx, row.onlineAmount, cashRight + 4, top, paymentContentRight - 4, bottom, 7.4, true);
      });
    }

    const stampTop = Math.min(Math.max(640, paymentBottom + 12), footerTop - 88);
    drawImageFit(ctx, assets.stamp, 365, stampTop, 555, Math.min(stampTop + 105, footerTop - 8));
    ctx.fillStyle = "#000";
    ctx.fillRect(6, footerTop, pageWidth - 12, 20);
    drawFit(ctx, "Thank you for your business! We appreciate your trust in Indian Steel and look forward to serving you again.", 12, pageWidth - 12, 821, 8, true, "center", "#fff");
  }

  function saleReceiptItems(entry) {
    const purchasedItems = entry.saleItems && entry.saleItems.length
      ? entry.saleItems
      : [{ product: entry.itemName || "Sale Item", quantity: "", rate: "", amount: purchaseDisplayAmount(entry) }];
    const maxRows = 6;
    if (purchasedItems.length <= maxRows) return purchasedItems;
    return purchasedItems.slice(0, maxRows - 1).concat({
      ...purchasedItems[maxRows - 1],
      product: `${purchasedItems[maxRows - 1].product} +${purchasedItems.length - maxRows} more`
    });
  }

  function receiptDueHistoryRows(entry, startingPaid, totalAmount, footerTop, historyRowTop, historyRowHeight) {
    const historyItems = entry.duePaymentHistory || [];
    if (!historyItems.length) return [];
    const maxRows = Math.max(0, Math.floor((footerTop - historyRowTop - 16) / historyRowHeight));
    if (!maxRows) return [];
    let runningPaid = Math.max(0, Math.min(startingPaid, totalAmount));
    const rows = historyItems.map((item, index) => {
      runningPaid = Math.min(totalAmount, runningPaid + Number(item.amount || 0));
      return {
        serial: `${index + 1}.`,
        dateTime: item.dateTime || "-",
        paidAmount: receiptCurrency(item.amount),
        dueAmount: receiptCurrency(Math.max(0, totalAmount - runningPaid)),
        cashAmount: receiptCurrency(item.cashAmount),
        onlineAmount: receiptCurrency(item.onlineAmount)
      };
    });
    if (rows.length <= maxRows) return rows;
    if (maxRows === 1) return [{ serial: "", dateTime: `+${rows.length} MORE`, paidAmount: "-", dueAmount: "-", cashAmount: "-", onlineAmount: "-" }];
    return rows.slice(0, maxRows - 1).concat({ serial: "", dateTime: `+${rows.length - maxRows + 1} MORE`, paidAmount: "-", dueAmount: "-", cashAmount: "-", onlineAmount: "-" });
  }

  function originalSalePaidAmount(entry) {
    if (!entry || entry.kind !== "Sale") return Number(entry && entry.paidAmount || 0);
    const duePaidLater = (entry.duePaymentHistory || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return Math.max(0, Number(entry.paidAmount || 0) - duePaidLater);
  }

  function originalSaleCashPaidAmount(entry) {
    const cash = Number(entry && entry.cashPaidAmount || 0);
    if (!entry || entry.kind !== "Sale") return cash;
    const basePaid = originalSalePaidAmount(entry);
    const modeTotal = Number(entry.cashPaidAmount || 0) + Number(entry.onlinePaidAmount || 0);
    const cashPaidLater = (entry.duePaymentHistory || []).reduce((sum, item) => sum + Number(item.cashAmount || 0), 0);
    return modeTotal > basePaid ? Math.max(0, cash - cashPaidLater) : cash;
  }

  function originalSaleOnlinePaidAmount(entry) {
    const online = Number(entry && entry.onlinePaidAmount || 0);
    if (!entry || entry.kind !== "Sale") return online;
    const basePaid = originalSalePaidAmount(entry);
    const modeTotal = Number(entry.cashPaidAmount || 0) + Number(entry.onlinePaidAmount || 0);
    const onlinePaidLater = (entry.duePaymentHistory || []).reduce((sum, item) => sum + Number(item.onlineAmount || 0), 0);
    return modeTotal > basePaid ? Math.max(0, online - onlinePaidLater) : online;
  }

  function purchaseDisplayAmount(entry) {
    return Number(entry && entry.purchasedAmount || 0) || Number(entry && entry.amount || 0);
  }

  function receiptCurrency(value) {
    return `${INR} ${numberText(value)}`;
  }

  function drawRightDetailPair(ctx, label, value, reservedValue, baseline, rightEdge) {
    const displayValue = value || "-";
    const reservedText = reservedValue || displayValue;
    const valueLeft = rightEdge - measureReceiptText(ctx, reservedText, 7.8);
    const labelRight = valueLeft - 3;
    const labelLeft = labelRight - measureReceiptText(ctx, label, 8.8);
    drawFit(ctx, label, labelLeft, labelRight, baseline, 8.8);
    drawFit(ctx, displayValue, valueLeft, rightEdge, baseline - 0.4, 7.8);
  }

  function setReceiptFont(ctx, size, bold = false, color = "#111827", align = "left", baseline = "alphabetic") {
    ctx.font = `${bold ? "700" : "400"} ${size}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
  }

  function measureReceiptText(ctx, text, size, bold = false) {
    setReceiptFont(ctx, size, bold);
    return ctx.measureText(String(text || "")).width;
  }

  function fittedCanvasText(ctx, text, maxWidth) {
    const raw = String(text || "");
    if (ctx.measureText(raw).width <= maxWidth) return raw;
    let left = 0;
    let right = raw.length;
    while (left < right) {
      const mid = Math.ceil((left + right) / 2);
      if (ctx.measureText(`${raw.slice(0, mid)}...`).width <= maxWidth) left = mid;
      else right = mid - 1;
    }
    return `${raw.slice(0, Math.max(0, left))}...`;
  }

  function drawFit(ctx, text, left, right, baseline, size, bold = false, align = "left", color = "#111827") {
    setReceiptFont(ctx, size, bold, color, align, "alphabetic");
    const fitted = fittedCanvasText(ctx, text, Math.max(0, right - left));
    const x = align === "center" ? (left + right) / 2 : align === "right" ? right : left;
    ctx.fillText(fitted, x, baseline);
  }

  function drawFitCenter(ctx, text, left, top, right, bottom, size, bold = false) {
    setReceiptFont(ctx, size, bold, "#111827", "center", "middle");
    const fitted = fittedCanvasText(ctx, text, Math.max(0, right - left));
    ctx.fillText(fitted, (left + right) / 2, (top + bottom) / 2);
  }

  function drawRectStroke(ctx, left, top, right, bottom, width = 1) {
    ctx.save();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = width;
    ctx.strokeRect(left, top, right - left, bottom - top);
    ctx.restore();
  }

  function drawLine(ctx, x1, y1, x2, y2) {
    ctx.save();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawRoundBox(ctx, left, top, right, bottom, radius) {
    ctx.save();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.1;
    roundedPath(ctx, left, top, right - left, bottom - top, radius);
    ctx.stroke();
    ctx.restore();
  }

  function roundedPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  function drawImageFit(ctx, image, left, top, right, bottom) {
    if (!image) return;
    const boxWidth = right - left;
    const boxHeight = bottom - top;
    const scale = Math.min(boxWidth / image.naturalWidth, boxHeight / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    ctx.drawImage(image, left + ((boxWidth - width) / 2), top + ((boxHeight - height) / 2), width, height);
  }

  function drawPhoneIcon(ctx, centerX, centerY) {
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(centerX, centerY, 5.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(centerX - 3.55, centerY - 2.85);
    ctx.bezierCurveTo(centerX - 4.15, centerY - 1.85, centerX - 3.45, centerY + 0.9, centerX - 1.15, centerY + 2.45);
    ctx.bezierCurveTo(centerX + 0.95, centerY + 3.85, centerX + 3.45, centerY + 3.85, centerX + 4, centerY + 2.9);
    ctx.lineTo(centerX + 2.55, centerY + 1.35);
    ctx.bezierCurveTo(centerX + 2.05, centerY + 0.85, centerX + 1.25, centerY + 0.85, centerX + 0.8, centerY + 1.35);
    ctx.lineTo(centerX + 0.25, centerY + 1.95);
    ctx.bezierCurveTo(centerX - 0.75, centerY + 1.55, centerX - 1.75, centerY + 0.55, centerX - 2.15, centerY - 0.45);
    ctx.lineTo(centerX - 1.5, centerY - 1);
    ctx.bezierCurveTo(centerX - 0.95, centerY - 1.5, centerX - 0.95, centerY - 2.25, centerX - 1.5, centerY - 2.8);
    ctx.lineTo(centerX - 3, centerY - 4.15);
    ctx.bezierCurveTo(centerX - 3.2, centerY - 4, centerX - 3.4, centerY - 3.65, centerX - 3.55, centerY - 2.85);
    ctx.fill();
    ctx.restore();
  }

  function drawMailIcon(ctx, centerX, centerY) {
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(centerX, centerY, 5.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 0.9;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const left = centerX - 3.9;
    const top = centerY - 2.7;
    const right = centerX + 3.9;
    const bottom = centerY + 3;
    roundedPath(ctx, left, top, right - left, bottom - top, 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(left + 0.7, top + 0.8);
    ctx.lineTo(centerX, centerY + 1.3);
    ctx.lineTo(right - 0.7, top + 0.8);
    ctx.stroke();
    ctx.restore();
  }

  function drawLocationIcon(ctx, centerX, centerY) {
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + 4.2);
    ctx.bezierCurveTo(centerX - 3.8, centerY + 0.4, centerX - 3.5, centerY - 4.2, centerX, centerY - 4.5);
    ctx.bezierCurveTo(centerX + 3.5, centerY - 4.2, centerX + 3.8, centerY + 0.4, centerX, centerY + 4.2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(centerX, centerY - 1.2, 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function dataUrlToBytes(dataUrl) {
    const base64 = String(dataUrl).split(",")[1] || "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function receiptPdfAnnotations() {
    return [
      { left: 498, top: 16, right: RECEIPT_PAGE_WIDTH - 7, bottom: 31, uri: `tel:${INDIAN_STEEL_OWNER_MOBILE}` },
      { left: 498, top: 31, right: RECEIPT_PAGE_WIDTH - 7, bottom: 46, uri: `mailto:${INDIAN_STEEL_RECEIPT_EMAIL}` },
      { left: 6, top: 130, right: RECEIPT_PAGE_WIDTH - 6, bottom: 148, uri: INDIAN_STEEL_MAPS_URL }
    ];
  }

  function buildSinglePagePdf({ imageBytes, imageWidth, imageHeight, annotations }) {
    const encoder = new TextEncoder();
    const chunks = [];
    const offsets = [];
    let length = 0;
    const pushBytes = bytes => {
      chunks.push(bytes);
      length += bytes.length;
    };
    const pushText = text => pushBytes(encoder.encode(text));
    const writeObject = (number, parts) => {
      offsets[number] = length;
      pushText(`${number} 0 obj\n`);
      (Array.isArray(parts) ? parts : [parts]).forEach(part => typeof part === "string" ? pushText(part) : pushBytes(part));
      pushText("\nendobj\n");
    };
    const annotationStart = 6;
    const annotationRefs = annotations.map((_, index) => `${annotationStart + index} 0 R`).join(" ");
    pushText("%PDF-1.4\n%\u00ff\u00ff\u00ff\u00ff\n");
    writeObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
    writeObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    writeObject(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${RECEIPT_PAGE_WIDTH} ${RECEIPT_PAGE_HEIGHT}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R /Annots [${annotationRefs}] >>`);
    writeObject(4, [
      `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
      imageBytes,
      "\nendstream"
    ]);
    const content = `q\n${RECEIPT_PAGE_WIDTH} 0 0 ${RECEIPT_PAGE_HEIGHT} 0 0 cm\n/Im0 Do\nQ`;
    writeObject(5, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);
    annotations.forEach((annotation, index) => {
      const left = numberForPdf(annotation.left);
      const right = numberForPdf(annotation.right);
      const bottom = numberForPdf(RECEIPT_PAGE_HEIGHT - annotation.bottom);
      const top = numberForPdf(RECEIPT_PAGE_HEIGHT - annotation.top);
      writeObject(annotationStart + index, `<< /Type /Annot /Subtype /Link /Rect [${left} ${bottom} ${right} ${top}] /Border [0 0 0] /A << /S /URI /URI (${pdfString(annotation.uri)}) >> >>`);
    });
    const objectCount = annotationStart + annotations.length - 1;
    const xrefOffset = length;
    pushText(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
    for (let index = 1; index <= objectCount; index += 1) {
      pushText(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
    }
    pushText(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
    const pdfBytes = new Uint8Array(length);
    let offset = 0;
    chunks.forEach(chunk => {
      pdfBytes.set(chunk, offset);
      offset += chunk.length;
    });
    return new Blob([pdfBytes], { type: "application/pdf" });
  }

  function buildImagePagesPdf(pages) {
    const encoder = new TextEncoder();
    const chunks = [];
    const offsets = [];
    let length = 0;
    const safePages = pages.length ? pages : [];
    const pushBytes = bytes => {
      chunks.push(bytes);
      length += bytes.length;
    };
    const pushText = text => pushBytes(encoder.encode(text));
    const writeObject = (number, parts) => {
      offsets[number] = length;
      pushText(`${number} 0 obj\n`);
      (Array.isArray(parts) ? parts : [parts]).forEach(part => typeof part === "string" ? pushText(part) : pushBytes(part));
      pushText("\nendobj\n");
    };
    const pageObjectNumber = index => 3 + (index * 3);
    const imageObjectNumber = index => 4 + (index * 3);
    const contentObjectNumber = index => 5 + (index * 3);
    const kids = safePages.map((_, index) => `${pageObjectNumber(index)} 0 R`).join(" ");
    pushText("%PDF-1.4\n%\u00ff\u00ff\u00ff\u00ff\n");
    writeObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
    writeObject(2, `<< /Type /Pages /Kids [${kids}] /Count ${safePages.length} >>`);
    safePages.forEach((page, index) => {
      const pageObject = pageObjectNumber(index);
      const imageObject = imageObjectNumber(index);
      const contentObject = contentObjectNumber(index);
      writeObject(pageObject, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${RECEIPT_PAGE_WIDTH} ${RECEIPT_PAGE_HEIGHT}] /Resources << /XObject << /Im${index} ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`);
      writeObject(imageObject, [
        `<< /Type /XObject /Subtype /Image /Width ${page.imageWidth} /Height ${page.imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.imageBytes.length} >>\nstream\n`,
        page.imageBytes,
        "\nendstream"
      ]);
      const content = `q\n${RECEIPT_PAGE_WIDTH} 0 0 ${RECEIPT_PAGE_HEIGHT} 0 0 cm\n/Im${index} Do\nQ`;
      writeObject(contentObject, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);
    });
    const objectCount = 2 + (safePages.length * 3);
    const xrefOffset = length;
    pushText(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
    for (let index = 1; index <= objectCount; index += 1) {
      pushText(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
    }
    pushText(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
    const pdfBytes = new Uint8Array(length);
    let offset = 0;
    chunks.forEach(chunk => {
      pdfBytes.set(chunk, offset);
      offset += chunk.length;
    });
    return new Blob([pdfBytes], { type: "application/pdf" });
  }

  function numberForPdf(value) {
    return Number(value || 0).toFixed(2).replace(/\.00$/, "");
  }

  function pdfString(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }

  function cleanFilePart(value) {
    return String(value || "").replace(/[\\/:*?"<>|#]+/g, "_").replace(/\s+/g, "_");
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
        picture: profile.picture || "",
        profileFetchedAt: Date.now(),
        lastLoginAt: Date.now(),
        localOnly: false
      };
      recordUserActivity(email);
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

  async function refreshGoogleSessionProfile() {
    if (!sync.token || !session.email) return;
    const profileAge = Date.now() - Number(session.profileFetchedAt || 0);
    const needsProfile = !session.picture || !session.name || session.name.includes("@") || isDefaultBusinessName(session.name) || profileAge > 24 * 60 * 60 * 1000;
    if (!needsProfile) return;
    const profile = await fetchGoogleProfile().catch(() => ({}));
    const email = String(profile.email || session.email || "").trim().toLowerCase();
    if (session.email && email && email !== String(session.email).trim().toLowerCase()) return;
    session = {
      ...session,
      email: email || session.email,
      name: profile.name || session.name || email || "",
      picture: profile.picture || session.picture || "",
      profileFetchedAt: Date.now()
    };
    persistSession();
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
      if (manual) ui.screen = "data-backup";
      scheduleRender();
      return;
    }
    await refreshGoogleSessionProfile();
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
      businessProfile: mergeBusinessProfile(remote.businessProfile, local.businessProfile),
      adminControls: (local.adminControls.updatedAt || 0) >= (remote.adminControls.updatedAt || 0) ? local.adminControls : remote.adminControls,
      userActivity: uniqueBy([...remote.userActivity, ...local.userActivity], item => item.email || JSON.stringify(item)),
      deletedLedgerEntryKeys,
      deletedAdvanceRecordKeys
    };
  }

  function mergeBusinessProfile(remoteRaw, localRaw) {
    const remote = normalizeBusinessProfile(remoteRaw);
    const local = normalizeBusinessProfile(localRaw);
    const localLooksDefault = isDefaultBusinessProfile(local);
    const remoteLooksDefault = isDefaultBusinessProfile(remote);
    if (localLooksDefault && !remoteLooksDefault) return remote;
    if (remoteLooksDefault && !localLooksDefault) return local;
    const localHasCustomName = !isDefaultBusinessName(local.name);
    const remoteHasCustomName = !isDefaultBusinessName(remote.name);
    if (remoteHasCustomName && !localHasCustomName) return mergePreferredBusinessProfile(remote, local);
    if (localHasCustomName && !remoteHasCustomName) return mergePreferredBusinessProfile(local, remote);
    const pick = (remoteValue, localValue) => {
      const localText = String(localValue || "").trim();
      const remoteText = String(remoteValue || "").trim();
      if (!localText) return remoteText;
      if (!remoteText) return localText;
      if (localLooksDefault && localText !== remoteText) return remoteText;
      return localText;
    };
    return normalizeBusinessProfile({
      name: pick(remote.name, local.name),
      mobile: pick(remote.mobile, local.mobile),
      email: pick(remote.email, local.email),
      logoUri: pick(remote.logoUri, local.logoUri)
    });
  }

  function mergePreferredBusinessProfile(preferred, fallback) {
    return normalizeBusinessProfile({
      name: preferred.name || fallback.name || DEFAULT_BUSINESS_NAME,
      mobile: preferred.mobile || fallback.mobile,
      email: preferred.email || fallback.email,
      logoUri: preferred.logoUri || fallback.logoUri
    });
  }

  function isDefaultBusinessProfile(profile) {
    const name = String(profile && profile.name || "").trim();
    const mobile = onlyDigits(profile && profile.mobile || "");
    const email = String(profile && profile.email || "").trim().toLowerCase();
    const logo = String(profile && profile.logoUri || "").trim();
    const sessionEmail = String(session && session.email || "").trim().toLowerCase();
    const defaultName = isDefaultBusinessName(name);
    const defaultMobile = !mobile || mobile === INDIAN_STEEL_OWNER_MOBILE;
    const defaultEmail = !email || email === INDIAN_STEEL_BUSINESS_EMAIL || email === INDIAN_STEEL_RECEIPT_EMAIL || (sessionEmail && email === sessionEmail);
    const defaultLogo = isDefaultBusinessLogoUri(logo);
    return defaultName && defaultMobile && defaultEmail && defaultLogo;
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
    applyThemeMode();
    if (session.email) recordUserActivity(session.email);
    persistDriveConfig();
    sync.status = navigator.onLine ? "Ready" : "Offline ready";
    setupEntryDropdownDismissal();
    render();
    void loadReceiptAssets();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`./sw.js?v=${APP_BUILD_VERSION}`, { updateViaCache: "none" })
        .then(registration => registration.update().catch(() => {}))
        .catch(() => {});
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

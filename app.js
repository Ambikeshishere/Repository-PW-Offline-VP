/* ============================================================
   app.js — Core Sheet Directory Logic
   - Fetch sheets from Google Sheet CSV
   - Render pinned + all sheets
   - Search, filter, category detection
   - Cache system (localStorage)
   ============================================================ */

// ⚙️ CONFIG — Change these for your company
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQqRvkO6AYYd7Hy_zCIX7HCtWweznMdAKF4EVcYj50KuhzQtfxWszGNnU4BEe3tDB2uab8SvK8qGc5s/pub?output=csv";
const ALLOWED_DOMAIN = "@pw.live";

// 🔗 Pinned Sheets Sync — Web App URL (deploy your PinnedSync.gs on the Login sheet)
const PIN_API_URL = "https://script.google.com/macros/s/AKfycbztvhlhHBShWRQ-Zji_WEBmyxo8S1GBhJye82HUVoCWasnFGbOKaEabv8-Ih3RLubSjlQ/exec";

let currentUser = localStorage.getItem("loggedUser");
let allSheets = [];
let currentFilter = "all";
let pendingFilter = null;

// In-memory pin cache — synced with server on load
let pinnedCache = null;

// ===== ANTI-INSPECT — logout on DevTools open =====
(function antiDevTools() {
  function logoutNow() {
    localStorage.removeItem("loggedUser");
    window.location.href = "login.html";
  }

  // 1. Block keyboard shortcuts for DevTools
  document.addEventListener("keydown", function (e) {
    // F12
    if (e.key === "F12"
      // Ctrl+Shift+I / Cmd+Opt+I (Inspect)
      || (e.ctrlKey && e.shiftKey && e.key === "I")
      || (e.metaKey && e.altKey && e.key === "I")
      // Ctrl+Shift+J / Cmd+Opt+J (Console)
      || (e.ctrlKey && e.shiftKey && e.key === "J")
      || (e.metaKey && e.altKey && e.key === "J")
      // Ctrl+Shift+C / Cmd+Opt+C (Inspect Element)
      || (e.ctrlKey && e.shiftKey && e.key === "C")
      || (e.metaKey && e.altKey && e.key === "C")
      // Ctrl+U / Cmd+U (View Source)
      || ((e.ctrlKey || e.metaKey) && e.key === "U")
    ) {
      e.preventDefault();
      logoutNow();
      return false;
    }
  });

  // 2. Block right-click — no context menu, no logout
  document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
    return false;
  });

  // 3. Periodic checker — detects DevTools via debugger trick
  let devtoolsDetected = false;
  function checkDevTools() {
    if (devtoolsDetected) return;
    const start = performance.now();
    // debugger statement pauses execution when DevTools is open
    debugger;
    const elapsed = performance.now() - start;
    // If DevTools is open, debugger pauses → elapsed will be > ~100ms
    if (elapsed > 100) {
      devtoolsDetected = true;
      logoutNow();
    }
  }
  // Check every 2 seconds
  setInterval(checkDevTools, 2000);
  // Also check immediately
  setTimeout(checkDevTools, 500);
})();

// ===== FETCH SHEETS =====
async function fetchSheets() {
  // Load pinned sheets from server first (or localStorage fallback)
  await loadPinned();

  // Try cache first
  const cached = loadFromCache();
  if (cached) {
    allSheets = cached;
    updateUI();
    console.log("⚡ Loaded from cache");
    // Background refresh
    setTimeout(fetchSheetsFromAPI, 2000);
    return;
  }

  showSkeletons();
  await fetchSheetsFromAPI();
}

// Force refresh — clears cache and re-fetches
async function refreshSheets() {
  localStorage.removeItem("companySheetsCache");
  localStorage.removeItem("companySheetsCacheTime");
  const btn = document.querySelector(".refresh-btn");
  if (btn) btn.classList.add("spin");
  showSkeletons();
  await fetchSheetsFromAPI();
  setTimeout(() => {
    if (btn) btn.classList.remove("spin");
  }, 800);
}

async function fetchSheetsFromAPI() {
  try {
    const res = await fetch(CSV_URL + "&t=" + Date.now());
    const text = await res.text();
    const rows = text.split("\n").slice(1).filter(r => r.trim());

    allSheets = rows.map(row => {
      const cols = parseCSVRow(row);
      return {
        name: cols[0]?.trim() || "Untitled",
        openLink: cols[1]?.trim() || "",
        owner: cols[2]?.trim() || "",
        lastModified: cols[3]?.trim() || "",
        lastModifiedDate: cols[4]?.trim() || "",
        webLink: cols[5]?.trim() || cols[1]?.trim() || ""
      };
    }).filter(s => s.name && s.webLink);

    saveToCache(allSheets);
    updateUI();
    console.log("🌐 Fetched from API");
  } catch (err) {
    console.error("Error fetching sheets:", err);
    document.getElementById("sheetList").innerHTML = `
      <div class="empty-state">
        <p>Failed to load sheets. Please refresh.</p>
      </div>`;
  }
}

function updateUI() {
  document.getElementById("sheetCount").innerText = allSheets.length + " sheets";
  if (pendingFilter) {
    setFilter(pendingFilter);
    pendingFilter = null;
  }
  renderSheets(allSheets);
}

// ===== CSV PARSER =====
function parseCSVRow(row) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ""; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

// ===== RENDER =====
function renderSheets(sheets) {
  const pinned = getPinned();
  const pinnedSheets = sheets.filter(s => pinned.includes(s.name));
  const unpinnedSheets = sheets.filter(s => !pinned.includes(s.name));

  const pinnedSection = document.getElementById("pinnedSection");
  if (currentFilter !== "all" && currentFilter !== "pinned") {
    pinnedSection.style.display = "none";
  } else {
    pinnedSection.style.display = "block";
    renderPinned(pinnedSheets);
  }

  renderList(unpinnedSheets);
  document.getElementById("allCount").innerText = unpinnedSheets.length + " sheets";
}

function renderPinned(sheets) {
  const container = document.getElementById("pinnedContainer");
  const empty = document.getElementById("pinnedEmpty");
  container.innerHTML = "";

  if (sheets.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  sheets.forEach((sheet) => {
    const cat = detectCategory(sheet.name);
    const borderColor = cat ? cat.color : "var(--accent)";
    const catBadge = cat ? `<span class="cat-badge" style="background:${cat.color}22; color:${cat.color}; border-color:${cat.color}44">${cat.icon} ${cat.label}</span>` : "";

    const card = document.createElement("div");
    card.className = "pinned-card";
    card.style.borderTopColor = borderColor;
    card.innerHTML = `
      <div class="pinned-card-icon" style="color:${borderColor}">${sheetsIcon(20)}</div>
      <div class="pinned-card-name">${escapeHTML(sheet.name)}</div>
      <div class="tile-badges">${catBadge}</div>
      <div class="sheet-meta">
        ${sheet.owner ? `<span class="meta-item">👤 ${escapeHTML(sheet.owner)}</span>` : ""}
        ${sheet.lastModifiedDate ? `<span class="meta-item">🗓 ${escapeHTML(sheet.lastModifiedDate)}</span>` : ""}
      </div>
      <div class="pinned-card-footer">
        <span class="pinned-open">Open ↗</span>
        <button class="unpin-btn" onclick="event.stopPropagation(); togglePin('${escapeAttr(sheet.name)}')">Unpin</button>
      </div>
    `;
    card.addEventListener("click", () => openSheet(sheet.webLink));
    container.appendChild(card);
  });
}

function renderList(sheets) {
  const list = document.getElementById("sheetList");
  const empty = document.getElementById("listEmpty");
  const allSection = document.querySelector(".section:not(#pinnedSection)");
  list.innerHTML = "";

  if (currentFilter === "pinned") {
    allSection.style.display = "none";
    return;
  }
  allSection.style.display = "block";
  if (sheets.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  sheets.forEach((sheet) => {
    const cat = detectCategory(sheet.name);
    const catBadge = cat ? `<span class="cat-badge" style="background:${cat.color}22; color:${cat.color}; border-color:${cat.color}44">${cat.icon} ${cat.label}</span>` : "";
    const borderColor = cat ? cat.color : "rgba(255,255,255,0.08)";
    const iconBg = cat ? `${cat.color}22` : "rgba(255,255,255,0.06)";

    const item = document.createElement("div");
    item.className = "sheet-tile";
    item.style.borderLeftColor = borderColor;
    item.innerHTML = `
      <div class="tile-top">
        <div class="tile-icon" style="background:${iconBg}">${sheetsIcon(18)}</div>
        <div class="tile-actions">
          <button class="open-btn" onclick="event.stopPropagation(); openSheet('${escapeAttr(sheet.webLink)}')">Open ↗</button>
          <button class="pin-btn" onclick="event.stopPropagation(); togglePin('${escapeAttr(sheet.name)}')">📌</button>
        </div>
      </div>
      <div class="tile-name" title="${escapeAttr(sheet.name)}">${escapeHTML(sheet.name)}</div>
      <div class="tile-badges">${catBadge}</div>
      <div class="tile-meta">
        ${sheet.owner ? `<span class="meta-item">👤 ${escapeHTML(sheet.owner)}</span>` : ""}
        ${sheet.lastModifiedDate ? `<span class="meta-item">🗓 ${escapeHTML(sheet.lastModifiedDate)}</span>` : ""}
      </div>
    `;
    item.addEventListener("click", () => openSheet(sheet.webLink));
    list.appendChild(item);
  });
}

// ===== CATEGORY DETECTION =====
function detectCategory(name) {
  const n = name.toLowerCase();
  if (n.includes("sales") || n.includes("pipeline"))
                                return { label: "Sales",         icon: "📈", color: "#8b5cf6" };
  if (n.includes("marketing") || n.includes("campaign"))
                                return { label: "Marketing",     icon: "📣", color: "#fb923c" };
  if (n.includes("acads") || n.includes("academic"))
                                return { label: "Acads",         icon: "📚", color: "#14b8a6" };
  if (n.includes("advertise") || n.includes("advertisement"))
                                return { label: "Advertisement", icon: "📢", color: "#f97316" };
  if (n.includes("offline"))
                                return { label: "Offline Gen",   icon: "🏫", color: "#6366f1" };
  if (n.includes("ops") || n.includes("operation"))
                                return { label: "Operations",    icon: "⚙️", color: "#0ea5e9" };
  if (n.includes("hr") || n.includes("employee"))
                                return { label: "HR",            icon: "👥", color: "#eab308" };
  if (n.includes("video") || n.includes("lecture") || n.includes("tutorial"))
                                return { label: "Video",         icon: "🎬", color: "#ec4899" };
  return null;
}

// ===== PINNING — Cross-device sync via Google Sheet =====

/** Load current user's pinned sheets from server + merge with localStorage */
async function loadPinned() {
  if (!currentUser) { pinnedCache = []; return; }

  let serverPins = null;

  // Try server first
  if (PIN_API_URL && !PIN_API_URL.startsWith("PUT_YOUR")) {
    try {
      const url = PIN_API_URL + "?email=" + encodeURIComponent(currentUser) + "&t=" + Date.now();
      const res = await fetch(url);
      const data = await res.json();
      if (data && Array.isArray(data.pins)) {
        serverPins = data.pins;
        console.log("📌 Pins synced from server:", serverPins.length);
      }
    } catch (err) {
      console.warn("⚠️ Pin server unreachable, will use localStorage");
    }
  }

  // Always also check localStorage (in case last POST failed)
  let localPins = [];
  try {
    const local = JSON.parse(localStorage.getItem("pinnedSheets")) || {};
    localPins = local[currentUser] || [];
  } catch {}

  // Merge: start with server pins, append any extra local-only pins
  if (serverPins) {
    pinnedCache = [...serverPins];
    for (const pin of localPins) {
      if (!pinnedCache.includes(pin)) {
        pinnedCache.push(pin);
      }
    }
    // If we found extra local pins, push them up to server
    if (pinnedCache.length > serverPins.length) {
      console.log("📌 Found un-synced local pins, pushing to server");
      fetch(PIN_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUser, pins: pinnedCache })
      }).catch(() => {});
    }
  } else {
    pinnedCache = localPins;
  }
}

/** Return cached pinned sheet names (synchronous — use after loadPinned) */
function getPinned() {
  return pinnedCache || [];
}

/** Sync pins to server and update UI */
async function togglePin(name) {
  const current = getPinned();
  let msg;

  if (current.includes(name)) {
    pinnedCache = current.filter(s => s !== name);
    msg = "📌 Unpinned";
  } else {
    pinnedCache = [...current, name];
    msg = "📌 Pinned!";
  }

  // Always save to localStorage as backup
  try {
    const data = JSON.parse(localStorage.getItem("pinnedSheets")) || {};
    data[currentUser] = pinnedCache;
    localStorage.setItem("pinnedSheets", JSON.stringify(data));
  } catch {}

  // Try server sync via POST (matches doPost in your Apps Script)
  let synced = false;
  if (PIN_API_URL && !PIN_API_URL.startsWith("PUT_YOUR")) {
    try {
      const res = await fetch(PIN_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUser, pins: pinnedCache })
      });
      if (res.ok) synced = true;
    } catch (err) {
      console.warn("⚠️ Pin server sync failed — saved locally only");
    }
  }

  showToast(msg + (synced ? " ☁️" : " 💾"));
  renderSheets(allSheets);
}

// ===== OPEN SHEET =====
function openSheet(link) {
  if (link) window.open(link, "_blank");
}

// ===== LOGOUT =====
function logout() {
  localStorage.removeItem("loggedUser");
  window.location.href = "login.html";
}

// ===== SEARCH & FILTER CLICK HANDLERS =====
function attachFilterHandlers() {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", function() {
      const query = this.value.toLowerCase().trim();
      let sheets = [...allSheets];

      if (currentFilter !== "all" && currentFilter !== "pinned") {
        sheets = sheets.filter(s => s.name.toLowerCase().includes(currentFilter.toLowerCase()));
      } else if (currentFilter === "pinned") {
        const pinned = getPinned();
        sheets = sheets.filter(s => pinned.includes(s.name));
      }

      if (query) {
        sheets = sheets.filter(s => s.name.toLowerCase().includes(query));
      }
      renderSheets(sheets);
    });
  }

  document.querySelectorAll(".menu-item:not(.has-sub)").forEach(item => {
    item.addEventListener("click", function() {
      if (this.dataset.filter) setFilter(this.dataset.filter);
    });
  });
  document.querySelectorAll(".sub-item").forEach(item => {
    item.addEventListener("click", function(e) {
      e.stopPropagation();
      setFilter(this.dataset.filter);
    });
  });
}

// Run after DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", attachFilterHandlers);
} else {
  attachFilterHandlers();
}

// ===== SIDEBAR FILTER =====
function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll(".menu-item").forEach(i => i.classList.remove("active"));
  document.querySelectorAll(".sub-item").forEach(i => i.classList.remove("active"));

  const matched = document.querySelector(`[data-filter="${filter}"]`);
  if (matched) matched.classList.add("active");

  const titles = {
    all: "Sheet Repository", pinned: "Pinned Sheets",
    sales: "Sales", marketing: "Marketing",
    acads: "Acads", advertisement: "Advertisement",
    offline: "Offline Gen", ops: "Operations", hr: "HR",
    video: "Videos"
  };
  const titleEl = document.querySelector(".page-title");
  if (titleEl) titleEl.innerText = titles[filter] || "Sheet Repository";

  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";

  applyFilter();
}

function applyFilter() {
  if (allSheets.length === 0) {
    pendingFilter = currentFilter;
    return;
  }
  let sheets = [...allSheets];
  if (currentFilter === "all") { renderSheets(sheets); return; }
  if (currentFilter === "pinned") {
    const pinned = getPinned();
    renderSheets(sheets.filter(s => pinned.includes(s.name)));
    return;
  }
  const keyword = currentFilter.toLowerCase();
  renderSheets(sheets.filter(s => s.name.toLowerCase().includes(keyword)));
}

// ===== SKELETON LOADING =====
function showSkeletons() {
  const list = document.getElementById("sheetList");
  if (list) {
    list.innerHTML = Array(6).fill(0).map(() =>
      `<div class="loading-skeleton"></div>`
    ).join("");
  }
}

// ===== TOAST =====
function showToast(msg) {
  const toast = document.getElementById("toast");
  if (toast) {
    toast.innerText = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
  }
}

// ===== HELPERS =====
function escapeHTML(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escapeAttr(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, "&quot;");
}
function sheetsIcon(size) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const bg = isDark ? '#2e7d32' : '#34a853';
  const text = isDark ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.9)';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="20" height="20" rx="3" fill="${bg}"/>
    <path d="M6 7h12v1.5H6zM6 10h12v1.5H6zM6 13h12v1.5H6zM6 16h8v1.5H6z" fill="${text}"/>
    <rect x="6" y="7" width="1.5" height="10.5" fill="rgba(255,255,255,0.2)"/>
    <rect x="16.5" y="7" width="1.5" height="10.5" fill="rgba(255,255,255,0.2)"/>
  </svg>`;
}

// ===== CACHE =====
function loadFromCache() {
  const cache = localStorage.getItem("companySheetsCache");
  const cacheTime = localStorage.getItem("companySheetsCacheTime");
  if (!cache || !cacheTime) return null;
  if (Date.now() - Number(cacheTime) > 5 * 60 * 1000) return null;
  return JSON.parse(cache);
}
function saveToCache(data) {
  localStorage.setItem("companySheetsCache", JSON.stringify(data));
  localStorage.setItem("companySheetsCacheTime", Date.now());
}

// ===== THEME =====
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('companyTheme', theme);
  document.querySelectorAll('.theme-btn, .home-theme-btn, .theme-dot').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
  // Re-render sheet icons with new theme colors
  if (allSheets.length > 0) renderSheets(allSheets);
}

// Apply saved theme on load
(function() {
  const saved = localStorage.getItem('companyTheme') || 'charcoal';
  document.documentElement.setAttribute('data-theme', saved);
  // Mark active theme dot on load
  document.querySelectorAll('.theme-dot').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === saved);
  });
})();

// ===== USER BOX DROPDOWN =====
function toggleUserMenu() {
  const dropdown = document.getElementById("userDropdown");
  const chevron = document.getElementById("userChevron");
  if (dropdown) {
    dropdown.classList.toggle("open");
    if (chevron) chevron.classList.toggle("open");
  }
}

// Close dropdown on outside click
document.addEventListener("click", function(e) {
  const box = document.querySelector(".nav-user-box");
  const dropdown = document.getElementById("userDropdown");
  if (box && dropdown && !box.contains(e.target)) {
    dropdown.classList.remove("open");
    const chevron = document.getElementById("userChevron");
    if (chevron) chevron.classList.remove("open");
  }
});

// ===== ABOUT MODAL =====
function showAbout() {
  document.getElementById("aboutModal").classList.add("open");
  // Close user dropdown
  const dd = document.getElementById("userDropdown");
  if (dd) dd.classList.remove("open");
}
function hideAbout(e) {
  document.getElementById("aboutModal").classList.remove("open");
}

// Set user email in sidebar
(function() {
  const user = localStorage.getItem("loggedUser");
  if (user) {
    const emailEls = document.querySelectorAll("#dropdownUserEmail");
    emailEls.forEach(el => { if (el) el.innerText = user; });
    const nameEl = document.getElementById("dropdownUserName");
    if (nameEl) nameEl.innerText = user.split("@")[0] || "User";
  }
})();

// ===== MOBILE NAV TOGGLE =====
function toggleMobileNav() {
  const navCenter = document.getElementById("navCenter");
  const backdrop = document.getElementById("navBackdrop");
  if (navCenter) navCenter.classList.toggle("open");
  if (backdrop) backdrop.classList.toggle("show");
}

// ===== PW LOGO DOODLE WALLPAPER =====
function createDoodles() {
  const container = document.getElementById('bgDoodles');
  if (!container || container.querySelector('img')) return;
  
  const logoUrl = 'https://upload.wikimedia.org/wikipedia/commons/d/dd/Physics_wallah_logo.svg';
  const count = 50;
  
  for (let i = 0; i < count; i++) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position: fixed;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      animation: doodleFloat ${25 + Math.random() * 30}s ease-in-out infinite;
      animation-delay: ${Math.random() * -30}s;
      pointer-events: none;
      z-index: 0;
    `;

    const img = document.createElement('img');
    img.className = 'doodle-img';
    img.src = logoUrl;
    img.style.cssText = `
      width: ${16 + Math.random() * 35}px;
      height: auto;
      transform: rotate(${Math.random() * 360}deg);
      display: block;
      pointer-events: none;
      user-select: none;
    `;
    img.setAttribute('loading', 'lazy');
    img.setAttribute('alt', '');
    wrapper.appendChild(img);
    container.appendChild(wrapper);
  }
}

// Auto-init doodles (run when DOM is ready)
if (document.readyState === "loading") {
  document.addEventListener('DOMContentLoaded', createDoodles);
} else {
  createDoodles();
}

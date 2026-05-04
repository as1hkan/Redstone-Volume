// ── ELEMENTS ──
const slider = document.getElementById("volume-slider");
const volumeNumber = document.getElementById("volume-number");
const volumeIcon = document.getElementById("volume-icon");
const resetBtn = document.getElementById("reset-btn");
const activeCountEl = document.getElementById("active-count");
const activeTabsList = document.getElementById("active-tabs-list");
const dot1 = document.getElementById("dot1");
const dot2 = document.getElementById("dot2");
const dot3 = document.getElementById("dot3");
const visualizerCanvas = document.getElementById("visualizer-canvas");
const visualizerToggle = document.getElementById("visualizer-toggle");
const ctx2d = visualizerCanvas.getContext("2d");

let currentTabId = null;
let currentTabUrl = null;

// ── EQ PRESETS (3-band) ──
const PRESETS = {
  flat:  { bass: 0,  mid: 0,  treble: 0  },
  bass:  { bass: 8,  mid: -2, treble: -2 },
  voice: { bass: -4, mid: 6,  treble: 2  },
  night: { bass: -6, mid: 2,  treble: -8 },
};
let currentPreset = "flat";

// ── 10-BAND EQ ──
const EQ_BANDS_LABELS = ["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];
const EQ10_PRESETS = {
  flat:       [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  rock:       [4, 3, 0, -1, -3, 0, 2, 4, 5, 5],
  pop:        [-1, 0, 2, 4, 5, 4, 2, 0, -1, -1],
  classical:  [4, 3, 2, 0, -1, 0, 0, 2, 3, 4],
  electronic: [5, 4, 1, 0, -2, 2, 1, 3, 4, 5],
  custom:     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};
let eq10Values = [...EQ10_PRESETS.flat];
let eq10Enabled = false;
let currentEQ10Preset = "flat";

// ── COLLAPSIBLE SECTIONS ──
document.querySelectorAll(".collapsible-header").forEach((header) => {
  header.addEventListener("click", (e) => {
    // Don't toggle if clicking on toggle switch
    if (e.target.closest(".toggle-switch")) return;
    const section = header.closest(".collapsible-section");
    const bodyId = header.dataset.target;
    const body = document.getElementById(bodyId);
    if (!body) return;
    const isOpen = section.classList.toggle("open");
    body.classList.toggle("collapsed", !isOpen);
  });
});

// ── UI UPDATE ──
function setVolumeUI(volume) {
  slider.value = volume;
  volumeNumber.textContent = volume;
  const pct = (Math.max(0, Math.min(200, volume)) / 200) * 100;
  slider.style.background = `linear-gradient(90deg, rgba(255,26,26,0.85) ${pct}%, rgba(255,26,26,0.1) ${pct}%)`;
  if (volume <= 0) volumeIcon.src = "volumeMute.png";
  else if (volume < 100) volumeIcon.src = "volumeDown.png";
  else volumeIcon.src = "volumeUp.png";
  document.body.classList.remove("vol-muted", "vol-boosted");
  if (volume <= 0) document.body.classList.add("vol-muted");
  else if (volume > 100) document.body.classList.add("vol-boosted");
  [dot1, dot2, dot3].forEach((d) => d.classList.remove("active", "pulse"));
  if (volume > 0) dot1.classList.add("active");
  if (volume >= 50) dot2.classList.add("active");
  if (volume >= 100) dot3.classList.add("active");
  if (volume > 150) dot3.classList.add("pulse");
  document.querySelectorAll(".qbtn[data-vol]").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.vol) === volume);
  });
}

// ── STORAGE ──
async function saveVolume(tabId, volume) {
  await chrome.storage.local.set({ [`vol_${tabId}`]: volume });
}
async function loadVolume(tabId) {
  const data = await chrome.storage.local.get(`vol_${tabId}`);
  return typeof data[`vol_${tabId}`] === "number" ? data[`vol_${tabId}`] : 100;
}

// ── APPLY VOLUME ──
async function applyVolume(volume) {
  if (!currentTabId) return;
  setVolumeUI(volume);
  await saveVolume(currentTabId, volume);
  try {
    await chrome.runtime.sendMessage({
      type: "SET_VOLUME",
      tabId: currentTabId,
      volume,
      url: currentTabUrl,
    });
  } catch (e) { console.warn("SET_VOLUME failed:", e); }
  refreshActiveTabsList();
}

// ── 3-BAND EQ PRESETS ──
async function applyPresetEQ(presetKey) {
  currentPreset = presetKey;
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.preset === presetKey);
  });
  if (!currentTabId) return;
  const preset = PRESETS[presetKey];
  try {
    await chrome.runtime.sendMessage({
      target: "offscreen", type: "APPLY_PRESET",
      tabId: currentTabId, preset,
    });
  } catch (e) { console.warn("APPLY_PRESET failed:", e); }
  chrome.storage.local.set({ [`preset_${currentTabId}`]: presetKey });
}

// ── 10-BAND EQ ──
function buildEQ10Bands() {
  const container = document.getElementById("eq10-bands");
  container.innerHTML = "";
  EQ_BANDS_LABELS.forEach((label, i) => {
    const band = document.createElement("div");
    band.className = "eq10-band";
    band.innerHTML = `
      <div class="eq10-val" id="eq10-val-${i}">0</div>
      <div class="eq10-fader-wrap">
        <input type="range" class="eq10-fader" id="eq10-fader-${i}"
          min="-12" max="12" step="0.5" value="0"
          orient="vertical">
      </div>
      <div class="eq10-label">${label}</div>
    `;
    container.appendChild(band);
    const fader = band.querySelector(".eq10-fader");
    fader.addEventListener("input", () => {
      const val = parseFloat(fader.value);
      eq10Values[i] = val;
      document.getElementById(`eq10-val-${i}`).textContent = (val >= 0 ? "+" : "") + val;
      // Mark as custom
      setEQ10Preset("custom", false);
      if (eq10Enabled) sendEQ10();
    });
  });
}

function setEQ10Preset(key, sendUpdate = true) {
  currentEQ10Preset = key;
  document.querySelectorAll(".eq10-preset-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.eq10 === key);
  });
  if (key !== "custom") {
    eq10Values = [...EQ10_PRESETS[key]];
    EQ_BANDS_LABELS.forEach((_, i) => {
      const fader = document.getElementById(`eq10-fader-${i}`);
      const valEl = document.getElementById(`eq10-val-${i}`);
      if (fader) fader.value = eq10Values[i];
      if (valEl) valEl.textContent = (eq10Values[i] >= 0 ? "+" : "") + eq10Values[i];
    });
  }
  if (sendUpdate && eq10Enabled) sendEQ10();
  if (currentTabId) {
    chrome.storage.local.set({
      [`eq10_${currentTabId}`]: eq10Values,
      [`eq10preset_${currentTabId}`]: key,
    });
  }
}

async function sendEQ10() {
  if (!currentTabId) return;
  try {
    await chrome.runtime.sendMessage({
      target: "offscreen", type: "APPLY_EQ",
      tabId: currentTabId, bands: eq10Values,
    });
  } catch (e) { console.warn("APPLY_EQ failed:", e); }
}

async function resetEQ10() {
  setEQ10Preset("flat");
  if (!eq10Enabled) return;
  // Send flat
  const flat = new Array(10).fill(0);
  try {
    await chrome.runtime.sendMessage({
      target: "offscreen", type: "APPLY_EQ",
      tabId: currentTabId, bands: flat,
    });
  } catch (_) {}
}

const eq10Toggle = document.getElementById("eq10-toggle");
eq10Toggle.addEventListener("change", async () => {
  eq10Enabled = eq10Toggle.checked;
  chrome.storage.local.set({ eq10Enabled });
  if (eq10Enabled) {
    await sendEQ10();
  } else {
    // Reset to flat
    try {
      await chrome.runtime.sendMessage({
        target: "offscreen", type: "APPLY_EQ",
        tabId: currentTabId, bands: new Array(10).fill(0),
      });
    } catch (_) {}
  }
});

document.querySelectorAll(".eq10-preset-btn").forEach((btn) => {
  btn.addEventListener("click", () => setEQ10Preset(btn.dataset.eq10));
});
document.getElementById("eq10-reset").addEventListener("click", resetEQ10);

// ── NOISE GATE ──
const noiseGateToggle = document.getElementById("noisegate-toggle");
const noiseGateThresholdSlider = document.getElementById("noisegate-threshold");
const noiseGateThresholdVal = document.getElementById("noisegate-threshold-val");

noiseGateThresholdSlider.addEventListener("input", () => {
  const val = noiseGateThresholdSlider.value;
  noiseGateThresholdVal.textContent = `${val}dB`;
  if (noiseGateToggle.checked) sendNoiseGate();
});

noiseGateToggle.addEventListener("change", () => {
  sendNoiseGate();
  chrome.storage.local.set({ noiseGateEnabled: noiseGateToggle.checked });
});

async function sendNoiseGate() {
  if (!currentTabId) return;
  try {
    await chrome.runtime.sendMessage({
      target: "offscreen", type: "SET_NOISE_GATE",
      tabId: currentTabId,
      enabled: noiseGateToggle.checked,
      threshold: parseFloat(noiseGateThresholdSlider.value),
    });
  } catch (e) { console.warn("SET_NOISE_GATE failed:", e); }
}

// ── FADE ──
const fadeDurationSlider = document.getElementById("fade-duration");
const fadeDurationVal = document.getElementById("fade-duration-val");
fadeDurationSlider.addEventListener("input", () => {
  fadeDurationVal.textContent = (fadeDurationSlider.value / 1000).toFixed(1) + "s";
});

document.getElementById("fade-in-btn").addEventListener("click", async () => {
  if (!currentTabId) return;
  const duration = parseInt(fadeDurationSlider.value);
  const current = parseInt(slider.value);
  await chrome.runtime.sendMessage({
    type: "FADE_VOLUME", tabId: currentTabId,
    fromVol: 0, toVol: current || 100, durationMs: duration,
  });
});

document.getElementById("fade-out-btn").addEventListener("click", async () => {
  if (!currentTabId) return;
  const duration = parseInt(fadeDurationSlider.value);
  const current = parseInt(slider.value);
  await chrome.runtime.sendMessage({
    type: "FADE_VOLUME", tabId: currentTabId,
    fromVol: current, toVol: 0, durationMs: duration,
  });
});

// ── SLEEP TIMER ──
const sleepMinutesSlider = document.getElementById("sleep-minutes");
const sleepMinutesVal = document.getElementById("sleep-minutes-val");
const sleepSetBtn = document.getElementById("sleep-set-btn");
const sleepClearBtn = document.getElementById("sleep-clear-btn");
const sleepCountdown = document.getElementById("sleep-countdown");
const sleepStatus = document.getElementById("sleep-status");
let sleepCountdownInterval = null;

sleepMinutesSlider.addEventListener("input", () => {
  sleepMinutesVal.textContent = sleepMinutesSlider.value + "m";
});

sleepSetBtn.addEventListener("click", async () => {
  if (!currentTabId) return;
  const minutes = parseInt(sleepMinutesSlider.value);
  await chrome.runtime.sendMessage({ type: "SET_SLEEP_TIMER", tabId: currentTabId, minutes });
  startSleepCountdown(Date.now() + minutes * 60 * 1000);
  sleepClearBtn.disabled = false;
  sleepStatus.textContent = "●";
  sleepStatus.style.color = "var(--red)";
});

sleepClearBtn.addEventListener("click", async () => {
  if (!currentTabId) return;
  await chrome.runtime.sendMessage({ type: "CLEAR_SLEEP_TIMER", tabId: currentTabId });
  clearSleepCountdown();
});

function startSleepCountdown(fireAt) {
  clearSleepCountdown();
  sleepCountdownInterval = setInterval(() => {
    const remaining = fireAt - Date.now();
    if (remaining <= 0) {
      clearSleepCountdown();
      sleepCountdown.textContent = "SLEEP ACTIVATED";
      return;
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    sleepCountdown.textContent = `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")} REMAINING`;
  }, 1000);
}

function clearSleepCountdown() {
  if (sleepCountdownInterval) { clearInterval(sleepCountdownInterval); sleepCountdownInterval = null; }
  sleepCountdown.textContent = "";
  sleepClearBtn.disabled = true;
  sleepStatus.textContent = "";
}

// ── AUTO-DUCK ──
const autoDuckToggle = document.getElementById("autoduck-toggle");
const autoDuckAmountSlider = document.getElementById("autoduck-amount");
const autoDuckAmountVal = document.getElementById("autoduck-amount-val");
const autoDuckSourceSelect = document.getElementById("autoduck-source-select");

autoDuckAmountSlider.addEventListener("input", () => {
  autoDuckAmountVal.textContent = autoDuckAmountSlider.value + "%";
  saveAutoDuckSettings();
});

autoDuckToggle.addEventListener("change", () => {
  saveAutoDuckSettings();
});

autoDuckSourceSelect.addEventListener("change", () => {
  saveAutoDuckSettings();
});

async function saveAutoDuckSettings() {
  const sourceTabId = autoDuckSourceSelect.value ? parseInt(autoDuckSourceSelect.value) : null;
  await chrome.storage.local.set({
    autoDuckEnabled: autoDuckToggle.checked,
    autoDuckAmount: parseInt(autoDuckAmountSlider.value),
    autoDuckSourceTabId: sourceTabId,
  });
}

async function populateAutoDuckSelect() {
  const tabs = await chrome.tabs.query({});
  autoDuckSourceSelect.innerHTML = '<option value="">— Select tab —</option>';
  tabs.forEach((tab) => {
    const opt = document.createElement("option");
    opt.value = tab.id;
    opt.textContent = (tab.title || "Tab").substring(0, 40);
    if (tab.id === currentTabId) opt.textContent += " (current)";
    autoDuckSourceSelect.appendChild(opt);
  });
  // Restore saved
  const d = await chrome.storage.local.get(["autoDuckSourceTabId", "autoDuckEnabled", "autoDuckAmount"]);
  if (d.autoDuckSourceTabId) autoDuckSourceSelect.value = d.autoDuckSourceTabId;
  if (typeof d.autoDuckEnabled === "boolean") autoDuckToggle.checked = d.autoDuckEnabled;
  if (typeof d.autoDuckAmount === "number") {
    autoDuckAmountSlider.value = d.autoDuckAmount;
    autoDuckAmountVal.textContent = d.autoDuckAmount + "%";
  }
}

// ── PER-SITE MEMORY ──
const siteMemToggle = document.getElementById("sitemem-toggle");
siteMemToggle.addEventListener("change", () => {
  chrome.storage.local.set({ siteMemoryEnabled: siteMemToggle.checked });
});
document.getElementById("sitemem-clear-btn").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "CLEAR_SITE_MEMORY" });
  const btn = document.getElementById("sitemem-clear-btn");
  btn.textContent = "CLEARED!";
  setTimeout(() => { btn.textContent = "CLEAR ALL SITE DATA"; }, 1500);
});

// ── TAB SYNC ──
let allOpenTabs = [];
let selectedSyncTabIds = new Set();
let currentSyncGroupId = null;

async function buildTabSyncList() {
  const syncList = document.getElementById("tabsync-list");
  const tabSyncStatus = document.getElementById("tabsync-status");
  const leaveBtn = document.getElementById("tabsync-leave-btn");

  allOpenTabs = await chrome.tabs.query({});
  syncList.innerHTML = "";

  let res;
  try { res = await chrome.runtime.sendMessage({ type: "GET_SYNC_GROUPS" }); } catch (_) { res = null; }
  const groups = res?.groups ?? {};
  currentSyncGroupId = null;
  for (const [groupId, tabIds] of Object.entries(groups)) {
    if (tabIds.includes(currentTabId)) {
      currentSyncGroupId = groupId;
      break;
    }
  }
  const syncedTabIds = currentSyncGroupId
    ? new Set(groups[currentSyncGroupId] || [])
    : new Set();

  if (currentSyncGroupId) {
    tabSyncStatus.textContent = `In sync group (${syncedTabIds.size} tabs)`;
    leaveBtn.disabled = false;
  } else {
    tabSyncStatus.textContent = "Not in a group";
    leaveBtn.disabled = true;
  }

  allOpenTabs.forEach((tab) => {
    if (tab.id === currentTabId) return;

    const isSynced = syncedTabIds.has(tab.id);
    if (isSynced) selectedSyncTabIds.add(tab.id);

    // Outer item
    const item = document.createElement("div");
    item.className = "tabsync-item" + (isSynced ? " checked synced" : "");

    // Custom checkbox wrapper
    const cbWrap = document.createElement("div");
    cbWrap.className = "cb-wrap";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = isSynced;
    cb.dataset.tabId = tab.id;

    const cbBox = document.createElement("div");
    cbBox.className = "cb-box";

    cbWrap.appendChild(cb);
    cbWrap.appendChild(cbBox);

    // Favicon placeholder (first letter of domain)
    const favicon = document.createElement("div");
    favicon.className = "tab-favicon";
    try {
      favicon.textContent = new URL(tab.url || "").hostname[0].toUpperCase();
    } catch (_) {
      favicon.textContent = "?";
    }

    // Title
    const title = document.createElement("span");
    title.className = "tabsync-item-title";
    title.textContent = (tab.title || "Tab").substring(0, 30);

    // Badge
    const badge = document.createElement("span");
    badge.className = "tab-badge";
    badge.textContent = isSynced ? "SYNCED" : "TAB";
    badge.dataset.orig = "TAB";

    item.appendChild(cbWrap);
    item.appendChild(favicon);
    item.appendChild(title);
    item.appendChild(badge);
    syncList.appendChild(item);

    // Toggle logic on the whole item
    item.addEventListener("click", () => {
      cb.checked = !cb.checked;
      const nowChecked = cb.checked;
      item.classList.toggle("checked", nowChecked);
      badge.textContent = nowChecked ? "SYNCED" : "TAB";
      if (nowChecked) selectedSyncTabIds.add(tab.id);
      else selectedSyncTabIds.delete(tab.id);
    });
  });
}

document.getElementById("tabsync-create-btn").addEventListener("click", async () => {
  if (!currentTabId) return;
  const tabIds = [currentTabId, ...selectedSyncTabIds];
  if (tabIds.length < 2) {
    document.getElementById("tabsync-status").textContent = "Select at least 1 other tab";
    return;
  }
  if (currentSyncGroupId) {
    await chrome.runtime.sendMessage({ type: "DISSOLVE_SYNC_GROUP", groupId: currentSyncGroupId });
  }
  const res = await chrome.runtime.sendMessage({ type: "CREATE_SYNC_GROUP", tabIds });
  if (res?.ok) {
    currentSyncGroupId = res.groupId;
    document.getElementById("tabsync-status").textContent = `Group created (${tabIds.length} tabs)`;
    document.getElementById("tabsync-leave-btn").disabled = false;
  }
});

document.getElementById("tabsync-leave-btn").addEventListener("click", async () => {
  if (!currentSyncGroupId) return;
  await chrome.runtime.sendMessage({ type: "DISSOLVE_SYNC_GROUP", groupId: currentSyncGroupId });
  currentSyncGroupId = null;
  selectedSyncTabIds.clear();
  buildTabSyncList();
});

// ── VISUALIZER ──
let visualizerEnabled = true;
let visualizerRAF = null;

visualizerToggle.addEventListener("change", () => {
  visualizerEnabled = visualizerToggle.checked;
  chrome.storage.local.set({ visualizerEnabled });
  if (!visualizerEnabled) {
    ctx2d.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    if (visualizerRAF) { cancelAnimationFrame(visualizerRAF); visualizerRAF = null; }
  } else {
    startVisualizer();
  }
});

function startVisualizer() {
  if (!visualizerEnabled || visualizerRAF) return;
  const W = visualizerCanvas.width;
  const H = visualizerCanvas.height;
  let lastData = new Array(32).fill(0);

  const draw = async () => {
    if (!visualizerEnabled) return;
    visualizerRAF = requestAnimationFrame(draw);

    let freqData = lastData;
    if (currentTabId) {
      try {
        const res = await chrome.runtime.sendMessage({
          target: "offscreen", type: "GET_ANALYSER_DATA", tabId: currentTabId,
        });
        if (res?.ok && res.frequencyData) {
          // Downsample to 32 bars
          const raw = res.frequencyData;
          const barCount = 32;
          const blockSize = Math.floor(raw.length / barCount);
          freqData = [];
          for (let i = 0; i < barCount; i++) {
            let sum = 0;
            for (let j = 0; j < blockSize; j++) sum += raw[i * blockSize + j];
            freqData.push(sum / blockSize);
          }
          lastData = freqData;
        }
      } catch (_) {}
    }

    // Draw
    ctx2d.clearRect(0, 0, W, H);
    const barW = (W - 2) / freqData.length;
    freqData.forEach((val, i) => {
      const norm = val / 255;
      const barH = norm * (H - 2);
      const x = 1 + i * barW;
      const y = H - barH - 1;
      // Color: dim red to bright red based on height
      const alpha = 0.3 + norm * 0.7;
      const brightness = Math.floor(26 + norm * 229);
      ctx2d.fillStyle = `rgba(255, ${Math.floor(norm * 60)}, ${Math.floor(norm * 30)}, ${alpha})`;
      // Glow for tall bars
      if (norm > 0.6) {
        ctx2d.shadowColor = `rgba(255, 26, 26, ${norm * 0.6})`;
        ctx2d.shadowBlur = 4;
      } else {
        ctx2d.shadowBlur = 0;
      }
      ctx2d.fillRect(x, y, barW - 1, barH);
    });
    ctx2d.shadowBlur = 0;
  };
  draw();
}

// ── ACTIVE TABS ──
async function refreshActiveTabsList() {
  let activeTabs = [];
  try {
    const res = await chrome.runtime.sendMessage({ type: "GET_ACTIVE_TABS" });
    if (res?.ok) activeTabs = res.tabs;
  } catch (_) {}
  activeCountEl.textContent = activeTabs.length;
  if (activeTabs.length === 0) {
    activeTabsList.innerHTML = '<div class="no-tabs">No tabs with modified volume</div>';
    return;
  }
  const tabInfos = await Promise.all(
    activeTabs.map(async (tabId) => {
      try {
        const tab = await chrome.tabs.get(tabId);
        const vol = await loadVolume(tabId);
        return { tabId, title: tab.title || "Tab", vol };
      } catch (_) {
        return { tabId, title: "Unknown Tab", vol: "?" };
      }
    })
  );
  activeTabsList.innerHTML = tabInfos
    .map(({ tabId, title, vol }) => `
      <div class="tab-item ${tabId === currentTabId ? "current" : ""}">
        <span class="tab-title">${escapeHtml(title)}</span>
        <span class="tab-vol">${vol}%</span>
      </div>`)
    .join("");
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── INIT ──
async function loadTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || typeof tab.id !== "number") { currentTabId = null; return; }
  currentTabId = tab.id;
  currentTabUrl = tab.url;

  // Load volume — check site memory first
  const settings = await chrome.storage.local.get(["siteMemoryEnabled", "visualizerEnabled", "eq10Enabled", "noiseGateEnabled"]);

  let volume = await loadVolume(tab.id);
  if (settings.siteMemoryEnabled !== false && currentTabUrl) {
    try {
      const siteRes = await chrome.runtime.sendMessage({ type: "GET_SITE_VOLUME", url: currentTabUrl });
      if (siteRes?.volume !== null && siteRes?.volume !== undefined) {
        volume = siteRes.volume;
      }
    } catch (_) {}
  }
  setVolumeUI(volume);

  // If volume is not 100 (default), re-apply it to ensure audio node is active
  // This fixes the case where service worker was suspended and lost state
  if (volume !== 100) {
    try {
      await chrome.runtime.sendMessage({
        type: "SET_VOLUME",
        tabId: tab.id,
        volume,
        url: currentTabUrl,
      });
    } catch (e) { console.warn("Reconnect SET_VOLUME failed:", e); }
  }

  // Site memory toggle
  siteMemToggle.checked = settings.siteMemoryEnabled !== false;

  // Load 3-band preset
  const d2 = await chrome.storage.local.get(`preset_${tab.id}`);
  const savedPreset = d2[`preset_${tab.id}`] || "flat";
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.preset === savedPreset);
  });
  currentPreset = savedPreset;

  // Load 10-band EQ
  eq10Enabled = settings.eq10Enabled === true;
  eq10Toggle.checked = eq10Enabled;
  const d3 = await chrome.storage.local.get([`eq10_${tab.id}`, `eq10preset_${tab.id}`]);
  if (d3[`eq10_${tab.id}`]) {
    eq10Values = d3[`eq10_${tab.id}`];
    EQ_BANDS_LABELS.forEach((_, i) => {
      const fader = document.getElementById(`eq10-fader-${i}`);
      const valEl = document.getElementById(`eq10-val-${i}`);
      if (fader) fader.value = eq10Values[i];
      if (valEl) valEl.textContent = (eq10Values[i] >= 0 ? "+" : "") + eq10Values[i];
    });
  }
  if (d3[`eq10preset_${tab.id}`]) {
    currentEQ10Preset = d3[`eq10preset_${tab.id}`];
    document.querySelectorAll(".eq10-preset-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.eq10 === currentEQ10Preset);
    });
  }

  // Load noise gate
  const noiseGateEnabled = settings.noiseGateEnabled === true;
  noiseGateToggle.checked = noiseGateEnabled;

  // Load visualizer state
  visualizerEnabled = settings.visualizerEnabled !== false;
  visualizerToggle.checked = visualizerEnabled;

  // Sleep timers
  try {
    const timerRes = await chrome.runtime.sendMessage({ type: "GET_SLEEP_TIMERS" });
    if (timerRes?.ok && timerRes.timers[currentTabId]) {
      const fireAt = timerRes.timers[currentTabId].fireAt;
      startSleepCountdown(fireAt);
      sleepClearBtn.disabled = false;
      sleepStatus.textContent = "●";
      sleepStatus.style.color = "var(--red)";
    }
  } catch (_) {}

  // Auto-duck
  await populateAutoDuckSelect();

  // Tab sync
  await buildTabSyncList();

  // Active tabs
  refreshActiveTabsList();

  // Visualizer
  if (visualizerEnabled) startVisualizer();
}

// ── EVENT LISTENERS ──
slider.addEventListener("input", () => { applyVolume(Number(slider.value)); });

document.querySelectorAll(".qbtn[data-vol]").forEach((btn) => {
  btn.addEventListener("click", () => { applyVolume(Number(btn.dataset.vol)); });
});

resetBtn.addEventListener("click", async () => {
  if (!currentTabId) return;
  try { await chrome.runtime.sendMessage({ type: "RESET_VOLUME", tabId: currentTabId }); } catch (_) {}
  applyVolume(100);
  await applyPresetEQ("flat");
  await resetEQ10();
});

document.querySelectorAll(".preset-btn").forEach((btn) => {
  btn.addEventListener("click", () => applyPresetEQ(btn.dataset.preset));
});

document.addEventListener("keydown", (e) => {
  const step = e.shiftKey ? 10 : 5;
  const current = Number(slider.value);
  if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); applyVolume(Math.min(200, current + step)); }
  else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); applyVolume(Math.max(0, current - step)); }
  else if (e.key === "m" || e.key === "M") { applyVolume(current > 0 ? 0 : 100); }
});

// Listen for background volume updates (from global hotkeys / fade)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "VOLUME_UPDATE" && msg.tabId === currentTabId) {
    setVolumeUI(msg.volume);
  }
  if (msg?.type === "SLEEP_TIMER_FIRED" && msg.tabId === currentTabId) {
    clearSleepCountdown();
    setVolumeUI(0);
  }
});

// Build EQ bands UI first, then init
buildEQ10Bands();
loadTab();

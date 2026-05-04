const OFFSCREEN = "offscreen.html";
const activeTabs = new Set();

// Tab sync groups: groupId -> Set of tabIds
const syncGroups = new Map();

// Pre-duck volumes
const preDuckVolumes = new Map();

// Sleep timers
const sleepTimers = new Map();

// Fade intervals
const fadeIntervals = new Map();

async function ensureOffscreen() {
  if (!chrome.offscreen) return;
  const contexts = chrome.runtime.getContexts
    ? await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN)],
      })
    : [];
  if (contexts.length) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN,
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Per-tab volume control",
  });
}

async function sendOffscreen(msg) {
  await ensureOffscreen();
  return chrome.runtime.sendMessage({ target: "offscreen", ...msg });
}

async function startOrUpdate(tabId, volume) {
  if (!activeTabs.has(tabId)) {
    let streamId;
    try {
      streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    } catch (e) {
      return { ok: false, error: "tabCapture failed: " + e.message };
    }
    let res;
    try {
      res = await sendOffscreen({ type: "START_AUDIO", tabId, streamId, volume });
    } catch (e) {
      return { ok: false, error: "offscreen error: " + e.message };
    }
    if (res?.ok) activeTabs.add(tabId);
    return res;
  } else {
    let res;
    try {
      res = await sendOffscreen({ type: "UPDATE_AUDIO", tabId, volume });
    } catch (e) {
      activeTabs.delete(tabId);
      return startOrUpdate(tabId, volume);
    }
    if (!res?.ok) {
      activeTabs.delete(tabId);
      return startOrUpdate(tabId, volume);
    }
    return res;
  }
}

async function stopTab(tabId) {
  if (!activeTabs.has(tabId)) return;
  activeTabs.delete(tabId);
  try {
    await chrome.runtime.sendMessage({ target: "offscreen", type: "STOP_AUDIO", tabId });
  } catch (_) {}
}

// ── VOLUME FADE ──
async function fadeVolume(tabId, fromVol, toVol, durationMs) {
  if (fadeIntervals.has(tabId)) {
    clearInterval(fadeIntervals.get(tabId));
    fadeIntervals.delete(tabId);
  }
  const steps = 40;
  const stepTime = durationMs / steps;
  const stepSize = (toVol - fromVol) / steps;
  let current = fromVol;
  let step = 0;
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      step++;
      current += stepSize;
      if (step >= steps) {
        current = toVol;
        clearInterval(interval);
        fadeIntervals.delete(tabId);
        resolve();
      }
      const vol = Math.round(current);
      await startOrUpdate(tabId, vol);
      await chrome.storage.local.set({ [`vol_${tabId}`]: vol });
      try { chrome.runtime.sendMessage({ type: "VOLUME_UPDATE", tabId, volume: vol }); } catch (_) {}
    }, stepTime);
    fadeIntervals.set(tabId, interval);
  });
}

// ── SLEEP TIMER ──
function setSleepTimer(tabId, minutes) {
  if (sleepTimers.has(tabId)) {
    clearTimeout(sleepTimers.get(tabId).id);
  }
  const fireAt = Date.now() + minutes * 60 * 1000;
  const timer = setTimeout(async () => {
    sleepTimers.delete(tabId);
    const d = await chrome.storage.local.get(`vol_${tabId}`);
    const currentVol = typeof d[`vol_${tabId}`] === "number" ? d[`vol_${tabId}`] : 100;
    await fadeVolume(tabId, currentVol, 0, 4000);
    chrome.storage.local.set({ [`vol_${tabId}`]: 0 });
    try { chrome.runtime.sendMessage({ type: "SLEEP_TIMER_FIRED", tabId }); } catch (_) {}
  }, minutes * 60 * 1000);
  sleepTimers.set(tabId, { id: timer, fireAt });
}

function clearSleepTimer(tabId) {
  if (sleepTimers.has(tabId)) {
    clearTimeout(sleepTimers.get(tabId).id);
    sleepTimers.delete(tabId);
  }
}

// ── PER-SITE MEMORY ──
async function saveSiteVolume(url, volume) {
  if (!url) return;
  try {
    const domain = new URL(url).hostname;
    await chrome.storage.local.set({ [`site_${domain}`]: volume });
  } catch (_) {}
}

async function loadSiteVolume(url) {
  if (!url) return null;
  try {
    const domain = new URL(url).hostname;
    const d = await chrome.storage.local.get(`site_${domain}`);
    return typeof d[`site_${domain}`] === "number" ? d[`site_${domain}`] : null;
  } catch (_) { return null; }
}

// ── TAB SYNC ──
function getTabGroup(tabId) {
  for (const [groupId, tabs] of syncGroups) {
    if (tabs.has(tabId)) return groupId;
  }
  return null;
}

async function syncGroupVolume(sourceTabId, volume) {
  const groupId = getTabGroup(sourceTabId);
  if (!groupId) return;
  const tabs = syncGroups.get(groupId);
  for (const tabId of tabs) {
    if (tabId === sourceTabId) continue;
    await startOrUpdate(tabId, volume);
    await chrome.storage.local.set({ [`vol_${tabId}`]: volume });
  }
}

// ── AUTO-DUCK ──
async function handleAutoDuck(sourceDuckerTabId, isActive) {
  const settings = await chrome.storage.local.get(["autoDuckEnabled", "autoDuckAmount", "autoDuckSourceTabId"]);
  if (!settings.autoDuckEnabled) return;
  if (settings.autoDuckSourceTabId !== sourceDuckerTabId) return;
  const amount = settings.autoDuckAmount ?? 30;

  if (isActive) {
    for (const tabId of activeTabs) {
      if (tabId === sourceDuckerTabId) continue;
      const d = await chrome.storage.local.get(`vol_${tabId}`);
      const vol = typeof d[`vol_${tabId}`] === "number" ? d[`vol_${tabId}`] : 100;
      if (!preDuckVolumes.has(tabId)) preDuckVolumes.set(tabId, vol);
      const duckedVol = Math.round(vol * (amount / 100));
      await startOrUpdate(tabId, duckedVol);
    }
  } else {
    for (const [tabId, origVol] of preDuckVolumes) {
      if (activeTabs.has(tabId)) await startOrUpdate(tabId, origVol);
    }
    preDuckVolumes.clear();
  }
}

// ── MESSAGE HANDLER ──
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  (async () => {
    if (msg?.type === "SET_VOLUME" && Number.isInteger(msg.tabId)) {
      const res = await startOrUpdate(msg.tabId, msg.volume);
      const settings = await chrome.storage.local.get("siteMemoryEnabled");
      if (settings.siteMemoryEnabled !== false && msg.url) {
        await saveSiteVolume(msg.url, msg.volume);
      }
      await syncGroupVolume(msg.tabId, msg.volume);
      respond(res);

    } else if (msg?.type === "GET_ACTIVE_TABS") {
      respond({ ok: true, tabs: Array.from(activeTabs) });

    } else if (msg?.type === "RESET_VOLUME" && Number.isInteger(msg.tabId)) {
      await stopTab(msg.tabId);
      await chrome.storage.local.remove(`vol_${msg.tabId}`);
      clearSleepTimer(msg.tabId);
      respond({ ok: true });

    } else if (msg?.type === "FADE_VOLUME") {
      const { tabId, fromVol, toVol, durationMs } = msg;
      fadeVolume(tabId, fromVol, toVol, durationMs ?? 2000);
      respond({ ok: true });

    } else if (msg?.type === "SET_SLEEP_TIMER") {
      setSleepTimer(msg.tabId, msg.minutes);
      respond({ ok: true });

    } else if (msg?.type === "CLEAR_SLEEP_TIMER") {
      clearSleepTimer(msg.tabId);
      respond({ ok: true });

    } else if (msg?.type === "GET_SLEEP_TIMERS") {
      const result = {};
      for (const [tabId, data] of sleepTimers) {
        result[tabId] = { fireAt: data.fireAt };
      }
      respond({ ok: true, timers: result });

    } else if (msg?.type === "GET_SITE_VOLUME") {
      const vol = await loadSiteVolume(msg.url);
      respond({ ok: true, volume: vol });

    } else if (msg?.type === "CLEAR_SITE_MEMORY") {
      const all = await chrome.storage.local.get(null);
      const siteKeys = Object.keys(all).filter(k => k.startsWith("site_"));
      if (siteKeys.length) await chrome.storage.local.remove(siteKeys);
      respond({ ok: true });

    } else if (msg?.type === "CREATE_SYNC_GROUP") {
      const groupId = "group_" + Date.now();
      syncGroups.set(groupId, new Set(msg.tabIds));
      respond({ ok: true, groupId });

    } else if (msg?.type === "ADD_TO_SYNC_GROUP") {
      if (syncGroups.has(msg.groupId)) syncGroups.get(msg.groupId).add(msg.tabId);
      respond({ ok: true });

    } else if (msg?.type === "REMOVE_FROM_SYNC_GROUP") {
      const groupId = getTabGroup(msg.tabId);
      if (groupId) {
        syncGroups.get(groupId).delete(msg.tabId);
        if (syncGroups.get(groupId).size === 0) syncGroups.delete(groupId);
      }
      respond({ ok: true });

    } else if (msg?.type === "DISSOLVE_SYNC_GROUP") {
      if (syncGroups.has(msg.groupId)) syncGroups.delete(msg.groupId);
      respond({ ok: true });

    } else if (msg?.type === "GET_SYNC_GROUPS") {
      const result = {};
      for (const [groupId, tabs] of syncGroups) {
        result[groupId] = Array.from(tabs);
      }
      respond({ ok: true, groups: result });

    } else if (msg?.type === "AUTO_DUCK_TRIGGER") {
      await handleAutoDuck(msg.tabId, msg.active);
      respond({ ok: true });

    } else {
      respond({ ok: false, error: "Unknown message" });
    }
  })();
  return true;
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await stopTab(tabId);
  clearSleepTimer(tabId);
  const groupId = getTabGroup(tabId);
  if (groupId) {
    syncGroups.get(groupId).delete(tabId);
    if (syncGroups.get(groupId).size === 0) syncGroups.delete(groupId);
  }
  chrome.storage.local.remove(`vol_${tabId}`).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!activeTabs.has(tabId) || changeInfo.status !== "loading") return;
  stopTab(tabId);
});

// ── KEEPALIVE: prevent service worker from being suspended ──
// Chrome suspends idle service workers after ~30s, losing all in-memory state.
// This alarm fires every 20s to keep the worker alive while tabs are active.
chrome.alarms.create("keepalive", { periodInMinutes: 1 / 3 }); // every 20s
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "keepalive") return;
  // No-op: just waking up the service worker is enough.
  // If there are active tabs but offscreen lost its controllers, re-register them.
  if (activeTabs.size > 0) {
    ensureOffscreen().catch(() => {});
  }
});

// Global hotkeys
chrome.commands?.onCommand?.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const tabId = tab.id;
  const d = await chrome.storage.local.get(`vol_${tabId}`);
  let vol = typeof d[`vol_${tabId}`] === "number" ? d[`vol_${tabId}`] : 100;

  if (command === "volume-up") vol = Math.min(200, vol + 10);
  else if (command === "volume-down") vol = Math.max(0, vol - 10);
  else if (command === "volume-mute") vol = vol > 0 ? 0 : 100;

  await startOrUpdate(tabId, vol);
  await chrome.storage.local.set({ [`vol_${tabId}`]: vol });
  try { chrome.runtime.sendMessage({ type: "VOLUME_UPDATE", tabId, volume: vol }); } catch (_) {}
});

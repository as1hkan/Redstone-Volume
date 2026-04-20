const slider = document.getElementById("volume-slider");
const volumeText = document.getElementById("volume-text");
// آیکن همیشه همان Redstone
const volumeIcon = document.getElementById("volume-icon");

let currentTabId = null;

function setVolumeUI(volume) {
  slider.value = volume;
  volumeText.textContent = volume + "%";
  const percent = Math.max(0, Math.min(200, volume))/2;
  slider.style.background = `linear-gradient(90deg, rgba(255,26,26,0.9) ${percent}%, rgba(255,0,0,0.3) ${percent}%)`;
  // آیکن همیشه Redstone، تغییر نمی‌کند
  volumeIcon.src = "icons/icon48.png";
}

async function loadTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if(!tab || typeof tab.id!=="number"){ currentTabId=null; return; }
  currentTabId = tab.id;
  const key = `vol_${tab.id}`;
  const data = await chrome.storage.local.get(key);
  const saved = typeof data[key]==="number"?data[key]:100;
  setVolumeUI(saved);
}

let applyTimer=null;
async function applyVolume(volume){
  if(!currentTabId) return;
  setVolumeUI(volume);
  const key=`vol_${currentTabId}`;
  await chrome.storage.local.set({[key]:volume});
  try{ await chrome.runtime.sendMessage({type:"SET_VOLUME",tabId:currentTabId,volume}); } catch{}
}

slider.addEventListener("input",()=>{const volume=Number(slider.value); clearTimeout(applyTimer); applyTimer=setTimeout(()=>applyVolume(volume),20);});
loadTab();

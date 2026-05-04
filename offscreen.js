const controllers = new Map();

async function getStream(streamId) {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });
}

async function startAudio(tabId, streamId, volume) {
  if (controllers.has(tabId)) return updateAudio(tabId, volume);
  let stream;
  try {
    stream = await getStream(streamId);
  } catch (e) {
    return { ok: false, error: "getUserMedia failed: " + e.message };
  }
  try {
    const ctx = new AudioContext();
    await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    const gain = ctx.createGain();

    // Legacy 3-band EQ (for presets)
    const bass = ctx.createBiquadFilter();
    bass.type = "lowshelf";
    bass.frequency.value = 200;
    bass.gain.value = 0;

    const mid = ctx.createBiquadFilter();
    mid.type = "peaking";
    mid.frequency.value = 1000;
    mid.Q.value = 1;
    mid.gain.value = 0;

    const treble = ctx.createBiquadFilter();
    treble.type = "highshelf";
    treble.frequency.value = 4000;
    treble.gain.value = 0;

    // 10-band EQ filters
    const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    const eqFilters = EQ_BANDS.map((freq, i) => {
      const f = ctx.createBiquadFilter();
      if (i === 0) f.type = "lowshelf";
      else if (i === EQ_BANDS.length - 1) f.type = "highshelf";
      else { f.type = "peaking"; f.Q.value = 1.4; }
      f.frequency.value = freq;
      f.gain.value = 0;
      return f;
    });

    // Analyser for visualizer
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    // Noise gate
    const noiseGateThreshold = { value: -60 }; // dB, -60 = off effectively
    let noiseGateEnabled = false;
    let noiseGateMuted = false;

    // Chain: src -> bass -> mid -> treble -> eqFilters chain -> analyser -> gain -> dest
    src.connect(bass);
    bass.connect(mid);
    mid.connect(treble);

    // Connect 10-band EQ in series
    treble.connect(eqFilters[0]);
    for (let i = 0; i < eqFilters.length - 1; i++) {
      eqFilters[i].connect(eqFilters[i + 1]);
    }
    eqFilters[eqFilters.length - 1].connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.value = Math.max(0, volume) / 100;

    // Noise gate interval
    let noiseGateInterval = null;

    const startNoiseGate = () => {
      if (noiseGateInterval) return;
      const bufLen = analyser.frequencyBinCount;
      const dataArr = new Uint8Array(bufLen);
      noiseGateInterval = setInterval(() => {
        if (!noiseGateEnabled) {
          if (noiseGateMuted) {
            gain.gain.value = controllers.get(tabId)?.targetGain ?? 1;
            noiseGateMuted = false;
          }
          return;
        }
        analyser.getByteFrequencyData(dataArr);
        const avg = dataArr.reduce((s, v) => s + v, 0) / dataArr.length;
        // avg 0-255; convert rough dB: threshold in dB from -100 to 0
        // map threshold dB to 0-255 scale: (threshold + 100) / 100 * 255
        const thresholdLinear = (noiseGateThreshold.value + 100) / 100 * 255;
        const shouldMute = avg < thresholdLinear;
        const c = controllers.get(tabId);
        if (shouldMute && !noiseGateMuted) {
          gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
          noiseGateMuted = true;
        } else if (!shouldMute && noiseGateMuted) {
          gain.gain.setTargetAtTime(c?.targetGain ?? 1, ctx.currentTime, 0.05);
          noiseGateMuted = false;
        }
      }, 100);
    };

    startNoiseGate();

    controllers.set(tabId, {
      ctx, src, gain, bass, mid, treble,
      eqFilters, analyser, stream,
      targetGain: Math.max(0, volume) / 100,
      noiseGateEnabled: false,
      noiseGateThreshold,
      noiseGateMuted: false,
      get noiseGateMutedRef() { return noiseGateMuted; },
      set noiseGateEnabledSet(v) { noiseGateEnabled = v; },
      get noiseGateEnabledGet() { return noiseGateEnabled; },
      stopNoiseGate: () => { if (noiseGateInterval) { clearInterval(noiseGateInterval); noiseGateInterval = null; } },
    });

    return { ok: true };
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    return { ok: false, error: "AudioContext failed: " + e.message };
  }
}

function updateAudio(tabId, volume) {
  const c = controllers.get(tabId);
  if (!c) return { ok: false, error: "Controller missing" };
  const g = Math.max(0, volume) / 100;
  c.targetGain = g;
  if (!c.noiseGateMutedRef) {
    c.gain.gain.value = g;
  }
  return { ok: true };
}

function applyPreset(tabId, preset) {
  const c = controllers.get(tabId);
  if (!c) return { ok: false, error: "Controller missing" };
  c.bass.gain.value = preset.bass ?? 0;
  c.mid.gain.value = preset.mid ?? 0;
  c.treble.gain.value = preset.treble ?? 0;
  return { ok: true };
}

function applyEQ(tabId, bands) {
  // bands: array of 10 gain values in dB
  const c = controllers.get(tabId);
  if (!c) return { ok: false, error: "Controller missing" };
  bands.forEach((gain, i) => {
    if (c.eqFilters[i]) c.eqFilters[i].gain.value = gain;
  });
  return { ok: true };
}

function setNoiseGate(tabId, enabled, threshold) {
  const c = controllers.get(tabId);
  if (!c) return { ok: false, error: "Controller missing" };
  c.noiseGateEnabledSet = enabled;
  if (threshold !== undefined) c.noiseGateThreshold.value = threshold;
  return { ok: true };
}

function getAnalyserData(tabId) {
  const c = controllers.get(tabId);
  if (!c) return { ok: false, error: "Controller missing" };
  const bufLen = c.analyser.frequencyBinCount;
  const freqData = new Uint8Array(bufLen);
  const timeData = new Uint8Array(bufLen);
  c.analyser.getByteFrequencyData(freqData);
  c.analyser.getByteTimeDomainData(timeData);
  return {
    ok: true,
    frequencyData: Array.from(freqData),
    timeDomainData: Array.from(timeData),
  };
}

async function stopAudio(tabId) {
  const c = controllers.get(tabId);
  if (!c) return { ok: true };
  try {
    c.stopNoiseGate();
    c.src.disconnect();
    c.gain.disconnect();
    c.bass.disconnect();
    c.mid.disconnect();
    c.treble.disconnect();
    c.eqFilters.forEach(f => f.disconnect());
    c.analyser.disconnect();
    c.stream.getTracks().forEach((t) => t.stop());
    await c.ctx.close();
  } catch (_) {}
  controllers.delete(tabId);
  return { ok: true };
}

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg?.target !== "offscreen") return;
  (async () => {
    if (msg.type === "START_AUDIO") respond(await startAudio(msg.tabId, msg.streamId, msg.volume));
    else if (msg.type === "UPDATE_AUDIO") respond(updateAudio(msg.tabId, msg.volume));
    else if (msg.type === "STOP_AUDIO") respond(await stopAudio(msg.tabId));
    else if (msg.type === "APPLY_PRESET") respond(applyPreset(msg.tabId, msg.preset));
    else if (msg.type === "APPLY_EQ") respond(applyEQ(msg.tabId, msg.bands));
    else if (msg.type === "SET_NOISE_GATE") respond(setNoiseGate(msg.tabId, msg.enabled, msg.threshold));
    else if (msg.type === "GET_ANALYSER_DATA") respond(getAnalyserData(msg.tabId));
    else respond({ ok: false, error: "Unknown offscreen message" });
  })();
  return true;
});

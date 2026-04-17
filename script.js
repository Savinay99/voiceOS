'use strict';

/* ============================================================
APP STATE & CONFIG
============================================================ */
const AppState = {
  apiKey: '',
  endpoint: '',
  isConnected: false,
  isRecording: false,
  isSpeaking: false,
  transcript: '',
  audioBlob: null,
  voices: [],
  currentLang: 'en-US', // Default STT language
};

// Supported Languages for STT (Speech Recognition)
const SUPPORTED_LANGS = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'hi-IN', name: 'Hindi (India)' },
  { code: 'es-ES', name: 'Spanish (Spain)' },
  { code: 'fr-FR', name: 'French (France)' },
  { code: 'de-DE', name: 'German (Germany)' },
  { code: 'ja-JP', name: 'Japanese (Japan)' },
  { code: 'zh-CN', name: 'Chinese (Mandarin)' },
  { code: 'ru-RU', name: 'Russian (Russia)' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' }
];

/* ============================================================
UTILITY — Toast Notifications
============================================================ */
const Toast = {
  container: null,
  init() { this.container = document.getElementById('toast-container'); },
  show(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-dot"></span><span>${message}</span>`;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 260);
    }, duration);
  },
  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error', 4500); },
  info(msg) { this.show(msg, 'info'); },
  warning(msg) { this.show(msg, 'warning', 4000); },
};

/* ============================================================
UTILITY — DOM helpers
============================================================ */
const $ = (sel) => document.querySelector(sel);
const $id = (id) => document.getElementById(id);

/* ============================================================
UI CONTROLLER
============================================================ */
const UI = {
  updateConnectionStatus(state) {
    const chip = $id('connection-status');
    if (!chip) return;
    chip.className = 'status-chip';
    if (state === 'connected') {
      chip.classList.add('connected');
      chip.querySelector('.status-label').textContent = 'Connected';
    } else if (state === 'error') {
      chip.classList.add('error');
      chip.querySelector('.status-label').textContent = 'Error';
    } else {
      chip.querySelector('.status-label').textContent = 'Not Connected';
    }
  },
  showFieldError(id, msg) {
    const el = $id(id);
    if (el) {
      el.textContent = msg;
      el.classList.remove('hidden');
      const inputId = id.replace('-error', '');
      const input = $id(inputId);
      if (input) input.classList.add('error');
    }
  },
  clearFieldError(id) {
    const el = $id(id);
    if (el) {
      el.classList.add('hidden');
      const inputId = id.replace('-error', '');
      const input = $id(inputId);
      if (input) input.classList.remove('error');
    }
  },
  clearAllErrors() {
    ['key-error', 'endpoint-error'].forEach(id => this.clearFieldError(id));
  },
  setConnectBtnLoading(loading) {
    const btn = $id('connect-btn');
    if (!btn) return;
    if (loading) {
      btn.innerHTML = `<span class="spinner"></span> Connecting…`;
      btn.disabled = true;
    } else {
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Connect Service`;
      btn.disabled = false;
    }
  },
  setRecorderStatus(status, text) {
    const el = $id('recorder-status').querySelector('.status-text');
    if (!el) return;
    el.className = 'status-text';
    if (status) el.classList.add(status);
    el.textContent = text;
  },
  setWaveformActive(active) {
    const bars = document.querySelectorAll('.waveform-bar');
    bars.forEach(bar => {
      if (active) bar.classList.add('active');
      else {
        bar.classList.remove('active');
        bar.style.height = '8px';
      }
    });
  },
  animateWaveform() {
    const bars = document.querySelectorAll('.waveform-bar');
    bars.forEach(bar => {
      const h = Math.floor(Math.random() * 38) + 8;
      bar.style.height = `${h}px`;
    });
  },
  setRecordBtn(recording) {
    const btn = $id('record-btn');
    const label = $id('record-label');
    if (!btn || !label) return;
    if (recording) {
      btn.classList.add('recording');
      label.textContent = 'Stop Recording';
    } else {
      btn.classList.remove('recording');
      label.textContent = 'Start Recording';
    }
  },
  setTranscript(text, interim = false) {
    const el = $id('transcript-output');
    if (!el) return;

    if (!text) {
      el.innerHTML = `<span class="placeholder-text">Your transcript will appear here…</span>`;
      const copyBtn = $id('copy-transcript-btn');
      if (copyBtn) copyBtn.disabled = true;
      const meta = $id('transcript-meta');
      if (meta) meta.textContent = '';
      return;
    }
    el.textContent = text + (interim ? '…' : '');

    const copyBtn = $id('copy-transcript-btn');
    if (copyBtn) copyBtn.disabled = false;

    if (!interim) {
      const wc = text.trim().split(/\s+/).filter(Boolean).length;
      const meta = $id('transcript-meta');
      if (meta) meta.textContent = `${wc} word${wc !== 1 ? 's' : ''} · ${text.length} chars`;
    }
  },
  setBadge(id, label) {
    const el = $id(id);
    if (el) el.textContent = label;
  },
  updateSpeakBtn(speaking) {
    const btn = $id('speak-btn');
    const stop = $id('stop-btn');
    if (!btn || !stop) return;

    if (speaking) {
      btn.innerHTML = `<span class="spinner"></span> <span>Synthesizing…</span>`;
      btn.disabled = true;
      stop.disabled = false;
    } else {
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="5 3 19 12 5 21 5 3"/></svg> <span>Convert to Speech</span>`;
      const input = $id('tts-input');
      btn.disabled = (input && input.value.trim().length === 0);
      stop.disabled = true;
    }
  },
  showAudioPlayer(show) {
    const card = $id('audio-player-card');
    if (card) {
      if (show) card.classList.remove('hidden');
      else card.classList.add('hidden');
    }
  },
  setTTSProgress(pct, statusText) {
    const fill = $id('tts-progress-fill');
    const status = $id('tts-status');
    if (fill) fill.style.width = `${pct}%`;
    if (status && statusText) status.textContent = statusText;
  },
};

/* ============================================================
VALIDATOR
============================================================ */
const Validator = {
  validateCredentials(key, endpoint) {
    let valid = true;
    if (!key || key.trim().length < 4) {
      UI.showFieldError('key-error', 'API Key is required and must be at least 4 characters.');
      valid = false;
    } else {
      UI.clearFieldError('key-error');
    }

    if (!endpoint || !endpoint.trim()) {
      UI.showFieldError('endpoint-error', 'Endpoint URL is required.');
      valid = false;
    } else if (!endpoint.trim().startsWith('https://')) {
      UI.showFieldError('endpoint-error', 'Endpoint must start with https://');
      valid = false;
    } else {
      UI.clearFieldError('endpoint-error');
    }
    return valid;
  },
};

/* ============================================================
SPEECH ENGINE
============================================================ */
const SpeechEngine = {
  recognition: null,
  synthesis: window.speechSynthesis,
  waveInterval: null,

  // ----------- STT -----------
  startRecognition(langCode, onResult, onError, onEnd) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onError('Speech recognition not supported. Use Chrome/Edge.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = langCode;
    rec.maxAlternatives = 1;
    this.recognition = rec;

    rec.onstart = () => {
      this.waveInterval = setInterval(() => UI.animateWaveform(), 80);
    };

    rec.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t + ' ';
        else interim += t;
      }
      onResult({ final: final.trim(), interim: interim.trim() });
    };

    rec.onerror = (event) => {
      clearInterval(this.waveInterval);
      let msg = 'Error: ' + event.error;

      // Specific handling for common errors
      if (event.error === 'not-allowed') {
        msg = 'Microphone permission denied. Please allow access in browser settings.';
      } else if (event.error === 'no-speech') {
        msg = 'No speech detected. Try again.';
      } else if (event.error === 'network') {
        // This usually happens if running from file:// protocol
        msg = 'Network error. Ensure you are running on localhost or HTTPS, not file://.';
      }

      onError(msg);
    };

    rec.onend = () => {
      clearInterval(this.waveInterval);
      onEnd();
    };

    try {
      rec.start();
    } catch (e) {
      onError('Failed to start microphone. Check permissions.');
    }
  },
  stopRecognition() {
    clearInterval(this.waveInterval);
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
  },

  // ----------- TTS -----------
  loadVoices() {
    return new Promise((resolve) => {
      const populate = () => {
        const voices = this.synthesis.getVoices();
        if (voices.length) resolve(voices);
      };
      populate();
      this.synthesis.onvoiceschanged = populate;
      setTimeout(() => resolve(this.synthesis.getVoices()), 1000);
    });
  },
  speak(text, voice, rate, pitch, onStart, onEnd, onError) {
    if (this.synthesis.speaking) this.synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) utterance.voice = voice;
    utterance.rate = parseFloat(rate) || 1;
    utterance.pitch = parseFloat(pitch) || 1;

    utterance.onstart = onStart;
    utterance.onend = onEnd;
    utterance.onerror = (e) => onError('Speech synthesis error: ' + e.error);

    this.synthesis.speak(utterance);
  },
  stop() {
    if (this.synthesis.speaking) this.synthesis.cancel();
  },
};

/* ============================================================
VOICE & LANGUAGE SELECTOR
============================================================ */
async function loadVoicesAndLanguages() {
  const voices = await SpeechEngine.loadVoices();
  AppState.voices = voices;

  // 1. Populate STT Language Dropdown
  const sttLangSelect = $id('stt-lang-select');
  if (sttLangSelect) {
    sttLangSelect.innerHTML = '';
    SUPPORTED_LANGS.forEach(lang => {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.name;
      if (lang.code === AppState.currentLang) opt.selected = true;
      sttLangSelect.appendChild(opt);
    });
  }

  // 2. Populate TTS Voice Dropdown (Load ALL voices)
  updateTTSVoiceDropdown();
}

function updateTTSVoiceDropdown() {
  const ttsVoiceSelect = $id('voice-select');
  if (!ttsVoiceSelect) return;

  ttsVoiceSelect.innerHTML = '';

  // Sort voices by language then name
  const sortedVoices = AppState.voices.sort((a, b) => {
    return a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name);
  });

  if (sortedVoices.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = 'No voices found';
    ttsVoiceSelect.appendChild(opt);
    return;
  }

  // Group by Language for cleaner UI
  let currentLangGroup = '';
  let currentOptGroup = null;

  sortedVoices.forEach((v, i) => {
    // Find original index in AppState.voices to keep reference correct
    const originalIndex = AppState.voices.indexOf(v);

    // Create OptGroup if language changes
    if (v.lang !== currentLangGroup) {
      currentLangGroup = v.lang;
      currentOptGroup = document.createElement('optgroup');
      currentOptGroup.label = v.lang; // e.g., "hi-IN"
      ttsVoiceSelect.appendChild(currentOptGroup);
    }

    const opt = document.createElement('option');
    opt.value = originalIndex;

    // Gender hint
    const nameLower = v.name.toLowerCase();
    const genderHint = (nameLower.includes('female') || nameLower.includes('zira') ||
      nameLower.includes('samantha') || nameLower.includes('victoria'))
      ? '♀' : '♂';

    opt.textContent = `${genderHint} ${v.name}`;
    currentOptGroup.appendChild(opt);
  });
}

/* ============================================================
THEME TOGGLE
============================================================ */
function initTheme() {
  const saved = localStorage.getItem('voiceos-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeLabel(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('voiceos-theme', next);
  updateThemeLabel(next);
}

function updateThemeLabel(theme) {
  const label = $id('theme-label');
  if (label) label.textContent = theme === 'light' ? 'Dark Mode' : 'Light Mode';
}

/* ============================================================
TAB NAVIGATION
============================================================ */
function initTabs() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const tabId = `tab-${btn.dataset.tab}`;
      const panel = $id(tabId);
      if (panel) panel.classList.add('active');
    });
  });
}

/* ============================================================
CREDENTIALS
============================================================ */
function initCredentials() {
  const apiKeyInput = $id('api-key');
  const endpointInput = $id('endpoint');
  const connectBtn = $id('connect-btn');
  const clearBtn = $id('clear-btn');
  const toggleKey = $id('toggle-key');

  if (apiKeyInput) apiKeyInput.addEventListener('input', () => UI.clearFieldError('key-error'));
  if (endpointInput) endpointInput.addEventListener('input', () => UI.clearFieldError('endpoint-error'));

  if (toggleKey) {
    toggleKey.addEventListener('click', () => {
      const isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
      toggleKey.querySelector('.eye-open').style.display = isPassword ? 'none' : '';
      toggleKey.querySelector('.eye-closed').style.display = isPassword ? '' : 'none';
    });
  }

  if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
      const key = apiKeyInput.value;
      const endpoint = endpointInput.value;

      UI.clearAllErrors();
      if (!Validator.validateCredentials(key, endpoint)) return;

      UI.setConnectBtnLoading(true);
      await new Promise(r => setTimeout(r, 1200));

      AppState.apiKey = key.trim();
      AppState.endpoint = endpoint.trim();
      AppState.isConnected = true;

      UI.setConnectBtnLoading(false);
      UI.updateConnectionStatus('connected');
      UI.setBadge('stt-mode-badge', 'Azure + Web Speech');
      UI.setBadge('tts-mode-badge', 'Azure + Web Speech');
      Toast.success('Service connected successfully.');
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (apiKeyInput) apiKeyInput.value = '';
      if (endpointInput) endpointInput.value = '';
      AppState.apiKey = '';
      AppState.endpoint = '';
      AppState.isConnected = false;
      UI.clearAllErrors();
      UI.updateConnectionStatus('none');
      UI.setBadge('stt-mode-badge', 'Web Speech API');
      UI.setBadge('tts-mode-badge', 'Web Speech API');
      Toast.info('Credentials cleared.');
    });
  }
}

/* ============================================================
SPEECH TO TEXT (STT)
============================================================ */
function initSTT() {
  const recordBtn = $id('record-btn');
  const copyTranscriptBtn = $id('copy-transcript-btn');
  const clearTranscriptBtn = $id('clear-transcript-btn');
  const sttLangSelect = $id('stt-lang-select');

  let accumulatedTranscript = '';

  // Handle Language Change
  if (sttLangSelect) {
    sttLangSelect.addEventListener('change', (e) => {
      AppState.currentLang = e.target.value;
      Toast.info(`STT Language changed to ${e.target.options[e.target.selectedIndex].text}`);
    });
  }

  if (recordBtn) {
    recordBtn.addEventListener('click', () => {
      if (AppState.isRecording) {
        // Stop
        SpeechEngine.stopRecognition();
        AppState.isRecording = false;
        UI.setRecordBtn(false);
        UI.setWaveformActive(false);
        UI.setRecorderStatus('', 'Ready to record');
        if (AppState.transcript) Toast.success('Transcript ready.');
      } else {
        // Start
        // Request permission explicitly
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(() => {
            AppState.isRecording = true;
            UI.setRecordBtn(true);
            UI.setWaveformActive(true);
            UI.setRecorderStatus('listening', 'Listening…');

            SpeechEngine.startRecognition(
              AppState.currentLang,
              // onResult
              ({ final, interim }) => {
                if (final) {
                  accumulatedTranscript += (accumulatedTranscript ? ' ' : '') + final;
                  AppState.transcript = accumulatedTranscript;
                  UI.setTranscript(accumulatedTranscript);
                  UI.setRecorderStatus('listening', 'Listening…');
                } else {
                  UI.setTranscript(accumulatedTranscript + (accumulatedTranscript ? ' ' : '') + interim, true);
                  UI.setRecorderStatus('processing', 'Processing…');
                }
              },
              // onError
              (msg) => {
                AppState.isRecording = false;
                UI.setRecordBtn(false);
                UI.setWaveformActive(false);
                UI.setRecorderStatus('', 'Ready to record');
                Toast.error(msg);
              },
              // onEnd
              () => {
                AppState.isRecording = false;
                UI.setRecordBtn(false);
                UI.setWaveformActive(false);
                UI.setRecorderStatus('', 'Ready to record');
              }
            );
          })
          .catch(err => {
            Toast.error('Microphone access denied. Please enable permissions in your browser.');
            console.error(err);
          });
      }
    });
  }

  if (copyTranscriptBtn) {
    copyTranscriptBtn.addEventListener('click', () => {
      if (!AppState.transcript) return;
      navigator.clipboard.writeText(AppState.transcript)
        .then(() => Toast.success('Transcript copied to clipboard.'))
        .catch(() => Toast.error('Could not copy. Please copy manually.'));
    });
  }

  if (clearTranscriptBtn) {
    clearTranscriptBtn.addEventListener('click', () => {
      if (AppState.isRecording) {
        SpeechEngine.stopRecognition();
        AppState.isRecording = false;
        UI.setRecordBtn(false);
        UI.setWaveformActive(false);
      }
      accumulatedTranscript = '';
      AppState.transcript = '';
      UI.setTranscript('');
      UI.setRecorderStatus('', 'Ready to record');
    });
  }
}

/* ============================================================
TEXT TO SPEECH (TTS)
============================================================ */
function initTTS() {
  const ttsInput = $id('tts-input');
  const speakBtn = $id('speak-btn');
  const stopBtn = $id('stop-btn');
  const charCount = $id('char-count');
  const downloadBtn = $id('download-audio-btn');
  const voiceSelect = $id('voice-select');
  const rateSelect = $id('rate-select');
  const pitchSelect = $id('pitch-select');

  if (ttsInput) {
    ttsInput.addEventListener('input', () => {
      const len = ttsInput.value.length;
      if (charCount) charCount.textContent = `${len} / 5000`;
      if (speakBtn) speakBtn.disabled = len === 0;
      if (charCount) charCount.style.color = len > 4500 ? 'var(--error)' : '';
    });
  }

  if (speakBtn) {
    speakBtn.addEventListener('click', () => {
      const text = ttsInput.value.trim();
      if (!text) { Toast.warning('Please enter some text first.'); return; }

      const voiceIdx = voiceSelect.value;
      // Ensure voice exists for the selected index
      const voice = (voiceIdx !== '' && AppState.voices[parseInt(voiceIdx)]) ? AppState.voices[parseInt(voiceIdx)] : null;

      const rate = rateSelect ? rateSelect.value : 1;
      const pitch = pitchSelect ? pitchSelect.value : 1;

      AppState.isSpeaking = true;
      UI.updateSpeakBtn(true);
      UI.showAudioPlayer(true);
      UI.setTTSProgress(10, 'Synthesizing audio…');

      let progress = 10;
      const progressInterval = setInterval(() => {
        progress = Math.min(progress + Math.random() * 15, 85);
        UI.setTTSProgress(progress, 'Synthesizing audio…');
      }, 300);

      SpeechEngine.speak(
        text, voice, rate, pitch,
        // onStart
        () => {
          clearInterval(progressInterval);
          UI.setTTSProgress(100, 'Playing…');
          Toast.success('Audio synthesis complete.');
          if (downloadBtn) downloadBtn.disabled = true;
        },
        // onEnd
        () => {
          clearInterval(progressInterval);
          AppState.isSpeaking = false;
          UI.updateSpeakBtn(false);
          UI.setTTSProgress(100, 'Playback complete.');
          const badge = $id('audio-playing-badge');
          if (badge) badge.innerHTML = `<span style="color:var(--text-muted);font-weight:500;font-size:.75rem">Playback complete</span>`;
        },
        // onError
        (msg) => {
          clearInterval(progressInterval);
          AppState.isSpeaking = false;
          UI.updateSpeakBtn(false);
          UI.showAudioPlayer(false);
          Toast.error(msg);
        }
      );
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      SpeechEngine.stop();
      AppState.isSpeaking = false;
      UI.updateSpeakBtn(false);
      UI.setTTSProgress(0, '');
      UI.showAudioPlayer(false);
      Toast.info('Playback stopped.');
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      Toast.info('Download is available only with Azure TTS. Web Speech API does not expose audio data.');
    });
  }
}

/* ============================================================
BOOT
============================================================ */
async function init() {
  Toast.init();
  initTheme();
  initTabs();
  initCredentials();
  initSTT();
  initTTS();

  // Load voices and populate language dropdowns
  await loadVoicesAndLanguages();

  const themeToggle = $id('theme-toggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  const hasSpeechRecog = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const hasSpeechSynth = !!window.speechSynthesis;

  if (!hasSpeechRecog) {
    Toast.warning('Speech recognition not supported. Use Chrome or Edge for STT.');
    const recordBtn = $id('record-btn');
    if (recordBtn) recordBtn.disabled = true;
  }
  if (!hasSpeechSynth) {
    Toast.warning('Speech synthesis not supported in this browser.');
    const speakBtn = $id('speak-btn');
    if (speakBtn) speakBtn.disabled = true;
  }
}

document.addEventListener('DOMContentLoaded', init);
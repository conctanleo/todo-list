import { escapeHtml } from './state.js';

const EYE_TIPS = [
  { icon: '\u{1F440}', text: '站起来看看窗外，让眼睛休息一下吧。\n远处的绿色对眼睛最友好。' },
  { icon: '\u{1F504}', text: '闭上眼睛，轻轻转动眼球，\n顺时针 5 圈，逆时针 5 圈。' },
  { icon: '\u{1F932}', text: '用双手搓热，轻轻敷在眼睛上，\n感受温暖，放松眼部肌肉。' },
  { icon: '\u{1F6B6}', text: '站起来走动一下，\n伸展手臂和肩膀，活动颈椎。' },
  { icon: '\u{1F4CF}', text: '遵循 20-20-20 法则：\n每 20 分钟，看 20 英尺外，持续 20 秒。' }
];

function parseParams() {
  const raw = location.hash.includes('?') ? location.hash.split('?')[1] : '';
  const params = new URLSearchParams(raw);
  return {
    taskName: params.get('task') || '',
    duration: Math.max(60, parseInt(params.get('duration'), 10) || 300)
  };
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function showConfirm(onConfirm, onCancel) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <p class="confirm-text">确定要提前结束护眼休息吗？</p>
      <div class="confirm-buttons">
        <button class="btn-cancel">再休息一会</button>
        <button class="btn-confirm">确认跳过</button>
      </div>
    </div>
  `;
  overlay.querySelector('.btn-cancel').addEventListener('click', () => {
    overlay.remove();
    onCancel();
  });
  overlay.querySelector('.btn-confirm').addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });
  document.body.appendChild(overlay);
}

export async function initLockScreen() {
  const { taskName, duration } = parseParams();
  const safeTaskName = escapeHtml(taskName);

  document.body.style.background = 'linear-gradient(160deg, #2d4a3e 0%, #1a3328 30%, #243b2e 60%, #1e3528 100%)';
  document.body.style.minHeight = '100vh';
  document.body.innerHTML = `
    <div class="lock-container">
      <div class="lock-icon">🌿</div>
      <p class="lock-label">护眼休息</p>
      <div class="lock-task">刚刚专注：${safeTaskName}</div>
      <div class="countdown">
        <span class="time" id="countdownTime">${formatTime(duration)}</span>
        <span class="time-sub">后自动解锁</span>
      </div>
      <div class="tip-box">
        <span class="tip-icon" id="tipIcon">👀</span>
        <p class="tip-text" id="tipText"></p>
      </div>
      <button class="skip-btn" id="skipBtn">跳过休息</button>
    </div>
  `;

  let remaining = duration;
  let confirmOpen = false;
  let lastTickAt = Date.now();

  function updateTip() {
    const tip = EYE_TIPS[Math.floor(Math.random() * EYE_TIPS.length)];
    document.getElementById('tipIcon').textContent = tip.icon;
    document.getElementById('tipText').textContent = tip.text;
  }
  updateTip();

  const tipTimer = setInterval(updateTip, 30000);

  const countdownTick = setInterval(async () => {
    if (confirmOpen) return;
    const now = Date.now();
    const delta = (now - lastTickAt) / 1000;
    lastTickAt = now;
    remaining = Math.max(0, remaining - delta);
    document.getElementById('countdownTime').textContent = formatTime(remaining);

    if (remaining <= 0) {
      clearInterval(countdownTick);
      clearInterval(tipTimer);
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        win.close();
      } catch {}
    }
  }, 250);

  document.getElementById('skipBtn').addEventListener('click', () => {
    confirmOpen = true;
    showConfirm(
      async () => {
        clearInterval(countdownTick);
        clearInterval(tipTimer);
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const win = getCurrentWindow();
          win.close();
        } catch {}
      },
      () => {
        confirmOpen = false;
      }
    );
  });
}

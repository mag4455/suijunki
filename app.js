const startBtn = document.getElementById('startBtn');
const calibControls = document.getElementById('calibControls');
const calibBtn = document.getElementById('calibBtn');
const resetBtn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');

const rowXY = document.querySelector('.vial-row[data-axis="xy"]');
const rowZ = document.querySelector('.vial-row[data-axis="z"]');
const bubbleXY = document.getElementById('bubbleXY');
const bubbleZ = document.getElementById('bubbleZ');
const readoutX = document.getElementById('readoutX');
const readoutY = document.getElementById('readoutY');
const readoutZ = document.getElementById('readoutZ');

const ROUND_TRAVEL_PX = 58;
const VERTICAL_TRAVEL_PX = 55;
const ANGLE_FOR_FULL_TRAVEL_ROUND = 12;
const ANGLE_FOR_FULL_TRAVEL_VERTICAL = 45;
const LEVEL_TOLERANCE_DEG = 0.5;

const STORAGE_KEY = 'suijunki-calibration';
let calibration = { beta: 0, gamma: 0 };
let latestBeta = null;
let latestGamma = null;

function loadCalibration() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.beta === 'number' && typeof parsed.gamma === 'number') {
        calibration = parsed;
      }
    }
  } catch (e) {
    // localStorageが使えない環境(プライベートモード等)ではそのまま無校正で続行
  }
}

function saveCalibration() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calibration));
  } catch (e) {
    // 保存できなくても計測自体は継続する
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function angleToOffset(angleDeg, angleForFullTravel, travelPx) {
  const ratio = clamp(angleDeg / angleForFullTravel, -1, 1);
  return -ratio * travelPx;
}

function setReadout(readoutEl, angleDeg) {
  const sign = angleDeg > 0 ? '+' : '';
  readoutEl.textContent = `${sign}${angleDeg.toFixed(1)}°`;
  readoutEl.classList.toggle('ok', Math.abs(angleDeg) < LEVEL_TOLERANCE_DEG);
}

// 円形バイアル: 気泡は皿の外周からはみ出さないよう、ベクトルの長さで丸くクランプする
function setRoundVial(bubbleEl, rowEl, rollAngle, pitchAngle) {
  let vx = -rollAngle / ANGLE_FOR_FULL_TRAVEL_ROUND;
  let vy = -pitchAngle / ANGLE_FOR_FULL_TRAVEL_ROUND;
  const magnitude = Math.hypot(vx, vy);
  if (magnitude > 1) {
    vx /= magnitude;
    vy /= magnitude;
  }

  bubbleEl.style.transform = `translate(${(vx * ROUND_TRAVEL_PX).toFixed(1)}px, ${(vy * ROUND_TRAVEL_PX).toFixed(1)}px)`;

  const isLevel = Math.hypot(rollAngle, pitchAngle) < LEVEL_TOLERANCE_DEG;
  rowEl.classList.toggle('is-level', isLevel);
}

function setVial(bubbleEl, readoutEl, rowEl, angleDeg, angleForFullTravel, travelPx) {
  bubbleEl.style.transform = `translateY(${angleToOffset(angleDeg, angleForFullTravel, travelPx).toFixed(1)}px)`;
  setReadout(readoutEl, angleDeg);
  rowEl.classList.toggle('is-level', Math.abs(angleDeg) < LEVEL_TOLERANCE_DEG);
}

function handleOrientation(event) {
  if (typeof event.beta !== 'number' || typeof event.gamma !== 'number') {
    return;
  }

  latestBeta = event.beta;
  latestGamma = event.gamma;

  const rollAngle = event.gamma - calibration.gamma;
  const pitchAngle = event.beta - calibration.beta;
  const plumbAngle = (event.beta - 90) - calibration.beta;

  setRoundVial(bubbleXY, rowXY, rollAngle, pitchAngle);
  setReadout(readoutX, rollAngle);
  setReadout(readoutY, pitchAngle);
  setVial(bubbleZ, readoutZ, rowZ, plumbAngle, ANGLE_FOR_FULL_TRAVEL_VERTICAL, VERTICAL_TRAVEL_PX);
}

function startLevel() {
  statusEl.textContent = 'センサーを取得中...';

  if (!window.isSecureContext) {
    statusEl.textContent = 'この機能は HTTPS またはローカル環境でのみ動作します。';
    return;
  }

  const start = () => {
    window.addEventListener('deviceorientation', handleOrientation, true);
    statusEl.textContent = 'センサー計測中。水平/垂直を確認してください。';
    calibControls.hidden = false;
  };

  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then((response) => {
        if (response === 'granted') {
          start();
        } else {
          statusEl.textContent = 'センサーへのアクセスが許可されませんでした。';
        }
      })
      .catch(() => {
        statusEl.textContent = 'センサーへのアクセスに失敗しました。';
      });
  } else if ('DeviceOrientationEvent' in window) {
    start();
  } else {
    statusEl.textContent = 'このデバイス・ブラウザは方位センサーに対応していません。';
  }
}

function calibrateZero() {
  if (latestBeta === null || latestGamma === null) {
    return;
  }
  calibration = { beta: latestBeta, gamma: latestGamma };
  saveCalibration();
  statusEl.textContent = '現在の姿勢をゼロ点として校正しました。';
}

function resetCalibration() {
  calibration = { beta: 0, gamma: 0 };
  saveCalibration();
  statusEl.textContent = '校正をリセットしました。';
}

loadCalibration();
startBtn.addEventListener('click', startLevel);
calibBtn.addEventListener('click', calibrateZero);
resetBtn.addEventListener('click', resetCalibration);

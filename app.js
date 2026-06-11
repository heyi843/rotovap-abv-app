const STORAGE_KEY = "rotovap-proof-dial-state-v1";
const HISTORY_KEY = "rotovap-proof-dial-history-v1";
const HISTORY_LIMIT = 8;

const modeMeta = {
  water: {
    label: "加水降度",
    hint: "已知当前体积和当前酒精度，直接算要加多少水才能降到目标度数。"
  },
  fortify: {
    label: "升度补酒",
    hint: "当旋蒸后度数不够时，用更高酒精度的酒液把整批拉回目标度数。"
  },
  conserve: {
    label: "守恒换算",
    hint: "只按纯酒精守恒计算目标体积，适合判断还要继续浓缩到哪里，或理论上应回调到多少总量。"
  }
};

const defaultState = {
  mode: "water",
  unit: "ml",
  currentVolume: 500,
  currentAbv: 32,
  targetAbv: 18,
  fortifierAbv: 95
};

const state = loadState();
let history = loadHistory();
let installPromptEvent = null;
let toastTimer = null;
let lastResult = null;

const elements = {
  modeButtons: [...document.querySelectorAll(".mode-button")],
  modeHint: document.getElementById("modeHint"),
  unitSelect: document.getElementById("unitSelect"),
  currentVolumeInput: document.getElementById("currentVolumeInput"),
  currentAbvInput: document.getElementById("currentAbvInput"),
  targetAbvInput: document.getElementById("targetAbvInput"),
  fortifierAbvInput: document.getElementById("fortifierAbvInput"),
  fortifierField: document.getElementById("fortifierField"),
  fortifierPresets: document.getElementById("fortifierPresets"),
  targetChips: [...document.querySelectorAll("[data-target-abv]")],
  fortifierChips: [...document.querySelectorAll("[data-fortifier-abv]")],
  resultKicker: document.getElementById("resultKicker"),
  headlineResult: document.getElementById("headlineResult"),
  resultSummary: document.getElementById("resultSummary"),
  pureAlcoholMetric: document.getElementById("pureAlcoholMetric"),
  finalVolumeMetric: document.getElementById("finalVolumeMetric"),
  changeMetric: document.getElementById("changeMetric"),
  changeCaption: document.getElementById("changeCaption"),
  batchMetric: document.getElementById("batchMetric"),
  batchCaption: document.getElementById("batchCaption"),
  equationNote: document.getElementById("equationNote"),
  errorBox: document.getElementById("errorBox"),
  copyBtn: document.getElementById("copyBtn"),
  saveBtn: document.getElementById("saveBtn"),
  resetBtn: document.getElementById("resetBtn"),
  historyList: document.getElementById("historyList"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn"),
  toast: document.getElementById("toast"),
  installAppBtn: document.getElementById("installAppBtn")
};

bindEvents();
hydrateInputs();
render();
renderHistory();
registerServiceWorker();

function bindEvents() {
  elements.modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      persistState();
      render();
    });
  });

  elements.unitSelect.addEventListener("change", (event) => {
    state.unit = event.target.value;
    persistState();
    render();
  });

  [
    [elements.currentVolumeInput, "currentVolume"],
    [elements.currentAbvInput, "currentAbv"],
    [elements.targetAbvInput, "targetAbv"],
    [elements.fortifierAbvInput, "fortifierAbv"]
  ].forEach(([input, key]) => {
    input.addEventListener("input", () => {
      state[key] = normalizeNumber(input.value);
      persistState();
      render();
    });
  });

  elements.targetChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      state.targetAbv = Number(chip.dataset.targetAbv);
      elements.targetAbvInput.value = state.targetAbv;
      persistState();
      render();
    });
  });

  elements.fortifierChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      state.fortifierAbv = Number(chip.dataset.fortifierAbv);
      elements.fortifierAbvInput.value = state.fortifierAbv;
      persistState();
      render();
    });
  });

  elements.copyBtn.addEventListener("click", copyResult);
  elements.saveBtn.addEventListener("click", saveCurrentBatch);
  elements.resetBtn.addEventListener("click", resetState);
  elements.clearHistoryBtn.addEventListener("click", clearHistory);
  elements.installAppBtn.addEventListener("click", promptInstall);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPromptEvent = event;
    elements.installAppBtn.classList.remove("is-hidden");
  });
}

function hydrateInputs() {
  elements.unitSelect.value = state.unit;
  elements.currentVolumeInput.value = state.currentVolume;
  elements.currentAbvInput.value = state.currentAbv;
  elements.targetAbvInput.value = state.targetAbv;
  elements.fortifierAbvInput.value = state.fortifierAbv;
}

function render() {
  elements.modeButtons.forEach((button) => {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });

  elements.modeHint.textContent = modeMeta[state.mode].hint;
  const isFortifyMode = state.mode === "fortify";

  elements.fortifierField.classList.toggle("is-hidden", !isFortifyMode);
  elements.fortifierPresets.classList.toggle("is-hidden", !isFortifyMode);

  const result = calculateResult(state);
  lastResult = result;

  if (!result.ok) {
    renderError(result.error);
    return;
  }

  renderSuccess(result);
}

function renderError(message) {
  elements.errorBox.textContent = message;
  elements.resultKicker.textContent = modeMeta[state.mode].label;
  elements.headlineResult.textContent = "请先修正输入";
  elements.resultSummary.textContent = message;
  elements.pureAlcoholMetric.textContent = formatVolume(0, state.unit);
  elements.finalVolumeMetric.textContent = formatVolume(0, state.unit);
  elements.changeMetric.textContent = formatSignedVolume(0, state.unit);
  elements.batchMetric.textContent = `${formatVolume(0, state.unit)} @ 0%`;
  elements.batchCaption.textContent = "目标还未设定";
  elements.changeCaption.textContent = "和当前体积相比";
  elements.equationNote.textContent = "纯酒精量守恒：当前体积 × 当前酒精度 = 目标体积 × 目标酒精度。";
}

function renderSuccess(result) {
  elements.errorBox.textContent = "";
  elements.resultKicker.textContent = modeMeta[state.mode].label;
  elements.headlineResult.textContent = result.headline;
  elements.resultSummary.textContent = result.summary;
  elements.pureAlcoholMetric.textContent = formatVolume(result.pureAlcohol, state.unit);
  elements.finalVolumeMetric.textContent = formatVolume(result.finalVolume, state.unit);
  elements.changeMetric.textContent = formatSignedVolume(result.changeVolume, state.unit);
  elements.changeCaption.textContent = result.changeCaption;
  elements.batchMetric.textContent = `${formatVolume(result.currentVolume, state.unit)} @ ${formatPercent(result.currentAbv)}`;
  elements.batchCaption.textContent = `目标 ${formatPercent(result.targetAbv)}`;
  elements.equationNote.textContent = result.equation;
}

function calculateResult(values) {
  const currentVolume = Number(values.currentVolume);
  const currentAbv = Number(values.currentAbv);
  const targetAbv = Number(values.targetAbv);
  const fortifierAbv = Number(values.fortifierAbv);

  if (!isFinitePositive(currentVolume)) {
    return { ok: false, error: "当前体积需要大于 0。" };
  }

  if (!isFiniteAbv(currentAbv)) {
    return { ok: false, error: "当前酒精度需要在 0 到 100 之间。" };
  }

  if (!isFinitePositive(targetAbv) || targetAbv >= 100) {
    return { ok: false, error: "目标酒精度需要大于 0 且小于 100。" };
  }

  const pureAlcohol = currentVolume * (currentAbv / 100);

  if (values.mode === "water") {
    if (targetAbv >= currentAbv) {
      return { ok: false, error: "加水降度模式下，目标酒精度必须低于当前酒精度。" };
    }

    const finalVolume = pureAlcohol / (targetAbv / 100);
    const addWater = finalVolume - currentVolume;

    if (addWater < 0) {
      return { ok: false, error: "这组数值不需要加水，请检查输入。" };
    }

    return {
      ok: true,
      mode: values.mode,
      currentVolume,
      currentAbv,
      targetAbv,
      pureAlcohol,
      finalVolume,
      changeVolume: addWater,
      changeCaption: "需要补入的水量",
      headline: `加水 ${formatVolume(addWater, values.unit)}`,
      summary: `当前这批酒液里约有 ${formatVolume(pureAlcohol, values.unit)} 纯酒精。若把酒精度从 ${formatPercent(currentAbv)} 降到 ${formatPercent(targetAbv)}，理论上需要把总体积回调到 ${formatVolume(finalVolume, values.unit)}，也就是补水 ${formatVolume(addWater, values.unit)}。`,
      equation: `先算纯酒精量：${formatVolume(currentVolume, values.unit)} × ${formatPercent(currentAbv)}。再按纯酒精守恒，目标总体积 = 纯酒精量 / 目标酒精度。`
    };
  }

  if (values.mode === "fortify") {
    if (!isFinitePositive(fortifierAbv) || fortifierAbv >= 100) {
      return { ok: false, error: "补入酒液的酒精度需要大于 0 且小于 100。" };
    }

    if (targetAbv <= currentAbv) {
      return { ok: false, error: "升度补酒模式下，目标酒精度必须高于当前酒精度。" };
    }

    if (fortifierAbv <= targetAbv) {
      return { ok: false, error: "补入酒液的酒精度必须高于目标酒精度，否则无法把整批拉到目标。" };
    }

    const addSpirit = currentVolume * ((targetAbv - currentAbv) / (fortifierAbv - targetAbv));
    const finalVolume = currentVolume + addSpirit;

    return {
      ok: true,
      mode: values.mode,
      currentVolume,
      currentAbv,
      targetAbv,
      pureAlcohol,
      finalVolume,
      changeVolume: addSpirit,
      changeCaption: "需要补入的高酒度酒液",
      headline: `补入 ${formatVolume(addSpirit, values.unit)} 的 ${formatPercent(fortifierAbv)}`,
      summary: `若当前是 ${formatVolume(currentVolume, values.unit)} @ ${formatPercent(currentAbv)}，想升到 ${formatPercent(targetAbv)}，并且你手上补入的是 ${formatPercent(fortifierAbv)} 的酒液，那么理论上需要加入 ${formatVolume(addSpirit, values.unit)}，最终总量会变成 ${formatVolume(finalVolume, values.unit)}。`,
      equation: `升度补酒公式：补入量 = 当前体积 × (目标度数 - 当前度数) / (补酒度数 - 目标度数)。这一步同时考虑了补入液体带来的体积变化。`
    };
  }

  const finalVolume = pureAlcohol / (targetAbv / 100);
  const changeVolume = finalVolume - currentVolume;
  const direction =
    changeVolume > 0
      ? "补足"
      : changeVolume < 0
        ? "继续浓缩"
        : "保持当前体积";
  const absoluteChange = Math.abs(changeVolume);
  const changeCaption =
    changeVolume > 0
      ? "若回调到目标，需要额外补足"
      : changeVolume < 0
        ? "若只靠浓缩，还需减少的体积"
        : "当前体积已经等于理论目标";
  const summaryAction =
    changeVolume > 0
      ? `需要补足 ${formatVolume(absoluteChange, values.unit)}。`
      : changeVolume < 0
        ? `需要继续浓缩 ${formatVolume(absoluteChange, values.unit)}。`
        : "当前体积已经处在理论终点，不需要再改体积。";

  return {
    ok: true,
    mode: values.mode,
    currentVolume,
      currentAbv,
      targetAbv,
      pureAlcohol,
      finalVolume,
      changeVolume,
      changeCaption,
      headline: `目标总量 ${formatVolume(finalVolume, values.unit)}`,
      summary: `按纯酒精守恒估算，这批 ${formatVolume(currentVolume, values.unit)} @ ${formatPercent(currentAbv)} 的酒液，如果目标是 ${formatPercent(targetAbv)}，理论终点应是 ${formatVolume(finalVolume, values.unit)}。相对当前体积，${summaryAction}`,
      equation: `纯酒精守恒换算：目标总体积 = 当前体积 × 当前酒精度 / 目标酒精度。这个模式只告诉你理论终点，不限定你用加水、补酒还是继续蒸发去实现。`
    };
}

async function copyResult() {
  if (!lastResult || !lastResult.ok) {
    showToast("先输入一组有效数值。");
    return;
  }

  const copyText = `${modeMeta[lastResult.mode].label}｜${lastResult.headline}｜${lastResult.summary}`;

  try {
    await navigator.clipboard.writeText(copyText);
    showToast("结果已复制。");
  } catch (error) {
    showToast("复制失败，请在本地服务或 HTTPS 环境下使用。");
  }
}

function saveCurrentBatch() {
  if (!lastResult || !lastResult.ok) {
    showToast("当前结果无效，不能保存。");
    return;
  }

  const entry = {
    id: `${Date.now()}`,
    savedAt: Date.now(),
    stateSnapshot: { ...state },
    mode: lastResult.mode,
    title: lastResult.headline,
    summary: lastResult.summary
  };

  history = [entry, ...history].slice(0, HISTORY_LIMIT);
  persistHistory();
  renderHistory();
  showToast("当前批次已保存。");
}

function renderHistory() {
  if (!history.length) {
    elements.historyList.innerHTML = '<p class="empty-history">还没有保存记录。算出一批后点“保存当前批次”就会出现在这里。</p>';
    return;
  }

  elements.historyList.innerHTML = history
    .map(
      (entry) => `
        <article class="history-item">
          <div>
            <div class="history-meta">${formatDate(entry.savedAt)} · ${modeMeta[entry.mode].label}</div>
            <h3>${escapeHtml(entry.title)}</h3>
            <p>${escapeHtml(entry.summary)}</p>
          </div>
          <div class="history-actions">
            <button class="history-action" type="button" data-restore-id="${entry.id}">
              恢复
            </button>
            <button class="history-action" type="button" data-delete-id="${entry.id}">
              删除
            </button>
          </div>
        </article>
      `
    )
    .join("");

  [...elements.historyList.querySelectorAll("[data-restore-id]")].forEach((button) => {
    button.addEventListener("click", () => restoreHistoryEntry(button.dataset.restoreId));
  });

  [...elements.historyList.querySelectorAll("[data-delete-id]")].forEach((button) => {
    button.addEventListener("click", () => deleteHistoryEntry(button.dataset.deleteId));
  });
}

function restoreHistoryEntry(id) {
  const entry = history.find((item) => item.id === id);

  if (!entry) {
    showToast("这条记录不存在了。");
    return;
  }

  Object.assign(state, entry.stateSnapshot);
  hydrateInputs();
  persistState();
  render();
  showToast("已恢复这批参数。");
}

function deleteHistoryEntry(id) {
  history = history.filter((entry) => entry.id !== id);
  persistHistory();
  renderHistory();
  showToast("记录已删除。");
}

function clearHistory() {
  history = [];
  persistHistory();
  renderHistory();
  showToast("最近记录已清空。");
}

function resetState() {
  Object.assign(state, defaultState);
  hydrateInputs();
  persistState();
  render();
  showToast("已恢复默认参数。");
}

async function promptInstall() {
  if (!installPromptEvent) {
    showToast("当前环境还没有提供安装提示。");
    return;
  }

  installPromptEvent.prompt();
  await installPromptEvent.userChoice;
  installPromptEvent = null;
  elements.installAppBtn.classList.add("is-hidden");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      showToast("离线缓存注册失败。");
    });
  });
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 1800);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...defaultState, ...saved };
  } catch (error) {
    return { ...defaultState };
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function persistHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function isFinitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

function isFiniteAbv(value) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function formatPercent(value) {
  return `${trimNumber(value)}%`;
}

function formatSignedVolume(value, unit) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatVolume(Math.abs(value), unit)}`;
}

function formatVolume(value, unit) {
  if (!Number.isFinite(value)) {
    return unit === "l" ? "0 L" : "0 mL";
  }

  const label = unit === "l" ? "L" : "mL";
  const primary = `${trimNumber(value)} ${label}`;

  if (unit === "ml" && value >= 1000) {
    return `${primary} (${trimNumber(value / 1000)} L)`;
  }

  if (unit === "l" && value > 0 && value < 1) {
    return `${primary} (${trimNumber(value * 1000)} mL)`;
  }

  return primary;
}

function trimNumber(value) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2
  }).format(Number(value));
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

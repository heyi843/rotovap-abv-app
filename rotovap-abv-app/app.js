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
  },
  measure: {
    label: "读数校正",
    hint: "输入酒精计读数和蒸馏液温度，折算成 20°C 标准下的真实酒精度。"
  }
};

const DENSITY_TABLE = [
  { mass: 0, rho10: 0.99973, rho20: 0.99823, rho25: 0.99708, rho30: 0.99568 },
  { mass: 5, rho10: 0.99098, rho20: 0.98938, rho25: 0.98817, rho30: 0.98670 },
  { mass: 10, rho10: 0.98393, rho20: 0.98187, rho25: 0.98043, rho30: 0.97875 },
  { mass: 15, rho10: 0.97800, rho20: 0.97514, rho25: 0.97334, rho30: 0.97133 },
  { mass: 20, rho10: 0.97252, rho20: 0.96864, rho25: 0.96639, rho30: 0.96395 },
  { mass: 25, rho10: 0.96665, rho20: 0.96168, rho25: 0.95895, rho30: 0.95607 },
  { mass: 30, rho10: 0.95977, rho20: 0.95382, rho25: 0.95067, rho30: 0.94741 },
  { mass: 35, rho10: 0.95162, rho20: 0.94494, rho25: 0.94146, rho30: 0.93790 },
  { mass: 40, rho10: 0.94238, rho20: 0.93518, rho25: 0.93148, rho30: 0.92770 },
  { mass: 45, rho10: 0.93226, rho20: 0.92472, rho25: 0.92085, rho30: 0.91692 },
  { mass: 50, rho10: 0.92162, rho20: 0.91384, rho25: 0.90985, rho30: 0.90580 },
  { mass: 55, rho10: 0.91055, rho20: 0.90258, rho25: 0.89850, rho30: 0.89437 },
  { mass: 60, rho10: 0.89927, rho20: 0.89113, rho25: 0.88699, rho30: 0.88278 },
  { mass: 65, rho10: 0.88774, rho20: 0.87948, rho25: 0.87527, rho30: 0.87100 },
  { mass: 70, rho10: 0.87602, rho20: 0.86766, rho25: 0.86340, rho30: 0.85908 },
  { mass: 75, rho10: 0.86408, rho20: 0.85564, rho25: 0.85135, rho30: 0.84698 },
  { mass: 80, rho10: 0.85197, rho20: 0.84344, rho25: 0.83911, rho30: 0.83473 },
  { mass: 85, rho10: 0.83951, rho20: 0.83095, rho25: 0.82660, rho30: 0.82220 },
  { mass: 90, rho10: 0.82654, rho20: 0.81797, rho25: 0.81362, rho30: 0.80922 },
  { mass: 95, rho10: 0.81278, rho20: 0.80424, rho25: 0.79991, rho30: 0.79555 },
  { mass: 100, rho10: 0.79784, rho20: 0.78934, rho25: 0.78506, rho30: 0.78075 }
];

const STANDARD_TEMP_C = 20;
const ETHANOL_DENSITY_20C = 0.78934;

const defaultState = {
  mode: "water",
  unit: "ml",
  currentVolume: 500,
  currentAbv: 32,
  targetAbv: 18,
  fortifierAbv: 95,
  measuredAbv: 40,
  sampleTemp: 25
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
  measuredAbvInput: document.getElementById("measuredAbvInput"),
  sampleTempInput: document.getElementById("sampleTempInput"),
  standardFieldGrid: document.getElementById("standardFieldGrid"),
  measurementFieldGrid: document.getElementById("measurementFieldGrid"),
  fortifierField: document.getElementById("fortifierField"),
  targetPresets: document.getElementById("targetPresets"),
  fortifierPresets: document.getElementById("fortifierPresets"),
  temperaturePresets: document.getElementById("temperaturePresets"),
  targetChips: [...document.querySelectorAll("[data-target-abv]")],
  fortifierChips: [...document.querySelectorAll("[data-fortifier-abv]")],
  temperatureChips: [...document.querySelectorAll("[data-sample-temp]")],
  resultKicker: document.getElementById("resultKicker"),
  headlineResult: document.getElementById("headlineResult"),
  resultSummary: document.getElementById("resultSummary"),
  metricOneLabel: document.getElementById("metricOneLabel"),
  metricOneCaption: document.getElementById("metricOneCaption"),
  metricTwoLabel: document.getElementById("metricTwoLabel"),
  metricTwoCaption: document.getElementById("metricTwoCaption"),
  metricThreeLabel: document.getElementById("metricThreeLabel"),
  metricFourLabel: document.getElementById("metricFourLabel"),
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
    [elements.fortifierAbvInput, "fortifierAbv"],
    [elements.measuredAbvInput, "measuredAbv"],
    [elements.sampleTempInput, "sampleTemp"]
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

  elements.temperatureChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      state.sampleTemp = Number(chip.dataset.sampleTemp);
      elements.sampleTempInput.value = state.sampleTemp;
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
  elements.measuredAbvInput.value = state.measuredAbv;
  elements.sampleTempInput.value = state.sampleTemp;
}

function render() {
  elements.modeButtons.forEach((button) => {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });

  elements.modeHint.textContent = modeMeta[state.mode].hint;
  const isFortifyMode = state.mode === "fortify";
  const isMeasureMode = state.mode === "measure";

  elements.standardFieldGrid.classList.toggle("is-hidden", isMeasureMode);
  elements.measurementFieldGrid.classList.toggle("is-hidden", !isMeasureMode);
  elements.fortifierField.classList.toggle("is-hidden", !isFortifyMode);
  elements.targetPresets.classList.toggle("is-hidden", isMeasureMode);
  elements.fortifierPresets.classList.toggle("is-hidden", !isFortifyMode || isMeasureMode);
  elements.temperaturePresets.classList.toggle("is-hidden", !isMeasureMode);

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
  elements.metricOneLabel.textContent = state.mode === "measure" ? "酒精计读数" : "当前纯酒精量";
  elements.metricOneCaption.textContent = state.mode === "measure" ? "仪器在当前温度下显示的度数" : "按输入体积和当前度数计算";
  elements.metricTwoLabel.textContent = state.mode === "measure" ? "液体温度" : "目标总量";
  elements.metricTwoCaption.textContent = state.mode === "measure" ? "测量时蒸馏液的温度" : "回调后最终理论体积";
  elements.metricThreeLabel.textContent = state.mode === "measure" ? "校正差值" : "变化量";
  elements.metricFourLabel.textContent = state.mode === "measure" ? "标准温度" : "当前批次概览";
  if (state.mode === "measure") {
    elements.pureAlcoholMetric.textContent = formatPercent(state.measuredAbv || 0);
    elements.finalVolumeMetric.textContent = formatTemperature(state.sampleTemp || STANDARD_TEMP_C);
    elements.changeMetric.textContent = formatSignedPercent(0);
    elements.batchMetric.textContent = `${STANDARD_TEMP_C}°C`;
    elements.batchCaption.textContent = "按 20°C 酒精计校准";
    elements.changeCaption.textContent = "校正后度数 - 原始读数";
    elements.equationNote.textContent = "校正逻辑：酒精计读数换算为密度，再按测量温度反推真实 ABV。";
    return;
  }

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
  renderMetrics(result.metrics || getStandardMetrics(result));
  elements.equationNote.textContent = result.equation;
}

function calculateResult(values) {
  if (values.mode === "measure") {
    return calculateMeasurementResult(values);
  }

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

function calculateMeasurementResult(values) {
  const measuredAbv = Number(values.measuredAbv);
  const sampleTemp = Number(values.sampleTemp);

  if (!isFiniteAbv(measuredAbv)) {
    return { ok: false, error: "酒精计读数需要在 0 到 100 之间。" };
  }

  if (!Number.isFinite(sampleTemp) || sampleTemp < 0 || sampleTemp > 40) {
    return { ok: false, error: "液体温度建议输入 0°C 到 40°C 之间的数值。" };
  }

  const apparentMass = massFromAbvAt20(measuredAbv);
  const observedDensity = densityAtTemp(apparentMass, STANDARD_TEMP_C);
  const correctedMass = massFromDensityAtTemp(observedDensity, sampleTemp);

  if (correctedMass === null) {
    return {
      ok: false,
      error: "这组读数和温度超出当前乙醇-水密度表可校正范围，建议把样品降到接近 20°C 后再测。"
    };
  }

  const correctedAbv = abvFromMassAt20(correctedMass);
  const delta = correctedAbv - measuredAbv;
  const bias =
    Math.abs(delta) < 0.01
      ? "读数基本不需要修正"
      : delta < 0
        ? "原读数偏高"
        : "原读数偏低";
  const biasSentence =
    Math.abs(delta) < 0.01
      ? "读数基本不需要修正。"
      : `${bias} ${formatSignedPercent(delta)}。`;
  const rangeNote =
    sampleTemp < 10 || sampleTemp > 30
      ? "当前温度已超出 10-30°C 表格范围，结果为外推估算。"
      : "当前温度落在密度表插值范围内。";

  return {
    ok: true,
    mode: values.mode,
    measuredAbv,
    sampleTemp,
    correctedAbv,
    correctionDelta: delta,
    headline: `校正后 ${formatPercent(correctedAbv)}`,
    summary: `酒精计在 ${formatTemperature(sampleTemp)} 时读到 ${formatPercent(measuredAbv)}，按 20°C 标准校正后约为 ${formatPercent(correctedAbv)}。${biasSentence}${rangeNote}`,
    equation: "校正逻辑：酒精计读数先换算为 20°C 标准密度，再用乙醇-水密度表按测量温度反推真实质量分数，最后折算成 20°C 体积分数 ABV。",
    metrics: [
      {
        label: "酒精计读数",
        value: formatPercent(measuredAbv),
        caption: "仪器在当前温度下显示的度数"
      },
      {
        label: "液体温度",
        value: formatTemperature(sampleTemp),
        caption: "测量时蒸馏液的温度"
      },
      {
        label: "校正差值",
        value: formatSignedPercent(delta),
        caption: "校正后度数 - 原始读数"
      },
      {
        label: "标准温度",
        value: `${STANDARD_TEMP_C}°C`,
        caption: "按 20°C 酒精计校准"
      }
    ]
  };
}

function renderMetrics(metrics) {
  const [one, two, three, four] = metrics;
  elements.metricOneLabel.textContent = one.label;
  elements.pureAlcoholMetric.textContent = one.value;
  elements.metricOneCaption.textContent = one.caption;
  elements.metricTwoLabel.textContent = two.label;
  elements.finalVolumeMetric.textContent = two.value;
  elements.metricTwoCaption.textContent = two.caption;
  elements.metricThreeLabel.textContent = three.label;
  elements.changeMetric.textContent = three.value;
  elements.changeCaption.textContent = three.caption;
  elements.metricFourLabel.textContent = four.label;
  elements.batchMetric.textContent = four.value;
  elements.batchCaption.textContent = four.caption;
}

function getStandardMetrics(result) {
  return [
    {
      label: "当前纯酒精量",
      value: formatVolume(result.pureAlcohol, state.unit),
      caption: "按输入体积和当前度数计算"
    },
    {
      label: "目标总量",
      value: formatVolume(result.finalVolume, state.unit),
      caption: "回调后最终理论体积"
    },
    {
      label: "变化量",
      value: formatSignedVolume(result.changeVolume, state.unit),
      caption: result.changeCaption
    },
    {
      label: "当前批次概览",
      value: `${formatVolume(result.currentVolume, state.unit)} @ ${formatPercent(result.currentAbv)}`,
      caption: `目标 ${formatPercent(result.targetAbv)}`
    }
  ];
}

function massFromAbvAt20(targetAbv) {
  if (targetAbv <= 0) {
    return 0;
  }

  if (targetAbv >= 100) {
    return 100;
  }

  let low = 0;
  let high = 100;

  for (let index = 0; index < 40; index += 1) {
    const mid = (low + high) / 2;
    const abv = abvFromMassAt20(mid);

    if (abv < targetAbv) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

function massFromDensityAtTemp(targetDensity, temp) {
  const maxDensity = densityAtTemp(0, temp);
  const minDensity = densityAtTemp(100, temp);

  if (targetDensity > maxDensity + 0.0001 || targetDensity < minDensity - 0.0001) {
    return null;
  }

  let low = 0;
  let high = 100;

  for (let index = 0; index < 44; index += 1) {
    const mid = (low + high) / 2;
    const density = densityAtTemp(mid, temp);

    if (density > targetDensity) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

function abvFromMassAt20(massPercent) {
  const massFraction = massPercent / 100;
  return (massFraction * densityAtTemp(massPercent, STANDARD_TEMP_C) / ETHANOL_DENSITY_20C) * 100;
}

function densityAtTemp(massPercent, temp) {
  const mass = Math.min(100, Math.max(0, massPercent));
  const upperIndex = DENSITY_TABLE.findIndex((entry) => entry.mass >= mass);

  if (upperIndex <= 0) {
    return densityFromRowAtTemp(DENSITY_TABLE[0], temp);
  }

  const upper = DENSITY_TABLE[upperIndex];
  const lower = DENSITY_TABLE[upperIndex - 1];

  if (!upper) {
    return densityFromRowAtTemp(DENSITY_TABLE[DENSITY_TABLE.length - 1], temp);
  }

  return interpolate(
    lower.mass,
    densityFromRowAtTemp(lower, temp),
    upper.mass,
    densityFromRowAtTemp(upper, temp),
    mass
  );
}

function densityFromRowAtTemp(row, temp) {
  if (temp <= 20) {
    return interpolate(10, row.rho10, 20, row.rho20, temp);
  }

  if (temp <= 25) {
    return interpolate(20, row.rho20, 25, row.rho25, temp);
  }

  return interpolate(25, row.rho25, 30, row.rho30, temp);
}

function interpolate(x1, y1, x2, y2, x) {
  return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
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

function formatSignedPercent(value) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatPercent(Math.abs(value))}`;
}

function formatTemperature(value) {
  return `${trimNumber(value)}°C`;
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

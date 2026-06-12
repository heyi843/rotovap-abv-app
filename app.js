const STORAGE_KEY = "bar-flavour-training-markdown-v1";
const SECTION_KEY = "bar-flavour-training-active-section";

const state = {
  markdown: "",
  defaultMarkdown: "",
  sections: [],
  title: "BAR FLAVOUR 培训手册",
  taglines: [],
  activeIndex: 0,
  query: "",
  installPrompt: null,
  toastTimer: null
};

const els = {
  shell: document.getElementById("appShell"),
  searchInput: document.getElementById("searchInput"),
  clearSearchButton: document.getElementById("clearSearchButton"),
  metricsStrip: document.getElementById("metricsStrip"),
  moduleRail: document.getElementById("moduleRail"),
  sectionIndexLabel: document.getElementById("sectionIndexLabel"),
  sectionTitle: document.getElementById("sectionTitle"),
  sectionBody: document.getElementById("sectionBody"),
  editor: document.getElementById("editor"),
  editCurrentButton: document.getElementById("editCurrentButton"),
  saveButton: document.getElementById("saveButton"),
  previewButton: document.getElementById("previewButton"),
  exportButton: document.getElementById("exportButton"),
  importButton: document.getElementById("importButton"),
  importFile: document.getElementById("importFile"),
  copyButton: document.getElementById("copyButton"),
  resetButton: document.getElementById("resetButton"),
  installButton: document.getElementById("installButton"),
  toast: document.getElementById("toast")
};

function init() {
  marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: false,
    mangle: false
  });

  state.defaultMarkdown = window.DEFAULT_MARKDOWN || "";
  state.markdown = localStorage.getItem(STORAGE_KEY) || state.defaultMarkdown;
  state.activeIndex = Number(localStorage.getItem(SECTION_KEY) || 0);
  els.editor.value = state.markdown;

  bindEvents();
  showView("manual");
  parseAndRender();
  registerServiceWorker();
  refreshIcons();
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderModuleRail();
  });

  els.clearSearchButton.addEventListener("click", () => {
    state.query = "";
    els.searchInput.value = "";
    renderModuleRail();
    els.searchInput.focus();
  });

  els.editCurrentButton.addEventListener("click", () => {
    showView("editor");
    focusCurrentSectionInEditor();
  });

  els.saveButton.addEventListener("click", saveEditor);
  els.previewButton.addEventListener("click", () => {
    saveEditor({ quiet: true });
    showView("manual");
    toast("已保存并刷新预览");
  });
  els.exportButton.addEventListener("click", exportMarkdown);
  els.importButton.addEventListener("click", () => els.importFile.click());
  els.copyButton.addEventListener("click", copyMarkdown);
  els.resetButton.addEventListener("click", resetMarkdown);

  els.importFile.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    const text = await file.text();
    els.editor.value = text;
    saveEditor();
    toast("已导入新稿");
    event.target.value = "";
  });

  document.querySelectorAll(".tab-button[data-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    els.installButton.classList.remove("is-hidden");
    refreshIcons();
  });

  els.installButton.addEventListener("click", async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    els.installButton.classList.add("is-hidden");
  });
}

function parseAndRender() {
  const parsed = splitMarkdown(state.markdown);
  state.title = parsed.title;
  state.taglines = parsed.taglines;
  state.sections = parsed.sections.filter((section) => !section.title.includes("目录"));

  if (!state.sections.length) {
    state.sections = [{ title: "培训内容", body: state.markdown }];
  }

  state.activeIndex = clamp(state.activeIndex, 0, state.sections.length - 1);
  renderMetrics();
  renderModuleRail();
  renderActiveSection();
}

function splitMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let title = "BAR FLAVOUR 培训手册";
  const taglines = [];
  const sections = [];
  let current = null;
  let beforeSections = true;

  lines.forEach((line) => {
    if (line.startsWith("# ")) {
      title = stripMarkdown(line.slice(2));
      return;
    }

    if (beforeSections && line.startsWith(">")) {
      const cleaned = stripMarkdown(line.replace(/^>\s*/, ""));
      if (cleaned) taglines.push(cleaned);
      return;
    }

    if (line.startsWith("## ")) {
      beforeSections = false;
      if (current) {
        current.body = current.lines.join("\n").trim();
        delete current.lines;
        sections.push(current);
      }
      current = {
        title: stripMarkdown(line.slice(3)),
        lines: []
      };
      return;
    }

    if (current) current.lines.push(line);
  });

  if (current) {
    current.body = current.lines.join("\n").trim();
    delete current.lines;
    sections.push(current);
  }

  return { title, taglines, sections };
}

function renderMetrics() {
  const stageCount = (state.markdown.match(/^### 第.+阶段/mg) || []).length;
  const recipeCount = (state.markdown.match(/^#### .*?\*\*/mg) || []).length;
  const checklistCount = (state.markdown.match(/\[ \]/g) || []).length;
  const metrics = [
    ["模块", state.sections.length, "品牌、技法、服务、酒谱"],
    ["阶段", stageCount, "外场到吧台成长路径"],
    ["酒款", recipeCount, "经典配方和速查"],
    ["清单", checklistCount, "开吧、营业、收吧"]
  ];

  els.metricsStrip.innerHTML = metrics
    .map(
      ([label, value, helper]) => `
        <div class="metric">
          <strong>${escapeHtml(String(value))}</strong>
          <span>${escapeHtml(label)} · ${escapeHtml(helper)}</span>
        </div>
      `
    )
    .join("");
}

function renderModuleRail() {
  const visibleSections = getVisibleSections();

  if (!visibleSections.length) {
    els.moduleRail.innerHTML = `<button class="module-card" type="button"><small>没有匹配</small><strong>换一个关键词试试</strong></button>`;
    return;
  }

  els.moduleRail.innerHTML = visibleSections
    .map(({ section, index }) => {
      const isActive = index === state.activeIndex ? " is-active" : "";
      return `
        <button class="module-card${isActive}" type="button" data-section-index="${index}">
          <small>模块 ${String(index + 1).padStart(2, "0")}</small>
          <strong>${escapeHtml(section.title)}</strong>
        </button>
      `;
    })
    .join("");

  els.moduleRail.querySelectorAll("[data-section-index]").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveSection(Number(button.dataset.sectionIndex));
    });
  });
}

function renderActiveSection() {
  const section = state.sections[state.activeIndex];
  if (!section) return;

  els.sectionIndexLabel.textContent = `模块 ${String(state.activeIndex + 1).padStart(2, "0")}`;
  els.sectionTitle.textContent = section.title;
  els.sectionBody.innerHTML = marked.parse(section.body || "");
  wrapTables();
  refreshIcons();
}

function getVisibleSections() {
  if (!state.query) {
    return state.sections.map((section, index) => ({ section, index }));
  }

  return state.sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => {
      const haystack = `${section.title} ${section.body}`.toLowerCase();
      return haystack.includes(state.query);
    });
}

function setActiveSection(index) {
  state.activeIndex = clamp(index, 0, state.sections.length - 1);
  localStorage.setItem(SECTION_KEY, String(state.activeIndex));
  renderModuleRail();
  renderActiveSection();
  document.querySelector(".reader-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function saveEditor(options = {}) {
  const nextMarkdown = els.editor.value.trim();
  if (!nextMarkdown) {
    toast("内容不能为空");
    return;
  }

  state.markdown = nextMarkdown;
  localStorage.setItem(STORAGE_KEY, state.markdown);
  parseAndRender();
  if (!options.quiet) toast("已保存到本机");
}

function exportMarkdown() {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([state.markdown], { type: "text/markdown;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `BAR_FLAVOUR_培训手册_${date}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 800);
  toast("已导出 Markdown");
}

async function copyMarkdown() {
  try {
    await navigator.clipboard.writeText(els.editor.value);
    toast("全文已复制");
  } catch (error) {
    toast("当前浏览器不允许复制");
  }
}

function resetMarkdown() {
  const confirmed = window.confirm("恢复为发布时的原稿？当前本机修改会被清除。");
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  state.markdown = state.defaultMarkdown;
  els.editor.value = state.markdown;
  parseAndRender();
  toast("已恢复原稿");
}

function showView(view) {
  els.shell.dataset.view = view;
  document.querySelectorAll(".tab-button[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });

  if (view === "tools") {
    els.editor.focus();
  }
}

function focusCurrentSectionInEditor() {
  const section = state.sections[state.activeIndex];
  if (!section) return;
  const heading = `## ${section.title}`;
  const position = els.editor.value.indexOf(heading);

  requestAnimationFrame(() => {
    els.editor.focus();
    if (position >= 0) {
      els.editor.setSelectionRange(position, position + heading.length);
      const lineHeight = 22;
      const lineNumber = els.editor.value.slice(0, position).split("\n").length;
      els.editor.scrollTop = Math.max(0, (lineNumber - 4) * lineHeight);
    }
  });
}

function wrapTables() {
  els.sectionBody.querySelectorAll("table").forEach((table) => {
    if (table.parentElement?.classList.contains("table-wrap")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrap";
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

function refreshIcons() {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

function stripMarkdown(input) {
  return String(input)
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toast(message) {
  window.clearTimeout(state.toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  state.toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 2200);
}

init();

// ── Shared state ─────────────────────────────────────────────────
let allEntries = [];
let currentRel = "";
let downloadDir = "";

// ── File utilities ────────────────────────────────────────────────
function getFileIcon(name) {
  const ext = name.split(".").pop().toLowerCase();
  const m = {
    pdf:"📄", doc:"📝", docx:"📝", xls:"📊", xlsx:"📊", ppt:"📊", pptx:"📊",
    zip:"🗜️", rar:"🗜️", "7z":"🗜️", tar:"🗜️", gz:"🗜️",
    mp4:"🎬", mkv:"🎬", avi:"🎬", mov:"🎬",
    mp3:"🎵", wav:"🎵", flac:"🎵",
    jpg:"🖼️", jpeg:"🖼️", png:"🖼️", gif:"🖼️", webp:"🖼️",
    js:"💻", ts:"💻", py:"💻", html:"💻", css:"💻", json:"💻",
    txt:"📃", md:"📃", sh:"💻", exe:"⚙️", apk:"📱", iso:"💿",
  };
  return m[ext] || "📄";
}

function formatSize(b) {
  if (!b && b !== 0) return "";
  if (b < 1024)             return b + " B";
  if (b < 1024 * 1024)      return (b / 1024).toFixed(1) + " KB";
  if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(2) + " MB";
  return (b / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Navigation ────────────────────────────────────────────────────
function goBack() {
  if (!currentRel) return;
  const parts = currentRel.split("/").filter(Boolean);
  parts.pop();
  navigateTo(parts.join("/"));
}

function navigateTo(relPath) {
  currentRel = relPath;
  history.pushState({ rel: relPath }, "");
  const search = document.getElementById("search");
  if (search) search.value = "";
  loadFiles();
}

window.addEventListener("popstate", (e) => {
  currentRel = e.state?.rel ?? "";
  const search = document.getElementById("search");
  if (search) search.value = "";
  loadFiles();
});

// ── Keyboard shortcuts ────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  const inInput = ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);
  if (!inInput && e.key === "Backspace") {
    e.preventDefault();
    goBack();
  }
  if (e.altKey && e.key === "ArrowLeft") {
    e.preventDefault();
    goBack();
  }
});

// ── Breadcrumb ────────────────────────────────────────────────────
function renderBreadcrumb() {
  const bc  = document.getElementById("breadcrumb");
  const btn = document.getElementById("backBtn");
  if (!bc) return;

  bc.innerHTML = "";
  if (btn) btn.classList.toggle("d-none", !currentRel);

  const root = document.createElement("span");
  root.textContent = "🏠 HOME";
  root.onclick = () => navigateTo("");
  bc.appendChild(root);

  if (!currentRel) return;

  currentRel.split("/").filter(Boolean).forEach((part, i, arr) => {
    const sep = document.createElement("span");
    sep.className = "sep";
    sep.textContent = " / ";
    bc.appendChild(sep);

    const el = document.createElement("span");
    el.className = "bread-crumb-item";
    el.textContent = part;
    const rel = arr.slice(0, i + 1).join("/");
    el.onclick = () => navigateTo(rel);
    bc.appendChild(el);
  });
}

// ── Load files & folders ──────────────────────────────────────────
async function loadFiles() {
  const summary = document.getElementById("summary");
  if (!summary) return;

  summary.innerText = "Loading...";
  summary.className = "badge bg-secondary";

  try {
    const cfg = await fetch("/config").then((r) => r.json());
    downloadDir = cfg.downloadDir;
    const display = document.getElementById("currentPathDisplay");
    if (display) display.textContent = downloadDir;
  } catch (_) {}

  renderBreadcrumb();

  try {
    const res  = await fetch("/browse?path=" + encodeURIComponent(currentRel));

    if (!res.ok) {
      const err = await res.json();
      summary.innerText = "Error";
      summary.className = "badge bg-danger";
      document.getElementById("fileList").innerHTML =
        `<li class="list-group-item text-danger">${err.error}</li>`;
      return;
    }

    const data = await res.json();
    allEntries = data.entries;

    const fileCount = allEntries.filter((e) => !e.isDir).length;
    const dirCount  = allEntries.filter((e) =>  e.isDir).length;
    summary.innerText = `${fileCount} file(s), ${dirCount} folder(s)`;
    summary.className = "badge bg-success";

    renderEntries(allEntries);
  } catch (_) {
    summary.innerText = "Error";
    summary.className = "badge bg-danger";
  }
}

function filterEntries() {
  const q = document.getElementById("search").value.toLowerCase();
  renderEntries(allEntries.filter((e) => e.name.toLowerCase().includes(q)));
}

function renderEntries(entries) {
  const list  = document.getElementById("fileList");
  const empty = document.getElementById("emptyState");
  list.innerHTML = "";

  if (entries.length === 0) {
    empty.classList.remove("d-none");
    return;
  }
  empty.classList.add("d-none");

  entries.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "list-group-item";

    if (entry.isDir) {
      li.classList.add("folder-item");
      li.innerHTML = `
        <div class="d-flex justify-content-between align-items-center"
             onclick="navigateTo('${(currentRel ? currentRel + "/" : "") + entry.name}')">
          <div>
            <span style="font-size:1.1rem">📁</span>
            <span class="ms-2 filename fw-semibold">${entry.name}</span>
          </div>
          <span class="text-muted" style="font-size:.8rem"><strong>&gt;</strong></span>
        </div>`;
    } else {
      const ext      = entry.name.split(".").pop().toLowerCase();
      const dirParam = currentRel ? `?dir=${encodeURIComponent(currentRel)}` : "";
      li.innerHTML = `
        <div class="d-flex justify-content-between align-items-center gap-2">
          <div class="flex-grow-1 overflow-hidden fw-semibold">
            <div class="filename">
              ${getFileIcon(entry.name)}
              ${entry.name}
              <span class="ext-badge ms-1">${ext}</span>
            </div>
            <div class="text-muted mt-1 fw-normal" style="font-size:.75rem">
              ${formatSize(entry.size)}${entry.mtime ? " · " + formatDate(entry.mtime) : ""}
            </div>
          </div>
          <a href="/download/${encodeURIComponent(entry.name)}${dirParam}"
             download="${entry.name}"
             class="btn btn-sm btn-success flex-shrink-0">
            ⬇ Download
          </a>
        </div>`;
    }

    list.appendChild(li);
  });
}

// ── Settings panel ────────────────────────────────────────────────
function toggleSettings() {
  document.getElementById("settingsPanel").classList.toggle("d-none");
}

function setQuick(p) {
  if (p === "HOME") {
    fetch("/gethome")
      .then((r) => r.json())
      .then((data) => {
        if (data.home) {
          document.getElementById("newPathInput").value = data.home;
        } else {
          alert("Failed to get home directory");
        }
      })
      .catch(() => alert("Network error"));
    return;
  }
  document.getElementById("newPathInput").value = p;
}

async function applyPath() {
  const newPath = document.getElementById("newPathInput").value.trim();
  const status  = document.getElementById("applyStatus");
  if (!newPath) return;

  status.innerHTML = `<span class="text-muted" style="font-size:.8rem">Applying...</span>`;

  try {
    const res  = await fetch("/config/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPath }),
    });
    const data = await res.json();

    if (res.ok) {
      downloadDir = data.downloadDir;
      document.getElementById("currentPathDisplay").textContent = downloadDir;
      status.innerHTML = `<span class="text-success" style="font-size:.8rem">✅ Applied!</span>`;
      currentRel = "";
      setTimeout(() => {
        document.getElementById("settingsPanel").classList.add("d-none");
        status.innerHTML = "";
        loadFiles();
      }, 800);
    } else {
      status.innerHTML = `<span class="text-danger" style="font-size:.8rem">❌ ${data.error}</span>`;
    }
  } catch (_) {
    status.innerHTML = `<span class="text-danger" style="font-size:.8rem">❌ Network error</span>`;
  }
}

function versionInfo() {
  fetch("/version")
    .then((r) => r.json())
    .then((data) => {
      document.getElementById("versioninfo").textContent = `Version: ${data.version}`;
    });
}

// ── QR code ───────────────────────────────────────────────────────
const qrImg = document.getElementById("qrImg");
if (qrImg) {
  fetch("/qr")
    .then((r) => r.json())
    .then((data) => { qrImg.src = data.qr; });

    versionInfo()
}

// ── Upload ────────────────────────────────────────────────────────
const input    = document.getElementById("files");
const dropzone = document.getElementById("dropzone");
let fileItems  = [];

if (dropzone) {
  dropzone.addEventListener("click", () => input.click());
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    input.files = e.dataTransfer.files;
    renderFiles();
  });
  input.addEventListener("change", renderFiles);
}

function renderFiles() {
  const list    = document.getElementById("fileList");
  const summary = document.getElementById("summary");
  list.innerHTML = "";
  fileItems = [];
  let totalSize = 0;

  [...input.files].forEach((file, i) => {
    totalSize += file.size;
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div class="filename">📄 ${file.name}</div>
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-primary">${(file.size / 1024 / 1024).toFixed(2)} MB</span>
          <span class="file-status text-muted" id="status-${i}">Pending</span>
        </div>
      </div>
      <div class="progress">
        <div class="progress-bar" id="bar-${i}" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
      </div>`;
    list.appendChild(li);
    fileItems.push({ file, bar: null, statusEl: null });
  });

  [...input.files].forEach((_, i) => {
    fileItems[i].bar      = document.getElementById(`bar-${i}`);
    fileItems[i].statusEl = document.getElementById(`status-${i}`);
  });

  summary.innerText = `${input.files.length} file(s) • ${(totalSize / 1024 / 1024).toFixed(2)} MB`;
}

function uploadSingleFile(file, bar, statusEl) {
  return new Promise((resolve, reject) => {
    const xhr      = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("files", file);
    formData.append(`mtime_${file.name}`, new Date(file.lastModified).toISOString());

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        bar.style.width = pct + "%";
        bar.setAttribute("aria-valuenow", pct);
        statusEl.textContent = pct + "%";
        statusEl.className = "file-status text-primary";
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        bar.style.width = "100%";
        bar.classList.add("done");
        statusEl.textContent = "Done ✓";
        statusEl.className = "file-status text-success";
        resolve();
      } else {
        bar.classList.add("error");
        statusEl.textContent = "Failed";
        statusEl.className = "file-status text-danger";
        reject(new Error(`HTTP ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => {
      bar.classList.add("error");
      statusEl.textContent = "Error";
      statusEl.className = "file-status text-danger";
      reject(new Error("Network error"));
    });

    xhr.open("POST", "/upload");
    xhr.send(formData);
  });
}

async function uploadFiles() {
  if (input.files.length === 0) {
    alert("Select files first");
    return;
  }

  const btn          = document.getElementById("uploadBtn");
  const globalStatus = document.getElementById("status");
  btn.disabled       = true;
  btn.textContent    = "Uploading...";
  globalStatus.innerHTML = `<div class="alert alert-info">Uploading ${input.files.length} file(s)...</div>`;

  let done = 0, failed = 0;

  for (let i = 0; i < fileItems.length; i++) {
    const { file, bar, statusEl } = fileItems[i];
    try {
      await uploadSingleFile(file, bar, statusEl);
      done++;
    } catch (_) {
      failed++;
    }
  }

  btn.disabled    = false;
  btn.textContent = "Upload Files";

  globalStatus.innerHTML = failed === 0
    ? `<div class="alert alert-success">✅ All ${done} file(s) uploaded successfully!</div>`
    : `<div class="alert alert-warning">⚠️ ${done} uploaded, ${failed} failed.</div>`;
}

// ── Init ──────────────────────────────────────────────────────────
// push initial state so popstate works on first back press
history.replaceState({ rel: "" }, "");

// only run on download page
if (document.getElementById("fileList") && document.getElementById("breadcrumb")) {
  loadFiles();
}

let allEntries = [];
let currentRel = ""; // relative path inside downloadDir
let downloadDir = ""; // server-side absolute base

function getFileIcon(name) {
  const ext = name.split(".").pop().toLowerCase();
  const m = {
    pdf: "📄",
    doc: "📝",
    docx: "📝",
    xls: "📊",
    xlsx: "📊",
    ppt: "📊",
    pptx: "📊",
    zip: "🗜️",
    rar: "🗜️",
    "7z": "🗜️",
    tar: "🗜️",
    gz: "🗜️",
    mp4: "🎬",
    mkv: "🎬",
    avi: "🎬",
    mov: "🎬",
    mp3: "🎵",
    wav: "🎵",
    flac: "🎵",
    jpg: "🖼️",
    jpeg: "🖼️",
    png: "🖼️",
    gif: "🖼️",
    webp: "🖼️",
    js: "💻",
    ts: "💻",
    py: "💻",
    html: "💻",
    css: "💻",
    json: "💻",
    txt: "📃",
    md: "📃",
    sh: "💻",
    exe: "⚙️",
    apk: "📱",
    iso: "💿",
  };
  return m[ext] || "📄";
}

function formatSize(b) {
  if (!b && b !== 0) return "";
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(2) + " MB";
  return (b / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return (
    d.toLocaleDateString() +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

// ── Back button ──────────────────────────────────────────────────
function goBack() {
  if (!currentRel) return;
  const parts = currentRel.split("/").filter(Boolean);
  parts.pop();
  navigateTo(parts.join("/"));
}

// ── Breadcrumb ────────────────────────────────────────────────────
function renderBreadcrumb() {
  const bc = document.getElementById("breadcrumb");
  const btn = document.getElementById("backBtn");
  bc.innerHTML = "";

  // show/hide back button
  btn.classList.toggle("d-none", !currentRel);

  const root = document.createElement("span");
  root.textContent = "🏠 HOME";
  root.onclick = () => navigateTo("");
  bc.appendChild(root);

  if (!currentRel) return;

  const parts = currentRel.split("/").filter(Boolean);
  parts.forEach((part, i) => {
    const sep = document.createElement("span");
    sep.className = "sep";
    sep.textContent = " / ";
    bc.appendChild(sep);

    const el = document.createElement("span");
    el.textContent = part;
    const rel = parts.slice(0, i + 1).join("/");
    el.onclick = () => navigateTo(rel);
    bc.appendChild(el);
  });
}

// ── Navigate into a sub-folder ────────────────────────────────────
function navigateTo(relPath) {
  currentRel = relPath;
  document.getElementById("search").value = "";
  // ── Keyboard shortcuts ───────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    // Backspace (not in input) or Alt+Left → go back
    const inInput = ["INPUT", "TEXTAREA"].includes(
      document.activeElement.tagName,
    );
    if (!inInput && e.key === "Backspace") {
      e.preventDefault();
      goBack();
    }
    if (e.altKey && e.key === "ArrowLeft") {
      e.preventDefault();
      goBack();
    }
  });

  loadFiles();
}

// ── Load files & folders from server ─────────────────────────────
async function loadFiles() {
  const summary = document.getElementById("summary");
  summary.innerText = "Loading...";
  summary.className = "badge bg-secondary";

  // fetch config to get current downloadDir
  try {
    const cfg = await fetch("/config").then((r) => r.json());
    downloadDir = cfg.downloadDir;
    document.getElementById("currentPathDisplay").textContent = downloadDir;
  } catch (_) {}

  renderBreadcrumb();

  try {
    const url = "/browse?path=" + encodeURIComponent(currentRel);
    const res = await fetch(url);

    if (!res.ok) {
      const err = await res.json();
      summary.innerText = "Error";
      summary.className = "badge bg-danger";
      document.getElementById("fileList").innerHTML = `
        <li class="list-group-item text-danger">${err.error}</li>`;
      return;
    }

    const data = await res.json();
    allEntries = data.entries;

    const fileCount = allEntries.filter((e) => !e.isDir).length;
    const dirCount = allEntries.filter((e) => e.isDir).length;
    summary.innerText = `${fileCount} file(s), ${dirCount} folder(s)`;
    summary.className = "badge bg-success";

    renderEntries(allEntries);
  } catch (err) {
    summary.innerText = "Error";
    summary.className = "badge bg-danger";
  }
}

function filterEntries() {
  const q = document.getElementById("search").value.toLowerCase();
  renderEntries(allEntries.filter((e) => e.name.toLowerCase().includes(q)));
}

function renderEntries(entries) {
  const list = document.getElementById("fileList");
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
      const ext = entry.name.split(".").pop().toLowerCase();
      const dirParam = currentRel
        ? `?dir=${encodeURIComponent(currentRel)}`
        : "";
      li.innerHTML = `
        <div class="d-flex justify-content-between align-items-center gap-2">
          <div class="flex-grow-1 overflow-hidden fw-semibold">
            <div class="filename">
              ${getFileIcon(entry.name)}
              ${entry.name}
              <span class="ext-badge ms-1">${ext}</span>
            </div>
            <div class="text-muted mt-1" style="font-size:.75rem">
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
  const p = document.getElementById("settingsPanel");
  p.classList.toggle("d-none");
}

function setQuick(p) {
  // /gethome
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
      .catch(() => {
        alert("Network error");
      });
    return;
  }

  document.getElementById("newPathInput").value = p;
}

async function applyPath() {
  const newPath = document.getElementById("newPathInput").value.trim();
  const status = document.getElementById("applyStatus");

  if (!newPath) return;

  status.innerHTML = `<span class="text-muted" style="font-size:.8rem">Applying...</span>`;

  try {
    const res = await fetch("/config/download", {
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
  } catch (err) {
    status.innerHTML = `<span class="text-danger" style="font-size:.8rem">❌ Network error</span>`;
  }
}

loadFiles();

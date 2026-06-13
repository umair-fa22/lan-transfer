const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return "localhost";
}

function getDefaultDownloadDir() {
    // Termux on Android
    if (process.env.TERMUX_VERSION || fs.existsSync("/data/data/com.termux")) {
        return "/storage/emulated/0/Download";
    }

    const platform = os.platform();

    if (platform === "win32") {
        return path.join(os.homedir(), "Downloads");
    }

    // linux / macOS / anything else
    const linuxDownloads = path.join(os.homedir(), "Downloads");
    if (fs.existsSync(linuxDownloads)) {
        return linuxDownloads;
    }

    return os.homedir();
}

const app = express();
const PORT = 3000;

const QRCode = require("qrcode");
const qrcode = require("qrcode-terminal");
const uploadDir = path.join(process.cwd(), "uploads");

app.use(express.json());

// ── Runtime state ────────────────────────────────────────────────
// uploadDir  → always "uploads/" inside CWD (where command was run)
// downloadDir → CLI arg, or same as uploadDir by default

let downloadDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : getDefaultDownloadDir();

[uploadDir, downloadDir].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Multer storage ───────────────────────────────────────────────
function buildStorage() {
    return multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => cb(null, file.originalname),
    });
}

let upload = multer({ storage: buildStorage() });

// ── Static files ─────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ── Page routes ─────────────────────────────────────────────────-

app.get("/", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "index.html"))
);
app.get("/upload-page", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "upload.html"))
);
app.get("/download-page", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "download.html"))
);

// ── Config API ───────────────────────────────────────────────────
// GET  /config          → return current paths
// POST /config/download → change downloadDir at runtime
app.get("/config", (req, res) => {
    res.json({ downloadDir, uploadDir });
});

app.get("/version", (req, res) => {
    const pkg = require("./package.json");
    res.json({ version: pkg.version });
});

app.post("/config/download", (req, res) => {
    const { newPath } = req.body;

    if (!newPath || typeof newPath !== "string") {
        return res.status(400).json({ error: "newPath is required" });
    }

    const resolved = path.resolve(newPath.trim());

    if (!fs.existsSync(resolved)) {
        return res.status(404).json({ error: `Path does not exist: ${resolved}` });
    }

    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
        return res.status(400).json({ error: "Path must be a directory" });
    }

    downloadDir = resolved;
    console.log("📂 Download dir changed to:", downloadDir);
    res.json({ ok: true, downloadDir });
});

// ── API: list files ───────────────────────────────────────────────
app.get("/files", (req, res) => {
    try {
        const entries = fs.readdirSync(downloadDir);
        const files = entries
            .filter((name) => fs.statSync(path.join(downloadDir, name)).isFile())
            .map((name) => {
                const stats = fs.statSync(path.join(downloadDir, name));
                return { name, size: stats.size, mtime: stats.mtime.toISOString() };
            })
            .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));

        res.json(files);
    } catch (err) {
        res.status(500).json({ error: "Could not read directory: " + err.message });
    }
});

// ── API: browse subdirectories ────────────────────────────────────
app.get("/browse", (req, res) => {
    const rel = req.query.path || "";
    const absBase = path.resolve(downloadDir);
    const target = path.resolve(path.join(absBase, rel));

    // security: must stay inside downloadDir
    if (!target.startsWith(absBase)) {
        return res.status(403).json({ error: "Access denied" });
    }

    if (!fs.existsSync(target)) {
        return res.status(404).json({ error: "Path not found" });
    }

    try {
        const entries = fs
            .readdirSync(target)
            .map((name) => {
                const full = path.join(target, name);
                const stats = fs.statSync(full);
                return {
                    name,
                    isDir: stats.isDirectory(),
                    size: stats.isFile() ? stats.size : null,
                    mtime: stats.mtime.toISOString(),
                };
            })
            .sort((a, b) => {
                if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
                return a.name.localeCompare(b.name);
            });

        res.json({ path: target, entries });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── API: download file ────────────────────────────────────────────
app.get("/download/:filename", (req, res) => {
    const subdir   = req.query.dir ? path.normalize(req.query.dir) : "";
    const filename = path.basename(req.params.filename);
    const absBase  = path.resolve(downloadDir);
    const filePath = path.resolve(path.join(absBase, subdir, filename));

    // security check
    if (!filePath.startsWith(absBase)) {
        return res.status(403).send("Access denied");
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("File not found");
    }

    // force download — works for all files including no-extension and dotfiles
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
});

// ── API: upload files ─────────────────────────────────────────────
app.post("/upload", (req, res, next) => {
    upload.array("files")(req, res, async (err) => {
        if (err) return res.status(500).send("Upload error: " + err.message);

        for (const file of req.files) {
            console.log("================================");
            console.log("File:", file.originalname);
            console.log("Size:", file.size, "bytes");
            console.log("Saved:", file.path);

            const modifiedTime = req.body[`mtime_${file.originalname}`];
            if (modifiedTime) {
                try {
                    const mtime = new Date(modifiedTime);
                    fs.utimesSync(file.path, new Date(), mtime);
                    console.log("Modified:", mtime);
                } catch (_) {
                    console.log("Failed to set mtime");
                }
            }
        }
        res.send("Upload successful");
    });
});

app.get("/qr", async (req, res) => {
    const ip = getLocalIP();
    const url = `http://${ip}:${PORT}`;
    const png = await QRCode.toDataURL(url); // base64 PNG
    res.json({ url, qr: png });
});

app.get("/gethome", (req, res) => {
    console.log("Home dir requested, sending:", os.homedir());
    res.json({ home: os.homedir() });
});

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
    const ip = getLocalIP();

    qrcode.generate(`http://${ip}:${PORT}`, { small: true });

    console.log(`\n🚀 LAN Transfer running!`);
    console.log(`\n   Open on any device in same Wi-Fi:\n`);
    console.log(`   👉  http://${ip}:${PORT}\n`);
    console.log(`   Upload dir:   ${uploadDir}`);
    console.log(`   Download dir: ${downloadDir}\n`);
});

# 📡 lan-transfer

A simple LAN file transfer tool — upload and download files between devices on the same network using just a browser. No cables, no cloud, no account needed.

Built for Android (Termux), Linux, and Windows.

---

## Install

```bash
npm i -g @umdv/lan-transfer
```

## Usage

```bash
lan-transfer
```

Then open the URL shown in the terminal on any device connected to the same Wi-Fi:

```
🚀 LAN Transfer running!

   Open on any device in same Wi-Fi:

   👉  http://192.168.100.20:3000
```

---

## Options

```bash
lan-transfer [download-path] [port]
```

| Argument | Description | Default |
|---|---|---|
| `download-path` | Directory to serve for downloading | OS-based (see below) |
| `port` | Port to run the server on | `3000` |

**Default download paths by OS:**

| OS | Default |
|---|---|
| Android (Termux) | `/storage/emulated/0/Download` |
| Windows | `C:\Users\username\Downloads` |
| Linux / macOS | `~/Downloads` |

**Examples:**

```bash
# Android — serve internal storage
lan-transfer /storage/emulated/0/DCIM

# Android — serve Downloads folder on custom port
lan-transfer /storage/emulated/0/Download 8080

# Windows
lan-transfer C:\Users\YourName\Downloads

# Linux
lan-transfer ~/Desktop
```

---

## Features

**Home page** — choose Upload or Download

**Upload**
- Drag & drop or tap to select files
- Per-file progress bars with live percentage
- Preserves original file modified time
- Files saved in `uploads/` folder where command was run

**Download**
- Browse folders and subfolders
- Navigate back with ⬆ Up button or `Backspace` / `Alt+Left`
- Search/filter files
- File type icons + size + date
- Change download directory at runtime without restart

**Path changer (Download page)**
- Quick buttons for common Android paths
- Custom path input
- Validates path exists before applying

---

## Running on Android (Termux)

```bash
pkg install -y nodejs
npm i -g @umdv/lan-transfer
termux-setup-storage
lan-transfer
```

Termux is auto-detected — no need to pass a path, `/storage/emulated/0/` is used by default.

---

## Running on Linux

```bash
npm i -g @umdv/lan-transfer
lan-transfer
```

`~/Downloads` is used by default if it exists, otherwise `~/`.

---

## Running on Windows

```bash
npm i -g @umdv/lan-transfer
lan-transfer
```

`%USERPROFILE%\Downloads` is used by default.

---

## How it works

- Express.js server serves a web UI on your local IP
- Any device on the same Wi-Fi can open the URL in a browser
- No internet connection required — works fully offline on LAN
- Files are transferred directly between devices on the network

---

## License

MIT

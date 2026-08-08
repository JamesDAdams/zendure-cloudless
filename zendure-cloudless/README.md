# Zendure Cloudless - Home Assistant Add-on

Self-hosted energy management dashboard for Zendure solar + battery systems.

## Installation

### Option 1: Private GitHub Repository

> **Note:** Home Assistant&#39;s add-on store does not natively support authentication for private repositories. Embedding a token in the URL exposes it in browser history and server logs. The recommended approach is to make the repository public (Option 2) or use a local installation (Option 3).

---

### Option 2: Public GitHub Repository
1. Ensure the repository visibility is set to **Public** on GitHub.
2. In Home Assistant, go to **Settings → Add-ons → Add-on Store → 3 dots (top-right) → Repositories**.
3. Add the URL: `https://github.com/JamesDAdams/zendure-cloudless`
4. Install "Zendure Cloudless" and start.

---

### Option 3: Local Installation (Dev / SSH / Samba)
1. Copy the project files to `/addons/zendure-cloudless` on your Home Assistant server via Samba or SSH.
2. In the Add-on Store, click the 3 dots → **Check for updates / Reload**.
3. The add-on will appear under **Local add-ons**.

---

## Configuration

The web interface is served on port `3001`. All configuration is managed directly via the Web UI.

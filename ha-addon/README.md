# Zendure Cloudless - Home Assistant Add-on

Self-hosted energy management dashboard for Zendure solar + battery systems.

## Installation

### Option 1: Private GitHub Repository
1. Generate a **Personal Access Token (PAT)** with `repo` scope on GitHub (Settings > Developer Settings > Personal Access Tokens).
2. In Home Assistant, go to **Settings → Add-ons → Add-on Store → 3 dots (top-right) → Repositories**.
3. Add the URL with your token:
   `https://<YOUR_GITHUB_TOKEN>@github.com/JamesDAdams/zendure-cloudless`
4. Install "Zendure Cloudless", configure, and start the add-on.

---

### Option 2: Public GitHub Repository
1. Ensure the repository visibility is set to **Public** on GitHub.
2. In Home Assistant, go to **Settings → Add-ons → Add-on Store → 3 points → Repositories**.
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

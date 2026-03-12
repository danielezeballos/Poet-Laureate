# Deploying the Poet website (player + admin) to the internet

This app is a **Node.js** server. To put it online with the admin portal, use a host that runs Node (e.g. **Render**, Railway, Fly.io). Below is a path that works with **Render** and **GitHub**.

---

## 1. Put the project on GitHub

If you already have a repo with the old static site, you can replace it with this version (Node app + `mp3/` and `images/` folders).

**Option A – New repo**

1. In GitHub: **New repository** (e.g. `poetwebsite`).
2. On your computer, in the `poetwebsite` folder:

   ```bash
   cd ~/Desktop/poetwebsite
   git init
   git add .
   git commit -m "Poet player with admin portal"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/poetwebsite.git
   git push -u origin main
   ```

**Option B – Update existing repo**

1. Copy your current `poetwebsite` folder (with `server.js`, `admin.html`, `config.json`, `mp3/`, `images/`, etc.) into the folder that’s already a git repo (or replace the contents of that repo with this project).
2. Then:

   ```bash
   cd /path/to/your/poet-repo
   git add .
   git commit -m "Add Node server and admin portal"
   git push
   ```

Make sure **all** of this is in the repo:

- `server.js`, `package.json`, `config.json`
- `index.html`, `admin.html`
- `mp3/` (with your MP3s)
- `images/` (with your JPGs)

---

## 2. Deploy on Render

1. Go to [render.com](https://render.com) and sign up (e.g. with GitHub).
2. **New** → **Web Service**.
3. Connect the GitHub repo that contains the poet project (e.g. `poetwebsite`).
4. Settings:
   - **Name:** e.g. `poet-website`
   - **Runtime:** **Node**
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** Free (or paid if you want persistent disk later).
5. **Advanced** → **Environment**:
   - Add a variable: `ADMIN_PASSWORD` = a strong password only you know.  
     This protects `/admin` and all config/upload endpoints. Without it, anyone could edit your site.
6. Click **Create Web Service**. Render will build and run your app.
7. When it’s live, you’ll get a URL like:  
   `https://poet-website.onrender.com`

---

## 3. Use the site and admin online

- **Player (public):**  
  `https://poet-website.onrender.com/`

- **Admin (password‑protected):**  
  `https://poet-website.onrender.com/admin`  
  When you open this, the browser will ask for a username and password:
  - **Username:** `admin`
  - **Password:** the value you set for `ADMIN_PASSWORD` in Render.

After logging in, you can edit the title, playlist, and backgrounds, and upload new MP3s and images the same way as on your computer.

---

## 4. Important: persistence on free tier

On Render’s **free** tier, the filesystem is **ephemeral**:

- Your **repo content** (including `mp3/`, `images/`, `config.json`) is deployed each time you push to GitHub, so that content is always there.
- Any **changes you make through the admin** (new uploads, config edits) are stored on the server’s disk only. They can be **lost** when the app restarts or when you redeploy.

So:

- **To add new tracks or images permanently:** add the files to the repo (`mp3/` and `images/`), update `config.json` if needed, then commit and push. Render will redeploy with the new files.
- **To keep admin uploads and config changes** across restarts, you’d need either:
  - a **paid** Render plan with a **persistent disk**, or  
  - a different setup (e.g. storing uploads and config in a database or external storage), which would require code changes.

---

## 5. Optional: custom domain

In the Render dashboard for your service: **Settings** → **Custom Domain**. Add your domain and follow the DNS instructions Render gives you.

---

## Summary

| Step | What you do |
|------|-------------|
| 1 | Put the full Node project (including `mp3/` and `images/`) in a GitHub repo. |
| 2 | Create a Web Service on Render linked to that repo; set **Build** = `npm install`, **Start** = `npm start`. |
| 3 | Set **ADMIN_PASSWORD** in Render so the admin is protected. |
| 4 | Use the player at `https://your-app.onrender.com/` and the admin at `https://your-app.onrender.com/admin` (log in with `admin` + your password). |
| 5 | For permanent new media, add files to the repo and push; for persistent admin uploads, consider a paid plan or extra storage later. |

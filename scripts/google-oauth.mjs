import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const clientFile = process.argv[2] || process.env.GOOGLE_OAUTH_CLIENT_FILE;
const tokenFile = process.argv[3] || process.env.GOOGLE_OAUTH_TOKEN_FILE || path.resolve(".google-sheets-token.json");

if (!clientFile) {
  console.error("Usage: node scripts/google-oauth.mjs /path/to/client_secret.json [token-output.json]");
  process.exit(1);
}

const credentials = JSON.parse(await readFile(clientFile, "utf8"));
const client = credentials.installed || credentials.web;

if (!client?.client_id || !client?.client_secret) {
  console.error("The OAuth client file is missing client_id or client_secret.");
  process.exit(1);
}

const server = http.createServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const redirectUri = `http://127.0.0.1:${port}`;

const authUrl = new URL(client.auth_uri || "https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", client.client_id);
authUrl.searchParams.set("redirect_uri", redirectUri);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/spreadsheets.readonly");
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("\nOpen this link, approve Google Sheets access, then come back here:\n");
console.log(authUrl.toString());
console.log("\nWaiting for Google approval...\n");

const code = await new Promise((resolve, reject) => {
  server.on("request", (req, res) => {
    const url = new URL(req.url, redirectUri);
    const error = url.searchParams.get("error");
    const authCode = url.searchParams.get("code");

    if (error) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end(`Google returned an error: ${error}`);
      reject(new Error(error));
      return;
    }

    if (!authCode) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("No authorization code found.");
      return;
    }

    res.writeHead(200, { "content-type": "text/html" });
    res.end("<h1>Google Sheets connected.</h1><p>You can close this tab and return to Codex.</p>");
    resolve(authCode);
  });
});

server.close();

const tokenResponse = await fetch(client.token_uri || "https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: client.client_id,
    client_secret: client.client_secret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  })
});

if (!tokenResponse.ok) {
  throw new Error(`Token exchange failed: ${tokenResponse.status} ${await tokenResponse.text()}`);
}

const token = await tokenResponse.json();
token.expires_at = Date.now() + (token.expires_in || 3600) * 1000;

await writeFile(tokenFile, `${JSON.stringify(token, null, 2)}\n`, { mode: 0o600 });
console.log(`Google Sheets token saved to ${tokenFile}`);

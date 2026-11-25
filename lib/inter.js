import https from "node:https";

const host = "cdpj.partners.bancointer.com.br";
let cached;
function call(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        method,
        path,
        headers,
        cert: Buffer.from(process.env.INTER_CERT_B64, "base64"),
        key: Buffer.from(process.env.INTER_KEY_B64, "base64"),
      },
      (res) => {
        let data = "";
        res
          .setEncoding("utf8")
          .on("data", (chunk) => (data += chunk))
          .on("end", () => {
            if (res.statusCode >= 300)
              return reject(new Error("Inter HTTP " + res.statusCode));
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error("Resposta inválida do Inter"));
            }
          })
          .on("error", reject);
      },
    );
    req.setTimeout(8000, () => req.destroy(new Error("Inter indisponível")));
    req.on("error", reject).end(body);
  });
}
export async function bank(method, txid, charge) {
  if (!cached || Date.now() >= cached.until) {
    const token = await call(
      "POST",
      "/oauth/v2/token",
      new URLSearchParams({
        client_id: process.env.INTER_CLIENT_ID.trim(),
        client_secret: process.env.INTER_CLIENT_SECRET.trim(),
        grant_type: "client_credentials",
        scope: "cob.read cob.write pix.read",
      }).toString(),
      { "Content-Type": "application/x-www-form-urlencoded" },
    );
    cached = {
      value: token.access_token,
      until: Date.now() + (token.expires_in - 60) * 1000,
    };
  }
  return call(method, "/pix/v2/cob/" + txid, charge && JSON.stringify(charge), {
    Authorization: "Bearer " + cached.value,
    "Content-Type": "application/json",
  });
}

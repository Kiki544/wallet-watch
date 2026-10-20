// Netlify Function: Helius webhook receiver. Alerts Telegram when WATCH_WALLET sends WATCH_MINT out.
const WALLET = process.env.WATCH_WALLET;
const MINT = process.env.WATCH_MINT;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;
const AUTH = process.env.WEBHOOK_AUTH;

const seen = new Set(); // best-effort dedupe within a warm instance

async function sendTelegram(text) {
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!res.ok) console.error("Telegram error", res.status, await res.text());
}

function analyse(tx) {
  const outs = (tx.tokenTransfers || []).filter(
    (t) => t.mint === MINT && t.fromUserAccount === WALLET && t.tokenAmount > 0
  );
  if (!outs.length) return null;
  const amount = outs.reduce((s, t) => s + t.tokenAmount, 0);
  const swap = tx.events && tx.events.swap;
  const isSwap = tx.type === "SWAP" || Boolean(swap);
  const recipients = [...new Set(outs.map((t) => t.toUserAccount).filter(Boolean))];
  let received = "";
  if (swap && swap.nativeOutput) received = `${(Number(swap.nativeOutput.amount) / 1e9).toFixed(4)} SOL`;
  return { amount, isSwap, recipients, received, signature: tx.signature, source: tx.source, ts: tx.timestamp };
}

function format(a) {
  const when = a.ts ? new Date(a.ts * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "";
  const lines = [
    `<b>${a.isSwap ? "🔴 SELL detected" : "🟠 Transfer out (not a swap)"}</b>`,
    `Wallet: <code>${WALLET}</code>`,
    `Sent: <b>${a.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}</b> PIZZA`,
  ];
  if (a.received) lines.push(`Received: ${a.received}`);
  if (a.source && a.source !== "UNKNOWN") lines.push(`Via: ${a.source}`);
  if (!a.isSwap && a.recipients.length) lines.push(`To: <code>${a.recipients.join(", ")}</code>`);
  if (when) lines.push(`Time: ${when}`);
  lines.push(`<a href="https://solscan.io/tx/${a.signature}">View on Solscan</a>`);
  return lines.join("\n");
}

exports.handler = async (event) => {
  if (event.httpMethod === "GET") return { statusCode: 200, body: "ok" }; // health check
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };
  if (!AUTH || event.headers["authorization"] !== AUTH) return { statusCode: 401, body: "" };

  let txs;
  try {
    txs = JSON.parse(event.body || "[]");
  } catch {
    return { statusCode: 400, body: "bad json" };
  }
  for (const tx of Array.isArray(txs) ? txs : [txs]) {
    if (!tx.signature || seen.has(tx.signature)) continue;
    seen.add(tx.signature);
    const alert = analyse(tx);
    if (alert) {
      console.log("ALERT", alert.signature, alert.amount);
      try {
        await sendTelegram(format(alert));
      } catch (e) {
        console.error("send failed", e);
      }
    }
  }
  return { statusCode: 200, body: "ok" };
};

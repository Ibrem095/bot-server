const express = require("express");
const app = express();
app.use(express.json());
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
let clientsData = [];
app.post("/sync", (req, res) => {
  try { clientsData = req.body.clients || []; res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false }); }
});
async function sendTelegram(text) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }) });
  return res.json();
}
function formatRub(n) { return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n || 0); }
function todayStr() { return new Date().toLocaleDateString("ru-RU"); }
function isOverdue(c) {
  if (c.paid >= c.remaining) return false;
  const lastDate = c.payments && c.payments.length > 0 ? c.payments[c.payments.length - 1].date : c.date;
  if (!lastDate) return false;
  const parts = lastDate.split(".");
  const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  return Math.floor((Date.now() - d.getTime()) / 86400000) > 1;
}
async function sendDailyReport() {
  const today = todayStr();
  const dueToday = clientsData.filter(c => c.paid < c.remaining && c.nextPaymentDate === today);
  const overdue = clientsData.filter(c => c.paid < c.remaining && (c.overdueMarked || isOverdue(c)));
  const active = clientsData.filter(c => c.paid < c.remaining);
  let msg = `🌅 <b>Доброе утро! Ежедневный отчёт</b>\n📅 ${today}\n\n`;
  if (dueToday.length > 0) { msg += `💳 <b>ПЛАТЯТ СЕГОДНЯ (${dueToday.length}):</b>\n`; dueToday.forEach(c => { msg += `• ${c.name} — ${formatRub(Math.round(c.monthly))}\n`; if (c.phone) msg += `  📞 ${c.phone}\n`; }); msg += "\n"; }
  else { msg += `💳 Сегодня платежей нет\n\n`; }
  if (overdue.length > 0) { msg += `⚠️ <b>ПРОСРОЧНИКИ (${overdue.length}):</b>\n`; overdue.forEach(c => { msg += `• ${c.name} — долг ${formatRub(c.remaining - c.paid)}\n`; if (c.phone) msg += `  📞 ${c.phone}\n`; }); msg += "\n"; }
  msg += `📊 <b>Итого активных:</b> ${active.length} клиентов`;
  await sendTelegram(msg);
}
function scheduleDaily() {
  const next9am = new Date(); next9am.setHours(9, 0, 0, 0);
  if (new Date() >= next9am) next9am.setDate(next9am.getDate() + 1);
  setTimeout(() => { sendDailyReport(); setInterval(sendDailyReport, 86400000); }, next9am - new Date());
}
app.get("/report", async (req, res) => { await sendDailyReport(); res.json({ ok: true }); });
app.get("/", (req, res) => res.json({ ok: true, clients: clientsData.length }));
app.listen(process.env.PORT || 8080, () => { console.log("Сервер запущен"); scheduleDaily(); });

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!JWT_SECRET || !ADMIN_EMAIL || !ADMIN_PASSWORD_HASH) {
  console.warn("Faltan JWT_SECRET, ADMIN_EMAIL o ADMIN_PASSWORD_HASH en server/.env. El acceso de administrador no funcionará hasta configurarlos.");
}
app.use(helmet());
app.use(express.json({ limit: "20kb" }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "ecosnacks.sqlite");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL,
    asunto TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
const contactLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: "draft-7", legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 6, standardHeaders: "draft-7", legacyHeaders: false });

function clean(value) { return typeof value === "string" ? value.trim() : ""; }
function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 160; }

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "Eco-Snacks API" }));

app.post("/api/contact", contactLimiter, (req, res) => {
  const nombre = clean(req.body?.nombre);
  const email = clean(req.body?.email).toLowerCase();
  const asunto = clean(req.body?.asunto);
  const mensaje = clean(req.body?.mensaje);
  if (nombre.length < 2 || nombre.length > 80) return res.status(400).json({ error: "El nombre debe tener entre 2 y 80 caracteres." });
  if (!validEmail(email)) return res.status(400).json({ error: "Introduce un correo electrónico válido." });
  if (!asunto || asunto.length > 120) return res.status(400).json({ error: "Selecciona un asunto válido." });
  if (mensaje.length < 10 || mensaje.length > 3000) return res.status(400).json({ error: "El mensaje debe tener entre 10 y 3000 caracteres." });
  const result = db.prepare("INSERT INTO contacts (nombre,email,asunto,mensaje) VALUES (?,?,?,?)").run(nombre, email, asunto, mensaje);
  return res.status(201).json({ ok: true, id: result.lastInsertRowid });
});

app.post("/api/admin/login", loginLimiter, async (req, res) => {
  const email = clean(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!JWT_SECRET || !ADMIN_EMAIL || !ADMIN_PASSWORD_HASH) return res.status(503).json({ error: "El administrador aún no está configurado en el servidor." });
  const emailMatch = email === ADMIN_EMAIL.toLowerCase();
  const passwordMatch = await bcrypt.compare(password, ADMIN_PASSWORD_HASH).catch(() => false);
  if (!emailMatch || !passwordMatch) return res.status(401).json({ error: "Correo o contraseña incorrectos." });
  const token = jwt.sign({ sub: email, role: "admin" }, JWT_SECRET, { expiresIn: "2h" });
  return res.json({ token, expiresIn: 7200 });
});

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "admin" || payload.sub.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) throw new Error("invalid role");
    req.admin = payload; return next();
  } catch { return res.status(401).json({ error: "Sesión inválida o vencida. Inicia sesión de nuevo." }); }
}
app.get("/api/admin/messages", requireAdmin, (_req, res) => {
  const messages = db.prepare("SELECT id,nombre,email,asunto,mensaje,created_at FROM contacts ORDER BY id DESC LIMIT 500").all();
  res.json({ messages });
});

// Eco-Snacks assistant: uses OpenAI when configured; otherwise answers common business questions locally.
const businessContext = `Eres Eco-Asistente, asistente virtual de Eco-Snacks, un emprendimiento de suscripción mensual de snacks saludables. La suscripción cuesta $100.000 COP al mes e incluye entregas semanales de cajas de snacks saludables (aproximadamente cuatro al mes). El catálogo ilustrativo menciona barras de cereal integral, mix de frutos secos y chips de banano; la selección puede variar semanalmente. Responde en español, de forma amable, clara y breve. No inventes zonas de cobertura, ingredientes exactos, información médica, métodos de pago ni condiciones no confirmadas. Para esos detalles, invita a contactar al equipo. No des diagnósticos ni sustituyas a profesionales de salud.`;
function localReply(q) {
  const s = q.toLowerCase();
  if (/precio|cu[aá]nto cuesta|valor|costo/.test(s)) return "La suscripción de Eco-Snacks cuesta $100.000 COP al mes e incluye entregas semanales de cajas de snacks saludables.";
  if (/entrega|env[ií]o|domicilio|semana|frecuencia/.test(s)) return "La suscripción contempla entregas semanales, aproximadamente cuatro cajas al mes. Consulta con nuestro equipo la cobertura y los detalles de entrega en tu dirección.";
  if (/qu[eé].*(incluye|trae)|snack|producto|cat[aá]logo/.test(s)) return "Entre los snacks ilustrativos del catálogo están las barras de cereal integral, el mix de frutos secos y los chips de banano. La selección puede cambiar cada semana.";
  if (/suscri|cancel/.test(s)) return "La suscripción cuesta $100.000 COP mensuales. Para solicitarla o confirmar las condiciones vigentes, envía un mensaje desde el formulario de contacto.";
  if (/alerg|ingrediente|nutri|salud|diab|cel[ií]ac/.test(s)) return "Los ingredientes y posibles alérgenos deben confirmarse para cada producto. Escríbenos mediante el formulario para verificar la información específica; no puedo ofrecer recomendaciones médicas personalizadas.";
  return "Puedo ayudarte con el precio ($100.000 COP al mes), las entregas semanales y los productos de ejemplo del catálogo. Para cobertura, pagos u otras condiciones, contacta al equipo desde el formulario.";
}
app.post("/api/assistant", rateLimit({ windowMs: 60 * 1000, limit: 20 }), async (req, res) => {
  const message = clean(req.body?.message);
  if (!message || message.length > 500) return res.status(400).json({ error: "Escribe una pregunta de hasta 500 caracteres." });
  if (process.env.OPENAI_API_KEY) {
    try {
      const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, instructions: businessContext, input: message, max_output_tokens: 220 })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Error del proveedor de IA");
      const reply = data.output?.flatMap(item => item.content || []).filter(item => item.type === "output_text").map(item => item.text).join("\n");
      if (reply) return res.json({ reply, source: "ai" });
    } catch (error) { console.error("AI provider error:", error.message); }
  }
  return res.json({ reply: localReply(message), source: "local" });
});

// In production, serve the compiled React app from client/dist.
if (process.env.NODE_ENV === "production") {
  const dist = path.resolve(__dirname, "../client/dist");
  app.use(express.static(dist));
  app.get("/{*path}", (req, res, next) =>
  req.path.startsWith("/api/")
    ? next()
    : res.sendFile(path.join(dist, "index.html"))
);
}
app.listen(PORT, () => console.log(`Eco-Snacks API disponible en http://localhost:${PORT}`));

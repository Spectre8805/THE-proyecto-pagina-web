import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

function ContactForm() {
  const [form, setForm] = useState({ nombre: "", email: "", asunto: "Información sobre la suscripción", mensaje: "" });
  const [status, setStatus] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState(false);
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setBusy(true); setStatus({ type: "", text: "" });
    try {
      const response = await fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible enviar el mensaje.");
      setStatus({ type: "success", text: "¡Mensaje enviado! El equipo de Eco-Snacks se pondrá en contacto contigo." });
      setForm({ nombre: "", email: "", asunto: "Información sobre la suscripción", mensaje: "" });
    } catch (error) {
      setStatus({ type: "error", text: error.message || "No se pudo conectar con el servidor. Intenta más tarde." });
    } finally { setBusy(false); }
  }

  return <section className="form-panel" id="contacto" aria-labelledby="contact-title">
    <p className="eyebrow">Hablemos</p><h2 id="contact-title">Contáctanos</h2>
    <p>¿Tienes preguntas sobre las cajas o la suscripción? Escríbenos.</p>
    <form onSubmit={submit}>
      <div className="form-grid">
        <div className="form-field"><label htmlFor="nombre">Nombre</label><input id="nombre" name="nombre" value={form.nombre} onChange={update} minLength="2" maxLength="80" required autoComplete="name" /></div>
        <div className="form-field"><label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" value={form.email} onChange={update} maxLength="160" required autoComplete="email" /></div>
        <div className="form-field full"><label htmlFor="asunto">Asunto</label><select id="asunto" name="asunto" value={form.asunto} onChange={update}><option>Información sobre la suscripción</option><option>Entregas y cobertura</option><option>Productos e ingredientes</option><option>Otra consulta</option></select></div>
        <div className="form-field full"><label htmlFor="mensaje">Mensaje</label><textarea id="mensaje" name="mensaje" value={form.mensaje} onChange={update} minLength="10" maxLength="3000" required /></div>
      </div>
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Enviando..." : "Enviar mensaje"}</button>
      {status.text && <p className={`status-message status-${status.type}`} role="status">{status.text}</p>}
    </form>
  </section>;
}

function Assistant() {
  const [messages, setMessages] = useState([{ role: "assistant", content: "¡Hola! Soy el asistente de Eco-Snacks. Puedo ayudarte con el precio, las entregas semanales y los snacks de nuestras cajas." }]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(e) {
    e.preventDefault();
    const q = question.trim(); if (!q || busy) return;
    setMessages(m => [...m, { role: "user", content: q }]); setQuestion(""); setBusy(true);
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: q }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo obtener respuesta.");
      setMessages(m => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Ahora mismo no pude responder. Puedes usar el formulario de contacto para hablar con el equipo." }]);
    } finally { setBusy(false); }
  }
  return <section className="chat-panel" aria-labelledby="assistant-title">
    <p className="eyebrow">Asistente virtual</p><h2 id="assistant-title">¿Qué quieres saber?</h2>
    <div className="chat-log" aria-live="polite">{messages.map((m, i) => <div key={i} className={`chat-bubble ${m.role === "user" ? "user" : ""}`}><strong>{m.role === "user" ? "Tú" : "Eco-Asistente"}:</strong> {m.content}</div>)}</div>
    <form className="chat-form" onSubmit={send}><input className="chat-input" aria-label="Pregunta para Eco-Asistente" value={question} onChange={e => setQuestion(e.target.value)} maxLength="500" placeholder="Ej. ¿Cuánto cuesta la suscripción?" required /><button className="button button-primary" disabled={busy}>{busy ? "..." : "Preguntar"}</button></form>
    <p><small>El asistente brinda información general del emprendimiento, no asesoría médica o nutricional personalizada.</small></p>
  </section>;
}

function AdminPanel() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "No se pudo iniciar sesión.");
      setToken(data.token); await loadMessages(data.token);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function loadMessages(t = token) {
    const r = await fetch("/api/admin/messages", { headers: { Authorization: `Bearer ${t}` } });
    const data = await r.json(); if (!r.ok) throw new Error(data.error || "No se pudieron cargar los mensajes.");
    setMessages(data.messages || []);
  }
  function logout() { setToken(""); setMessages([]); setPassword(""); setEmail(""); }
  return <section className="admin-panel" id="administracion">
    <div className="admin-toolbar"><div><p className="eyebrow">Área privada</p><h3>Administración</h3></div><button className="text-link" type="button" onClick={() => setShow(!show)}>{show ? "Ocultar panel" : "Acceso administrativo"}</button></div>
    {show && <div>
      {!token ? <form onSubmit={login}><div className="form-grid">
        <div className="form-field"><label htmlFor="admin-email">Correo administrador</label><input id="admin-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" /></div>
        <div className="form-field"><label htmlFor="admin-password">Contraseña</label><input id="admin-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></div>
      </div><button className="button button-primary" disabled={busy}>{busy ? "Validando..." : "Iniciar sesión"}</button>{error && <p className="status-message status-error" role="alert">{error}</p>}</form>
      : <><div className="admin-toolbar"><p>Mensajes recibidos: <strong>{messages.length}</strong></p><div><button className="button button-primary" type="button" onClick={() => loadMessages().catch(e => setError(e.message))}>Actualizar</button> <button className="button" type="button" onClick={logout}>Cerrar sesión</button></div></div>
      {error && <p className="status-message status-error">{error}</p>}
      {messages.length === 0 ? <p>Aún no hay mensajes.</p> : messages.map(m => <article className="admin-message" key={m.id}><strong>{m.nombre}</strong> · {m.email}<p><strong>{m.asunto}</strong></p><p>{m.mensaje}</p><small>{new Date(m.created_at).toLocaleString("es-CO")}</small></article>)}</>}
    </div>}
  </section>;
}

function App() {
  useEffect(() => { document.title = "Eco-Snacks | Snacks saludables a domicilio"; }, []);
  return <>
    <a className="skip-link" href="#contenido">Saltar al contenido principal</a>
    <header className="site-header">
      <a className="brand" href="#inicio" aria-label="Eco-Snacks, ir al inicio"><span className="brand-mark" aria-hidden="true">E</span><span>Eco-Snacks</span></a>
      <nav aria-label="Navegación principal"><ul className="nav-list"><li><a href="#nosotros">Nosotros</a></li><li><a href="#catalogo">Catálogo</a></li><li><a href="#contacto">Contacto</a></li><li><a className="nav-action" href="#suscripcion">Suscribirme</a></li></ul></nav>
    </header>
    <main id="contenido">
      <section className="hero" id="inicio" aria-labelledby="hero-title">
        <div className="hero-copy"><p className="eyebrow">Una caja distinta cada semana</p><h1 id="hero-title">Pausas ricas.<br/><em>Días más ligeros.</em></h1><p className="hero-text">Snacks nutritivos para estudiar, trabajar y seguir tu día. Los seleccionamos con ingredientes sencillos y los llevamos directo a tu puerta.</p><div className="hero-actions"><a className="button button-primary" href="#suscripcion">Quiero mi caja</a><a className="text-link" href="#catalogo">Ver qué incluye <span aria-hidden="true">↓</span></a></div></div>
        <div className="hero-art" aria-label="Ilustración de una caja Eco-Snacks con alimentos saludables" role="img"><div className="sun" aria-hidden="true"></div><div className="leaf leaf-one" aria-hidden="true"></div><div className="leaf leaf-two" aria-hidden="true"></div><div className="snack-box" aria-hidden="true"><span>Esta semana</span><strong>5 snacks<br/>para descubrir</strong></div></div>
      </section>
      <section className="about" id="nosotros" aria-labelledby="about-title"><div><p className="eyebrow">Así funciona</p><h2 id="about-title">Comer mejor no debería ser complicado.</h2></div><div className="about-copy"><p>Recibes una selección semanal de productos nutritivos, prácticos y deliciosos. Sin listas interminables ni compras de último minuto.</p><p className="price"><strong>$100.000 COP</strong> al mes <span>· envío incluido</span></p></div></section>
      <section className="catalog" id="catalogo" aria-labelledby="catalog-title"><div className="section-heading"><div><p className="eyebrow">Dentro de la caja</p><h2 id="catalog-title">Favoritos que sí alimentan</h2></div><p>La selección cambia cada semana para que siempre tengas algo nuevo por probar.</p></div>
        <div className="product-grid">
          <article className="product product-featured"><div className="product-number" aria-hidden="true">01</div><div className="product-icon icon-bar" aria-hidden="true"><span></span><span></span><span></span></div><div><p className="product-tag">Energía sostenida</p><h3>Barra de cereal integral</h3><p>Avena, semillas y fruta: una mezcla práctica para cualquier momento del día.</p></div></article>
          <article className="product"><div className="product-number" aria-hidden="true">02</div><div className="product-icon icon-nuts" aria-hidden="true"><span></span><span></span><span></span></div><div><p className="product-tag">Proteína vegetal</p><h3>Mix de frutos secos</h3><p>Nueces, almendras y maní tostado, sin sabores artificiales.</p></div></article>
          <article className="product product-yellow"><div className="product-number" aria-hidden="true">03</div><div className="product-icon icon-banana" aria-hidden="true"><span></span></div><div><p className="product-tag">Crujiente y natural</p><h3>Chips de banano</h3><p>Banano deshidratado y crocante, sin conservantes añadidos.</p></div></article>
        </div>
      </section>
      <section className="subscription" id="suscripcion" aria-labelledby="subscription-title"><div><p className="eyebrow">Tu próxima pausa empieza aquí</p><h2 id="subscription-title">Una caja. Cuatro entregas. Cero complicaciones.</h2></div><div className="subscription-action"><p>Suscripción mensual por <strong>{money.format(100000)} COP</strong>. Cuatro entregas semanales; confirma cobertura y condiciones al solicitarla.</p><a className="button button-light" href="#contacto">Solicitar suscripción</a></div></section>
      <ContactForm />
      <Assistant />
      <AdminPanel />
    </main>
    <footer><a className="brand footer-brand" href="#inicio" aria-label="Eco-Snacks, volver al inicio"><span className="brand-mark" aria-hidden="true">E</span><span>Eco-Snacks</span></a><p>Snacks honestos para días reales.</p><a href="#contacto">Contáctanos</a></footer>
  </>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);

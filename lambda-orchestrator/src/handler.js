const serverless = require('serverless-http');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const CUSTOMERS_API_BASE = process.env.CUSTOMERS_API_BASE || 'http://localhost:3001';
const ORDERS_API_BASE = process.env.ORDERS_API_BASE || 'http://localhost:3002';
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'internal-service-token-2024';

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

function getOperatorToken() {
  return jwt.sign({ username: 'orchestrator', role: 'service' }, JWT_SECRET, { expiresIn: '5m' });
}

// Serve static assets
const FAVICON_B64 = fs.readFileSync(path.join(__dirname, 'favicon.png')).toString('base64');
app.get('/favicon.png', (req, res) => {
  const buf = Buffer.from(FAVICON_B64, 'base64');
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Length', buf.length);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.end(buf);
});
app.get('/logo.svg', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(fs.readFileSync(path.join(__dirname, 'logo.svg')));
});

// Read logo SVG for inline use
const LOGO_SVG = fs.readFileSync(path.join(__dirname, 'logo.svg'), 'utf8');

// Jelou brand CSS — extracted from jelou.ai production styles
const JELOU_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Poppins', sans-serif;
    background: #fbfbfb;
    color: #1e2939;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }
  .page-wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; }
  .container { max-width: 740px; width: 100%; }

  /* Header */
  .brand-header { text-align: center; margin-bottom: 2rem; }
  .brand-logo {
    display: inline-flex; align-items: center; gap: 0.6rem;
    font-family: 'Manrope', sans-serif; font-size: 1.6rem; font-weight: 700;
    color: #1e2939; letter-spacing: -0.02em; margin-bottom: 0.35rem;
  }
  .brand-logo svg { width: 34px; height: 34px; flex-shrink: 0; }
  .brand-tagline {
    color: #374361; font-size: 0.95rem; font-weight: 400; line-height: 1.5;
  }
  .gradient-text {
    background: linear-gradient(122deg, #161c2b 58.21%, #017e9d 92.45%);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  /* Status pill */
  .status-pill {
    display: inline-flex; align-items: center; gap: 0.5rem;
    border-radius: 24px; border: 1px solid rgba(0,179,199,0.2);
    background: #fff; padding: 5px 17px;
    font-size: 12px; font-weight: 500; color: #1e2939;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    margin-bottom: 2.25rem;
    transition: background-color 0.2s, border-color 0.2s;
  }
  .status-pill:hover { background: #f0fdfa; border-color: rgba(0,179,199,0.4); }
  .status-dot {
    width: 7px; height: 7px; background: #00b3c7;
    border-radius: 50%; animation: pulse-dot 2s ease-in-out infinite;
  }
  @keyframes pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

  /* Cards */
  .card {
    background: #fff;
    border: 1px solid #e8ecf1;
    border-radius: 16px;
    padding: 1.5rem;
    margin-bottom: 0.85rem;
    transition: border-color 0.2s, box-shadow 0.25s;
  }
  .card:hover { border-color: rgba(0,179,199,0.35); box-shadow: 0 4px 24px rgba(0,179,199,0.06); }
  a.card { text-decoration: none; color: inherit; display: block; cursor: pointer; }
  .card-label {
    font-family: 'Manrope', sans-serif;
    font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; color: #00b3c7; margin-bottom: 0.75rem;
  }
  .card h3 { font-size: 0.95rem; font-weight: 600; color: #1e2939; margin-bottom: 0.2rem; }
  .card p { font-size: 0.82rem; color: #374361; line-height: 1.55; }

  /* Service grid */
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.85rem; margin-bottom: 0.85rem; }
  .grid-card { text-align: center; padding: 1.5rem 1rem; }
  .icon-wrap {
    width: 48px; height: 48px; border-radius: 12px;
    display: inline-flex; align-items: center; justify-content: center;
    margin-bottom: 0.75rem;
  }
  .icon-wrap svg { width: 24px; height: 24px; }
  .icon-wrap.teal { background: rgba(0,179,199,0.08); color: #00b3c7; }
  .icon-wrap.green { background: rgba(1,126,157,0.08); color: #017e9d; }
  .icon-wrap.dark { background: rgba(22,28,43,0.06); color: #161c2b; }
  .port-badge {
    font-family: 'Manrope', monospace; font-size: 0.7rem; font-weight: 600;
    color: #00b3c7; background: rgba(0,179,199,0.06);
    padding: 0.2rem 0.65rem; border-radius: 6px;
    display: inline-block; margin-top: 0.5rem;
  }

  /* Endpoints */
  .endpoint-row {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.65rem 0; border-bottom: 1px solid #f1f3f7;
  }
  .endpoint-row:last-child { border-bottom: none; }
  .method-pill {
    font-family: 'Manrope', monospace; font-size: 0.65rem; font-weight: 700;
    padding: 0.2rem 0.55rem; border-radius: 6px; min-width: 44px; text-align: center;
  }
  .method-pill.get { background: rgba(0,179,199,0.1); color: #00b3c7; }
  .method-pill.post { background: rgba(1,126,157,0.1); color: #017e9d; }
  .endpoint-path { font-family: 'Manrope', monospace; font-size: 0.82rem; color: #1e2939; }

  /* Code blocks */
  .code-block {
    background: #161c2b; border-radius: 12px; padding: 1.15rem 1.35rem;
    font-family: ui-monospace, 'SF Mono', 'Fira Code', Consolas, monospace;
    font-size: 0.78rem; color: #94a3b8; line-height: 1.75;
    overflow-x: auto; white-space: pre; margin-top: 0.5rem;
  }
  .code-block .kw { color: #00b3c7; }
  .code-block .str { color: #34d399; }
  .code-block .num { color: #fbbf24; }

  /* Links */
  .link-list a {
    display: flex; align-items: center; gap: 0.5rem;
    color: #00b3c7; text-decoration: none; font-size: 0.85rem; font-weight: 500;
    padding: 0.45rem 0; transition: color 0.2s;
  }
  .link-list a:hover { color: #017e9d; }
  .link-list a svg { width: 16px; height: 16px; opacity: 0.5; }

  /* CTA Button */
  .btn-primary {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
    background: #00b3c7; color: #fff;
    font-family: 'Poppins', sans-serif; font-size: 0.875rem; font-weight: 600;
    padding: 0.6rem 1.5rem; border-radius: 160px; border: none;
    cursor: pointer; text-decoration: none;
    transition: background-color 0.2s;
    box-shadow: 0 4px 24px rgba(77,187,255,0.15);
  }
  .btn-primary:hover { background: #0099a8; }

  /* Candidate card */
  .candidate-card {
    background: linear-gradient(135deg, #161c2b 0%, #1a2d3d 100%);
    border: 1px solid rgba(0,179,199,0.15); border-radius: 16px;
    padding: 1.75rem; margin-bottom: 0.85rem; color: #e8ecf1;
  }
  .candidate-card .card-label { color: rgba(0,179,199,0.7); margin-bottom: 1rem; }
  .candidate-name {
    font-family: 'Manrope', sans-serif; font-size: 1.15rem; font-weight: 700;
    color: #fff; margin-bottom: 0.15rem;
  }
  .candidate-role {
    font-size: 0.8rem; color: #00b3c7; font-weight: 500; margin-bottom: 1rem;
  }
  .candidate-info { display: flex; flex-direction: column; gap: 0.5rem; }
  .candidate-info a, .candidate-info span {
    display: inline-flex; align-items: center; gap: 0.5rem;
    font-size: 0.82rem; color: #cdd5e0; text-decoration: none; transition: color 0.2s;
  }
  .candidate-info a:hover { color: #00b3c7; }
  .candidate-info svg { width: 16px; height: 16px; flex-shrink: 0; opacity: 0.6; }

  /* Collapsible */
  .collapsible-toggle {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; background: #fff; border: 1px solid #e8ecf1; border-radius: 12px;
    padding: 1rem 1.25rem; cursor: pointer; margin-bottom: 0;
    font-family: 'Poppins', sans-serif; font-size: 0.82rem; font-weight: 600;
    color: #1e2939; transition: all 0.2s;
  }
  .collapsible-toggle:hover { border-color: rgba(0,179,199,0.35); box-shadow: 0 2px 12px rgba(0,179,199,0.06); }
  .collapsible-toggle .chevron {
    width: 20px; height: 20px; transition: transform 0.3s; color: #00b3c7;
  }
  .collapsible-toggle.open { border-radius: 12px 12px 0 0; border-bottom-color: transparent; margin-bottom: 0; }
  .collapsible-toggle.open .chevron { transform: rotate(180deg); }
  .collapsible-body {
    display: none; background: #fff; border: 1px solid #e8ecf1; border-top: none;
    border-radius: 0 0 12px 12px; padding: 1.25rem; margin-bottom: 0.85rem;
    font-size: 0.78rem; color: #374361; line-height: 1.7;
  }
  .collapsible-body.open { display: block; }
  .collapsible-body h4 { font-family: 'Manrope', sans-serif; font-size: 0.75rem; font-weight: 700; color: #1e2939; margin: 1rem 0 0.4rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .collapsible-body h4:first-child { margin-top: 0; }
  .collapsible-body ul { padding-left: 1.25rem; margin: 0.3rem 0; }
  .collapsible-body li { margin-bottom: 0.25rem; }
  .collapsible-body code {
    background: rgba(0,179,199,0.06); color: #017e9d; padding: 0.1rem 0.4rem;
    border-radius: 4px; font-size: 0.72rem;
  }
  .spec-section { border-top: 1px solid #f1f3f7; padding-top: 0.75rem; margin-top: 0.75rem; }

  /* Footer */
  .footer {
    text-align: center; margin-top: 2rem; padding-top: 1.25rem;
    border-top: 1px solid #e8ecf1; font-size: 0.7rem; color: #374361;
  }

  /* Back link */
  .back-link {
    display: inline-flex; align-items: center; gap: 0.35rem;
    color: #374361; text-decoration: none; font-size: 0.8rem; font-weight: 500;
    margin-bottom: 1.5rem; transition: color 0.2s;
  }
  .back-link:hover { color: #00b3c7; }
  .back-link svg { width: 16px; height: 16px; }

  @media (max-width: 640px) {
    .grid-3 { grid-template-columns: 1fr; }
    .brand-logo { font-size: 1.3rem; }
  }
`;

// SVG Icons — outline style, consistent stroke
const ICONS = {
  jelou: '<svg viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="34" height="34" rx="10" fill="#00b3c7"/><path d="M9.5 17.5a7.5 7.5 0 0 1 7.5-7.5h0a7.5 7.5 0 0 1 7.5 7.5v0a7.5 7.5 0 0 1-7.5 7.5h0a7.5 7.5 0 0 1-7.5-7.5z" stroke="#fff" stroke-width="1.8"/><circle cx="14.8" cy="16.5" r="1.3" fill="#fff"/><circle cx="19.2" cy="16.5" r="1.3" fill="#fff"/><path d="M14.5 20.5c.8.9 1.8 1.2 2.5 1.2s1.7-.3 2.5-1.2" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>',
  customers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  orders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 7v10"/><path d="M12 7v4"/><path d="M16 7v7"/></svg>',
  orchestrator: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
};

// Root portal
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jelou B2B Backoffice</title>
  <link rel="icon" type="image/png" href="data:image/png;base64,${FAVICON_B64}">
  <style>${JELOU_CSS}</style>
</head>
<body>
  <div class="page-wrap">
    <div class="container">
      <div class="brand-header">
        <div class="brand-logo"><img src="/logo.svg" alt="Jelou" style="height:28px;width:auto;" /> B2B Backoffice</div>
        <div class="brand-tagline">Plataforma de Procesamiento de Pedidos &mdash; Arquitectura de Microservicios</div>
      </div>

      <div style="text-align:center; margin-bottom:1.5rem;">
        <a href="/orchestrator/console" style="display:inline-flex; align-items:center; gap:0.6rem; text-decoration:none; border:1px solid rgba(0,179,199,0.2); border-radius:24px; padding:6px 20px 6px 8px; background:#fff; transition:all 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.04);" onmouseover="this.style.borderColor='rgba(0,179,199,0.5)';this.style.background='#f0fdfa';" onmouseout="this.style.borderColor='rgba(0,179,199,0.2)';this.style.background='#fff';">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#00b3c7;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </span>
          <span style="font-family:'Poppins',sans-serif;font-size:0.8rem;font-weight:500;color:#1e2939;">Consola Interactiva</span>
        </a>
      </div>

      <div class="grid-3">
        <a class="card grid-card" href="${CUSTOMERS_API_BASE}/api-docs" target="_blank">
          <div class="icon-wrap teal">${ICONS.customers}</div>
          <h3>Customers API</h3>
          <p>Gesti&oacute;n de clientes B2B</p>
          <span class="port-badge">:3001</span>
        </a>
        <a class="card grid-card" href="${ORDERS_API_BASE}/api-docs" target="_blank">
          <div class="icon-wrap green">${ICONS.orders}</div>
          <h3>Orders API</h3>
          <p>Productos y stock</p>
          <span class="port-badge">:3002</span>
        </a>
        <a class="card grid-card" href="/orchestrator">
          <div class="icon-wrap dark">${ICONS.orchestrator}</div>
          <h3>Orquestador</h3>
          <p>Flujo completo</p>
          <span class="port-badge">:3003</span>
        </a>
      </div>

      <div class="card">
        <div class="card-label">Arquitectura</div>
        <p>Backoffice basado en microservicios construido con <strong>Node.js</strong>, <strong>Express</strong>, <strong>MySQL</strong> y <strong>AWS Lambda</strong>.
           El orquestador coordina la validaci&oacute;n del cliente, creaci&oacute;n de orden, gesti&oacute;n de stock y confirmaci&oacute;n idempotente en una sola llamada API transaccional.</p>
      </div>

      <div class="card">
        <div class="card-label">Documentaci&oacute;n y Herramientas</div>
        <div class="link-list">
          <a href="${CUSTOMERS_API_BASE}/api-docs" target="_blank">${ICONS.external} Customers API &mdash; Swagger</a>
          <a href="${ORDERS_API_BASE}/api-docs" target="_blank">${ICONS.external} Orders API &mdash; Swagger</a>
          <a href="/orchestrator">${ICONS.arrow} Orquestador &mdash; Endpoints y Ejemplos</a>
          <a href="/orchestrator/console" style="color:#017e9d; font-weight:600;">${ICONS.arrow} Consola Interactiva &mdash; Probar las APIs visualmente</a>
        </div>
      </div>

      <div class="card">
        <div class="card-label">Plan de Pruebas &mdash; Customers API (:3001)</div>
        <table style="width:100%; font-size:0.78rem; border-collapse:collapse;">
          <thead><tr><th style="text-align:left; padding:0.4rem 0.5rem; border-bottom:1px solid #e8ecf1; font-family:Manrope,sans-serif; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.05em; color:#374361;">#</th><th style="text-align:left; padding:0.4rem 0.5rem; border-bottom:1px solid #e8ecf1; font-family:Manrope,sans-serif; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.05em; color:#374361;">Prueba</th><th style="text-align:left; padding:0.4rem 0.5rem; border-bottom:1px solid #e8ecf1; font-family:Manrope,sans-serif; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.05em; color:#374361;">M&eacute;todo</th><th style="text-align:left; padding:0.4rem 0.5rem; border-bottom:1px solid #e8ecf1; font-family:Manrope,sans-serif; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.05em; color:#374361;">Esperado</th></tr></thead>
          <tbody>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">1.1</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Obtener token JWT</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(0,179,199,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">POST /auth/login</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">200 + token</td></tr>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">2.1</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Listar clientes (seed)</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(0,179,199,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">GET /customers</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">200 + 5 clientes</td></tr>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">2.2</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Buscar por nombre</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(0,179,199,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">GET /customers?search=ACME</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">200 + filtrado</td></tr>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">2.3</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Obtener por ID</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(0,179,199,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">GET /customers/1</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">200 + ACME</td></tr>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">2.4</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Crear cliente</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(1,126,157,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">POST /customers</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">201 creado</td></tr>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">2.5</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Email duplicado</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(1,126,157,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">POST /customers</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">409 conflicto</td></tr>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">2.6</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Actualizar cliente</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(245,166,35,0.08);color:#b45309;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">PUT /customers/:id</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">200 actualizado</td></tr>
            <tr><td style="padding:0.35rem 0.5rem;">2.7</td><td style="padding:0.35rem 0.5rem;">Eliminaci&oacute;n l&oacute;gica</td><td style="padding:0.35rem 0.5rem;"><code style="background:rgba(239,68,68,0.06);color:#dc2626;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">DELETE /customers/:id</code></td><td style="padding:0.35rem 0.5rem;">204 eliminado</td></tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-label">Plan de Pruebas &mdash; Orders API (:3002)</div>
        <table style="width:100%; font-size:0.78rem; border-collapse:collapse;">
          <thead><tr><th style="text-align:left; padding:0.4rem 0.5rem; border-bottom:1px solid #e8ecf1; font-family:Manrope,sans-serif; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.05em; color:#374361;">#</th><th style="text-align:left; padding:0.4rem 0.5rem; border-bottom:1px solid #e8ecf1; font-family:Manrope,sans-serif; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.05em; color:#374361;">Prueba</th><th style="text-align:left; padding:0.4rem 0.5rem; border-bottom:1px solid #e8ecf1; font-family:Manrope,sans-serif; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.05em; color:#374361;">M&eacute;todo</th><th style="text-align:left; padding:0.4rem 0.5rem; border-bottom:1px solid #e8ecf1; font-family:Manrope,sans-serif; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.05em; color:#374361;">Esperado</th></tr></thead>
          <tbody>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">3.1</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Listar productos (seed)</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(0,179,199,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">GET /products</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">200 + 6 productos</td></tr>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">3.2</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Crear producto</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(1,126,157,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">POST /products</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">201 creado</td></tr>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">3.3</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Actualizar stock/precio</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(167,139,250,0.08);color:#7c3aed;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">PATCH /products/:id</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">200 actualizado</td></tr>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">4.1</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Crear orden (v&aacute;lida)</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(1,126,157,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">POST /orders</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">201 CREATED + stock descontado</td></tr>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">4.2</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Orden + cliente inexistente</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(1,126,157,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">POST /orders</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">404 cliente no encontrado</td></tr>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">4.3</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Orden + sin stock</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(1,126,157,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">POST /orders</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">400 stock insuficiente</td></tr>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">5.1</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Confirmar (1ra vez)</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(1,126,157,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">POST /orders/:id/confirm</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">200 CONFIRMED</td></tr>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">5.2</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Confirmar (retry, misma key)</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(1,126,157,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">POST /orders/:id/confirm</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">200 idempotente (misma respuesta)</td></tr>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">6.1</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Cancelar orden CREATED</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(1,126,157,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">POST /orders/:id/cancel</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">200 CANCELED + stock restaurado</td></tr>
            <tr><td style="padding:0.35rem 0.5rem;">6.2</td><td style="padding:0.35rem 0.5rem;">Cancelar CONFIRMED (&lt;10min)</td><td style="padding:0.35rem 0.5rem;"><code style="background:rgba(1,126,157,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">POST /orders/:id/cancel</code></td><td style="padding:0.35rem 0.5rem;">200 CANCELED</td></tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-label">Plan de Pruebas &mdash; Lambda Orquestador (:3003)</div>
        <table style="width:100%; font-size:0.78rem; border-collapse:collapse;">
          <thead><tr><th style="text-align:left; padding:0.4rem 0.5rem; border-bottom:1px solid #e8ecf1; font-family:Manrope,sans-serif; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.05em; color:#374361;">#</th><th style="text-align:left; padding:0.4rem 0.5rem; border-bottom:1px solid #e8ecf1; font-family:Manrope,sans-serif; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.05em; color:#374361;">Prueba</th><th style="text-align:left; padding:0.4rem 0.5rem; border-bottom:1px solid #e8ecf1; font-family:Manrope,sans-serif; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.05em; color:#374361;">M&eacute;todo</th><th style="text-align:left; padding:0.4rem 0.5rem; border-bottom:1px solid #e8ecf1; font-family:Manrope,sans-serif; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.05em; color:#374361;">Esperado</th></tr></thead>
          <tbody>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">7.1</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Flujo completo: crear + confirmar</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(1,126,157,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">POST /orchestrator/create-and-confirm-order</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">201 + JSON consolidado</td></tr>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">7.2</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Cliente inexistente</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(1,126,157,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">POST /orchestrator/create-and-confirm-order</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">404 cliente no encontrado</td></tr>
            <tr><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">7.3</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">Sin idempotency_key</td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;"><code style="background:rgba(1,126,157,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">POST /orchestrator/create-and-confirm-order</code></td><td style="padding:0.35rem 0.5rem; border-bottom:1px solid #f1f3f7;">400 error de validaci&oacute;n</td></tr>
            <tr><td style="padding:0.35rem 0.5rem;">7.4</td><td style="padding:0.35rem 0.5rem;">Verificaci&oacute;n de salud</td><td style="padding:0.35rem 0.5rem;"><code style="background:rgba(0,179,199,0.08);color:#017e9d;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.7rem;">GET /orchestrator/health</code></td><td style="padding:0.35rem 0.5rem;">200 status ok</td></tr>
          </tbody>
        </table>
      </div>

      <div class="candidate-card">
        <div class="card-label">Candidato</div>
        <div class="candidate-name">Daniel Obed Ortega Hern&aacute;ndez</div>
        <div class="candidate-role">Technical Project Manager &ndash; Implementations / Operations</div>
        <div class="candidate-info">
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Bogot&aacute;, Colombia
          </span>
          <a href="https://wa.me/573004051582" target="_blank">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            +57 300 405 1582
          </a>
          <a href="mailto:ohernandez83@hotmail.com">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            ohernandez83@hotmail.com
          </a>
        </div>
      </div>

      <button class="collapsible-toggle" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open');">
        <span>Prueba T&eacute;cnica &mdash; Ver Especificaci&oacute;n Completa</span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="collapsible-body">
        <h4>Objetivo</h4>
        <p>Construir un sistema m&iacute;nimo compuesto por dos APIs (Customers y Orders) y un Lambda orquestador. Las APIs deben operar sobre MySQL, estar documentadas y levantarse con Docker Compose. El Lambda se invoca desde Postman/Insomnia (local via serverless-offline + ngrok o desplegado en AWS) y orquesta la creaci&oacute;n y confirmaci&oacute;n de pedidos, devolviendo un JSON consolidado.</p>

        <div class="spec-section">
          <h4>Entregables (Repositorio GitHub)</h4>
          <ul>
            <li>Monorepo con carpetas: <code>/customers-api</code>, <code>/orders-api</code>, <code>/lambda-orchestrator</code>, <code>/db</code> (schema.sql y seed.sql), <code>docker-compose.yml</code>, <code>README.md</code>, <code>openapi.yaml</code> por servicio.</li>
            <li>Ambas APIs y el Lambda en Node.js (JavaScript) + Express, autenticaci&oacute;n JWT simple, validaci&oacute;n (Zod/Joi), SQL parametrizado.</li>
            <li>Lambda orquestador con Serverless Framework (runtime Node 22). Endpoint HTTP para orquestar pedido.</li>
            <li>Documentaci&oacute;n OpenAPI 3.0 por servicio + ejemplos cURL/collection Postman/Insomnia (opcional).</li>
            <li>Scripts NPM: build, start/dev, migrate, seed, test (si agregas pruebas).</li>
          </ul>
        </div>

        <div class="spec-section">
          <h4>Caso de uso: Backoffice de Pedidos B2B</h4>
          <ul>
            <li>Operador crea/gestiona clientes (Customers API).</li>
            <li>Operador gestiona productos y stock (Orders API).</li>
            <li>Operador crea un pedido para un cliente existente; el sistema valida al cliente en Customers API, verifica stock, calcula totales y crea la orden en estado CREATED.</li>
            <li>Operador confirma el pedido; el sistema cambia a CONFIRMED en forma idempotente (X-Idempotency-Key).</li>
          </ul>
        </div>

        <div class="spec-section">
          <h4>Customers API (puerto 3001)</h4>
          <ul>
            <li><code>POST /customers</code> &rarr; crea cliente {name, email (&uacute;nico), phone}.</li>
            <li><code>GET /customers/:id</code> &rarr; detalle.</li>
            <li><code>GET /customers?search=&amp;cursor=&amp;limit=</code> &rarr; b&uacute;squeda.</li>
            <li><code>PUT /customers/:id</code> / <code>DELETE /customers/:id</code> (soft-delete opcional).</li>
            <li><code>GET /internal/customers/:id</code> &rarr; igual al GET normal pero requiere Authorization: Bearer SERVICE_TOKEN (para Orders).</li>
          </ul>
        </div>

        <div class="spec-section">
          <h4>Orders API (puerto 3002)</h4>
          <p style="margin-bottom:0.4rem;"><strong>Productos:</strong></p>
          <ul>
            <li><code>POST /products</code>, <code>PATCH /products/:id</code> (precio/stock), <code>GET /products/:id</code>, <code>GET /products?search=&amp;cursor=&amp;limit=</code>.</li>
          </ul>
          <p style="margin:0.6rem 0 0.4rem;"><strong>&Oacute;rdenes:</strong></p>
          <ul>
            <li><code>POST /orders</code> &rarr; body {customer_id, items:[{product_id, qty}]}; valida cliente en Customers (endpoint /internal), verifica stock, crea order (CREATED), descuenta stock (transacci&oacute;n).</li>
            <li><code>GET /orders/:id</code> &rarr; incluye items.</li>
            <li><code>GET /orders?status=&amp;from=&amp;to=&amp;cursor=&amp;limit=</code></li>
            <li><code>POST /orders/:id/confirm</code> &rarr; idempotente con header X-Idempotency-Key; devuelve mismo resultado si se repite la misma key.</li>
            <li><code>POST /orders/:id/cancel</code> &rarr; CREATED cancela y restaura stock; CONFIRMED cancela dentro de 10 min (regla simple).</li>
          </ul>
        </div>

        <div class="spec-section">
          <h4>Lambda Orquestador (HTTP)</h4>
          <p>Endpoint: <code>POST /orchestrator/create-and-confirm-order</code>. Recibe {customer_id, items[], idempotency_key, (opcional) correlation_id}.</p>
          <p>Flujo: valida cliente (Customers /internal) &rarr; crea orden (Orders /orders) &rarr; confirma orden (Orders /orders/:id/confirm con X-Idempotency-Key) &rarr; responde JSON consolidado (cliente + orden confirmada + items).</p>
        </div>

        <div class="spec-section">
          <h4>Base de datos (incluida en el repo)</h4>
          <ul>
            <li><code>customers</code> (id, name, email &uacute;nico, phone, created_at)</li>
            <li><code>products</code> (id, sku &uacute;nico, name, price_cents, stock, created_at)</li>
            <li><code>orders</code> (id, customer_id FK, status ENUM('CREATED','CONFIRMED','CANCELED'), total_cents, created_at)</li>
            <li><code>order_items</code> (id, order_id FK, product_id FK, qty, unit_price_cents, subtotal_cents)</li>
            <li><code>idempotency_keys</code> (key PK &uacute;nico, target_type, target_id, status, response_body, created_at, expires_at)</li>
          </ul>
          <p>Incluir <code>/db/schema.sql</code> y <code>/db/seed.sql</code> con datos de ejemplo.</p>
        </div>

        <div class="spec-section">
          <h4>Criterios de aceptaci&oacute;n m&iacute;nimos</h4>
          <ul>
            <li>Customers API y Orders API funcionales, documentadas (OpenAPI) y levantan con docker-compose.</li>
            <li>Creaci&oacute;n de pedido: valida cliente, stock, calcula totales, crea CREATED y descuenta stock (transacci&oacute;n).</li>
            <li>Confirmaci&oacute;n idempotente con X-Idempotency-Key; reintentos con misma key devuelven la misma respuesta.</li>
            <li>Cancelaci&oacute;n v&aacute;lida restaura stock seg&uacute;n reglas.</li>
            <li>Lambda orquestador invocable por HTTP y retorna JSON consolidado.</li>
            <li>Repo contiene <code>/db/schema.sql</code> y <code>/db/seed.sql</code>; README con pasos claros.</li>
          </ul>
        </div>

        <div class="spec-section">
          <h4>Entrega</h4>
          <p>Subir el repositorio a GitHub con todo lo indicado. En el README agregar: comandos para levantar, variables de entorno, URLs base, ejemplos cURL, y c&oacute;mo invocar el Lambda en local y en AWS.</p>
        </div>
      </div>

      <div class="footer">
        Jelou Technical Assessment &mdash; Daniel Obed Ortega Hern&aacute;ndez
      </div>
    </div>
  </div>
</body>
</html>`);
});

// Interactive Console
app.get('/orchestrator/console', (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, 'console.html'), 'utf8')
    .replace(/\{\{CUSTOMERS_API_BASE\}\}/g, CUSTOMERS_API_BASE)
    .replace(/\{\{ORDERS_API_BASE\}\}/g, ORDERS_API_BASE)
    .replace(/\{\{FAVICON_B64\}\}/g, FAVICON_B64);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Orchestrator page
app.get('/orchestrator', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orchestrator &mdash; Jelou B2B Backoffice</title>
  <link rel="icon" type="image/png" href="data:image/png;base64,${FAVICON_B64}">
  <style>${JELOU_CSS}</style>
</head>
<body>
  <div class="page-wrap">
    <div class="container">
      <a href="/" class="back-link">${ICONS.back} Back to portal</a>

      <div class="brand-header" style="text-align:left;">
        <div class="brand-logo" style="font-size:1.35rem;"><img src="/logo.svg" alt="Jelou" style="height:22px;width:auto;" /> Orchestrator</div>
        <div class="brand-tagline">Create and confirm B2B orders in a single API call</div>
      </div>

      <div class="card">
        <div class="card-label">Endpoints</div>
        <div class="endpoint-row">
          <span class="method-pill get">GET</span>
          <span class="endpoint-path">/orchestrator/health</span>
        </div>
        <div class="endpoint-row">
          <span class="method-pill post">POST</span>
          <span class="endpoint-path">/orchestrator/create-and-confirm-order</span>
        </div>
      </div>

      <div class="card">
        <div class="card-label">Connected Services</div>
        <div class="link-list">
          <a href="${CUSTOMERS_API_BASE}/api-docs" target="_blank">${ICONS.external} Customers API &mdash; ${CUSTOMERS_API_BASE}</a>
          <a href="${ORDERS_API_BASE}/api-docs" target="_blank">${ICONS.external} Orders API &mdash; ${ORDERS_API_BASE}</a>
        </div>
      </div>

      <div class="card">
        <div class="card-label">Example Request</div>
        <div class="code-block"><span class="kw">POST</span> /orchestrator/create-and-confirm-order
<span class="kw">Content-Type:</span> application/json

{
  <span class="str">"customer_id"</span>: <span class="num">1</span>,
  <span class="str">"items"</span>: [{ <span class="str">"product_id"</span>: <span class="num">2</span>, <span class="str">"qty"</span>: <span class="num">3</span> }],
  <span class="str">"idempotency_key"</span>: <span class="str">"abc-123"</span>,
  <span class="str">"correlation_id"</span>: <span class="str">"req-789"</span>
}</div>
      </div>

      <div class="card">
        <div class="card-label">Example Response (201)</div>
        <div class="code-block">{
  <span class="str">"success"</span>: <span class="kw">true</span>,
  <span class="str">"correlationId"</span>: <span class="str">"req-789"</span>,
  <span class="str">"data"</span>: {
    <span class="str">"customer"</span>: { <span class="str">"id"</span>: <span class="num">1</span>, <span class="str">"name"</span>: <span class="str">"ACME Corp"</span>, ... },
    <span class="str">"order"</span>: {
      <span class="str">"id"</span>: <span class="num">101</span>,
      <span class="str">"status"</span>: <span class="str">"CONFIRMED"</span>,
      <span class="str">"total_cents"</span>: <span class="num">389700</span>,
      <span class="str">"items"</span>: [{ <span class="str">"product_id"</span>: <span class="num">2</span>, <span class="str">"qty"</span>: <span class="num">3</span> }]
    }
  }
}</div>
      </div>

      <div style="text-align:center; margin-top:1.5rem; display:flex; gap:0.75rem; justify-content:center;">
        <a href="/orchestrator/console" class="btn-primary">${ICONS.arrow} Open Interactive Console</a>
        <a href="/" class="btn-primary" style="background:#374361;">${ICONS.back} Back to Portal</a>
      </div>

      <div class="footer">
        Jelou Technical Assessment &mdash; Senior Backend (Node.js + MySQL + Docker + Lambda)
      </div>
    </div>
  </div>
</body>
</html>`);
});

// Health check
app.get('/orchestrator/health', (req, res) => {
  res.json({ status: 'ok', service: 'lambda-orchestrator', timestamp: new Date().toISOString() });
});

// POST /orchestrator/create-and-confirm-order
app.post('/orchestrator/create-and-confirm-order', async (req, res) => {
  const { customer_id, items, idempotency_key, correlation_id } = req.body;
  const correlationId = correlation_id || `cor-${Date.now()}`;

  if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      correlationId,
      error: 'customer_id and items (non-empty array) are required',
    });
  }

  if (!idempotency_key) {
    return res.status(400).json({
      success: false,
      correlationId,
      error: 'idempotency_key is required',
    });
  }

  try {
    const operatorToken = getOperatorToken();

    // Step 1: Validate customer
    const customerResponse = await fetch(`${CUSTOMERS_API_BASE}/internal/customers/${customer_id}`, {
      headers: { 'Authorization': `Bearer ${SERVICE_TOKEN}` },
    });

    if (!customerResponse.ok) {
      const errorBody = await customerResponse.json().catch(() => ({}));
      return res.status(customerResponse.status === 404 ? 404 : 502).json({
        success: false, correlationId,
        error: customerResponse.status === 404 ? `Customer ${customer_id} not found` : 'Failed to validate customer',
        details: errorBody,
      });
    }

    const customer = await customerResponse.json();

    // Step 2: Create order
    const createOrderResponse = await fetch(`${ORDERS_API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${operatorToken}` },
      body: JSON.stringify({ customer_id, items }),
    });

    if (!createOrderResponse.ok) {
      const errorBody = await createOrderResponse.json().catch(() => ({}));
      return res.status(createOrderResponse.status >= 400 && createOrderResponse.status < 500 ? createOrderResponse.status : 502).json({
        success: false, correlationId, error: 'Failed to create order', details: errorBody,
      });
    }

    const createdOrder = await createOrderResponse.json();

    // Step 3: Confirm order
    const confirmResponse = await fetch(`${ORDERS_API_BASE}/orders/${createdOrder.id}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${operatorToken}`, 'X-Idempotency-Key': idempotency_key },
    });

    if (!confirmResponse.ok) {
      const errorBody = await confirmResponse.json().catch(() => ({}));
      return res.status(502).json({ success: false, correlationId, error: 'Failed to confirm order', details: errorBody });
    }

    const confirmedOrder = await confirmResponse.json();

    // Step 4: Consolidated response
    res.status(201).json({
      success: true,
      correlationId,
      data: {
        customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
        order: {
          id: confirmedOrder.id, status: confirmedOrder.status, total_cents: confirmedOrder.total_cents,
          items: (confirmedOrder.items || []).map(item => ({
            product_id: item.product_id, qty: item.qty, unit_price_cents: item.unit_price_cents, subtotal_cents: item.subtotal_cents,
          })),
        },
      },
    });
  } catch (err) {
    console.error('Orchestrator error:', err);
    res.status(500).json({ success: false, correlationId, error: 'Internal orchestrator error', message: err.message });
  }
});

module.exports.handler = serverless(app);

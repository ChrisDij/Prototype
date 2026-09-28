const app = document.querySelector("#app");
const s = {
  user: null,
  page: "dashboard",
  from: "2026-09-01",
  to: "2026-09-28",
  level: "month",
  grouping: "weekly",
  metric: "totalRecordedValue",
  chart: "line",
  compare: false,
  location: "",
  band: "",
  search: "",
  view: null,
  meta: null,
  locations: [],
  trail: [],
};
const labels = {
  recordCount: "Card transactions",
  totalRecordedValue: "Total student spend",
  averageRecordedValue: "Average transaction",
};
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (v) =>
  v == null
    ? "Not available"
    : new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        maximumFractionDigits: 2,
      }).format(v / 100);
const number = (v) => (v == null ? "Not available" : v.toLocaleString("en-ZA"));
const fmt = (v, m = s.metric) => (m === "recordCount" ? number(v) : money(v));
const iso = (n) => new Date(n).toISOString().slice(0, 10);
const btn = (text, action, value = "", kind = "") =>
  `<button type="button" class="${kind}" data-action="${action}" data-value="${esc(value)}">${text}</button>`;
const opt = (v, l, c) =>
  `<option value="${esc(v)}" ${v === c ? "selected" : ""}>${esc(l)}</option>`;
const field = (label, name, type = "text", extra = "") =>
  `<label>${label}<input name="${name}" type="${type}" required ${extra}></label>`;
const query = (overrides = {}) =>
  new URLSearchParams({
    from: s.from,
    to: s.to,
    grouping: s.grouping,
    metric: s.metric,
    chart: s.chart,
    location: s.location,
    band: s.band,
    ...overrides,
  });
async function api(path, body) {
  const r = await fetch(
      path,
      body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    ),
    d = await r.json();
  if (!r.ok) {
    if (r.status === 401) {
      s.user = null;
      render();
    }
    throw Error(d.error || "Request failed.");
  }
  return d;
}
function toast(message, error = false) {
  document.querySelector(".toast")?.remove();
  const e = document.createElement("div");
  e.className = `toast ${error ? "error" : ""}`;
  e.setAttribute("role", error ? "alert" : "status");
  e.textContent = message;
  (document.querySelector("dialog") || app).append(e);
  setTimeout(() => e.remove(), 8000);
}
const brand = '<span class="logo">S</span> Shop-A-Lytics';
function login() {
  return `<header class="welcome"><div class="brand">${brand}</div><h1>Understand your student market.</h1><p>Insights from BoschCard transactions</p></header><main id="main" class="auth-grid"><form class="panel" data-form="login"><h2>Log in</h2>${field("Email or demo username", "username", "text", 'autocomplete="username"')}${field("Password", "password", "password", 'autocomplete="current-password"')}<button class="primary wide">Log in</button>${btn("Forgot password?", "forgot", "", "link")}<p class="muted">Members use the details their account owner gave them.</p></form><form class="panel" data-form="register"><h2>Create a business account</h2><p class="muted">For owners and managers. Add your team after signing up.</p>${field("Business name", "business")}${field("Your name", "name")}${field("Work email", "email", "email")}${field("Password · at least 12 characters", "password", "password", 'minlength="12" autocomplete="new-password"')}<p class="note">Payment details: coming in a later release. New businesses start with no connected data.</p><button class="primary wide">Create account</button></form></main><p class="auth-note">Local demonstration · invented transactions · no live BoschCard connection</p>`;
}
function password() {
  return `<header class="welcome"><div class="brand">${brand}</div><h1>Welcome, ${esc(s.user.name)}</h1></header><main id="main" class="password-wrap"><form class="panel" data-form="password"><h2>Set your own password</h2><p>Your owner created your account with a temporary password. Choose your own to continue.</p>${field("New password", "password", "password", 'minlength="12" autocomplete="new-password"')}${field("Confirm new password", "confirm", "password", 'minlength="12" autocomplete="new-password"')}<p class="muted">At least 12 characters. Cannot be the same as the temporary password.</p><button class="primary wide">Save and continue</button>${btn("Log out", "logout", "", "link")}</form></main>`;
}
function nav() {
  return `<header class="topbar"><a href="#dashboard" class="brand">${brand}</a><nav aria-label="Main navigation">${[
    ["dashboard", "Dashboard"],
    ...(s.user.canViewAlerts
      ? [
          [
            "alerts",
            `Alerts <span class="badge">${s.view?.alerts?.items.length ?? 0}</span>`,
          ],
          ["team", "Team"],
        ]
      : []),
    ["search", "Search"],
  ]
    .map(
      ([id, label]) =>
        `<a href="#${id}" ${s.page === id ? 'aria-current="page"' : ""}>${label}</a>`,
    )
    .join(
      "",
    )}</nav><form data-form="nav-search" class="nav-search"><input name="search" aria-label="Search your locations" placeholder="Search your locations"><button>Search</button></form>${btn("Feedback", "feedback")}<div class="account"><span class="avatar">${esc(s.user.name[0])}</span><div>${esc(s.user.name)}<small>${s.user.role === "manager" ? "Owner" : "Member · View only"} · ${btn("Log out", "logout", "", "text-button")}</small></div></div></header>`;
}
function filters() {
  return `<form class="filters" data-form="range"><label>From<input type="date" name="from" value="${s.from}" required></label><label>To<input type="date" name="to" value="${s.to}" required></label><label>Location<select name="location">${opt("", "All locations", s.location)}${s.locations.map((l) => opt(String(l.id), l.name, s.location)).join("")}</select></label><label>Calendar period<select id="calendar-period"><option value="">Choose a period</option>${s.meta.calendar.periods.map((p) => opt(p.id, p.label, "")).join("")}</select></label><button>Apply</button>${btn("All 5 years", "history", "", "link")}</form>`;
}
function controls() {
  return `<div class="controls"><div class="segmented" aria-label="Time scale">${["month", "week", "day"].map((l) => btn(l[0].toUpperCase() + l.slice(1), "level", l, s.level === l ? "selected" : "")).join("")}</div>${s.page === "detail" ? `<label>Chart<select id="chart">${opt("line", "Line", s.chart)}${opt("column", "Bar", s.chart)}</select></label><label>Compare with<select id="compare">${opt("no", "Nothing", s.compare ? "yes" : "no")}${opt("yes", "Previous period", s.compare ? "yes" : "no")}</select></label>` : ""}${btn("Export", "export", "", "primary")}</div>`;
}
function cards() {
  const t = s.view.totals,
    c = s.view.comparison.changes;
  return `<section class="kpis" aria-label="Key metrics">${[
    ["recordCount", "Card transactions", t.recordCount, c?.recordCountPercent],
    [
      "totalRecordedValue",
      "Total student spend",
      t.totalRecordedValueMinor,
      c?.totalRecordedValuePercent,
    ],
    [
      "averageRecordedValue",
      "Average transaction",
      t.averageRecordedValueMinor,
      c?.averageRecordedValuePercent,
    ],
    ["discount", "Discounts given", null, null],
  ]
    .map(
      ([id, label, value, change]) =>
        `<div class="panel kpi"><p>${label}</p>${id === "discount" ? "<strong>Not available</strong>" : btn(t.hidden ? "Hidden" : fmt(value, id), "metric", id, "metric-button")}<small>${id === "discount" ? "Discount data not supplied" : change == null ? "No comparable previous period" : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(1)}% vs previous period`}</small></div>`,
    )
    .join("")}</section>`;
}
function chart(rows = s.view.series, metric = s.metric) {
  if (!rows.length) return '<p class="empty">No data for this selection.</p>';
  if (rows.every((r) => r.value == null))
    return '<p class="empty">Chart values are hidden or unavailable for this selection.</p>';
  const w = 900,
    h = 220,
    pad = 28,
    max = Math.max(1, ...rows.map((r) => r.value || 0)),
    x = (i) => pad + ((i + 0.5) * (w - 2 * pad)) / rows.length,
    y = (v) => h - pad - (v / max) * (h - 2 * pad);
  const points = rows.map((r, i) => ({
    ...r,
    x: x(i),
    y: r.value == null ? null : y(r.value),
  }));
  let segments = [],
    segment = [];
  for (const p of points) {
    if (p.y == null) {
      if (segment.length) segments.push(segment);
      segment = [];
    } else segment.push(p);
  }
  if (segment.length) segments.push(segment);
  const shading = s.view.calendar.periods
    .filter((p) => /exam|assessment|recess/i.test(p.label))
    .map((p) => {
      const indexes = rows
        .map((r, i) => (r.to >= p.from && r.from <= p.to ? i : -1))
        .filter((i) => i >= 0);
      if (!indexes.length) return "";
      const a = x(indexes[0]) - (w - 2 * pad) / rows.length / 2,
        b = x(indexes.at(-1)) + (w - 2 * pad) / rows.length / 2;
      return `<rect class="calendar-shade" x="${a}" y="15" width="${b - a}" height="${h - pad - 15}"><title>${esc(p.label)}</title></rect>`;
    })
    .join("");
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(labels[metric])}; exact values in the detail table"><text x="6" y="12">${esc(fmt(max, metric))}</text>${shading}<line class="axis" x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}"/>${s.chart === "line" ? segments.map((a) => `<polyline class="trend" points="${a.map((p) => `${p.x},${p.y}`).join(" ")}"/>`).join("") : ""}${points.map((p) => (p.y == null ? `<text x="${p.x}" y="${h - pad - 5}" text-anchor="middle">${rows.length < 35 ? (p.hidden ? "Hidden" : "—") : ""}</text>` : `<g><title>${esc(p.from)}: ${esc(fmt(p.value, metric))}${p.unusual ? " · Unusual" : ""}</title>${s.chart === "column" ? `<rect class="bar" x="${p.x - Math.min(25, ((w - 2 * pad) / rows.length) * 0.3)}" y="${p.y}" width="${Math.min(50, ((w - 2 * pad) / rows.length) * 0.6)}" height="${h - pad - p.y}"/>` : `<circle class="${p.unusual ? "unusual" : "point"}" cx="${p.x}" cy="${p.y}" r="${p.unusual ? 5 : 3}"/>`}</g>`)).join("")}${[...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])].map((i) => `<text x="${x(i)}" y="${h - 5}" text-anchor="middle">${esc(rows[i].from)}</text>`).join("")}</svg>`;
}
function bars(rows, metric = "totalRecordedValue") {
  const key =
      metric === "recordCount" ? "recordCount" : "totalRecordedValueMinor",
    max = Math.max(1, ...rows.map((r) => r[key] || 0));
  return `<div class="mini-bars">${rows.map((r, i) => `<div><svg viewBox="0 0 80 110" role="img" aria-label="${esc(r.label)}: ${r.hidden ? "Hidden" : esc(fmt(r[key], metric))}"><rect class="color-${i % 4}" x="12" y="${100 - ((r[key] || 0) / max) * 85}" width="56" height="${((r[key] || 0) / max) * 85}" rx="5"/></svg><small>${esc(r.label)}</small><small>${r.hidden ? "Hidden" : fmt(r[key], metric)}</small></div>`).join("")}</div>`;
}
function locations() {
  return (
    s.view.locations
      .map(
        (l) =>
          `<div class="location-row">${btn(esc(l.name), "location", l.id, "link")}<small>${l.hidden ? "Hidden" : `${money(l.totalRecordedValueMinor)} · ${number(l.recordCount)} transactions`}</small></div>`,
      )
      .join("") || "<p>No connected locations yet.</p>"
  );
}
function recent() {
  return `<section class="panel tinted"><h3>Recent alerts</h3>${
    s.view.alerts.items
      .slice(0, 3)
      .map(
        (a) =>
          `<div class="alert-summary"><span class="dot"></span><div>${btn(esc(a.title), "alert", a.id, "link")}<small>${a.date} · ${esc(a.location)}</small></div></div>`,
      )
      .join("") || "<p>No assessed days triggered a flag in this selection.</p>"
  }<a class="button wide" href="#alerts">View all alerts</a></section>`;
}
function dashboard() {
  return `<div class="heading"><div><p class="eyebrow">${esc(s.user.businessName)} · ${esc(s.view.location)}</p><h1>Dashboard ${s.user.role === "reporting" ? '<span class="badge">View only</span>' : ""}</h1></div>${controls()}</div>${filters()}<div class="dashboard-grid"><div>${cards()}<section class="panel chart-panel"><div class="section-heading"><h3>Student spend over the selected period</h3><div class="legend"><span>▧ University calendar</span><span>🟠 Unusual activity</span>${btn("Open detail →", "metric", "totalRecordedValue", "link")}</div></div>${chart()}<p class="muted">Open detail for period-by-period values and drill-down.</p></section><div class="two-cols"><section class="panel"><h3>Spend by price band</h3>${bars(s.view.priceBands)}</section><section class="panel"><h3>Busiest days</h3>${bars(s.view.weekdays, "recordCount")}</section></div></div><aside>${s.user.canViewAlerts ? recent() : ""}<section class="panel"><h3>Spend by location</h3>${locations()}<p class="muted">Your own locations only</p></section></aside></div>`;
}
function comparison() {
  const c = s.view.comparison;
  return `<div class="note"><strong>Previous equal-length period: ${c.range.from} – ${c.range.to}</strong><p>${c.available && c.totals && !c.totals.hidden ? `${number(c.totals.recordCount)} transactions · ${money(c.totals.totalRecordedValueMinor)} total · ${money(c.totals.averageRecordedValueMinor)} average` : "Comparison unavailable because coverage or privacy requirements are not met."}</p></div>`;
}
function detail() {
  return `<div class="breadcrumbs"><a href="#dashboard">Dashboard</a> › ${esc(labels[s.metric])}${s.trail.map((t, i) => ` › ${btn(`${t.from} – ${t.to}`, "back", i, "link")}`).join("")} › ${s.from}${s.to !== s.from ? " – " + s.to : ""}</div><div class="heading"><div><p class="eyebrow">${esc(s.user.businessName)} · ${esc(s.view.location)}</p><h1>${esc(labels[s.metric])}</h1></div>${controls()}</div>${filters()}${s.view.totals.hidden ? `${cards()}<section class="panel empty hidden-view"><h2>Not enough transactions to show this view</h2><p>To protect student privacy, views built from fewer than ${s.view.privacyMinimum} transactions are hidden. This does not mean there were no sales.</p>${btn("Back to the week", "whole-week", "", "primary")} ${btn("See the whole week by hour", "week-hours")}</section>` : `<section class="panel chart-panel"><div class="section-heading"><h3>${s.level === "day" ? "Hourly detail" : s.level === "week" ? "Spend per day" : "Spend by period"}</h3><span class="muted">Select a period below to drill down</span></div>${s.level === "day" ? '<div class="note">Hourly analysis is not available: the source records use placeholder timestamps. Daily totals remain available below.</div>' : chart()}${s.compare ? comparison() : ""}<p class="note">These figures show what happened at the same time, not what caused it. Calendar events and discounts can both play a part.</p></section><section class="panel table-wrap"><table><thead><tr><th>Period</th><th>Card transactions</th><th>Student spend</th><th>Average transaction</th><th>Average discount</th></tr></thead><tbody>${s.view.series.map((r, i) => `<tr><td>${s.level === "day" ? esc(r.from) : btn(`${esc(r.from)}${r.to !== r.from ? " – " + esc(r.to) : ""}`, "drill", i, "link")}${r.unusual ? ' <span class="badge orange">Unusual</span>' : ""}${r.partial ? " <small>Partial period</small>" : ""}</td>${r.hidden ? `<td colspan="4">Hidden: fewer than ${s.view.privacyMinimum} transactions, or complementary suppression to protect student privacy.</td>` : `<td>${number(r.recordCount)}</td><td>${money(r.totalRecordedValueMinor)}</td><td>${money(r.averageRecordedValueMinor)}</td><td>Not available</td>`}</tr>`).join("")}</tbody></table></section>`}`;
}
function search() {
  const rows = s.view.locations.filter((l) =>
    `${l.name} ${l.address || ""}`
      .toLowerCase()
      .includes(s.search.toLowerCase()),
  );
  return `<div class="breadcrumbs"><a href="#dashboard">Dashboard</a> › Search</div><h1>Search</h1><form class="search-form" data-form="search"><input name="search" aria-label="Search locations" placeholder="Search your locations" value="${esc(s.search)}"><button class="primary">Search</button></form>${filters()}<div class="controls"><span>Type: location</span><label>Price band<select id="band">${[
    ["", "Any"],
    ["under50", "Under R50"],
    ["50to150", "R50–150"],
    ["150to300", "R150–300"],
    ["300plus", "R300+"],
  ]
    .map(([v, l]) => opt(v, l, s.band))
    .join(
      "",
    )}</select></label>${btn("Clear filters", "clear", "", "link")}</div><h3>Your locations (${rows.length})</h3><div class="two-cols">${rows.map((l) => `<section class="panel"><div class="section-heading"><h3>${esc(l.name)}</h3>${btn("Open", "location", l.id)}</div><p class="muted">${esc(l.address || "Address not supplied · synthetic location")}</p><p>${l.hidden ? "Hidden to protect student privacy" : `${number(l.recordCount)} transactions · ${money(l.totalRecordedValueMinor)} spend`}</p><div class="note">Average discount: not available. Location coordinates have not been supplied.</div></section>`).join("") || '<p class="empty">No locations match these filters. New businesses have no connected locations.</p>'}</div>`;
}
function alerts() {
  const a = s.view.alerts;
  if (!a) return "<h1>Owners only</h1>";
  return `<h1>Alerts</h1><p class="muted">Unusual activity worth a closer look. An alert is not proof that something is wrong.</p>${filters()}<section class="panel table-wrap"><table><thead><tr><th>What happened</th><th>When</th><th>Location</th><th>Calendar context</th></tr></thead><tbody>${a.items.map((r) => `<tr><td>${btn(esc(r.title), "alert", r.id, "link")}</td><td>${r.date}</td><td>${esc(r.location)}</td><td>${esc(r.context)}</td></tr>`).join("") || '<tr><td colspan="4">No flags for this selection. This does not imply every day was assessed.</td></tr>'}</tbody></table></section><p class="note">${esc(a.rule)}</p><p>${a.assessed} location-days assessed · ${a.notAssessed} not assessed (insufficient eligible history, coverage or privacy).</p><p class="muted">${esc(a.note)}</p><p class="muted">Spend-concentration and discount alerts require source data that has not been supplied.</p>`;
}
function alertDetail() {
  const a = s.view.alerts?.items.find((a) => a.id === s.alertId);
  if (!a)
    return '<p>This alert is no longer in the selected range. <a href="#alerts">Back to alerts</a></p>';
  const rows = [...a.history, { date: a.date, value: a.value }].map((r) => ({
    ...r,
    from: r.date,
    to: r.date,
  }));
  return `<div class="breadcrumbs"><a href="#alerts">Alerts</a> › ${esc(a.title)}</div><div class="heading"><div><h1>${esc(a.title)}</h1><p>${a.date} · ${esc(a.location)}</p></div><a class="button" href="#alerts">Back to alerts</a></div><div class="two-cols"><section class="panel"><h3>Matching weekdays over the prior 8 weeks</h3>${chart(rows, a.metric)}${btn("Open this day in the detail view", "alert-day", a.id, "link")}<p class="muted">Prior observations: ${a.history.map((h) => `${h.date}: ${fmt(h.value, a.metric)}`).join("; ")}. Selected day: ${fmt(a.value, a.metric)}.</p></section><section class="panel"><h3>Why this was flagged</h3><ul><li>${esc(labels[a.metric])} was ${a.ratio.toFixed(2)}× the usual comparable-day average (${fmt(a.mean, a.metric)}).</li><li>${a.history.length} eligible historical days; standard deviation ${fmt(a.variation, a.metric)}. The current day does not define its own baseline.</li><li>Calendar context: ${esc(a.context)}.</li></ul><p class="note">Unusual activity is not confirmed fraud or a confirmed cause. Flagged records remain included in totals.</p></section></div>`;
}
function team() {
  return `<h1>Team</h1><p class="muted">Members can view, drill down and export. They cannot see the alerts list or manage the team.</p><div class="team-grid"><section class="panel table-wrap"><table><thead><tr><th>Name</th><th>Email / username</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>${(s.team || []).map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.username)}</td><td>${u.role === "manager" ? "Owner" : "Member"}</td><td><span class="badge">${u.must_change ? "Waiting for first login" : "Active"}</span></td><td>${u.role === "reporting" ? btn("Remove", "remove", u.id) : ""}</td></tr>`).join("")}</tbody></table></section><form class="panel" data-form="member"><h3>Add member</h3>${field("Name", "name")}${field("Email", "email", "email")}<label>Temporary password<div class="input-row"><input name="password" id="temporary" required minlength="12" autocomplete="off">${btn("Generate", "generate")}</div></label><p class="muted">Share this with them yourself. They must set their own password at first login. At least 12 characters.</p><button class="primary wide">Add member</button></form></div>`;
}
function render() {
  if (!s.user) {
    app.innerHTML = login();
    return;
  }
  if (s.user.mustChangePassword) {
    app.innerHTML = password();
    return;
  }
  app.innerHTML =
    nav() +
    `<main id="main">${!s.view ? '<p role="status">Loading your data…</p>' : ({ dashboard, detail, search, alerts, "alert-detail": alertDetail, team }[s.page] || dashboard)()}${s.view ? `<footer><p>${esc(s.view.dataNote)}</p><p>${esc(s.view.calendar.note)}</p><p>Privacy minimum: ${s.view.privacyMinimum} transactions. Small and complementary buckets are hidden; no student identities are exposed.</p></footer>` : ""}</main>`;
}
let loading = 0;
async function refresh() {
  const generation = ++loading;
  if (!s.user || s.user.mustChangePassword) {
    render();
    return;
  }
  if (!s.meta) {
    const [meta, locations] = await Promise.all([
      api("/api/meta"),
      api("/api/locations"),
    ]);
    s.meta = meta;
    s.locations = locations.items;
  }
  const [view, teamData] = await Promise.all([
    api("/api/summary?" + query()),
    s.page === "team" && s.user.canManageTeam ? api("/api/team") : null,
  ]);
  if (generation !== loading) return;
  s.view = view;
  if (teamData) s.team = teamData.items;
  render();
}
async function navigate(page) {
  if (
    ["alerts", "alert-detail", "team"].includes(page) &&
    !s.user?.canViewAlerts
  )
    page = "dashboard";
  s.page = page;
  if (page === "dashboard") s.metric = "totalRecordedValue";
  history.replaceState(null, "", "#" + page);
  await refresh();
}
window.addEventListener("hashchange", () =>
  navigate(location.hash.slice(1) || "dashboard").catch((e) =>
    toast(e.message, true),
  ),
);
let lastFocus;
function modal(title, contents) {
  document.querySelector("dialog")?.remove();
  lastFocus = document.activeElement;
  const d = document.createElement("dialog");
  d.innerHTML = `<h2>${title}</h2>${contents}`;
  d.addEventListener("close", () => {
    d.remove();
    lastFocus?.focus();
  });
  app.append(d);
  d.showModal();
}
const closeModal = () => document.querySelector("dialog")?.close();
async function parentWeek(hourly = false) {
  const d = new Date(s.from),
    start = Date.parse(s.from) - ((d.getUTCDay() + 6) % 7) * 86400000;
  s.from = iso(start);
  s.to = iso(start + 6 * 86400000);
  s.level = "week";
  s.grouping = "daily";
  await navigate("detail");
  if (hourly)
    toast(
      "Hourly analysis is unavailable because reliable times have not been supplied. Showing the whole week by day.",
    );
}
app.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action,
    value = target.dataset.value;
  try {
    if (action === "logout") {
      await api("/api/logout", {});
      Object.assign(s, {
        user: null,
        view: null,
        meta: null,
        locations: [],
        location: "",
        band: "",
        page: "dashboard",
        trail: [],
      });
      render();
    }
    if (action === "forgot")
      modal(
        "Forgot password?",
        `<p>Members: ask your account owner for help. Owners: contact the local installation administrator.</p><p class="note">Email delivery and self-service password recovery are not connected. No reset email has been sent.</p>${btn("Close", "close", "", "primary")}`,
      );
    if (action === "close") closeModal();
    if (action === "feedback-history") {
      const d = await api("/api/feedback");
      modal(
        "Your submitted feedback",
        `${d.items.map((f) => `<section class="note"><strong>${esc(f.category)} · ${esc(f.created_at.slice(0, 10))}</strong><p>${esc(f.message)}</p></section>`).join("") || "<p>No submissions yet.</p>"}${btn("Close", "close")}`,
      );
    }
    if (action === "feedback")
      modal(
        "Send feedback",
        `<form data-form="feedback"><fieldset><legend>What is it about?</legend><label class="radio"><input type="radio" name="category" value="Insights" checked> Insights about discounts and promotions</label><label class="radio"><input type="radio" name="category" value="Usability"> Using the website</label></fieldset><label>Screen<input name="screen" value="${esc(s.page)}" readonly></label><label>Your feedback<textarea name="message" required minlength="5" maxlength="1800" rows="5"></textarea></label>${btn("View my submitted feedback", "feedback-history", "", "link")}<div class="modal-actions">${btn("Cancel", "close")}<button class="primary">Send</button></div></form>`,
      );
    if (action === "export")
      modal(
        "Export report",
        `<form data-form="export"><fieldset><legend>What to export</legend><label class="radio"><input type="radio" name="scope" value="current" checked> Current view: ${esc(labels[s.metric])}, ${s.from} – ${s.to}</label><label class="radio"><input type="radio" name="scope" value="dashboard"> Dashboard summary for the selected dates</label></fieldset><p class="note">Privacy rules still apply. Anything hidden on screen stays hidden in the export.</p><div class="modal-actions">${btn("Cancel", "close")}<button class="primary">Export</button></div></form>`,
      );
    if (action === "metric") {
      s.metric = value;
      s.trail = [];
      await navigate("detail");
    }
    if (action === "location") {
      s.location = value;
      s.metric = "totalRecordedValue";
      await navigate("detail");
    }
    if (action === "alert") {
      s.alertId = value;
      await navigate("alert-detail");
    }
    if (action === "alert-day") {
      const a = s.view.alerts.items.find((a) => a.id === value);
      Object.assign(s, {
        from: a.date,
        to: a.date,
        location: String(a.locationId),
        level: "day",
        grouping: "daily",
        metric: a.metric,
      });
      await navigate("detail");
    }
    if (action === "generate")
      document.querySelector("#temporary").value = Array.from(
        crypto.getRandomValues(new Uint8Array(18)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
    if (action === "remove") {
      const u = s.team.find((u) => u.id === Number(value));
      modal(
        "Remove team member",
        `<p>Remove ${esc(u.name)}? Their access and active sessions will be revoked. Feedback and audit history will be retained.</p><div class="modal-actions">${btn("Cancel", "close")}${btn("Remove member", "confirm-remove", value, "primary")}</div>`,
      );
    }
    if (action === "confirm-remove") {
      await api("/api/team/remove", { id: Number(value) });
      closeModal();
      await refresh();
      toast("Member access removed. Audit history retained.");
    }
    if (action === "history") {
      Object.assign(s, {
        from: s.meta.coverage.from,
        to: s.meta.coverage.to,
        grouping: "monthly",
        level: "month",
        trail: [],
      });
      await refresh();
    }
    if (action === "clear") {
      Object.assign(s, {
        search: "",
        location: "",
        band: "",
        from: "2026-09-01",
        to: "2026-09-28",
      });
      await refresh();
    }
    if (action === "drill") {
      const r = s.view.series[Number(value)];
      s.trail.push({
        from: s.from,
        to: s.to,
        level: s.level,
        grouping: s.grouping,
      });
      Object.assign(s, {
        from: r.from,
        to: r.to,
        level: r.from === r.to ? "day" : "week",
        grouping: "daily",
        chart: "column",
      });
      await refresh();
    }
    if (action === "back") {
      const i = Number(value);
      Object.assign(s, s.trail[i]);
      s.trail = s.trail.slice(0, i);
      await refresh();
    }
    if (action === "whole-week" || action === "week-hours")
      await parentWeek(action === "week-hours");
    if (action === "level") {
      s.level = value;
      s.trail = [];
      if (value === "week") {
        await parentWeek();
        return;
      }
      if (value === "day") {
        s.to = s.from;
        s.grouping = "daily";
      } else {
        const d = new Date(s.from);
        s.from = s.from.slice(0, 7) + "-01";
        s.to = iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
        if (s.to > s.meta.coverage.to && s.from <= s.meta.coverage.to)
          s.to = s.meta.coverage.to;
        s.grouping = "weekly";
      }
      await refresh();
    }
  } catch (e) {
    toast(e.message, true);
  }
});
app.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-form]");
  if (!form) return;
  event.preventDefault();
  const b = Object.fromEntries(new FormData(form)),
    submit = form.querySelector('button:not([type="button"])');
  if (submit) submit.disabled = true;
  try {
    if (["login", "register", "password"].includes(form.dataset.form)) {
      const d = await api("/api/" + form.dataset.form, b);
      Object.assign(s, {
        user: d.user,
        view: null,
        meta: null,
        location: "",
        band: "",
        page: "dashboard",
      });
      render();
      await refresh();
    }
    if (form.dataset.form === "range") {
      Object.assign(s, {
        from: b.from,
        to: b.to,
        location: b.location,
        trail: [],
      });
      const days = (Date.parse(s.to) - Date.parse(s.from)) / 86400000 + 1;
      s.level = days === 1 ? "day" : days <= 7 ? "week" : "month";
      s.grouping = days > 90 ? "monthly" : days > 7 ? "weekly" : "daily";
      await refresh();
    }
    if (form.dataset.form === "member") {
      await api("/api/team", b);
      await refresh();
      toast(
        "Member added. Share the temporary password privately; no email was sent.",
      );
    }
    if (form.dataset.form === "feedback") {
      await api("/api/feedback", {
        category: b.category,
        message: `[${b.screen}] ${b.message}`,
      });
      closeModal();
      toast("Feedback saved. No email notification was sent.");
    }
    if (form.dataset.form === "search" || form.dataset.form === "nav-search") {
      s.search = b.search;
      await navigate("search");
    }
    if (form.dataset.form === "export") {
      const r = await fetch("/api/report?" + query({ scope: b.scope }));
      if (!r.ok) throw Error((await r.json()).error);
      const url = URL.createObjectURL(await r.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = `shop-a-lytics-${b.scope}-${s.from}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      closeModal();
      toast("Report downloaded with privacy rules applied.");
    }
  } catch (e) {
    toast(e.message, true);
  } finally {
    if (submit) submit.disabled = false;
  }
});
app.addEventListener("change", async (event) => {
  try {
    if (event.target.id === "chart") {
      s.chart = event.target.value;
      render();
    }
    if (event.target.id === "compare") {
      s.compare = event.target.value === "yes";
      render();
    }
    if (event.target.id === "band") {
      s.band = event.target.value;
      await refresh();
    }
    if (event.target.id === "calendar-period" && event.target.value) {
      const p = s.meta.calendar.periods.find(
        (p) => p.id === event.target.value,
      );
      Object.assign(s, {
        from: p.start,
        to: p.end,
        grouping: "weekly",
        level: "month",
        trail: [],
      });
      await refresh();
    }
  } catch (e) {
    toast(e.message, true);
  }
});
try {
  s.user = (await api("/api/session")).user;
  render();
  if (s.user) await navigate(location.hash.slice(1) || "dashboard");
} catch (e) {
  render();
  toast(e.message, true);
}

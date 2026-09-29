import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { getMeta } from "./analytics.mjs";
import { openDatabase } from "./database.mjs";
import { calendar } from "./presentation.mjs";
import { buildInsights } from "./insights.mjs";
import { makeWireframeReport } from "./wireframe-report.mjs";
import { importExample } from "./importer.mjs";

const clientPath = fileURLToPath(new URL("../dist", import.meta.url)),
  clientIndex = fileURLToPath(new URL("../dist/index.html", import.meta.url));
const sessionCookie = (session, maxAge = 3600) =>
  `shoplytics_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
const error = (message, status = 400) =>
  Object.assign(Error(message), { status });

export function createApp({
  databasePath = fileURLToPath(
    new URL("../.local/shoplytics.sqlite", import.meta.url),
  ),
} = {}) {
  const store = openDatabase(databasePath),
    app = express(),
    parseJson = express.json({ limit: 8192, strict: true }),
    parseImport = express.json({ limit: 10_000_000, strict: true });

  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    });
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || ""))
      return res.status(403).json({ error: "Local prototype only." });
    if (
      req.method === "POST" &&
      req.headers.origin !== `http://${req.headers.host}`
    )
      return res.status(403).json({
        error: "Use the application page to perform this action.",
      });
    const cookie = (req.headers.cookie || "")
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith("shoplytics_session="));
    req.sessionToken = cookie?.slice("shoplytics_session=".length);
    req.user = store.getSession(req.sessionToken);
    next();
  });

  function requestBody(req) {
    if (!req.is("application/json")) throw error("Expected JSON.", 415);
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
      throw error("Invalid request.");
    return req.body;
  }
  function requireUser(req, res, next) {
    if (!req.user)
      return res.status(401).json({
        error: "Your session has ended. Please sign in again.",
      });
    next();
  }
  function requireReadyUser(req, res, next) {
    if (req.user.mustChangePassword)
      return res.status(403).json({
        error: "Set your own password before continuing.",
      });
    next();
  }

  app.post("/api/login", parseJson, (req, res) => {
    const body = requestBody(req),
      username =
        typeof body.username === "string"
          ? body.username.trim().toLowerCase()
          : "";
    if (
      !/^[a-z0-9.@_+-]{3,120}$/.test(username) ||
      typeof body.password !== "string" ||
      body.password.length > 256
    )
      return res.status(401).json({ error: "Incorrect username or password." });
    const found = store.authenticate(username, body.password);
    if (!found)
      return res.status(401).json({ error: "Incorrect username or password." });
    store.endSession(req.sessionToken, null);
    const session = store.startSession(found);
    res.set("Set-Cookie", sessionCookie(session)).json({ user: found });
  });

  app.post("/api/register", parseJson, (req, res) => {
    const body = requestBody(req),
      username = store.register(body),
      found = store.authenticate(username, body.password),
      recoveryCode = store.issueRecoveryCode(found);
    store.endSession(req.sessionToken, null);
    const session = store.startSession(found);
    res
      .status(201)
      .set("Set-Cookie", sessionCookie(session))
      .json({ user: found, recoveryCode });
  });

  app.post("/api/logout", parseJson, (req, res) => {
    requestBody(req);
    store.endSession(req.sessionToken, req.user);
    res.set("Set-Cookie", sessionCookie("", 0)).json({ ok: true });
  });

  app.post("/api/recover", parseJson, (req, res) => {
    const found = store.recoverOwner(requestBody(req)),
      session = store.startSession(found);
    res.set("Set-Cookie", sessionCookie(session)).json({ user: found });
  });

  app.get("/api/session", (req, res) => res.json({ user: req.user }));
  app.use("/api", requireUser);

  app.post("/api/recovery-code", parseJson, (req, res) => {
    requestBody(req);
    res.json({ code: store.issueRecoveryCode(req.user) });
  });

  app.post("/api/password", parseJson, (req, res) => {
    const found = store.changePassword(req.user, requestBody(req)),
      session = store.startSession(found);
    res.set("Set-Cookie", sessionCookie(session)).json({ user: found });
  });

  app.use("/api", requireReadyUser);

  app.post("/api/team", parseJson, (req, res) => {
    store.addMember(req.user, requestBody(req));
    res.status(201).json({ ok: true });
  });

  app.post("/api/team/remove", parseJson, (req, res) => {
    store.removeMember(req.user, requestBody(req).id);
    res.json({ ok: true });
  });

  app.post("/api/team/reset", parseJson, (req, res) => {
    store.resetMember(req.user, requestBody(req));
    res.json({ ok: true });
  });

  app.post("/api/import", parseImport, (req, res) => {
    const result = store.importDataset(req.user, requestBody(req));
    res.json({ ok: true, ...result });
  });

  app.post("/api/feedback", parseJson, (req, res) => {
    if (!req.user.canFeedback)
      return res.status(403).json({
        error: "Feedback is not available for this account.",
      });
    const body = requestBody(req);
    if (
      !["Usability", "Insights", "Other"].includes(body.category) ||
      typeof body.message !== "string" ||
      body.message.trim().length < 5 ||
      body.message.trim().length > 2000
    )
      throw error("Choose a category and enter between 5 and 2,000 characters.");
    const id = store.feedback(req.user, body.category, body.message.trim());
    res.status(201).json({
      id,
      message:
        "Feedback saved in the project database. No email notification was sent.",
    });
  });

  app.get("/api/team", (req, res) =>
    res.json({ items: store.team(req.user) }),
  );
  app.get("/api/locations", (req, res) =>
    res.json({ items: store.locations(req.user) }),
  );
  app.get("/api/alerts", (req, res) => {
    if (!req.user.canViewAlerts)
      return res.status(403).json({ error: "Only owners can access alerts." });
    res.json(buildInsights(store, req.user, { ...req.query }).alerts);
  });
  app.get("/api/meta", (req, res) =>
    res.json({
      ...getMeta(),
      coverage: store.coverage(req.user),
      calendar: { periods: calendar.periods, events: calendar.events },
      data: store.dataStatus(req.user),
    }),
  );
  app.get("/api/import/example", (req, res) => {
    if (!req.user.canManageTeam)
      return res.status(403).json({
        error: "Only owners can manage data imports.",
      });
    res.json(importExample);
  });
  app.get("/api/feedback", (req, res) =>
    res.json({ items: store.ownFeedback(req.user) }),
  );

  async function analysis(req, res) {
    const query = { ...req.query },
      metric = query.metric || "recordCount",
      grouping = query.grouping || "daily",
      chart = query.chart || "line";
    if (!["line", "column"].includes(chart))
      throw error("Choose a line or column chart.");
    if (query.scope && !["current", "dashboard"].includes(query.scope))
      throw error("Choose current view or dashboard summary.");
    if (
      !req.user.canDrillDown &&
      (req.path === "/api/details" || metric !== "recordCount")
    )
      return res.status(403).json({
        error:
          "This account can view transaction activity and summary figures only.",
      });
    if (req.path === "/api/report" && !req.user.canExport)
      return res.status(403).json({
        error: "Report export is not available for this account.",
      });
    const view = buildInsights(store, req.user, {
      ...query,
      grouping,
      metric,
    });
    if (req.path === "/api/report") {
      const pdf = await makeWireframeReport(
        view,
        chart,
        query.scope || "current",
      );
      store.audit(req.user.id, "report_exported");
      return res
        .set({
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="shoplytics-${query.from}-${query.to}.pdf"`,
        })
        .send(pdf);
    }
    if (!req.user.canDrillDown) {
      view.daily = view.daily.map(({ date, recordCount, covered }) => ({
        date,
        recordCount,
        covered,
      }));
      view.series = view.series.map(
        ({
          date,
          periodEnd,
          from,
          to,
          selectedDays,
          coveredDays,
          covered,
          partial,
          recordCount,
          value,
        }) => ({
          date,
          periodEnd,
          from,
          to,
          selectedDays,
          coveredDays,
          covered,
          partial,
          recordCount,
          value,
        }),
      );
    }
    res.json(view);
  }
  app.get(["/api/summary", "/api/details", "/api/report"], analysis);

  app.use(express.static(clientPath, { index: false }));
  app.get("/", (_req, res) => res.sendFile(clientIndex));

  app.use((req, res) => {
    if (!["GET", "POST"].includes(req.method))
      return res.status(405).json({ error: "Method not allowed." });
    res.status(404).json({ error: "Not found." });
  });
  app.use((caught, req, res, _next) => {
    if (caught.type === "entity.too.large")
      caught = error("Request too large.", 413);
    else if (caught.type === "entity.parse.failed")
      caught = error("Invalid request.");
    if (req.path.startsWith("/api/"))
      return res.status(caught.status || 400).json({ error: caught.message });
    console.error(caught);
    res.status(500).json({ error: "Could not load the application." });
  });

  const server = createServer(app);
  server.on("close", () => store.close());
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.SHOPLYTICS_PORT || 4317);
  createApp().listen(port, "127.0.0.1", () =>
    console.log(`Shoplytics: http://127.0.0.1:${port}`),
  );
}

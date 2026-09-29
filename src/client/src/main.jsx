import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import "../../public/styles.css";
import "../../public/enhancements.css";

const labels = {
  recordCount: "Card transactions",
  totalRecordedValue: "Total student spend",
  averageRecordedValue: "Average transaction",
};
const priceBandLabels = {
  under50: "Under R50",
  "50to150": "R50–150",
  "150to300": "R150–300",
  "300plus": "R300+",
};
const savedKeys = [
  "from",
  "to",
  "level",
  "grouping",
  "metric",
  "chart",
  "location",
  "band",
  "calendarPeriod",
];
const initialState = {
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
  calendarPeriod: "",
  search: "",
  view: null,
  meta: null,
  locations: [],
  trail: [],
  loading: false,
  error: "",
  team: [],
  alertId: "",
};
const money = (value) =>
  value == null
    ? "Not available"
    : new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        maximumFractionDigits: 2,
      }).format(value / 100);
const number = (value) =>
  value == null ? "Not available" : value.toLocaleString("en-ZA");
const format = (value, metric) =>
  metric === "recordCount" ? number(value) : money(value);
const iso = (value) => new Date(value).toISOString().slice(0, 10);
const randomPassword = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(18)),
    (value) => value.toString(16).padStart(2, "0"),
  ).join("");

function restoreState() {
  const state = { ...initialState };
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem("shoplytics-view") || "{}");
  } catch {}
  const params = new URLSearchParams(location.search);
  for (const key of savedKeys) {
    const value = params.has(key) ? params.get(key) : saved[key];
    if (typeof value === "string") state[key] = value;
  }
  state.compare = (params.get("compare") || saved.compare) === "yes";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.from))
    state.from = initialState.from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.to))
    state.to = initialState.to;
  if (!["month", "week", "day"].includes(state.level))
    state.level = "month";
  if (!["monthly", "weekly", "daily"].includes(state.grouping))
    state.grouping = "weekly";
  if (!Object.hasOwn(labels, state.metric))
    state.metric = "totalRecordedValue";
  if (!["line", "column"].includes(state.chart)) state.chart = "line";
  return state;
}
function Brand() {
  return (
    <span className="brand">
      <span className="logo">S</span> Shop-A-Lytics
    </span>
  );
}
function Button({ children, kind = "", onClick, ...props }) {
  return (
    <button type="button" className={kind} onClick={onClick} {...props}>
      {children}
    </button>
  );
}
function Field({ label, ...props }) {
  return (
    <label>
      {label}
      <input required {...props} />
    </label>
  );
}
function LoginPage({ submit, action }) {
  return (
    <>
      <header className="welcome">
        <Brand />
        <h1>Understand your student market.</h1>
        <p>Insights from BoschCard transactions</p>
      </header>
      <main id="main" className="auth-grid">
        <form className="panel" onSubmit={(event) => submit(event, "login")}>
          <h2>Log in</h2>
          <Field
            label="Email or demo username"
            name="username"
            autoComplete="username"
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
          />
          <button className="primary wide">Log in</button>
          <Button kind="link" onClick={() => action("forgot")}>
            Forgot password?
          </Button>
          <p className="muted">
            Members use the details their account owner gave them.
          </p>
        </form>
        <form className="panel" onSubmit={(event) => submit(event, "register")}>
          <h2>Create a business account</h2>
          <p className="muted">
            For owners and managers. Add your team after signing up.
          </p>
          <Field label="Business name" name="business" />
          <Field label="Your name" name="name" />
          <Field label="Work email" name="email" type="email" />
          <Field
            label="Password · at least 12 characters"
            name="password"
            type="password"
            minLength="12"
            autoComplete="new-password"
          />
          <p className="note">
            Payment details: coming in a later release. New businesses start
            with no connected data.
          </p>
          <button className="primary wide">Create account</button>
        </form>
      </main>
      <p className="auth-note">
        Local demonstration · invented transactions · no live BoschCard
        connection
      </p>
    </>
  );
}
function PasswordPage({ state, submit, action }) {
  return (
    <>
      <header className="welcome">
        <Brand />
        <h1>Welcome, {state.user.name}</h1>
      </header>
      <main id="main" className="password-wrap">
        <form className="panel" onSubmit={(event) => submit(event, "password")}>
          <h2>Set your own password</h2>
          <p>
            Your owner created your account with a temporary password. Choose
            your own to continue.
          </p>
          <Field
            label="New password"
            name="password"
            type="password"
            minLength="12"
            autoComplete="new-password"
          />
          <Field
            label="Confirm new password"
            name="confirm"
            type="password"
            minLength="12"
            autoComplete="new-password"
          />
          <p className="muted">
            At least 12 characters. Cannot be the same as the temporary
            password.
          </p>
          <button className="primary wide">Save and continue</button>
          <Button kind="link" onClick={() => action("logout")}>
            Log out
          </Button>
        </form>
      </main>
    </>
  );
}
function Navigation({ state, navigate, submit, action }) {
  const items = [
    ["dashboard", "Dashboard"],
    ...(state.user.canViewAlerts
      ? [
          ["alerts", "Alerts"],
          ["team", "Team"],
          ["data", "Data"],
        ]
      : []),
    ["search", "Search"],
  ];
  return (
    <header className="topbar">
      <a href="#dashboard" onClick={() => navigate("dashboard")}>
        <Brand />
      </a>
      <nav aria-label="Main navigation">
        {items.map(([id, label]) => (
          <a
            href={"#" + id}
            aria-current={state.page === id ? "page" : undefined}
            onClick={() => navigate(id)}
            key={id}
          >
            {label}
            {id === "alerts" && (
              <>
                {" "}
                <span
                  className="badge"
                  title="Alerts in the current selection"
                >
                  {state.view?.alerts?.items.length ?? 0}
                </span>
              </>
            )}
          </a>
        ))}
      </nav>
      <form
        className="nav-search"
        onSubmit={(event) => submit(event, "nav-search")}
      >
        <input
          name="search"
          aria-label="Search your locations"
          placeholder="Search your locations"
        />
        <button>Search</button>
      </form>
      <Button onClick={() => action("feedback")}>Feedback</Button>
      {state.user.role === "manager" && (
        <Button onClick={() => action("recovery-code")}>Recovery code</Button>
      )}
      <div className="account">
        <span className="avatar">{state.user.name[0]}</span>
        <div>
          {state.user.name}
          <small>
            {state.user.role === "manager"
              ? "Owner"
              : "Member · Analysis access"}{" "}
            ·{" "}
            <Button kind="text-button" onClick={() => action("logout")}>
              Log out
            </Button>
          </small>
        </div>
      </div>
    </header>
  );
}
function Filters({ state, submit, action }) {
  return (
    <form
      className="filters"
      onSubmit={(event) => submit(event, "range")}
      key={[
        state.from,
        state.to,
        state.location,
        state.calendarPeriod,
      ].join(":")}
    >
      <Field label="From" name="from" type="date" defaultValue={state.from} />
      <Field label="To" name="to" type="date" defaultValue={state.to} />
      <label>
        Location
        <select name="location" defaultValue={state.location}>
          <option value="">All locations</option>
          {state.locations.map((location) => (
            <option value={location.id} key={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Calendar period
        <select name="calendarPeriod" defaultValue={state.calendarPeriod}>
          <option value="">Choose a period</option>
          {state.meta.calendar.periods.map((period) => (
            <option value={period.id} key={period.id}>
              {period.label}
            </option>
          ))}
        </select>
      </label>
      <button>Apply</button>
      <Button kind="link" onClick={() => action("history")}>
        All 5 years
      </Button>
    </form>
  );
}
function ActiveFilter({ state, action }) {
  if (!state.band) return null;
  return (
    <div className="note active-filter">
      <strong>Active price-band filter:</strong>{" "}
      {priceBandLabels[state.band]}{" "}
      <Button kind="link" onClick={() => action("clear-band")}>
        Clear
      </Button>
    </div>
  );
}
function Controls({ state, action, update }) {
  return (
    <div className="controls">
      <div className="segmented" aria-label="Time scale">
        {["month", "week", "day"].map((level) => (
          <Button
            kind={state.level === level ? "selected" : ""}
            onClick={() => action("level", level)}
            key={level}
          >
            {level[0].toUpperCase() + level.slice(1)}
          </Button>
        ))}
      </div>
      {state.page === "detail" && (
        <>
          <label>
            Chart
            <select
              value={state.chart}
              onChange={(event) => update({ chart: event.target.value }, true)}
            >
              <option value="line">Line</option>
              <option value="column">Bar</option>
            </select>
          </label>
          <label>
            Compare with
            <select
              value={state.compare ? "yes" : "no"}
              onChange={(event) =>
                update({ compare: event.target.value === "yes" }, true)
              }
            >
              <option value="no">Nothing</option>
              <option value="yes">Previous period</option>
            </select>
          </label>
        </>
      )}
      <Button kind="primary" onClick={() => action("export")}>
        Export
      </Button>
    </div>
  );
}
function MetricCards({ state, action }) {
  const totals = state.view.totals,
    changes = state.view.comparison.changes,
    cards = [
      [
        "recordCount",
        "Card transactions",
        totals.recordCount,
        changes?.recordCountPercent,
      ],
      [
        "totalRecordedValue",
        "Total student spend",
        totals.totalRecordedValueMinor,
        changes?.totalRecordedValuePercent,
      ],
      [
        "averageRecordedValue",
        "Average transaction",
        totals.averageRecordedValueMinor,
        changes?.averageRecordedValuePercent,
      ],
      [
        "discount",
        "Discounts given",
        state.view.discounts?.totalDiscountMinor ?? null,
        null,
      ],
    ];
  return (
    <section className="kpis" aria-label="Key metrics">
      {cards.map(([id, label, value, change]) => (
        <div className="panel kpi" key={id}>
          <p>{label}</p>
          {id === "discount" ? (
            <strong>
              {state.view.discountAvailable ? money(value) : "Not available"}
            </strong>
          ) : (
            <Button kind="metric-button" onClick={() => action("metric", id)}>
              {totals.hidden ? "Hidden" : format(value, id)}
            </Button>
          )}
          <small>
            {id === "discount"
              ? state.view.discountAvailable
                ? "Total recorded discount amount"
                : "Discount data not supplied"
              : change == null
                ? "No comparable previous period"
                : (change >= 0 ? "▲ " : "▼ ") +
                  Math.abs(change).toFixed(1) +
                  "% vs previous period"}
          </small>
        </div>
      ))}
    </section>
  );
}
function Chart({ state, rows = state.view.series, metric = state.metric }) {
  if (!rows.length) return <p className="empty">No data for this selection.</p>;
  if (rows.every((row) => row.value == null))
    return (
      <p className="empty">
        Chart values are hidden or unavailable for this selection.
      </p>
    );
  const width = 900,
    height = 220,
    padding = 28,
    maximum = Math.max(1, ...rows.map((row) => row.value || 0)),
    x = (index) =>
      padding + ((index + 0.5) * (width - 2 * padding)) / rows.length,
    y = (value) =>
      height - padding - (value / maximum) * (height - 2 * padding),
    points = rows.map((row, index) => ({
      ...row,
      x: x(index),
      y: row.value == null ? null : y(row.value),
    })),
    segments = [];
  let segment = [];
  for (const point of points) {
    if (point.y == null) {
      if (segment.length) segments.push(segment);
      segment = [];
    } else segment.push(point);
  }
  if (segment.length) segments.push(segment);
  const shading = state.view.calendar.periods
    .filter((period) => /exam|assessment|recess/i.test(period.label))
    .map((period) => {
      const indexes = rows
        .map((row, index) =>
          row.to >= period.from && row.from <= period.to ? index : -1,
        )
        .filter((index) => index >= 0);
      if (!indexes.length) return null;
      const start =
          x(indexes[0]) - (width - 2 * padding) / rows.length / 2,
        end =
          x(indexes.at(-1)) + (width - 2 * padding) / rows.length / 2;
      return { ...period, start, width: end - start };
    })
    .filter(Boolean);
  const labelIndexes = [
    ...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1]),
  ];
  return (
    <svg
      className="chart"
      viewBox={"0 0 " + width + " " + height}
      role="img"
      aria-label={labels[metric] + "; exact values in the detail table"}
    >
      <text x="6" y="12">
        {format(maximum, metric)}
      </text>
      {shading.map((period, index) => (
        <rect
          className="calendar-shade"
          x={period.start}
          y="15"
          width={period.width}
          height={height - padding - 15}
          key={(period.id || period.label) + index}
        >
          <title>{period.label}</title>
        </rect>
      ))}
      <line
        className="axis"
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
      />
      {state.chart === "line" &&
        segments.map((values, index) => (
          <polyline
            className="trend"
            points={values
              .map((point) => point.x + "," + point.y)
              .join(" ")}
            key={index}
          />
        ))}
      {points.map((point, index) =>
        point.y == null ? (
          <text
            x={point.x}
            y={height - padding - 5}
            textAnchor="middle"
            key={index}
          >
            {rows.length < 35 ? (point.hidden ? "Hidden" : "—") : ""}
          </text>
        ) : (
          <g key={index}>
            <title>
              {(point.label || point.from) +
                ": " +
                format(point.value, metric) +
                (point.unusual ? " · Unusual" : "") +
                (point.partial ? " · Partial period" : "")}
            </title>
            {state.chart === "column" ? (
              <rect
                className="bar"
                x={
                  point.x -
                  Math.min(
                    25,
                    ((width - 2 * padding) / rows.length) * 0.3,
                  )
                }
                y={point.y}
                width={Math.min(
                  50,
                  ((width - 2 * padding) / rows.length) * 0.6,
                )}
                height={height - padding - point.y}
              />
            ) : (
              <circle
                className={point.unusual ? "unusual" : "point"}
                cx={point.x}
                cy={point.y}
                r={point.unusual ? 5 : 3}
              />
            )}
          </g>
        ),
      )}
      {labelIndexes.map((index) => (
        <text
          x={x(index)}
          y={height - 5}
          textAnchor="middle"
          key={index}
        >
          {rows[index].label || rows[index].from}
        </text>
      ))}
    </svg>
  );
}
function MiniBars({ rows, metric = "totalRecordedValue" }) {
  const key =
      metric === "recordCount" ? "recordCount" : "totalRecordedValueMinor",
    maximum = Math.max(1, ...rows.map((row) => row[key] || 0));
  return (
    <div className="mini-bars">
      {rows.map((row, index) => (
        <div key={row.label}>
          <svg
            viewBox="0 0 80 110"
            role="img"
            aria-label={
              row.label +
              ": " +
              (row.hidden ? "Hidden" : format(row[key], metric))
            }
          >
            <rect
              className={"color-" + (index % 4)}
              x="12"
              y={100 - ((row[key] || 0) / maximum) * 85}
              width="56"
              height={((row[key] || 0) / maximum) * 85}
              rx="5"
            />
          </svg>
          <small>{row.label}</small>
          <small>{row.hidden ? "Hidden" : format(row[key], metric)}</small>
        </div>
      ))}
    </div>
  );
}
function PartialPeriodNote({ state }) {
  if (!state.view.series.some((row) => row.partial)) return null;
  return (
    <p className="note">
      <strong>Partial period:</strong> At least one chart point covers only part
      of its normal period, so compare it cautiously with complete periods.
    </p>
  );
}
function LocationList({ state, action }) {
  const visible = state.view.locations.filter((location) => !location.hidden),
    maximum = Math.max(
      1,
      ...visible.map((location) => location.totalRecordedValueMinor || 0),
    );
  if (!state.view.locations.length) return <p>No connected locations yet.</p>;
  return state.view.locations.map((location, index) => (
    <div className="location-row" key={location.id}>
      <Button kind="link" onClick={() => action("location", location.id)}>
        {location.name}
      </Button>
      <small>
        {location.hidden
          ? "Hidden"
          : money(location.totalRecordedValueMinor) +
            " · " +
            number(location.recordCount) +
            " transactions"}
      </small>
      {!location.hidden && (
        <svg
          className="location-meter"
          viewBox="0 0 100 6"
          role="img"
          aria-label={location.name + " relative spend"}
        >
          <rect className="meter-track" width="100" height="6" rx="3" />
          <rect
            className={"color-" + (index % 4)}
            width={Math.round(
              (location.totalRecordedValueMinor / maximum) * 100,
            )}
            height="6"
            rx="3"
          />
        </svg>
      )}
    </div>
  ));
}
function RecentAlerts({ state, action, navigate }) {
  return (
    <section className="panel tinted">
      <h3>Recent alerts</h3>
      {state.view.alerts.items.length ? (
        state.view.alerts.items.slice(0, 3).map((alert) => (
          <div className="alert-summary" key={alert.id}>
            <span className="dot"></span>
            <div>
              <Button kind="link" onClick={() => action("alert", alert.id)}>
                {alert.title}
              </Button>
              <small>
                {alert.date} · {alert.location}
              </small>
            </div>
          </div>
        ))
      ) : (
        <p>No assessed days triggered a flag in this selection.</p>
      )}
      <a
        className="button wide"
        href="#alerts"
        onClick={() => navigate("alerts")}
      >
        View all alerts
      </a>
    </section>
  );
}
function Dashboard({ state, submit, action, navigate, update }) {
  if (!state.locations.length)
    return (
      <>
        <div className="heading">
          <div>
            <p className="eyebrow">{state.user.businessName}</p>
            <h1>Dashboard</h1>
          </div>
        </div>
        <section className="panel empty onboarding">
          <h2>Connect your first data source</h2>
          <p>
            This business account is ready, but it has no locations or
            transaction records yet.
          </p>
          <ol>
            <li>Prepare data using the documented import contract.</li>
            <li>
              Confirm transaction values, time zone, discount meaning and
              coverage dates.
            </li>
            <li>Import and validate the dataset before using insights.</li>
          </ol>
          {state.user.canManageTeam ? (
            <Button kind="primary" onClick={() => navigate("data")}>
              Open data setup
            </Button>
          ) : (
            <p>Ask the account owner to connect the business data.</p>
          )}
        </section>
      </>
    );
  return (
    <>
      <div className="heading">
        <div>
          <p className="eyebrow">
            {state.user.businessName} · {state.view.location}
          </p>
          <h1>
            Dashboard{" "}
            {state.user.role === "reporting" && (
              <span className="badge">Analysis access</span>
            )}
          </h1>
        </div>
        <Controls state={state} action={action} update={update} />
      </div>
      <Filters state={state} submit={submit} action={action} />
      <ActiveFilter state={state} action={action} />
      <div className="dashboard-grid">
        <div>
          <MetricCards state={state} action={action} />
          <section className="panel chart-panel">
            <div className="section-heading">
              <h3>Student spend over the selected period</h3>
              <div className="legend">
                <span>▧ University calendar</span>
                <span>🟠 Unusual activity</span>
                <Button
                  kind="link"
                  onClick={() => action("metric", "totalRecordedValue")}
                >
                  Open detail →
                </Button>
              </div>
            </div>
            <Chart state={state} />
            <PartialPeriodNote state={state} />
            <p className="muted">
              Open detail for period-by-period values and drill-down.
            </p>
          </section>
          <div className="two-cols">
            <section className="panel">
              <h3>Spend by price band</h3>
              <MiniBars rows={state.view.priceBands} />
            </section>
            <section className="panel">
              <h3>Transactions by weekday</h3>
              <MiniBars rows={state.view.weekdays} metric="recordCount" />
            </section>
          </div>
        </div>
        <aside>
          {state.user.canViewAlerts && (
            <RecentAlerts
              state={state}
              action={action}
              navigate={navigate}
            />
          )}
          <section className="panel">
            <h3>Spend by location</h3>
            <LocationList state={state} action={action} />
            <p className="muted">Your own locations only</p>
          </section>
        </aside>
      </div>
    </>
  );
}
function Comparison({ state }) {
  const comparison = state.view.comparison;
  if (
    !comparison.available ||
    !comparison.totals ||
    comparison.totals.hidden
  )
    return (
      <div className="note">
        <strong>
          Previous equal-length period: {comparison.range.from} –{" "}
          {comparison.range.to}
        </strong>
        <p>
          Comparison unavailable because coverage or privacy requirements are
          not met.
        </p>
      </div>
    );
  const rows = [
    [
      "Card transactions",
      state.view.totals.recordCount,
      comparison.totals.recordCount,
      "recordCount",
    ],
    [
      "Student spend",
      state.view.totals.totalRecordedValueMinor,
      comparison.totals.totalRecordedValueMinor,
      "totalRecordedValue",
    ],
    [
      "Average transaction",
      state.view.totals.averageRecordedValueMinor,
      comparison.totals.averageRecordedValueMinor,
      "averageRecordedValue",
    ],
  ];
  return (
    <section className="comparison">
      <div className="section-heading">
        <strong>Current vs previous equal-length period</strong>
        <span className="muted">
          {comparison.range.from} – {comparison.range.to}
        </span>
      </div>
      <div className="comparison-grid">
        {rows.map(([label, current, previous, metric]) => {
          const maximum = Math.max(1, current || 0, previous || 0);
          return (
            <div key={label}>
              <small>{label}</small>
              <svg
                viewBox="0 0 100 24"
                role="img"
                aria-label={
                  label +
                  ". Current " +
                  format(current, metric) +
                  "; previous " +
                  format(previous, metric)
                }
              >
                <rect
                  className="comparison-previous"
                  x="0"
                  y="3"
                  width={Math.round((previous / maximum) * 100)}
                  height="7"
                  rx="3"
                />
                <rect
                  className="comparison-current"
                  x="0"
                  y="14"
                  width={Math.round((current / maximum) * 100)}
                  height="7"
                  rx="3"
                />
              </svg>
              <small>
                Current {format(current, metric)} · Previous{" "}
                {format(previous, metric)}
              </small>
            </div>
          );
        })}
      </div>
      <p className="muted">
        <span className="comparison-key current"></span> Current{" "}
        <span className="comparison-key previous"></span> Previous
      </p>
    </section>
  );
}
function Detail({ state, submit, action, update }) {
  const rows =
      state.level === "day" && state.view.hourlyAvailable
        ? state.view.hourly
        : state.view.series,
    heading =
      state.level === "day"
        ? state.view.hourlyAvailable
          ? labels[state.metric] + " by hour"
          : "Daily summary"
        : labels[state.metric] +
          (state.level === "week" ? " per day" : " by period");
  return (
    <>
      <div className="breadcrumbs">
        <a href="#dashboard">Dashboard</a> › {labels[state.metric]}
        {state.trail.map((trail, index) => (
          <React.Fragment key={index}>
            {" "}
            ›{" "}
            <Button kind="link" onClick={() => action("back", index)}>
              {trail.from} – {trail.to}
            </Button>
          </React.Fragment>
        ))}{" "}
        › {state.from}
        {state.to !== state.from ? " – " + state.to : ""}
      </div>
      <div className="heading">
        <div>
          <p className="eyebrow">
            {state.user.businessName} · {state.view.location}
          </p>
          <h1>{labels[state.metric]}</h1>
        </div>
        <Controls state={state} action={action} update={update} />
      </div>
      <Filters state={state} submit={submit} action={action} />
      <ActiveFilter state={state} action={action} />
      {state.view.totals.hidden ? (
        <>
          <MetricCards state={state} action={action} />
          <section className="panel empty hidden-view">
            <h2>Not enough transactions to show this view</h2>
            <p>
              To protect student privacy, views built from fewer than{" "}
              {state.view.privacyMinimum} transactions are hidden. This does
              not mean there were no sales.
            </p>
            <Button kind="primary" onClick={() => action("whole-week")}>
              Back to the week
            </Button>{" "}
            <Button onClick={() => action("whole-week")}>
              Show the whole week by day
            </Button>
          </section>
        </>
      ) : (
        <>
          <section className="panel chart-panel">
            <div className="section-heading">
              <h3>{heading}</h3>
              <span className="muted">
                {state.level === "day"
                  ? state.view.hourlyAvailable
                    ? "Source-local time"
                    : "Hourly breakdown unavailable"
                  : "Select a period below to drill down"}
              </span>
            </div>
            {state.level === "day" && !state.view.hourlyAvailable ? (
              <div className="note">
                Hourly analysis is not available: reliable timestamps were not
                supplied. Daily totals remain available below.
              </div>
            ) : (
              <Chart state={state} rows={rows} />
            )}
            <PartialPeriodNote state={state} />
            {state.compare && <Comparison state={state} />}
            <p className="note">
              These figures show what happened at the same time, not what
              caused it. Calendar events and discounts can both play a part.
            </p>
          </section>
          <section className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Card transactions</th>
                  <th>Student spend</th>
                  <th>Average transaction</th>
                  <th>Average discount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={(row.from || row.label) + index}>
                    <td>
                      {state.level === "day" ? (
                        row.label || row.from
                      ) : (
                        <Button
                          kind="link"
                          onClick={() => action("drill", index)}
                        >
                          {row.from}
                          {row.to !== row.from ? " – " + row.to : ""}
                        </Button>
                      )}
                      {row.unusual && (
                        <>
                          {" "}
                          <span className="badge orange">Unusual</span>
                        </>
                      )}
                      {row.partial && (
                        <>
                          {" "}
                          <small>Partial period</small>
                        </>
                      )}
                    </td>
                    {row.hidden ? (
                      <td colSpan="4">
                        Hidden: fewer than {state.view.privacyMinimum}{" "}
                        transactions, or complementary suppression to protect
                        student privacy.
                      </td>
                    ) : (
                      <>
                        <td>{number(row.recordCount)}</td>
                        <td>{money(row.totalRecordedValueMinor)}</td>
                        <td>{money(row.averageRecordedValueMinor)}</td>
                        <td>
                          {state.view.discountAvailable
                            ? money(row.averageDiscountMinor)
                            : "Not available"}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
function SearchPage({ state, submit, action, update }) {
  const rows = state.view.locations.filter((location) =>
    (location.name + " " + (location.address || ""))
      .toLowerCase()
      .includes(state.search.toLowerCase()),
  );
  return (
    <>
      <div className="breadcrumbs">
        <a href="#dashboard">Dashboard</a> › Search
      </div>
      <h1>Search</h1>
      <form
        className="search-form"
        onSubmit={(event) => submit(event, "search")}
      >
        <input
          name="search"
          aria-label="Search locations"
          placeholder="Search your locations"
          defaultValue={state.search}
        />
        <button className="primary">Search</button>
      </form>
      <Filters state={state} submit={submit} action={action} />
      <div className="controls">
        <span>Type: location</span>
        <label>
          Price band
          <select
            value={state.band}
            onChange={(event) =>
              update({ band: event.target.value }, false, true)
            }
          >
            <option value="">Any</option>
            <option value="under50">Under R50</option>
            <option value="50to150">R50–150</option>
            <option value="150to300">R150–300</option>
            <option value="300plus">R300+</option>
          </select>
        </label>
        <Button kind="link" onClick={() => action("clear")}>
          Clear filters
        </Button>
      </div>
      <h3>Your locations ({rows.length})</h3>
      <div className="two-cols">
        {rows.length ? (
          rows.map((location) => (
            <section className="panel" key={location.id}>
              <div className="section-heading">
                <h3>{location.name}</h3>
                <Button onClick={() => action("location", location.id)}>
                  Open
                </Button>
              </div>
              <p className="muted">
                {location.address ||
                  "Address not supplied · synthetic location"}
              </p>
              <p>
                {location.hidden
                  ? "Hidden to protect student privacy"
                  : number(location.recordCount) +
                    " transactions · " +
                    money(location.totalRecordedValueMinor) +
                    " spend"}
              </p>
              <div className="note">
                Average discount: not available. Location coordinates have not
                been supplied.
              </div>
            </section>
          ))
        ) : (
          <p className="empty">
            No locations match these filters. New businesses have no connected
            locations.
          </p>
        )}
      </div>
    </>
  );
}
function AlertsPage({ state, submit, action }) {
  const alerts = state.view.alerts;
  if (!alerts) return <h1>Owners only</h1>;
  return (
    <>
      <h1>Alerts</h1>
      <p className="muted">
        Unusual activity worth a closer look. An alert is not proof that
        something is wrong.
      </p>
      <p className="note">
        <strong>{alerts.thresholdStatus}</strong>
      </p>
      <Filters state={state} submit={submit} action={action} />
      <ActiveFilter state={state} action={action} />
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>What happened</th>
              <th>When</th>
              <th>Location</th>
              <th>Calendar context</th>
            </tr>
          </thead>
          <tbody>
            {alerts.items.length ? (
              alerts.items.map((alert) => (
                <tr key={alert.id}>
                  <td>
                    <Button
                      kind="link"
                      onClick={() => action("alert", alert.id)}
                    >
                      {alert.title}
                    </Button>
                  </td>
                  <td>{alert.date}</td>
                  <td>{alert.location}</td>
                  <td>{alert.context}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4">
                  No flags for this selection. This does not imply every day
                  was assessed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <p className="note">{alerts.rule}</p>
      <p>
        {alerts.assessed} location-days assessed · {alerts.notAssessed} not
        assessed (insufficient eligible history, coverage or privacy).
      </p>
      <p className="muted">{alerts.note}</p>
      <p className="muted">
        Spend-concentration and discount alerts require source data that has
        not been supplied.
      </p>
    </>
  );
}
function AlertDetail({ state, action }) {
  const alert = state.view.alerts?.items.find(
    (item) => item.id === state.alertId,
  );
  if (!alert)
    return (
      <p>
        This alert is no longer in the selected range.{" "}
        <a href="#alerts">Back to alerts</a>
      </p>
    );
  const rows = [
    ...alert.history,
    { date: alert.date, value: alert.value },
  ].map((row) => ({ ...row, from: row.date, to: row.date }));
  return (
    <>
      <div className="breadcrumbs">
        <a href="#alerts">Alerts</a> › {alert.title}
      </div>
      <div className="heading">
        <div>
          <h1>{alert.title}</h1>
          <p>
            {alert.date} · {alert.location}
          </p>
        </div>
        <a className="button" href="#alerts">
          Back to alerts
        </a>
      </div>
      <div className="two-cols">
        <section className="panel">
          <h3>Matching weekdays over the prior 8 weeks</h3>
          <Chart state={state} rows={rows} metric={alert.metric} />
          <Button kind="link" onClick={() => action("alert-day", alert.id)}>
            Open this day in the detail view
          </Button>
          <p className="muted">
            Prior observations:{" "}
            {alert.history
              .map(
                (history) =>
                  history.date + ": " + format(history.value, alert.metric),
              )
              .join("; ")}
            . Selected day: {format(alert.value, alert.metric)}.
          </p>
        </section>
        <section className="panel">
          <h3>Why this was flagged</h3>
          <ul>
            <li>
              {labels[alert.metric]} was {alert.ratio.toFixed(2)}× the usual
              comparable-day average ({format(alert.mean, alert.metric)}).
            </li>
            <li>
              {alert.history.length} eligible historical days; standard
              deviation {format(alert.variation, alert.metric)}. The current
              day does not define its own baseline.
            </li>
            <li>Calendar context: {alert.context}.</li>
          </ul>
          <p className="note">
            Unusual activity is not confirmed fraud or a confirmed cause.
            Flagged records remain included in totals.
          </p>
        </section>
      </div>
    </>
  );
}
function TeamPage({ state, submit, action }) {
  return (
    <>
      <h1>Team</h1>
      <p className="muted">
        Members can view, drill down and export. They cannot see the alerts
        list or manage the team.
      </p>
      <div className="team-grid">
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email / username</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.team.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.username}</td>
                  <td>{user.role === "manager" ? "Owner" : "Member"}</td>
                  <td>
                    <span className="badge">
                      {user.active
                        ? user.must_change
                          ? "Waiting for first login"
                          : "Active"
                        : "Access removed"}
                    </span>
                  </td>
                  <td>
                    {user.role === "reporting" && (
                      <>
                        <Button
                          onClick={() => action("reset-member", user.id)}
                        >
                          {user.active ? "Reset access" : "Reactivate"}
                        </Button>{" "}
                        {user.active && (
                          <Button onClick={() => action("remove", user.id)}>
                            Remove
                          </Button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <form
          className="panel"
          onSubmit={(event) => submit(event, "member")}
        >
          <h3>Add member</h3>
          <Field label="Name" name="name" />
          <Field label="Email" name="email" type="email" />
          <label>
            Temporary password
            <div className="input-row">
              <input
                name="password"
                id="temporary"
                required
                minLength="12"
                autoComplete="off"
              />
              <Button onClick={() => action("generate")}>Generate</Button>
            </div>
          </label>
          <p className="muted">
            Share this with them yourself. They must set their own password at
            first login. At least 12 characters.
          </p>
          <button className="primary wide">Add member</button>
        </form>
      </div>
    </>
  );
}
function DataSetup({ state, submit, action }) {
  const data = state.meta.data;
  return (
    <>
      <div className="breadcrumbs">
        <a href="#dashboard">Dashboard</a> › Data setup
      </div>
      <h1>Data setup</h1>
      <div className="two-cols">
        <section className="panel">
          <h2>Current connection</h2>
          <p>
            <span className="badge">
              {data.connected ? "Connected" : "Not connected"}
            </span>
          </p>
          <dl>
            <dt>Coverage</dt>
            <dd>
              {data.connected
                ? data.coverage.from + " – " + data.coverage.to
                : "No business dataset imported"}
            </dd>
            <dt>Time zone</dt>
            <dd>{data.timezone}</dd>
            <dt>Reliable hourly timestamps</dt>
            <dd>
              {data.hourlyTimestamps
                ? "Declared by source"
                : "Not supplied"}
            </dd>
            <dt>Discount meaning</dt>
            <dd>
              {data.discountSemantics === "amountMinor"
                ? "Discount amount in ZAR cents"
                : "Not supplied"}
            </dd>
          </dl>
          <p className="note">
            Hourly detail and discount measures are enabled only when the
            import explicitly declares reliable timestamps and discount
            amounts. Maps and new alert types still require approved
            definitions.
          </p>
        </section>
        <form
          className="panel"
          onSubmit={(event) => submit(event, "import")}
        >
          <h2>Import JSON data</h2>
          <label>
            Import file
            <input
              type="file"
              name="file"
              accept="application/json,.json"
              required
            />
          </label>
          <p className="muted">
            Maximum 50,000 transactions and 10 MB per import. Transactions are
            upserted by their external id. Student keys are pseudonymised
            before storage.
          </p>
          <Button kind="link" onClick={() => action("import-example")}>
            Download example
          </Button>
          <button className="primary wide">Validate and import</button>
        </form>
      </div>
    </>
  );
}
function Modal({ modal, close, submit, action }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.showModal();
  }, [modal.type]);
  return (
    <dialog ref={ref} onClose={close}>
      <h2>{modal.title}</h2>
      {modal.type === "forgot" && (
        <form onSubmit={(event) => submit(event, "recover")}>
          <p>
            Enter the one-time recovery code saved when the owner account was
            created or last generated. Members should ask their owner to reset
            their access.
          </p>
          <Field
            label="Owner email or username"
            name="username"
            autoComplete="username"
          />
          <Field
            label="Recovery code"
            name="code"
            autoComplete="one-time-code"
          />
          <Field
            label="New password"
            name="password"
            type="password"
            minLength="12"
            autoComplete="new-password"
          />
          <Field
            label="Confirm new password"
            name="confirm"
            type="password"
            minLength="12"
            autoComplete="new-password"
          />
          <p className="note">
            No email is sent. The recovery code is used once and all existing
            sessions are revoked.
          </p>
          <div className="modal-actions">
            <Button onClick={close}>Cancel</Button>
            <button className="primary">Recover access</button>
          </div>
        </form>
      )}
      {modal.type === "code" && (
        <>
          <p>{modal.message}</p>
          <p className="note">
            <code>{modal.code}</code>
          </p>
          <p>No email was sent.</p>
          <Button kind="primary" onClick={close}>
            I have saved it
          </Button>
        </>
      )}
      {modal.type === "feedback" && (
        <form onSubmit={(event) => submit(event, "feedback")}>
          <fieldset>
            <legend>What is it about?</legend>
            <label className="radio">
              <input
                type="radio"
                name="category"
                value="Insights"
                defaultChecked
              />{" "}
              Insights about discounts and promotions
            </label>
            <label className="radio">
              <input type="radio" name="category" value="Usability" /> Using the
              website
            </label>
          </fieldset>
          <label>
            Screen
            <input name="screen" value={modal.screen} readOnly />
          </label>
          <label>
            Your feedback
            <textarea
              name="message"
              required
              minLength="5"
              maxLength="1800"
              rows="5"
            ></textarea>
          </label>
          <Button kind="link" onClick={() => action("feedback-history")}>
            View my submitted feedback
          </Button>
          <div className="modal-actions">
            <Button onClick={close}>Cancel</Button>
            <button className="primary">Send</button>
          </div>
        </form>
      )}
      {modal.type === "feedback-history" && (
        <>
          {modal.items.length ? (
            modal.items.map((feedback) => (
              <section className="note" key={feedback.id}>
                <strong>
                  {feedback.category} · {feedback.created_at.slice(0, 10)}
                </strong>
                <p>{feedback.message}</p>
              </section>
            ))
          ) : (
            <p>No submissions yet.</p>
          )}
          <Button onClick={close}>Close</Button>
        </>
      )}
      {modal.type === "export" && (
        <form onSubmit={(event) => submit(event, "export")}>
          <fieldset>
            <legend>What to export</legend>
            <label className="radio">
              <input
                type="radio"
                name="scope"
                value="current"
                defaultChecked
              />{" "}
              Current view: {labels[modal.metric]}, {modal.from} – {modal.to}
              {modal.band ? ", " + priceBandLabels[modal.band] : ""}
            </label>
            <label className="radio">
              <input type="radio" name="scope" value="dashboard" /> Dashboard
              summary for the selected dates
            </label>
          </fieldset>
          <p className="note">
            Privacy rules still apply. Anything hidden on screen stays hidden
            in the export.
          </p>
          <div className="modal-actions">
            <Button onClick={close}>Cancel</Button>
            <button className="primary">Export</button>
          </div>
        </form>
      )}
      {modal.type === "reset-member" && (
        <form onSubmit={(event) => submit(event, "reset-member")}>
          <input type="hidden" name="id" value={modal.user.id} />
          <p>
            {modal.user.name} will receive a new temporary password. Existing
            sessions will end and they must choose a personal password at next
            login.
          </p>
          <label>
            New temporary password
            <div className="input-row">
              <input
                name="password"
                id="reset-temporary"
                required
                minLength="12"
                autoComplete="off"
                defaultValue={modal.password || ""}
                key={modal.password || "empty"}
              />
              <Button onClick={() => action("generate-reset")}>
                Generate
              </Button>
            </div>
          </label>
          <div className="modal-actions">
            <Button onClick={close}>Cancel</Button>
            <button className="primary">
              {modal.user.active ? "Reset access" : "Reactivate"}
            </button>
          </div>
        </form>
      )}
      {modal.type === "remove" && (
        <>
          <p>
            Remove {modal.user.name}? Their access and active sessions will be
            revoked. Feedback and audit history will be retained.
          </p>
          <div className="modal-actions">
            <Button onClick={close}>Cancel</Button>
            <Button
              kind="primary"
              onClick={() => action("confirm-remove", modal.user.id)}
            >
              Remove member
            </Button>
          </div>
        </>
      )}
    </dialog>
  );
}
function App() {
  const stateRef = useRef(restoreState()),
    generationRef = useRef(0),
    refreshRef = useRef(null),
    navigateRef = useRef(null),
    [, rerender] = useReducer((value) => value + 1, 0),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(null);
  const state = stateRef.current;
  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 8000);
  }, []);
  const saveState = useCallback(() => {
    const current = stateRef.current;
    if (!current.user) return;
    const saved = Object.fromEntries(
      savedKeys.map((key) => [key, current[key]]),
    );
    saved.compare = current.compare ? "yes" : "no";
    try {
      localStorage.setItem("shoplytics-view", JSON.stringify(saved));
    } catch {}
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(saved))
      if (value) params.set(key, value);
    history.replaceState(
      null,
      "",
      location.pathname + "?" + params + "#" + current.page,
    );
  }, []);
  const update = useCallback(
    (changes, save = false, refreshAfter = false) => {
      Object.assign(stateRef.current, changes);
      rerender();
      if (save) saveState();
      if (refreshAfter) refreshRef.current?.();
    },
    [saveState],
  );
  const api = useCallback(async (path, body) => {
    const response = await fetch(
        path,
        body === undefined
          ? {}
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
      ),
      data = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        Object.assign(stateRef.current, {
          user: null,
          view: null,
          meta: null,
        });
        rerender();
      }
      throw Error(data.error || "Request failed.");
    }
    return data;
  }, []);
  const query = useCallback((overrides = {}) => {
    const current = stateRef.current;
    return new URLSearchParams({
      from: current.from,
      to: current.to,
      grouping: current.grouping,
      metric: current.metric,
      chart: current.chart,
      location: current.location,
      band: current.band,
      ...overrides,
    });
  }, []);
  const refresh = useCallback(async () => {
    const generation = ++generationRef.current,
      current = stateRef.current;
    if (!current.user || current.user.mustChangePassword) {
      rerender();
      return;
    }
    Object.assign(current, { loading: true, error: "" });
    rerender();
    try {
      if (!current.meta) {
        const [meta, locations] = await Promise.all([
          api("/api/meta"),
          api("/api/locations"),
        ]);
        current.meta = meta;
        current.locations = locations.items;
      }
      const [view, team] = await Promise.all([
        api("/api/summary?" + query()),
        current.page === "team" && current.user.canManageTeam
          ? api("/api/team")
          : null,
      ]);
      if (generation !== generationRef.current) return;
      current.view = view;
      if (team) current.team = team.items;
      saveState();
    } catch (caught) {
      if (generation === generationRef.current) current.error = caught.message;
      throw caught;
    } finally {
      if (generation === generationRef.current) {
        current.loading = false;
        rerender();
      }
    }
  }, [api, query, saveState]);
  refreshRef.current = refresh;
  const navigate = useCallback(
    async (page) => {
      const current = stateRef.current;
      if (
        ["alerts", "alert-detail", "team", "data"].includes(page) &&
        !current.user?.canViewAlerts
      )
        page = "dashboard";
      current.page = page;
      if (page === "dashboard") current.metric = "totalRecordedValue";
      try {
        await refresh();
      } catch (caught) {
        showToast(caught.message, true);
      }
    },
    [refresh, showToast],
  );
  navigateRef.current = navigate;
  useEffect(() => {
    const onHashChange = () => {
      const page = location.hash.slice(1) || "dashboard";
      if (page !== stateRef.current.page) navigateRef.current(page);
    };
    window.addEventListener("hashchange", onHashChange);
    (async () => {
      try {
        stateRef.current.user = (await api("/api/session")).user;
        rerender();
        if (stateRef.current.user)
          await navigateRef.current(
            location.hash.slice(1) || "dashboard",
          );
      } catch (caught) {
        showToast(caught.message, true);
      }
    })();
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [api, showToast]);

  const parentWeek = useCallback(async () => {
    const current = stateRef.current,
      date = new Date(current.from),
      start =
        Date.parse(current.from) -
        ((date.getUTCDay() + 6) % 7) * 86400000;
    Object.assign(current, {
      from: iso(start),
      to: iso(start + 6 * 86400000),
      level: "week",
      grouping: "daily",
      calendarPeriod: "",
    });
    await navigate("detail");
  }, [navigate]);
  const action = useCallback(
    async (name, value) => {
      const current = stateRef.current;
      try {
        if (name === "logout") {
          await api("/api/logout", {});
          Object.assign(current, {
            ...initialState,
            user: null,
          });
          try {
            localStorage.removeItem("shoplytics-view");
          } catch {}
          history.replaceState(null, "", location.pathname + "#dashboard");
          rerender();
        }
        if (name === "retry") await refresh();
        if (name === "recovery-code") {
          const result = await api("/api/recovery-code", {});
          setModal({
            type: "code",
            title: "Save your recovery code",
            code: result.code,
            message:
              "Store this code privately. Generating it invalidated any previous recovery code.",
          });
        }
        if (name === "import-example") {
          const example = await api("/api/import/example"),
            url = URL.createObjectURL(
              new Blob([JSON.stringify(example, null, 2)], {
                type: "application/json",
              }),
            ),
            anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = "shoplytics-import-example.json";
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        }
        if (name === "forgot")
          setModal({ type: "forgot", title: "Recover owner access" });
        if (name === "feedback")
          setModal({
            type: "feedback",
            title: "Send feedback",
            screen: current.page,
          });
        if (name === "feedback-history") {
          const result = await api("/api/feedback");
          setModal({
            type: "feedback-history",
            title: "Your submitted feedback",
            items: result.items,
          });
        }
        if (name === "export")
          setModal({
            type: "export",
            title: "Export report",
            metric: current.metric,
            from: current.from,
            to: current.to,
            band: current.band,
          });
        if (name === "metric") {
          current.metric = value;
          current.trail = [];
          await navigate("detail");
        }
        if (name === "location") {
          current.location = String(value);
          current.metric = "totalRecordedValue";
          await navigate("detail");
        }
        if (name === "alert") {
          current.alertId = value;
          await navigate("alert-detail");
        }
        if (name === "alert-day") {
          const alert = current.view.alerts.items.find(
            (item) => item.id === value,
          );
          Object.assign(current, {
            from: alert.date,
            to: alert.date,
            location: String(alert.locationId),
            level: "day",
            grouping: "daily",
            metric: alert.metric,
            calendarPeriod: "",
          });
          await navigate("detail");
        }
        if (name === "generate")
          document.querySelector("#temporary").value = randomPassword();
        if (name === "generate-reset")
          setModal((existing) => ({
            ...existing,
            password: randomPassword(),
          }));
        if (name === "reset-member")
          setModal({
            type: "reset-member",
            title: current.team.find((user) => user.id === Number(value)).active
              ? "Reset member access"
              : "Reactivate member",
            user: current.team.find((user) => user.id === Number(value)),
          });
        if (name === "remove")
          setModal({
            type: "remove",
            title: "Remove team member",
            user: current.team.find((user) => user.id === Number(value)),
          });
        if (name === "confirm-remove") {
          await api("/api/team/remove", { id: Number(value) });
          setModal(null);
          await refresh();
          showToast("Member access removed. Audit history retained.");
        }
        if (name === "history") {
          Object.assign(current, {
            from: current.meta.coverage.from,
            to: current.meta.coverage.to,
            grouping: "monthly",
            level: "month",
            calendarPeriod: "",
            trail: [],
          });
          await refresh();
        }
        if (name === "clear") {
          Object.assign(current, {
            search: "",
            location: "",
            band: "",
            calendarPeriod: "",
            from: initialState.from,
            to: initialState.to,
            level: "month",
            grouping: "weekly",
            compare: false,
            trail: [],
          });
          await refresh();
        }
        if (name === "clear-band") {
          current.band = "";
          await refresh();
        }
        if (name === "drill") {
          const row = current.view.series[Number(value)];
          current.trail.push({
            from: current.from,
            to: current.to,
            level: current.level,
            grouping: current.grouping,
            calendarPeriod: current.calendarPeriod,
          });
          Object.assign(current, {
            from: row.from,
            to: row.to,
            level:
              current.grouping === "monthly"
                ? "month"
                : current.grouping === "weekly"
                  ? "week"
                  : "day",
            grouping:
              current.grouping === "monthly" ? "weekly" : "daily",
            chart: "column",
            calendarPeriod: "",
          });
          await refresh();
        }
        if (name === "back") {
          const index = Number(value);
          Object.assign(current, current.trail[index]);
          current.trail = current.trail.slice(0, index);
          await refresh();
        }
        if (name === "whole-week") await parentWeek();
        if (name === "level") {
          current.level = value;
          current.trail = [];
          current.calendarPeriod = "";
          if (value === "week") {
            await parentWeek();
            return;
          }
          if (value === "day") {
            current.to = current.from;
            current.grouping = "daily";
          } else {
            const date = new Date(current.from);
            current.from = current.from.slice(0, 7) + "-01";
            current.to = iso(
              Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
            );
            if (
              current.to > current.meta.coverage.to &&
              current.from <= current.meta.coverage.to
            )
              current.to = current.meta.coverage.to;
            current.grouping = "weekly";
          }
          await refresh();
        }
      } catch (caught) {
        showToast(caught.message, true);
      }
    },
    [api, navigate, parentWeek, refresh, showToast],
  );
  const submit = useCallback(
    async (event, type) => {
      event.preventDefault();
      const form = event.currentTarget,
        body = Object.fromEntries(new FormData(form)),
        submitButton = form.querySelector(
          'button:not([type="button"])',
        );
      if (submitButton) submitButton.disabled = true;
      try {
        const current = stateRef.current;
        if (["login", "register", "password"].includes(type)) {
          const result = await api("/api/" + type, body);
          Object.assign(current, {
            user: result.user,
            view: null,
            meta: null,
            location: "",
            band: "",
            calendarPeriod: "",
            page: "dashboard",
          });
          rerender();
          await refresh();
          if (result.recoveryCode)
            setModal({
              type: "code",
              title: "Save your recovery code",
              code: result.recoveryCode,
              message:
                "This code is shown once. Store it privately so you can recover the owner account without email.",
            });
        }
        if (type === "recover") {
          const result = await api("/api/recover", body);
          Object.assign(current, {
            user: result.user,
            view: null,
            meta: null,
            location: "",
            band: "",
            calendarPeriod: "",
            page: "dashboard",
          });
          setModal(null);
          rerender();
          await refresh();
          showToast("Password replaced and previous sessions revoked.");
        }
        if (type === "range") {
          const period = current.meta.calendar.periods.find(
              (item) => item.id === body.calendarPeriod,
            ),
            from = period?.start || body.from,
            to = period?.end || body.to;
          if (from > to)
            throw Error("The From date must be before the To date.");
          Object.assign(current, {
            from,
            to,
            location: body.location,
            calendarPeriod: period?.id || "",
            trail: [],
          });
          const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
          current.level =
            days === 1 ? "day" : days <= 7 ? "week" : "month";
          current.grouping =
            days > 90 ? "monthly" : days > 7 ? "weekly" : "daily";
          await refresh();
        }
        if (type === "member") {
          await api("/api/team", body);
          form.reset();
          await refresh();
          showToast(
            "Member added. Share the temporary password privately; no email was sent.",
          );
        }
        if (type === "reset-member") {
          await api("/api/team/reset", {
            id: Number(body.id),
            password: body.password,
          });
          setModal(null);
          await refresh();
          showToast(
            "Member access updated. Share the temporary password privately; no email was sent.",
          );
        }
        if (type === "import") {
          const file = form.querySelector('input[type="file"]').files[0];
          if (!file) throw Error("Choose a JSON import file.");
          if (file.size > 10_000_000)
            throw Error("Import file must be 10 MB or less.");
          let payload;
          try {
            payload = JSON.parse(await file.text());
          } catch {
            throw Error("Import file must contain valid JSON.");
          }
          const result = await api("/api/import", payload);
          current.meta = null;
          current.locations = [];
          form.reset();
          await refresh();
          showToast(
            "Imported " +
              number(result.transactions) +
              " transactions across " +
              number(result.locations) +
              " locations.",
          );
        }
        if (type === "feedback") {
          await api("/api/feedback", {
            category: body.category,
            message:
              "[" +
              body.screen +
              "; " +
              current.from +
              " to " +
              current.to +
              "; " +
              current.view.location +
              (current.band
                ? "; " + priceBandLabels[current.band]
                : "") +
              "] " +
              body.message,
          });
          setModal(null);
          showToast("Feedback saved. No email notification was sent.");
        }
        if (type === "search" || type === "nav-search") {
          current.search = body.search;
          await navigate("search");
        }
        if (type === "export") {
          const response = await fetch(
            "/api/report?" + query({ scope: body.scope }),
          );
          if (!response.ok) throw Error((await response.json()).error);
          const url = URL.createObjectURL(await response.blob()),
            anchor = document.createElement("a");
          anchor.href = url;
          anchor.download =
            "shop-a-lytics-" +
            body.scope +
            "-" +
            current.from +
            ".pdf";
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          setModal(null);
          showToast("Report downloaded with privacy rules applied.");
        }
      } catch (caught) {
        showToast(caught.message, true);
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    },
    [api, navigate, query, refresh, showToast],
  );
  let page;
  if (state.view) {
    const props = { state, submit, action, navigate, update };
    page =
      {
        dashboard: <Dashboard {...props} />,
        detail: <Detail {...props} />,
        search: <SearchPage {...props} />,
        alerts: <AlertsPage {...props} />,
        "alert-detail": <AlertDetail {...props} />,
        team: <TeamPage {...props} />,
        data: <DataSetup {...props} />,
      }[state.page] || <Dashboard {...props} />;
  }
  if (!state.user)
    return (
      <>
        <LoginPage submit={submit} action={action} />
        {modal && (
          <Modal
            modal={modal}
            close={() => setModal(null)}
            submit={submit}
            action={action}
          />
        )}
        {toast && (
          <div
            className={"toast " + (toast.isError ? "error" : "")}
            role={toast.isError ? "alert" : "status"}
          >
            {toast.message}
          </div>
        )}
      </>
    );
  if (state.user.mustChangePassword)
    return (
      <PasswordPage state={state} submit={submit} action={action} />
    );
  return (
    <>
      <Navigation
        state={state}
        navigate={navigate}
        submit={submit}
        action={action}
      />
      {state.error ? (
        <div className="status-banner error" role="alert">
          {state.error}{" "}
          <Button kind="link" onClick={() => action("retry")}>
            Try again
          </Button>
        </div>
      ) : state.loading ? (
        <div className="status-banner" role="status">
          Updating analysis…
        </div>
      ) : null}
      <main id="main" aria-busy={state.loading ? "true" : undefined}>
        {state.view ? page : <p role="status">Loading your data…</p>}
        {state.view && (
          <footer>
            <p>{state.view.dataNote}</p>
            <p>{state.view.calendar.note}</p>
            <p>
              Privacy minimum: {state.view.privacyMinimum} transactions. Small
              and complementary buckets are hidden; no student identities are
              exposed.
            </p>
          </footer>
        )}
      </main>
      {modal && (
        <Modal
          modal={modal}
          close={() => setModal(null)}
          submit={submit}
          action={action}
        />
      )}
      {toast && (
        <div
          className={"toast " + (toast.isError ? "error" : "")}
          role={toast.isError ? "alert" : "status"}
        >
          {toast.message}
        </div>
      )}
    </>
  );
}

createRoot(document.querySelector("#root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

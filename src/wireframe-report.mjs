import PDFDocument from "pdfkit";

const ink = "#17131f",
  muted = "#6f687a",
  purple = "#672ce4",
  orange = "#f16b00",
  pale = "#f5f2fa",
  border = "#e2dbea";
const money = (value) =>
  value == null ? "Unavailable" : `R ${(value / 100).toFixed(2)}`;
const clean = (value) =>
  String(value ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[^ -~\n]/g, "");
const metricLabel = (metric) =>
  ({
    recordCount: "Card transactions",
    totalRecordedValue: "Total student spend",
    averageRecordedValue: "Average transaction",
  })[metric] || metric;

export function makeWireframeReport(view, chart, scope) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42, bufferPages: true }),
      chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const pageHeader = (title) => {
      doc.rect(0, 0, doc.page.width, 94).fill(ink);
      doc.rect(42, 25, 34, 4).fill(orange);
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#ffffff")
        .text("SHOP-A-LYTICS", 42, 36);
      doc.fontSize(23).text(clean(title), 42, 54, { lineBreak: false });
      doc.y = 116;
      doc.x = 42;
    };
    const addPage = (title) => {
      doc.addPage();
      pageHeader(title);
    };
    const ensure = (height, title = "Report continued") => {
      if (doc.y + height > 770) addPage(title);
    };
    const heading = (title) => {
      ensure(34, title);
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(ink)
        .text(clean(title));
      doc.moveDown(0.55);
    };
    const paragraph = (text, size = 9, color = muted) => {
      const value = clean(text),
        options = { lineGap: 3, width: 511 },
        height = doc
          .font("Helvetica")
          .fontSize(size)
          .heightOfString(value, options);
      ensure(height + 12);
      doc
        .font("Helvetica")
        .fontSize(size)
        .fillColor(color)
        .text(value, options);
      doc.moveDown(0.55);
    };
    const summaryCard = (x, y, width, label, value, note) => {
      doc.roundedRect(x, y, width, 74, 8).fillAndStroke(pale, border);
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(muted)
        .text(clean(label), x + 12, y + 11, { width: width - 24 });
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor(ink)
        .text(clean(value), x + 12, y + 28, { width: width - 24 });
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(muted)
        .text(clean(note), x + 12, y + 53, { width: width - 24 });
    };

    pageHeader(scope === "dashboard" ? "Dashboard report" : "Analysis report");
    paragraph(
      `${view.business} | ${view.location}${view.priceBand ? ` | ${view.priceBand}` : ""}`,
      10,
      ink,
    );
    paragraph(
      `${view.range.from} to ${view.range.to} | ${view.grouping} | ${chart} chart | Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
      8,
    );

    const totals = view.totals,
      hidden = totals.hidden,
      cardWidth = 247,
      cardY = doc.y + 4;
    summaryCard(
      42,
      cardY,
      cardWidth,
      "Card transactions",
      hidden ? "Hidden" : (totals.recordCount ?? "Unavailable"),
      "BoschCard records in the selected view",
    );
    summaryCard(
      306,
      cardY,
      cardWidth,
      "Total student spend",
      hidden ? "Hidden" : money(totals.totalRecordedValueMinor),
      "Recorded transaction value",
    );
    summaryCard(
      42,
      cardY + 86,
      cardWidth,
      "Average transaction",
      hidden ? "Hidden" : money(totals.averageRecordedValueMinor),
      "Total value divided by transaction count",
    );
    summaryCard(
      306,
      cardY + 86,
      cardWidth,
      "Recorded discounts",
      view.discountAvailable
        ? money(view.discounts.totalDiscountMinor)
        : "Unavailable",
      view.discountAvailable
        ? "Recorded discount amounts"
        : "Discount semantics were not supplied",
    );
    doc.y = cardY + 181;
    doc.x = 42;

    heading(metricLabel(view.metric));
    const top = doc.y,
      left = 52,
      width = 490,
      height = 135,
      values = view.series
        .map((row) => row.value)
        .filter((value) => value != null),
      maximum = Math.max(1, ...values),
      step = width / Math.max(1, view.series.length),
      x = (index) => left + (index + 0.5) * step,
      y = (value) => top + height - (value / maximum) * height;
    for (let grid = 0; grid <= 4; grid++) {
      const gridY = top + (height * grid) / 4;
      doc
        .moveTo(left, gridY)
        .lineTo(left + width, gridY)
        .strokeColor(grid === 4 ? "#bfb6ca" : border)
        .lineWidth(grid === 4 ? 1 : 0.5)
        .stroke();
    }
    if (chart === "column")
      view.series.forEach((row, index) => {
        if (row.value != null)
          doc
            .roundedRect(
              x(index) - Math.min(18, step * 0.32),
              y(row.value),
              Math.min(36, step * 0.64),
              top + height - y(row.value),
              2,
            )
            .fill(row.unusual ? orange : purple);
      });
    else {
      let previous = null;
      view.series.forEach((row, index) => {
        if (row.value == null) {
          previous = null;
          return;
        }
        const point = { x: x(index), y: y(row.value) };
        if (previous)
          doc
            .moveTo(previous.x, previous.y)
            .lineTo(point.x, point.y)
            .strokeColor(purple)
            .lineWidth(2)
            .stroke();
        doc
          .circle(point.x, point.y, row.unusual ? 4 : 2.5)
          .fill(row.unusual ? orange : purple);
        previous = point;
      });
    }
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(muted)
      .text(clean(view.range.from), left, top + height + 8, {
        lineBreak: false,
      });
    doc.text(clean(view.range.to), left + width - 65, top + height + 8, {
      lineBreak: false,
    });
    doc.y = top + height + 28;
    doc.x = 42;
    paragraph(
      `Scale: 0 to ${view.metric === "recordCount" ? maximum : money(maximum)}. Orange marks indicate unusual activity; gaps are hidden or unavailable values.`,
      8,
    );

    if (doc.y + view.series.length * 28 + 40 > 770)
      addPage("Period detail");
    heading("Period detail");
    for (const [index, row] of view.series.entries()) {
      ensure(30, "Period detail");
      const rowY = doc.y;
      if (index % 2 === 0)
        doc.rect(42, rowY - 3, 511, 25).fill("#faf9fc");
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(ink)
        .text(clean(`${row.from} to ${row.to}`), 48, rowY + 3, {
          width: 120,
          lineBreak: false,
        });
      const detail = row.hidden
        ? "Hidden for privacy"
        : `${row.recordCount ?? "Unavailable"} transactions | ${money(row.totalRecordedValueMinor)} | avg ${money(row.averageRecordedValueMinor)}${row.unusual ? " | REVIEW FLAG" : ""}`;
      doc.text(clean(detail), 175, rowY + 3, { width: 370 });
      doc.y = rowY + 28;
      doc.x = 42;
    }

    if (scope === "dashboard")
      for (const [title, rows] of [
        ["Spend by location", view.locations],
        ["Spend by price band", view.priceBands],
        ["Transactions by weekday", view.weekdays],
      ]) {
        heading(title);
        for (const row of rows)
          paragraph(
            `${row.name || row.label}: ${row.hidden ? "Hidden" : `${row.recordCount ?? "Unavailable"} transactions | ${money(row.totalRecordedValueMinor)}`}`,
            8,
            ink,
          );
      }

    if (view.alerts) {
      heading("Anomaly assessment");
      paragraph(
        `${view.alerts.assessed} location-days assessed; ${view.alerts.notAssessed} not assessed. ${view.alerts.items.length} flags in this report. Method ${view.alerts.validation.methodVersion}; thresholds remain provisional.`,
        9,
        ink,
      );
      for (const alert of view.alerts.items.slice(0, 12))
        paragraph(
          `${alert.date} | ${alert.location} | ${alert.title} | ${Math.abs(alert.deviationPercent).toFixed(1)}% from baseline | ${alert.priority}`,
          8,
          alert.priority === "High variance" ? orange : ink,
        );
      paragraph(view.alerts.note, 8);
    }

    heading("Context and qualifications");
    paragraph(view.dataNote);
    paragraph(view.calendar.note);
    for (const period of view.calendar.periods)
      paragraph(`${period.label}: ${period.from} to ${period.to}`, 8, ink);
    for (const event of view.calendar.events)
      paragraph(`${event.label}: ${event.start} to ${event.end}`, 8, ink);
    paragraph(
      `Privacy: views with fewer than ${view.privacyMinimum} transactions are hidden, and an additional bucket may be hidden to limit subtraction. Flags remain in aggregates. Calendar events, discounts and transaction changes can coincide without establishing cause. No individual student records are included.`,
      8,
    );

    const pages = doc.bufferedPageRange();
    for (let index = 0; index < pages.count; index++) {
      doc.switchToPage(index);
      doc
        .moveTo(42, 798)
        .lineTo(553, 798)
        .strokeColor(border)
        .lineWidth(0.5)
        .stroke();
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(muted)
        .text(
          `Shop-A-Lytics | Synthetic/local demonstration data | ${index + 1} / ${pages.count}`,
          42,
          806,
          { lineBreak: false },
        );
    }
    doc.end();
  });
}

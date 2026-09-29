import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("application shell and dynamic interface retain accessibility landmarks", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../src/client/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/client/src/main.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /name="viewport"/);
  assert.match(app, /aria-label="Main navigation"/);
  assert.match(app, /aria-busy=/);
  assert.match(app, /role="alert"/);
  assert.match(app, /role="status"/);
  assert.match(app, /role="img"/);
  assert.match(app, /Owner overview/);
  assert.match(app, /value=\{state\.metric\}/);
  assert.match(app, /Review priority/);
});

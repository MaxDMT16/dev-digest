import { test } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { route, findSkillDrift, loadRouting, collect } from "./collect.mjs";
import { makeRepo } from "./lib.test.mjs";
import { headTree, mergeBase } from "./lib.mjs";

const routing = loadRouting();
const UI = ["frontend-architecture", "react-best-practices", "next-best-practices", "react-testing-library"];
const BACKEND = ["onion-architecture", "fastify-best-practices", "drizzle-orm-patterns", "postgresql-table-design"];

test("client files route only to UI skills (plus generic ones)", () => {
  const { routes } = route(["client/src/components/Foo.tsx", "client/src/lib/hooks/useX.ts"], routing);
  for (const s of Object.keys(routes)) assert.ok(![...BACKEND].includes(s), s);
  assert.ok(routes["frontend-architecture"] && routes["react-best-practices"]);
});

test("server files route only to backend skills", () => {
  const { routes } = route(["server/src/modules/a/routes.ts", "server/src/db/schema.ts"], routing);
  for (const s of Object.keys(routes)) assert.ok(!UI.includes(s), s);
  assert.ok(routes["onion-architecture"] && routes["fastify-best-practices"] && routes["postgresql-table-design"]);
});

test("migrations skip onion but hit postgres; content patterns route", () => {
  const { routes } = route(["server/src/db/migrations/0001.sql"], routing);
  assert.deepEqual(Object.keys(routes).sort(), ["drizzle-orm-patterns", "postgresql-table-design", "security"]);
  assert.ok(!routes["onion-architecture"]);
  const r2 = route(["server/src/x/thing.ts"], routing, () => "import { eq } from 'drizzle-orm'");
  assert.ok(r2.routes["drizzle-orm-patterns"]);
  const r3 = route(["client/src/lib/x.ts"], routing, () => "'use client'");
  assert.ok(r3.routes["next-best-practices"]);
});

test("e2e source is uncovered; skill drift detected", () => {
  const { routes, uncovered } = route(["e2e/flows/a.ts"], routing);
  assert.deepEqual(routes, {});
  assert.deepEqual(uncovered, ["e2e/flows/a.ts"]);
  assert.deepEqual(findSkillDrift(["zod", "mermaid-diagram", "brand-new"], routing), ["brand-new"]);
});

test("collect(): docs-only diff routes nowhere; code diff routes; no rules.mjs tolerated", async () => {
  const r = makeRepo();
  r.put("README.md", "x"); r.put("server/src/a.ts", "1"); r.commit("init");
  r.sh("branch", "base");
  r.put("README.md", "y"); r.put("docs/x.md", "z");
  let out = await collect({ cwd: r.d, base: "base", fetch: false });
  assert.deepEqual(out.routes, {}); assert.deepEqual(out.files, []);
  assert.deepEqual(out.signals, []); assert.deepEqual(out.ruleFindings, []);
  r.put("server/src/a.ts", "2"); r.put("client/src/b.tsx", "x");
  out = await collect({ cwd: r.d, base: "base", fetch: false });
  assert.deepEqual(out.packages.sort(), ["client", "server"]);
  assert.ok(out.routes["onion-architecture"].includes("server/src/a.ts"));
  assert.ok(out.routes["react-best-practices"].includes("client/src/b.tsx"));
  assert.ok(!out.routes["onion-architecture"].includes("client/src/b.tsx"));
  assert.match(out.key, /^[0-9a-f]{40}:[0-9a-f]{40}$/);
  r.commit("c");
  const committed = await collect({ cwd: r.d, base: "base", fetch: false });
  assert.equal(committed.key, `${mergeBase("base", r.d)}:${headTree(r.d)}`);
  rmSync(r.d, { recursive: true, force: true });
});

/**
 * End-to-end check of the public-vault API against a running dev server
 * (VAULTS_DEV_AUTH=1, DATABASE_URL set). Usage: npx tsx scripts/api-smoke.mts [baseUrl]
 */
import { getHeist } from "../src/content/heists.ts";
import { solve } from "../src/engine/solver.ts";
import { Level } from "../src/engine/geometry.ts";
import { run } from "../src/engine/game.ts";

const base = process.argv[2] ?? "http://localhost:3300";
let failures = 0;
function check(name: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` ${JSON.stringify(extra)}`}`);
  if (!ok) failures++;
}
async function call(path: string, init: RequestInit & { user?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.user) headers["x-vaults-dev-user"] = init.user;
  const r = await fetch(base + path, { ...init, headers });
  return { status: r.status, body: await r.json().catch(() => null) };
}

const heist = getHeist("night-shift")!;
const def = { ...heist.def, emp: heist.def.emp }; // clone
const sol = solve(def);
if (sol.status !== "solved") throw new Error("heist unsolvable?");
const tag = Date.now().toString(36);
// make each run's vault unique so the duplicate check doesn't trip on reruns
def.maxTurns = 200 + (Date.now() % 250);

const anon = await call("/api/vaults", { method: "POST", body: JSON.stringify({ title: "x", def, proof: sol.moves }) });
check("publish needs sign-in", anon.status === 401, anon);

const bad = await call("/api/vaults", { method: "POST", user: `alice${tag}`, body: JSON.stringify({ title: "x", def, proof: "UUUU" }) });
check("publish rejects a proof that doesn't crack it", bad.status === 400, bad);

const pub = await call("/api/vaults", { method: "POST", user: `alice${tag}`, body: JSON.stringify({ title: "  Smoke   test vault ", def, proof: sol.moves + "" }) });
check("publish works", pub.status === 201 && typeof pub.body?.code === "string", pub);
const code = pub.body.code as string;

const dup = await call("/api/vaults", { method: "POST", user: `bob${tag}`, body: JSON.stringify({ title: "copy", def, proof: sol.moves }) });
check("same vault can't be published twice", dup.status === 409, dup);

const fast = await call(`/api/vaults/${code}/attempts`, { method: "POST", user: `bob${tag}`, body: JSON.stringify({ moves: sol.moves, player: "player0001", ms: 10 }) });
check("bot-speed cracks are refused", fast.status === 400, fast);

const illegal = await call(`/api/vaults/${code}/attempts`, { method: "POST", body: JSON.stringify({ moves: "LLLLLLLL", player: "player0001", ms: 5000 }) });
check("impossible moves are refused", illegal.status === 400, illegal);

const unfinished = await call(`/api/vaults/${code}/attempts`, { method: "POST", body: JSON.stringify({ moves: sol.moves.slice(0, 2), player: "player0001", ms: 5000 }) });
check("unfinished runs are refused", unfinished.status === 400, unfinished);

const creatorRun = await call(`/api/vaults/${code}/attempts`, { method: "POST", user: `alice${tag}`, body: JSON.stringify({ moves: sol.moves, player: "player0002", ms: 60000 }) });
check("creator's runs don't count", creatorRun.status === 200 && creatorRun.body.counted === false && creatorRun.body.vault.attempts === 0, creatorRun);

const crack = await call(`/api/vaults/${code}/attempts`, { method: "POST", user: `bob${tag}`, body: JSON.stringify({ moves: sol.moves, player: "player0003", ms: 60000 }) });
check("bob cracks it: first blood, rank 1", crack.status === 200 && crack.body.outcome === "cracked" && crack.body.firstBlood && crack.body.rank === 1 && crack.body.points > 0, crack);

const again = await call(`/api/vaults/${code}/attempts`, { method: "POST", user: `carol${tag}`, body: JSON.stringify({ moves: sol.moves, player: "player0004", ms: 60000 }) });
check("carol cracks it too: no first blood", again.status === 200 && !again.body.firstBlood && again.body.rank === 1, again);

// find a losing run locally, then submit it
const level = new Level(def);
let losing = "";
for (const m of ["RRRRRRRRRRRR", "DDDDDDDDDD", "RRRRDDDDDDDD", "DDDDRRRRRRRR", "WWWWWWWWWWWWWWWWWWWW", "DDRRRRRRRRRR"]) {
  for (let n = 1; n <= m.length && !losing; n++) if (run(level, m.slice(0, n)).status === "caught" && run(level, m.slice(0, n)).invalidAt === null) losing = m.slice(0, n);
  if (losing) break;
}
const caught = await call(`/api/vaults/${code}/attempts`, { method: "POST", body: JSON.stringify({ moves: losing, player: "player0005", ms: 5000 }) });
check("anonymous capture recorded", caught.body?.outcome === "caught" && caught.body.vault.attempts === 3, { losing, caught });

const replaysAnon = await call(`/api/vaults/${code}/replays`);
check("replays hidden from anonymous players", replaysAnon.status === 401, replaysAnon);
const replaysDave = await call(`/api/vaults/${code}/replays`, { user: `dave${tag}` });
check("replays hidden from people who haven't cracked it", replaysDave.status === 403, replaysDave);
const replaysBob = await call(`/api/vaults/${code}/replays`, { user: `bob${tag}` });
check("replays open to crackers", replaysBob.status === 200 && replaysBob.body.runs.length === 2, replaysBob);

const del = await call(`/api/vaults/${code}`, { method: "DELETE", user: `bob${tag}` });
check("only the builder can take it down", del.status === 403, del);

const page = await fetch(`${base}/v/${code}`);
check("vault page renders", page.status === 200, page.status);

console.log(failures ? `\n${failures} failed` : "\nall good");
console.log(`vault: ${base}/v/${code}`);
process.exit(failures ? 1 : 0);

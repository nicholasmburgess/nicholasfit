/**
 * Scriptable (iOS) scripts for the home-screen widget. The setup card fills in the
 * site address and the personal key, and the user pastes each one into Scriptable.
 * Keep these free of backticks and dollar-brace so they can live in template strings.
 */

export const RINGS_NAME = "Nicholasfit";
export const LOG_NAME = "Log meal";

const fill = (src: string, base: string, token: string) =>
  src.replace("__BASE__", JSON.stringify(base)).replace("__TOKEN__", JSON.stringify(token)).trim() + "\n";

const RINGS = `
// Nicholasfit: today's calories and protein. Add as a small widget.
// Tapping the widget runs the "Log meal" script.
const BASE = __BASE__;
const TOKEN = __TOKEN__;

const ink = Color.dynamic(new Color("#13261c"), new Color("#f2ead7"));
const muted = Color.dynamic(new Color("#5c5a4a"), new Color("#a8b29f"));
const energy = new Color("#3f8f63");
const protein = new Color("#c9a66b");
const track = new Color("#8a8f80", 0.28);

const now = new Date();
const day = new Date(now); day.setHours(0, 0, 0, 0);
const week = new Date(day); week.setDate(week.getDate() - ((week.getDay() + 6) % 7));

let d = null, problem = null;
try {
  const req = new Request(BASE + "/api/widget/summary?day=" + encodeURIComponent(day.toISOString()) + "&week=" + encodeURIComponent(week.toISOString()));
  req.headers = { Authorization: "Bearer " + TOKEN };
  d = await req.loadJSON();
  if (d.error) { problem = d.error; d = null; }
} catch (e) {
  problem = "Offline";
}

function ring(ctx, c, r, frac, color, w) {
  ctx.setLineWidth(w);
  ctx.setStrokeColor(track);
  ctx.strokeEllipse(new Rect(c - r, c - r, r * 2, r * 2));
  const f = Math.max(0, Math.min(1, frac));
  if (f <= 0) return;
  const n = Math.max(2, Math.ceil(90 * f));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + 2 * Math.PI * f * (i / n);
    pts.push(new Point(c + r * Math.cos(a), c + r * Math.sin(a)));
  }
  const p = new Path();
  p.addLines(pts);
  ctx.addPath(p);
  ctx.setStrokeColor(color);
  ctx.strokePath();
}

const w = new ListWidget();
w.backgroundColor = Color.dynamic(new Color("#f3ecdc"), new Color("#0b1d15"));
w.setPadding(14, 14, 12, 14);
w.url = "scriptable:///run/" + encodeURIComponent("${LOG_NAME}");
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

function label(stack, text, size, color, weight) {
  const t = stack.addText(text);
  t.font = weight ? Font.semiboldSystemFont(size) : Font.systemFont(size);
  t.textColor = color;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.7;
  return t;
}

if (!d) {
  label(w, "Nicholasfit", 13, ink, true);
  w.addSpacer(6);
  label(w, problem || "No data", 11, muted).lineLimit = 3;
  w.addSpacer();
  label(w, "Tap to log a meal", 10, muted);
} else {
  const t = d.targets;
  const row = w.addStack();
  row.centerAlignContent();
  const ctx = new DrawContext();
  ctx.size = new Size(140, 140);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  ring(ctx, 70, 62, t ? d.kcal / t.kcal : 0, energy, 15);
  ring(ctx, 70, 40, t ? d.protein / t.protein : 0, protein, 15);
  const img = row.addImage(ctx.getImage());
  img.imageSize = new Size(66, 66);
  row.addSpacer(10);
  const col = row.addStack();
  col.layoutVertically();
  if (t) {
    const kLeft = t.kcal - d.kcal, pLeft = t.protein - d.protein;
    label(col, kLeft >= 0 ? String(kLeft) : "+" + (-kLeft), 17, ink, true);
    label(col, kLeft >= 0 ? "kcal left" : "kcal over", 10, muted);
    col.addSpacer(5);
    label(col, pLeft > 0 ? pLeft + " g" : "Done", 17, protein, true);
    label(col, pLeft > 0 ? "protein left" : "protein", 10, muted);
  } else {
    label(col, String(d.kcal), 17, ink, true);
    label(col, "kcal", 10, muted);
    col.addSpacer(5);
    label(col, d.protein + " g", 17, protein, true);
    label(col, "protein", 10, muted);
  }
  w.addSpacer();
  const foot = d.sessions + "/" + d.sessionGoal + " sessions" + (d.weight ? " · " + d.weight + " kg" : "");
  label(w, t ? foot : "Open Food once to set targets", 10, muted);
}

if (config.runsInWidget) Script.setWidget(w);
else await w.presentSmall();
Script.complete();
`;

const LOG = `
// Nicholasfit: take a photo of a meal (or describe it), check the estimate, save.
const BASE = __BASE__;
const TOKEN = __TOKEN__;

async function call(body) {
  const req = new Request(BASE + "/api/widget/meal");
  req.method = "POST";
  req.headers = { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" };
  req.body = JSON.stringify(body);
  req.timeoutInterval = 90;
  return await req.loadJSON();
}

function shrink(img, max) {
  const s = img.size;
  const k = Math.min(1, max / Math.max(s.width, s.height));
  const ctx = new DrawContext();
  ctx.size = new Size(Math.round(s.width * k), Math.round(s.height * k));
  ctx.respectScreenScale = false;
  ctx.drawImageInRect(img, new Rect(0, 0, ctx.size.width, ctx.size.height));
  return ctx.getImage();
}

async function notice(title, message) {
  const a = new Alert();
  a.title = title;
  a.message = message || "";
  a.addAction("OK");
  await a.present();
}

async function run() {
  let photo = null;
  try { photo = await Photo.fromCamera(); } catch (e) { photo = null; }

  const ask = new Alert();
  ask.title = photo ? "Add a few words?" : "Describe the meal";
  ask.message = photo ? "Optional, e.g. large serve, cooked in olive oil" : "e.g. chicken burrito bowl and a flat white";
  ask.addTextField("Description", "");
  ask.addAction("Estimate");
  ask.addCancelAction("Cancel");
  if ((await ask.present()) === -1) return;
  const description = ask.textFieldValue(0).trim();
  if (!photo && !description) return;

  const body = { description: description };
  if (photo) body.image = Data.fromJPEG(shrink(photo, 1024)).toBase64String();

  let est;
  try { est = await call(body); } catch (e) { return notice("Couldn't reach Nicholasfit", "Check your connection and try again."); }
  if (est.error) return notice("Couldn't estimate", est.error);

  const lines = est.items.map(function (i) { return i.name + " (" + i.portion + "): " + Math.round(i.kcal) + " kcal"; });
  const review = new Alert();
  review.title = est.kcal + " kcal · " + est.protein + " g protein";
  review.message = lines.join("\\n") + (est.note ? "\\n\\n" + est.note : "") + "\\n\\nConfidence: " + est.confidence;
  review.addTextField("Calories", String(est.kcal));
  review.addTextField("Protein (g)", String(est.protein));
  review.addAction("Save");
  review.addCancelAction("Discard");
  if ((await review.present()) === -1) return;

  const kcal = Number(review.textFieldValue(0) || est.kcal), prot = Number(review.textFieldValue(1) || est.protein);
  const ratio = est.kcal > 0 && kcal > 0 ? kcal / est.kcal : 1;
  const saved = await call({ save: {
    description: description || est.items.map(function (i) { return i.name; }).join(", "),
    items: est.items,
    kcal: kcal > 0 ? kcal : est.kcal,
    protein: prot >= 0 ? prot : est.protein,
    carbs: Math.round(est.carbs * ratio),
    fat: Math.round(est.fat * ratio),
    confidence: est.confidence,
  } });
  if (saved.error) return notice("Couldn't save", saved.error);
  const n = new Notification();
  n.title = "Meal saved";
  n.body = (kcal > 0 ? kcal : est.kcal) + " kcal logged";
  await n.schedule();
}

await run();
Script.complete();
`;

export const ringsScript = (base: string, token: string) => fill(RINGS, base, token);
export const logScript = (base: string, token: string) => fill(LOG, base, token);

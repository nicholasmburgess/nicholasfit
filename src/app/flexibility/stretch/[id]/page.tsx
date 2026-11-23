import Link from "next/link";
import { notFound } from "next/navigation";
import { StretchDemo } from "@/components/flex/StretchDemo";
import { ROUTINES, STRETCHES, getStretch } from "@/lib/stretches";

export function generateStaticParams() {
  return STRETCHES.map((s) => ({ id: s.id }));
}

export default async function StretchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = getStretch(decodeURIComponent(id));
  if (!s) notFound();
  const inRoutines = ROUTINES.filter((r) => r.steps.some((x) => x.id === s.id));

  return (
    <main className="space-y-4 md:mx-auto md:max-w-2xl">
      <Link href="/flexibility" className="inline-block pt-2 text-sm text-accent">
        ‹ Flexibility
      </Link>
      <header>
        <h1 className="text-2xl font-bold">{s.name}</h1>
        <p className="text-sm text-muted">
          {s.area} · {s.kind === "move" ? "Moving drill" : `Hold${s.sides ? ", each side" : ""}`}
        </p>
      </header>

      <StretchDemo id={s.id} images={s.images} name={s.name} />

      <section className="rounded-2xl border border-line bg-card p-4">
        <p className="mb-3 text-sm">
          <span className="font-semibold">Feel it:</span> {s.feel.toLowerCase()}
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          {s.cues.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        {s.kind === "hold" && <p className="mt-3 text-sm text-muted">Breathe slowly and relax into it. Tension is fine, pain means ease off.</p>}
      </section>

      {inRoutines.length > 0 && (
        <p className="text-sm text-muted">
          In:{" "}
          {inRoutines.map((r, i) => (
            <span key={r.key}>
              {i > 0 && ", "}
              <Link href={`/flexibility/${r.key}`} className="text-accent">
                {r.name}
              </Link>
            </span>
          ))}
        </p>
      )}

      <details className="rounded-2xl border border-line bg-card p-4">
        <summary className="font-semibold">Step-by-step instructions</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted">
          {s.instructions.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </details>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ExerciseDemo } from "@/components/ExerciseDemo";
import { ExerciseProgress } from "@/components/ExerciseProgress";
import { EXERCISES, getExercise, videoSearchUrl } from "@/lib/exercises";

export function generateStaticParams() {
  return EXERCISES.map((e) => ({ id: e.id }));
}

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ex = getExercise(decodeURIComponent(id));
  if (!ex) notFound();

  return (
    <main className="space-y-4">
      <Link href="/exercises" className="inline-block pt-2 text-sm text-accent">
        ‹ Exercises
      </Link>
      <header>
        <h1 className="text-2xl font-bold">{ex.name}</h1>
        <p className="text-sm capitalize text-muted">
          {ex.pattern} · {ex.load} · {[...ex.primaryMuscles, ...ex.secondaryMuscles].join(", ")}
        </p>
      </header>

      <ExerciseDemo images={ex.images} name={ex.name} />

      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="mb-2 font-semibold">Form cues</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          {ex.cues.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <h2 className="mb-2 mt-4 font-semibold">Common mistakes</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          {ex.mistakes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <a href={videoSearchUrl(ex)} target="_blank" rel="noreferrer" className="mt-4 block rounded-xl border border-line py-2.5 text-center text-sm text-accent">
          Watch video demos
        </a>
      </section>

      <ExerciseProgress exerciseId={ex.id} />

      <details className="rounded-2xl border border-line bg-card p-4">
        <summary className="font-semibold">Step-by-step instructions</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted">
          {ex.instructions.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </details>
    </main>
  );
}

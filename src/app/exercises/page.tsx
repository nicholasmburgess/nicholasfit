import Link from "next/link";
import { EXERCISES, PATTERNS } from "@/lib/exercises";

export default function ExercisesPage() {
  return (
    <main className="space-y-5">
      <header className="pt-2">
        <h1 className="text-2xl font-bold">Exercises</h1>
        <p className="text-sm text-muted">Everything here works with your home gym.</p>
      </header>
      {PATTERNS.map((p) => (
        <section key={p}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{p}</h2>
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
            {EXERCISES.filter((e) => e.pattern === p).map((e) => (
              <li key={e.id}>
                <Link href={`/exercises/${e.id}`} className="block overflow-hidden rounded-xl border border-line bg-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.images[1] ?? e.images[0]} alt="" className="aspect-[4/3] w-full bg-white object-contain" loading="lazy" />
                  <span className="block px-3 py-2 text-sm font-medium leading-tight">{e.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-muted">
        Exercise photos and instructions from{" "}
        <a className="underline" href="https://github.com/yuhonas/free-exercise-db">Free Exercise DB</a> (public domain).
      </p>
    </main>
  );
}

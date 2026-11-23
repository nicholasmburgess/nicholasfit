import { notFound } from "next/navigation";
import { StretchPlayer } from "@/components/flex/StretchPlayer";
import { ROUTINES, getRoutine } from "@/lib/stretches";

export function generateStaticParams() {
  return ROUTINES.map((r) => ({ routine: r.key }));
}

export default async function RoutinePage({ params }: { params: Promise<{ routine: string }> }) {
  const { routine } = await params;
  const r = getRoutine(routine);
  if (!r) notFound();
  return <StretchPlayer routine={r} />;
}

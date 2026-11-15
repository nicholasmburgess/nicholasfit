# Nicholasfit

A personal fitness app: workout logging with exercise demos, and (coming next) body weight from Withings, photo-based nutrition logging and weekly AI coaching.

It's a web app you add to your iPhone home screen. Built with Next.js, Supabase and Vercel.

- **Setting it up:** see [docs/SETUP.md](docs/SETUP.md)
- **Running locally:** `npm install`, then `npm run dev` and open http://localhost:3000. Without Supabase settings it runs in demo mode and saves data in the browser.

## What's in Phase 1

- Strength A / Strength B beginner routines (3 days a week, about 45 minutes) plus an optional easy row
- Log weight, reps and completed sets; weights carry forward between sets
- Rest timer with sound when it ends
- Automatic progression: add weight when every set hits the top of the rep range, drop 10% after two stalled sessions
- Exercise library for the home gym with looping demos, form cues, common mistakes and a progress chart
- Workout history

## Credits

Exercise photos and instructions come from [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (public domain, Unlicense). Refresh them with `node scripts/fetch-exercises.mjs`.

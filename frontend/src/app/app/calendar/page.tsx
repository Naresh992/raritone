"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { Burst, Sticker } from "@/components/pop";
import { StreakApi } from "@/lib/api";
import { useToast } from "@/lib/store";

type Day = { date: string; completed: boolean; isToday: boolean; isFuture: boolean; source: string | null; imageUrl: string | null };

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

export default function StyleCalendarPage() {
  const toast = useToast();
  const now = new Date();
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [days, setDays] = useState<Day[]>([]);
  const [streak, setStreak] = useState<any>(null);
  const [monthDone, setMonthDone] = useState(0);
  const [monthTotal, setMonthTotal] = useState(30);
  const [challenge, setChallenge] = useState("");
  const [outfits, setOutfits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const d: any = await StreakApi.calendar(m);
      setDays(d.days || []);
      setStreak(d.streak);
      setMonthDone(d.monthCompleted || 0);
      setMonthTotal(d.monthTotal || 30);
      setChallenge(d.todayChallenge || "");
      const o: any = await StreakApi.outfits();
      setOutfits(o.outfits || []);
    } catch (e: any) {
      toast.push(e?.status === 401 ? "Sign in to see your style calendar" : e?.message || "Could not load calendar", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(ym); }, [ym, load]);

  function shift(dir: number) {
    const [y, m] = ym.split("-").map(Number);
    const dt = new Date(y, m - 1 + dir, 1);
    setYm(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  }

  // Monday-first offset for the 1st
  const lead = days.length ? (new Date(days[0].date + "T00:00:00").getDay() + 6) % 7 : 0;
  const progress = streak ? Math.min(streak.current, streak.rewardThreshold) : 0;

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <Sticker>Style Streak</Sticker>
            <h1 className="font-display uppercase text-3xl lg:text-5xl mt-2">My Style Calendar</h1>
          </div>
          {streak && streak.current > 0 && (
            <Burst className="w-20 h-20" star="text-blood" ink="text-white">Day<br/>{streak.current}</Burst>
          )}
        </div>
        <Link href="/app/live" className="px-6 py-3.5 bg-blood text-white text-[11px] tracking-[0.16em] uppercase font-bold inline-flex items-center hover:bg-blood-bright transition">
          ● Start today&apos;s Live Try-On
        </Link>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        {[
          { label: "Current streak", value: streak ? `${streak.current} day${streak.current === 1 ? "" : "s"}` : "—", hot: true },
          { label: "Longest streak", value: streak ? `${streak.longest} day${streak.longest === 1 ? "" : "s"}` : "—", hot: false },
          { label: "Saved outfits", value: streak ? streak.totalSavedOutfits : "—", hot: false },
          { label: "Reward progress", value: streak ? `${progress}/${streak.rewardThreshold} days` : "—", hot: true },
        ].map((c) => (
          <div key={c.label} className={`border p-4 ${c.hot ? "bg-blood-dark border-blood" : "bg-coal border-white/10"}`}>
            <div className="text-[11px] tracking-[0.18em] uppercase font-bold text-smoke">{c.label}</div>
            <div className="font-display text-3xl mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      {streak && (
        <div className="mt-3 bg-coal border border-white/10 p-4">
          <div className="flex justify-between text-[11px] tracking-[0.18em] uppercase font-bold text-smoke">
            <span>Monthly reward progress</span><span>{progress}/{streak.rewardThreshold}</span>
          </div>
          <div className="h-2 bg-white/10 mt-2 overflow-hidden">
            <div className="h-full bg-blood transition-all" style={{ width: `${(progress / streak.rewardThreshold) * 100}%` }} />
          </div>
          {streak.openRewardId ? (
            <div className="mt-3 text-sm font-bold text-blood-bright">
              ✕ Reward unlocked — <Link href="/app/rewards" className="underline underline-offset-4">claim it in Rewards →</Link>
            </div>
          ) : (
            <div className="mt-3 text-sm text-smoke">Today&apos;s challenge: <span className="text-bone font-medium">{challenge}</span></div>
          )}
        </div>
      )}

      {/* Month grid */}
      <div className="mt-6 bg-coal border border-white/10 p-4 lg:p-6">
        <div className="flex items-center justify-between">
          <button onClick={() => shift(-1)} className="h-9 w-9 border border-white/20 text-bone hover:border-blood" aria-label="Previous month">←</button>
          <div className="font-display uppercase text-xl tracking-wide">{ym}</div>
          <button onClick={() => shift(1)} className="h-9 w-9 border border-white/20 text-bone hover:border-blood" aria-label="Next month">→</button>
        </div>
        {loading ? (
          <div className="grid grid-cols-7 gap-1.5 mt-4">{Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}</div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5 mt-4">
            {WEEK.map((w, i) => <div key={i} className="text-center text-[10px] tracking-widest text-smoke pb-1">{w}</div>)}
            {Array.from({ length: lead }).map((_, i) => <div key={`e${i}`} />)}
            {days.map((d) => {
              const n = Number(d.date.slice(8));
              const cls = d.completed
                ? "bg-blood text-white font-bold"
                : d.isToday
                  ? "border border-blood text-white font-bold"
                  : d.isFuture
                    ? "text-smoke/40 bg-white/[0.03]"
                    : "border border-white/10 text-smoke";
              return (
                <div key={d.date} title={d.completed ? `Completed${d.source ? ` · ${d.source}` : ""}` : d.isToday ? "Today — try on a look!" : d.isFuture ? "Upcoming" : "Missed"}
                  className={`aspect-square flex flex-col items-center justify-center text-sm border border-transparent ${cls}`}>
                  <span>{n}</span>
                  {d.completed && <span aria-label="completed" className="text-xs leading-none">✕</span>}
                  {d.isToday && !d.completed && <span className="w-1.5 h-1.5 bg-blood mt-0.5" aria-label="today" />}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap gap-4 mt-4 text-xs text-smoke">
          <span><span className="inline-block w-3 h-3 bg-blood text-white text-[8px] text-center mr-1">✕</span>Completed</span>
          <span><span className="inline-block w-3 h-3 border border-blood mr-1" />Today</span>
          <span><span className="inline-block w-3 h-3 border border-white/15 mr-1" />Missed</span>
          <span><span className="inline-block w-3 h-3 bg-white/5 mr-1" />Upcoming</span>
        </div>
      </div>

      {/* Saved outfits */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display uppercase text-2xl">Saved outfits</h2>
          <span className="text-xs text-smoke">{monthDone} day{monthDone === 1 ? "" : "s"} completed this month</span>
        </div>
        {outfits.length === 0 ? (
          <EmptyState title="No saved looks yet" body="Complete a try-on and check in to start filling your calendar."
            action={<Link href="/app/live" className="px-5 py-3 bg-blood text-white text-[11px] font-bold tracking-[0.16em] uppercase inline-flex items-center">Try a look</Link>} />
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-4">
            {outfits.map((o: any) => (
              <div key={o.id} className="bg-coal border border-white/10 overflow-hidden">
                {o.imageUrl
                  ? <img src={o.imageUrl} alt={o.name || "Saved outfit"} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                  : <div className="aspect-[3/4] bg-ash flex items-center justify-center text-xs text-smoke">No preview</div>}
                <div className="p-2 text-xs truncate text-bone/80">{o.name || "Saved look"}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/app/subscription"><Button variant="outline">My Subscription</Button></Link>
        <Link href="/app/rewards"><Button variant="outline">Rewards</Button></Link>
        <Link href="/subscriptions"><Button variant="ghost">View plans</Button></Link>
      </div>
    </div>
  );
}

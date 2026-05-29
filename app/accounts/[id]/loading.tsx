function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-zinc-900 ${className}`} />;
}

function MetricSkeleton({ label }: { label: string }) {
  return (
    <div className="h-[94px] rounded-[18px] bg-zinc-950/80 p-3 ring-1 ring-zinc-900 sm:h-[106px] sm:rounded-[22px] sm:p-4">
      <div className="text-[11px] font-medium leading-none text-zinc-500 sm:text-[12px]">
        {label}
      </div>

      <SkeletonBlock className="mt-2 h-5 w-20 sm:h-6 sm:w-24" />
      <SkeletonBlock className="mt-1 h-3 w-24 sm:mt-2" />
    </div>
  );
}

function RuleSkeleton({ label }: { label: string }) {
  return (
    <div className="h-[238px] rounded-[26px] bg-zinc-950/80 p-5 ring-1 ring-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[13px] font-medium text-zinc-500">{label}</div>
          <SkeletonBlock className="mt-3 h-8 w-36" />
          <SkeletonBlock className="mt-2 h-4 w-28" />
        </div>

        <SkeletonBlock className="h-7 w-20 rounded-full" />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-[12px] text-zinc-500">
          <span>Used</span>
          <SkeletonBlock className="h-3 w-8" />
        </div>

        <SkeletonBlock className="h-2 w-full rounded-full" />
      </div>

      <SkeletonBlock className="mt-4 h-3 w-full" />
      <SkeletonBlock className="mt-2 h-3 w-4/5" />
    </div>
  );
}

function BetCardSkeleton() {
  return (
    <div className="min-h-[154px] rounded-[22px] bg-zinc-950/80 p-4 ring-1 ring-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <SkeletonBlock className="h-5 w-36" />
          <SkeletonBlock className="mt-2 h-3 w-32" />
        </div>

        <SkeletonBlock className="h-7 w-16 rounded-full" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-black/30 p-3">
          <div className="text-[11px] text-zinc-600">Stake</div>
          <SkeletonBlock className="mt-2 h-4 w-14" />
        </div>

        <div className="rounded-2xl bg-black/30 p-3">
          <div className="text-[11px] text-zinc-600">Possible</div>
          <SkeletonBlock className="mt-2 h-4 w-16" />
        </div>

        <div className="rounded-2xl bg-black/30 p-3">
          <div className="text-[11px] text-zinc-600">P/L</div>
          <SkeletonBlock className="mt-2 h-4 w-14" />
        </div>
      </div>

      <SkeletonBlock className="mt-4 h-3 w-32" />
    </div>
  );
}

function TopSummarySkeleton() {
  return (
    <div className="flex h-[142px] min-w-0 flex-col justify-between overflow-hidden lg:h-[146px]">
      <div className="min-w-0">
        <SkeletonBlock className="h-8 w-52 max-w-full sm:h-9 sm:w-64" />

        <div className="mt-3 text-[12px] font-medium leading-none text-zinc-500">
          Rule equity
        </div>

        <div className="mt-2 flex min-w-0 items-end gap-3">
          <SkeletonBlock className="h-10 w-56 max-w-full sm:h-11 sm:w-64" />
          <SkeletonBlock className="mb-2 h-3 w-24 shrink-0" />
        </div>

        <SkeletonBlock className="mt-2 h-4 w-36" />
      </div>
    </div>
  );
}

function GoalSkeleton() {
  return (
    <div className="flex h-[142px] flex-col justify-between rounded-[26px] bg-black/30 p-5 ring-1 ring-zinc-900 lg:h-[146px]">
      <div className="flex items-start justify-between gap-4">
        <div className="text-[13px] font-medium leading-none text-zinc-500">
          Goal
        </div>

        <SkeletonBlock className="h-7 w-16 shrink-0 rounded-full" />
      </div>

      <div className="min-w-0">
        <SkeletonBlock className="h-9 w-40 sm:h-10 sm:w-44" />
        <SkeletonBlock className="mt-2 h-4 w-32" />
      </div>
    </div>
  );
}

export default function LoadingAccountPage() {
  return (
    <div className="min-h-screen bg-[#09090b] px-4 pb-24 pt-6 text-white sm:px-6 md:pb-12 md:pt-10">
      <div className="mx-auto mt-4 w-full max-w-6xl sm:mt-5">
        <section className="rounded-[32px] bg-zinc-950/90 p-4 sm:p-5">
          <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)]">
            <TopSummarySkeleton />
            <GoalSkeleton />
          </div>
        </section>

        <section className="mt-3 grid h-[196px] grid-cols-2 gap-2 sm:h-[224px] sm:gap-3 lg:h-[106px] lg:grid-cols-4">
          <MetricSkeleton label="Rule equity" />
          <MetricSkeleton label="Open risk" />
          <MetricSkeleton label="Max bet" />
          <MetricSkeleton label="Account size" />
        </section>

        <section className="mt-2 grid h-[488px] gap-3 sm:mt-3 lg:h-[238px] lg:grid-cols-2">
          <RuleSkeleton label="Daily loss room" />
          <RuleSkeleton label="Total loss room" />
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[24px] font-semibold tracking-tight text-zinc-100">
                Open positions
              </h2>

              <p className="mt-1 text-[14px] text-zinc-500">
                Bets that are still waiting to settle.
              </p>
            </div>

            <div className="hidden text-[13px] text-zinc-500 sm:block">
              <SkeletonBlock className="inline-block h-4 w-28 align-middle" />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <BetCardSkeleton />
            <BetCardSkeleton />
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4">
            <h2 className="text-[24px] font-semibold tracking-tight text-zinc-100">
              Past positions
            </h2>

            <p className="mt-1 text-[14px] text-zinc-500">
              Settled wins, losses, and voids.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <BetCardSkeleton />
            <BetCardSkeleton />
          </div>
        </section>

        <section className="mt-10 min-h-[72px] rounded-[24px] bg-zinc-950/70 p-4 ring-1 ring-zinc-900">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-600">
            Account ID
          </div>

          <SkeletonBlock className="mt-3 h-4 w-full max-w-xl" />
        </section>
      </div>
    </div>
  );
}
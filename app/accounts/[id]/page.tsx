import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PLAN_CONFIG, type PlanKey } from "@/lib/plans";

interface AccountPageProps {
  params: Promise<{ id: string }>;
}

type BetRow = {
  id: string;
  selection: string;
  league: string;
  market: string;
  odds: number;
  stake: number;
  potential_profit: number;
  potential_payout: number;
  status: string;
  result: string | null;
  settlement_amount: number | null;
  settlement_reason: string | null;
  placed_at: string;
  settled_at: string | null;
  polymarket_winning_outcome: string | null;
  polymarket_resolution_error: string | null;
};

function formatMoney(value: number | null | undefined) {
  const safeValue = Number(value ?? 0);

  return `$${safeValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatSignedMoney(value: number | null | undefined) {
  const safeValue = Number(value ?? 0);
  const prefix = safeValue > 0 ? "+" : "";

  return `${prefix}${formatMoney(safeValue)}`;
}

function formatPercent(value: number | null | undefined) {
  return `${Number(value ?? 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}%`;
}

function formatOdds(odds: number | null | undefined) {
  const safeOdds = Number(odds ?? 0);
  return safeOdds > 0 ? `+${safeOdds}` : `${safeOdds}`;
}

function formatDate(date: string | null | undefined) {
  if (!date) return "—";

  const formatted = new Date(date).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return `${formatted} EST`;
}

function formatCompactAccountSize(value: number | null | undefined) {
  const size = Number(value ?? 0);

  if (!size) return "";

  if (size >= 1000) {
    return `${Math.round(size / 1000)}k`;
  }

  return String(size);
}

function getTodayNewYorkDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getBetPnl(bet: BetRow) {
  if (bet.status === "won") return Number(bet.potential_profit ?? 0);
  if (bet.status === "lost") return -Number(bet.stake ?? 0);
  if (bet.status === "void") return 0;
  return null;
}

function resultLabel(status: string) {
  if (status === "open") return "Open";
  if (status === "won") return "Won";
  if (status === "lost") return "Lost";
  if (status === "void") return "Void";
  if (status === "passed") return "Passed";
  if (status === "failed") return "Failed";
  if (status === "active_dev") return "Active Dev";
  return status;
}

function statusColor(status: string) {
  if (status === "passed" || status === "won") {
    return "border-emerald-900/70 text-emerald-300";
  }

  if (status === "failed" || status === "lost") {
    return "border-red-900/70 text-red-300";
  }

  if (status === "void") {
    return "border-zinc-700 text-zinc-400";
  }

  return "border-zinc-800 text-zinc-400";
}

function pnlColor(value: number) {
  if (value > 0) return "text-green-400";
  if (value < 0) return "text-red-400";
  return "text-zinc-100";
}

function StatCard({
  label,
  value,
  sub,
  valueClassName = "text-zinc-100",
}: {
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">
        {label}
      </div>

      <div
        className={[
          "mt-2 text-xl font-semibold tracking-tight",
          valueClassName,
        ].join(" ")}
      >
        {value}
      </div>

      {sub ? <div className="mt-1 text-xs text-zinc-500">{sub}</div> : null}
    </div>
  );
}

function FloorBar({
  current,
  floor,
  start,
}: {
  current: number;
  floor: number;
  start: number;
}) {
  const range = Math.max(start - floor, 1);
  const distanceAboveFloor = current - floor;

  const currentPercent = Math.min(
    Math.max((distanceAboveFloor / range) * 100, 0),
    100
  );

  const isBreached = current <= floor;

  return (
    <div className="mt-4">
      <div className="relative h-3 overflow-hidden rounded-full bg-zinc-900">
        <div
          className={[
            "h-full rounded-full transition-all",
            isBreached ? "bg-red-500/70" : "bg-zinc-200",
          ].join(" ")}
          style={{ width: `${currentPercent}%` }}
        />

        <div className="absolute left-0 top-0 h-full w-[2px] bg-red-400" />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-600">
        <span>Floor {formatMoney(floor)}</span>
        <span>Start {formatMoney(start)}</span>
      </div>
    </div>
  );
}

function RuleCard({
  label,
  current,
  floor,
  start,
  description,
  danger,
}: {
  label: string;
  current: number;
  floor: number;
  start: number;
  description: string;
  danger?: boolean;
}) {
  const distanceAboveFloor = Math.max(current - floor, 0);

  return (
    <div
      className={[
        "rounded-2xl border bg-black/30 p-4",
        danger ? "border-red-950" : "border-zinc-800",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">
            {label}
          </div>

          <div
            className={[
              "mt-2 text-lg font-semibold",
              danger ? "text-red-300" : "text-zinc-100",
            ].join(" ")}
          >
            {formatMoney(current)}
          </div>
        </div>

        <div
          className={[
            "rounded-full border px-2.5 py-1 text-[11px] font-medium",
            danger
              ? "border-red-900/70 text-red-300"
              : "border-zinc-800 text-zinc-400",
          ].join(" ")}
        >
          {danger ? "Breached" : `${formatMoney(distanceAboveFloor)} above`}
        </div>
      </div>

      <FloorBar current={current} floor={floor} start={start} />

      <p className="mt-3 text-xs leading-5 text-zinc-500">{description}</p>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-5">
      <h3 className="text-lg font-semibold tracking-tight text-zinc-100">
        {title}
      </h3>

      <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
        {description}
      </p>

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function BetCard({ bet }: { bet: BetRow }) {
  const pnl = getBetPnl(bet);
  const displayStatus = bet.result ?? bet.status;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold tracking-tight text-zinc-100">
            {bet.selection}
          </h3>

          <p className="mt-1 text-sm text-zinc-500">
            {bet.league?.toUpperCase()} · {formatOdds(bet.odds)}
          </p>
        </div>

        <div
          className={[
            "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium",
            statusColor(displayStatus),
          ].join(" ")}
        >
          {resultLabel(displayStatus)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-zinc-800 pt-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">
            Stake
          </div>
          <div className="mt-1 text-sm font-semibold text-zinc-100">
            {formatMoney(bet.stake)}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">
            Payout
          </div>
          <div className="mt-1 text-sm font-semibold text-zinc-100">
            {formatMoney(bet.potential_payout)}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">
            P/L
          </div>
          <div
            className={[
              "mt-1 text-sm font-semibold",
              pnl === null ? "text-zinc-100" : pnlColor(pnl),
            ].join(" ")}
          >
            {pnl === null ? "—" : formatSignedMoney(pnl)}
          </div>
        </div>
      </div>

      {bet.polymarket_winning_outcome ? (
        <div className="mt-3 border-t border-zinc-800 pt-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">
            Polymarket Result
          </div>
          <div className="mt-1 text-sm font-semibold text-zinc-100">
            {bet.polymarket_winning_outcome}
          </div>
        </div>
      ) : null}

      {bet.settlement_reason ? (
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">
          {bet.settlement_reason}
        </div>
      ) : null}

      {bet.polymarket_resolution_error && bet.status === "open" ? (
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">
          {bet.polymarket_resolution_error}
        </div>
      ) : null}

      <div className="mt-3 border-t border-zinc-800 pt-3 text-xs text-zinc-500">
        {bet.status === "open"
          ? `Placed ${formatDate(bet.placed_at)}`
          : `Settled ${formatDate(bet.settled_at)}`}
      </div>
    </div>
  );
}

export default async function AccountPage({ params }: AccountPageProps) {
  const { id } = await params;

  const { data: account, error } = await supabaseAdmin
    .from("challenge_accounts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!account) {
    notFound();
  }

  const today = getTodayNewYorkDate();

  const [{ data: bets, error: betsError }, { data: dailySnapshot }] =
    await Promise.all([
      supabaseAdmin
        .from("bets")
        .select(
          `
          id,
          selection,
          league,
          market,
          odds,
          stake,
          potential_profit,
          potential_payout,
          status,
          result,
          settlement_amount,
          settlement_reason,
          placed_at,
          settled_at,
          polymarket_winning_outcome,
          polymarket_resolution_error
        `
        )
        .eq("account_id", id)
        .order("placed_at", { ascending: false }),

      supabaseAdmin
        .from("account_daily_snapshots")
        .select("starting_balance")
        .eq("account_id", id)
        .eq("day", today)
        .maybeSingle(),
    ]);

  if (betsError) {
    throw betsError;
  }

  const plan = PLAN_CONFIG[account.plan_key as PlanKey];

  const startingBalance = Number(
    account.starting_balance ?? account.plan_size ?? 0
  );
  const currentBalance = Number(account.current_balance ?? 0);
  const reservedRisk = Number(account.reserved_risk ?? 0);
  const realizedPnl = Number(account.realized_pnl ?? 0);
  const ruleEquity = currentBalance + reservedRisk;

  const profitTargetPercent = Number(account.profit_target_percent ?? 30);
  const dailyDrawdownPercent = Number(account.daily_drawdown_percent ?? 10);
  const totalDrawdownPercent = Number(account.total_drawdown_percent ?? 20);

  const profitTargetBalance = startingBalance * (1 + profitTargetPercent / 100);

  const maxRiskAmount = Number(
    account.max_risk_amount ?? startingBalance * 0.05
  );

  const dailyLossLimit = Number(
    account.daily_loss_limit_amount ??
      startingBalance * (dailyDrawdownPercent / 100)
  );

  const totalLossLimit = Number(
    account.total_loss_limit_amount ??
      startingBalance * (totalDrawdownPercent / 100)
  );

  const dayStartingBalance = Number(
    dailySnapshot?.starting_balance ?? ruleEquity
  );

  const dailyFloor = dayStartingBalance - dailyLossLimit;
  const totalFloor = startingBalance - totalLossLimit;

  const allBets = (bets ?? []) as BetRow[];
  const openBets = allBets.filter((bet) => bet.status === "open");
  const pastBets = allBets.filter((bet) => bet.status !== "open");

  const fallbackAccountTitle =
    plan?.sizeLabel ??
    `${
      formatCompactAccountSize(Number(account.plan_size)) ||
      formatMoney(account.plan_size)
    } Account`;

  const accountName =
    typeof account.account_name === "string"
      ? account.account_name.trim()
      : "";

  const pageTitle = accountName
    ? accountName
    : `${fallbackAccountTitle} Challenge`;

  const targetProgress =
    profitTargetBalance > 0
      ? Math.min(Math.max((currentBalance / profitTargetBalance) * 100, 0), 100)
      : 0;

  const dailyDistance = Math.max(ruleEquity - dailyFloor, 0);
  const totalDistance = Math.max(ruleEquity - totalFloor, 0);
  const remainingToTarget = Math.max(profitTargetBalance - currentBalance, 0);

  return (
    <div className="min-h-screen bg-[#09090b] px-5 pt-20 pb-24 text-white md:pb-0 md:pt-0">
      <div className="mx-auto w-full max-w-5xl md:py-16">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Account Overview
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
            {pageTitle}
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Current balance, P/L, open risk, rules, and recent positions.
          </p>
        </div>

        {account.failure_reason ? (
          <div className="mb-6 rounded-[20px] border border-red-950 bg-red-950/20 p-4 text-sm text-red-300">
            {account.failure_reason}
          </div>
        ) : null}

        <div className="mb-6 rounded-[24px] border border-zinc-800 bg-zinc-950 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div
                className={[
                  "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
                  statusColor(account.status),
                ].join(" ")}
              >
                {resultLabel(String(account.status))}
              </div>

              <div className="mt-4 text-[42px] font-semibold leading-none tracking-tight text-zinc-100">
                {formatMoney(currentBalance)}
              </div>

              <p className="mt-2 text-sm text-zinc-500">Available balance</p>
            </div>

            <div className="min-w-[220px] rounded-2xl border border-zinc-800 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-zinc-500">Target</span>
                <span className="font-semibold text-zinc-100">
                  {formatMoney(profitTargetBalance)}
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-900">
                <div
                  className="h-full rounded-full bg-zinc-200"
                  style={{ width: `${targetProgress}%` }}
                />
              </div>

              <p className="mt-3 text-xs text-zinc-500">
                {remainingToTarget > 0
                  ? `${formatMoney(remainingToTarget)} left to target.`
                  : "Target reached. Account passes when no positions are open."}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Realized P/L"
              value={formatSignedMoney(realizedPnl)}
              valueClassName={pnlColor(realizedPnl)}
              sub="settled only"
            />

            <StatCard
              label="Rule Equity"
              value={formatMoney(ruleEquity)}
              sub="available + reserved"
            />

            <StatCard
              label="Reserved Risk"
              value={formatMoney(reservedRisk)}
              sub={`${openBets.length} open`}
            />

            <StatCard
              label="Max Bet"
              value={formatMoney(maxRiskAmount)}
              sub="fixed by size"
            />

            <StatCard
              label="Starting"
              value={formatMoney(startingBalance)}
              sub="initial balance"
            />
          </div>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <RuleCard
            label="Daily Floor"
            current={ruleEquity}
            floor={dailyFloor}
            start={dayStartingBalance}
            danger={ruleEquity <= dailyFloor}
            description={`Start-of-day balance ${formatMoney(
              dayStartingBalance
            )}. Daily loss limit ${formatMoney(
              dailyLossLimit
            )}. Distance from floor: ${formatMoney(dailyDistance)}.`}
          />

          <RuleCard
            label="Total Floor"
            current={ruleEquity}
            floor={totalFloor}
            start={startingBalance}
            danger={ruleEquity <= totalFloor}
            description={`Starting balance ${formatMoney(
              startingBalance
            )}. Total loss limit ${formatMoney(
              totalLossLimit
            )}. Distance from floor: ${formatMoney(totalDistance)}.`}
          />
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Account Size"
            value={formatMoney(account.plan_size)}
            sub={plan?.sizeLabel ?? undefined}
          />

          <StatCard label="Fee" value={formatMoney(account.one_time_fee)} />

          <StatCard
            label="Profit Target"
            value={formatPercent(profitTargetPercent)}
            sub={formatMoney(profitTargetBalance)}
          />

          <StatCard
            label="Positions"
            value={`${openBets.length} open`}
            sub={`${pastBets.length} past`}
          />
        </div>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
              Open Positions
            </h2>

            <div className="text-sm text-zinc-500">
              reserved: {formatMoney(reservedRisk)}
            </div>
          </div>

          {openBets.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {openBets.map((bet) => (
                <BetCard key={bet.id} bet={bet} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No open positions"
              description="This account has no active bets right now. New positions will appear here after a bet is placed."
              action={
                <Link
                  href="/"
                  className="inline-flex rounded-xl border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
                >
                  Browse markets
                </Link>
              }
            />
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-semibold tracking-tight text-zinc-100">
            Past Positions
          </h2>

          {pastBets.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {pastBets.map((bet) => (
                <BetCard key={bet.id} bet={bet} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No past positions"
              description="Settled wins, losses, and voids for this account will appear here."
            />
          )}
        </section>

        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Account ID
          </div>

          <div className="mt-2 break-all text-sm text-zinc-300">
            {account.id}
          </div>
        </div>
      </div>
    </div>
  );
}
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import type { PlanKey } from "@/lib/plans";

type ButtonStyle = "gold" | "silver" | "default";
type DepositChain = "solana" | "ethereum" | "bitcoin";
type DepositStep = "currency" | "fromAddress" | "deposit";

type DepositInvoice = {
  id: string;
  chain: DepositChain;
  asset: "SOL" | "ETH" | "BTC";
  deposit_address: string;
  expected_from_address: string;
  expected_amount_display: string;
  status: "pending" | "paid" | "expired" | "invalid";
  expires_at: string;
  tx_hash?: string | null;
  confirmations?: number | null;
  credited_account_id?: string | null;
};

const DEPOSIT_CHAINS: {
  label: string;
  asset: "SOL" | "ETH" | "BTC";
  value: DepositChain;
  description: string;
}[] = [
  {
    label: "Solana",
    asset: "SOL",
    value: "solana",
    description: "Fastest confirmation",
  },
];

function getButtonShellClassName(style: ButtonStyle) {
  if (style === "gold") return "bg-[#7b5a12]";
  if (style === "silver") return "bg-zinc-500";
  return "bg-zinc-800";
}

function getButtonFaceClassName(style: ButtonStyle) {
  if (style === "gold") {
    return "border border-[#6b5520] bg-linear-to-br from-[#e0b84b] via-[#cfa13a] to-[#b68b2d] text-[#120d02]";
  }

  if (style === "silver") {
    return "border border-zinc-400 bg-linear-to-br from-zinc-100 via-zinc-300 to-zinc-400 text-zinc-900";
  }

  return "border border-zinc-800 bg-zinc-900 text-zinc-100";
}

function getShimmerClassName(style: ButtonStyle) {
  if (style === "gold") {
    return "pointer-events-none absolute inset-y-[-35%] left-[-22%] w-[18%] skew-x-[-20deg] bg-[#fff6d5]/35 blur-md animate-[buttonShimmer_3.4s_ease-out_infinite]";
  }

  return "pointer-events-none absolute inset-y-[-35%] left-[-22%] w-[18%] skew-x-[-20deg] bg-white/35 blur-md animate-[buttonShimmer_3.4s_ease-out_infinite]";
}

function shortenAddress(address: string) {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function formatCountdown(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function StepDots({ step }: { step: DepositStep }) {
  const activeIndex =
    step === "currency" ? 0 : step === "fromAddress" ? 1 : 2;

  return (
    <div className="flex items-center justify-center gap-1.5">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={[
            "h-1.5 rounded-full transition-all",
            index === activeIndex ? "w-5 bg-zinc-100" : "w-1.5 bg-zinc-700",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

export default function ChallengeCta({
  cta,
  buttonStyle,
  shimmerEnabled,
  planKey,
}: {
  cta: string;
  buttonStyle: ButtonStyle;
  shimmerEnabled: boolean;
  planKey: PlanKey;
}) {
  const router = useRouter();
  const { ready, authenticated, user } = usePrivy();
  const { login } = useLogin();

  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<DepositStep>("currency");
  const [chain, setChain] = useState<DepositChain>("solana");
  const [fromAddress, setFromAddress] = useState("");
  const [invoice, setInvoice] = useState<DepositInvoice | null>(null);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const selectedChain = useMemo(
    () => DEPOSIT_CHAINS.find((item) => item.value === chain),
    [chain]
  );

  const privyUserId = user?.id ?? null;
  const email = user?.email?.address ?? null;
  const walletAddress =
    user?.wallet?.address ??
    user?.linkedAccounts?.find((account) => account.type === "wallet")
      ?.address ??
    null;

  const expiresAtMs = invoice?.expires_at
    ? new Date(invoice.expires_at).getTime()
    : null;

  const remainingMs = expiresAtMs ? expiresAtMs - nowMs : 0;
  const countdown = formatCountdown(remainingMs);

  const sharedClassName = [
    "relative inline-flex h-11 w-full cursor-pointer items-center justify-center overflow-hidden rounded-[16px] px-4 text-[15px] font-semibold transition-transform duration-100 hover:translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70",
    getButtonFaceClassName(buttonStyle),
  ].join(" ");

  const sharedStyle = {
    transform: "translateY(-2px)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
  } as const;

  function resetDepositFlow() {
    setStep("currency");
    setChain("solana");
    setFromAddress("");
    setInvoice(null);
    setError(null);
    setIsCreatingInvoice(false);
  }

  async function handleClick() {
    if (!ready) return;

    if (!authenticated) {
      login();
      return;
    }

    resetDepositFlow();
    setModalOpen(true);
  }

  async function createInvoice() {
    if (!privyUserId || isCreatingInvoice) return;

    try {
      setIsCreatingInvoice(true);
      setError(null);

      const response = await fetch("/api/crypto-deposits/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planKey,
          chain,
          fromAddress,
          privyUserId,
          email,
          walletAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to create deposit invoice.");
      }

      setInvoice(data.invoice);
      setStep("deposit");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to create deposit."
      );
    } finally {
      setIsCreatingInvoice(false);
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError("Unable to copy. Please copy it manually.");
    }
  }

  useEffect(() => {
    if (!modalOpen) return;

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen || !invoice?.id || !privyUserId) return;
    if (invoice.status === "paid" || invoice.status === "expired") return;

    const pollInvoice = async () => {
      try {
        const response = await fetch(
          `/api/crypto-deposits/${invoice.id}?privyUserId=${encodeURIComponent(
            privyUserId
          )}`
        );

        const data = await response.json();

        if (!response.ok) return;

        setInvoice(data.invoice);

        if (
          data.invoice?.status === "paid" &&
          data.invoice?.credited_account_id
        ) {
          router.refresh();
        }
      } catch {
        // Keep polling silently.
      }
    };

    pollInvoice();

    const interval = window.setInterval(pollInvoice, 5000);

    return () => window.clearInterval(interval);
  }, [invoice?.id, invoice?.status, modalOpen, privyUserId, router]);

  return (
    <>
      <div
        className={[
          "mt-4 inline-block w-full rounded-[16px]",
          getButtonShellClassName(buttonStyle),
        ].join(" ")}
        style={{ paddingBottom: "2px", lineHeight: 0 }}
      >
        <button
          type="button"
          onClick={handleClick}
          disabled={!ready}
          className={sharedClassName}
          style={sharedStyle}
        >
          {shimmerEnabled ? (
            <span
              aria-hidden="true"
              className={getShimmerClassName(buttonStyle)}
            />
          ) : null}

          <span className="relative z-10">{cta}</span>
        </button>
      </div>

      <AnimatePresence>
        {modalOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 pt-12 backdrop-blur-md sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setModalOpen(false);
              }
            }}
          >
            <motion.div
              className="w-full max-w-[430px] overflow-hidden rounded-[28px] border border-zinc-800 bg-[#09090b] text-white shadow-2xl"
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 330, damping: 30 }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="border-b border-zinc-900 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                      Edge checkout
                    </p>

                    <h2 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-zinc-50">
                      Start challenge
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[18px] leading-none text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                    aria-label="Close deposit modal"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-4">
                  <StepDots step={step} />
                </div>
              </div>

              <div className="relative min-h-[420px] px-5 py-5">
                <AnimatePresence mode="wait">
                  {step === "currency" ? (
                    <motion.div
                      key="currency"
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.2 }}
                      className="flex min-h-[390px] flex-col"
                    >
                      <div>
                        <h3 className="text-[18px] font-semibold tracking-tight text-zinc-50">
                          Choose deposit currency
                        </h3>

                        <p className="mt-1 text-[13px] leading-5 text-zinc-500">
                          Pick the crypto you want to use. The next step locks a
                          fixed deposit amount for 3 hours.
                        </p>
                      </div>

                      <div className="mt-5 grid gap-2">
                        {DEPOSIT_CHAINS.map((item) => {
                          const selected = item.value === chain;

                          return (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setChain(item.value)}
                              className={[
                                "flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition-colors",
                                selected
                                  ? "border-zinc-500 bg-zinc-900"
                                  : "border-zinc-900 bg-zinc-950 hover:border-zinc-800 hover:bg-zinc-900/70",
                              ].join(" ")}
                            >
                              <div>
                                <div className="text-[15px] font-semibold text-zinc-100">
                                  {item.asset}
                                </div>

                                <div className="mt-0.5 text-[12px] text-zinc-500">
                                  {item.description}
                                </div>
                              </div>

                              <div
                                className={[
                                  "flex h-7 min-w-7 items-center justify-center rounded-full border text-[11px] font-bold",
                                  selected
                                    ? "border-zinc-300 bg-zinc-100 text-zinc-950"
                                    : "border-zinc-800 text-zinc-500",
                                ].join(" ")}
                              >
                                {item.asset}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-auto pt-5">
                        <button
                          type="button"
                          onClick={() => setStep("fromAddress")}
                          className="h-12 w-full rounded-2xl bg-zinc-100 text-[15px] font-semibold text-zinc-950 transition-colors hover:bg-white"
                        >
                          Continue
                        </button>
                      </div>
                    </motion.div>
                  ) : null}

                  {step === "fromAddress" ? (
                    <motion.div
                      key="fromAddress"
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.2 }}
                      className="flex min-h-[390px] flex-col"
                    >
                      <div>
                        <h3 className="text-[18px] font-semibold tracking-tight text-zinc-50">
                          Sending address
                        </h3>

                        <p className="mt-1 text-[13px] leading-5 text-zinc-500">
                          Paste the {selectedChain?.asset} address you will send
                          from. The deposit must come from this exact address.
                        </p>
                      </div>

                      <div className="mt-5 rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
                        <label className="text-[12px] font-medium text-zinc-500">
                          Sending from
                        </label>

                        <input
                          value={fromAddress}
                          onChange={(event) =>
                            setFromAddress(event.target.value)
                          }
                          placeholder={`Paste ${selectedChain?.asset} wallet address`}
                          className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-[14px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                        />

                        <p className="mt-3 text-[12px] leading-5 text-zinc-600">
                          Do not send from Coinbase, Binance, or another
                          exchange if you require exact sender-address matching.
                        </p>
                      </div>

                      {error ? (
                        <div className="mt-3 rounded-2xl border border-red-950 bg-red-950/30 px-4 py-3 text-[13px] text-red-300">
                          {error}
                        </div>
                      ) : null}

                      <div className="mt-auto grid grid-cols-[96px_minmax(0,1fr)] gap-2 pt-5">
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setStep("currency");
                          }}
                          className="h-12 rounded-2xl bg-zinc-900 text-[14px] font-semibold text-zinc-300 transition-colors hover:bg-zinc-800"
                        >
                          Back
                        </button>

                        <button
                          type="button"
                          onClick={createInvoice}
                          disabled={!fromAddress.trim() || isCreatingInvoice}
                          className="h-12 rounded-2xl bg-zinc-100 text-[15px] font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isCreatingInvoice
                            ? "Creating..."
                            : "Create deposit"}
                        </button>
                      </div>
                    </motion.div>
                  ) : null}

                  {step === "deposit" && invoice ? (
                    <motion.div
                      key="deposit"
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.2 }}
                      className="flex min-h-[390px] flex-col"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-[18px] font-semibold tracking-tight text-zinc-50">
                            Send deposit
                          </h3>

                          <p className="mt-1 text-[13px] leading-5 text-zinc-500">
                            Send the exact amount before the timer expires.
                          </p>
                        </div>

                        <div
                          className={[
                            "rounded-full px-3 py-1 text-[12px] font-semibold capitalize",
                            invoice.status === "paid"
                              ? "bg-emerald-950/50 text-emerald-300"
                              : invoice.status === "expired"
                                ? "bg-red-950/50 text-red-300"
                                : "bg-zinc-900 text-zinc-300",
                          ].join(" ")}
                        >
                          {invoice.status}
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3">
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                          <p className="text-[12px] font-medium text-zinc-500">
                            Send exactly
                          </p>

                          <div className="mt-1 flex items-end justify-between gap-3">
                            <p className="break-all text-[24px] font-semibold leading-tight tracking-tight text-zinc-50">
                              {invoice.expected_amount_display}
                            </p>

                            <p className="pb-1 text-[13px] font-bold text-zinc-400">
                              {invoice.asset}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[12px] font-medium text-zinc-500">
                              Deposit address
                            </p>

                            <button
                              type="button"
                              onClick={() =>
                                copyText(invoice.deposit_address)
                              }
                              className="text-[12px] font-semibold text-zinc-300 hover:text-white"
                            >
                              Copy
                            </button>
                          </div>

                          <p className="mt-2 break-all text-[13px] leading-5 text-zinc-200">
                            {invoice.deposit_address}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
                          <p className="text-[12px] font-medium text-zinc-500">
                            Required sending address
                          </p>

                          <p className="mt-2 break-all text-[13px] leading-5 text-zinc-300">
                            {invoice.expected_from_address}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-zinc-950 p-4">
                            <p className="text-[12px] font-medium text-zinc-500">
                              Time left
                            </p>

                            <p className="mt-1 text-[18px] font-semibold text-zinc-100">
                              {invoice.status === "paid"
                                ? "Complete"
                                : invoice.status === "expired"
                                  ? "Expired"
                                  : countdown}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-zinc-950 p-4">
                            <p className="text-[12px] font-medium text-zinc-500">
                              Confirmations
                            </p>

                            <p className="mt-1 text-[18px] font-semibold text-zinc-100">
                              {invoice.confirmations ?? 0}
                            </p>
                          </div>
                        </div>
                      </div>

                      {invoice.status === "paid" &&
                      invoice.credited_account_id ? (
                        <div className="mt-auto pt-5">
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/accounts/${invoice.credited_account_id}`
                              )
                            }
                            className="h-12 w-full rounded-2xl bg-zinc-100 text-[15px] font-semibold text-zinc-950 transition-colors hover:bg-white"
                          >
                            Open account
                          </button>
                        </div>
                      ) : (
                        <div className="mt-auto pt-5">
                          <p className="text-center text-[12px] leading-5 text-zinc-600">
                            Waiting for {invoice.asset} payment from{" "}
                            {shortenAddress(invoice.expected_from_address)}.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
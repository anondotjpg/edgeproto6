import { Connection, PublicKey } from "@solana/web3.js";
import { DepositChain } from "@/lib/crypto-deposits";

export type DepositInvoice = {
  id: string;
  chain: DepositChain;
  asset: "SOL" | "ETH" | "BTC";
  deposit_address: string;
  expected_from_address: string;
  expected_amount_atomic: string;
  created_at: string;
  expires_at: string;
};

export type FoundPayment = {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amountAtomic: bigint;
  confirmations: number;
};

function sameAddress(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function findPaymentForInvoice(
  invoice: DepositInvoice
): Promise<FoundPayment | null> {
  if (invoice.chain !== "solana") {
    return null;
  }

  return findSolanaPayment(invoice);
}

async function findSolanaPayment(
  invoice: DepositInvoice
): Promise<FoundPayment | null> {
  const rpcUrl = process.env.SOLANA_RPC_URL;

  if (!rpcUrl) {
    throw new Error("Missing SOLANA_RPC_URL. Set it to your Helius RPC URL.");
  }

  const expectedAmount = BigInt(invoice.expected_amount_atomic);
  const invoiceCreatedAtMs = new Date(invoice.created_at).getTime();
  const invoiceExpiresAtMs = new Date(invoice.expires_at).getTime();

  const connection = new Connection(rpcUrl, "confirmed");
  const depositPubkey = new PublicKey(invoice.deposit_address);

  const signatures = await connection.getSignaturesForAddress(depositPubkey, {
    limit: 15,
  });

  const candidateSignatures = signatures.filter((signature) => {
    if (signature.err) return false;
    if (!signature.blockTime) return true;

    const blockTimeMs = signature.blockTime * 1000;

    return (
      blockTimeMs >= invoiceCreatedAtMs - 60_000 &&
      blockTimeMs <= invoiceExpiresAtMs + 60_000
    );
  });

  for (const signatureInfo of candidateSignatures) {
    const tx = await connection.getParsedTransaction(signatureInfo.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) continue;

    for (const ix of tx.transaction.message.instructions) {
      if (!("parsed" in ix)) continue;

      const parsed = ix.parsed as {
        type?: string;
        info?: {
          source?: string;
          destination?: string;
          lamports?: number | string;
        };
      };

      if (ix.program !== "system") continue;
      if (parsed.type !== "transfer") continue;

      const source = String(parsed.info?.source || "");
      const destination = String(parsed.info?.destination || "");
      const lamports = BigInt(parsed.info?.lamports || 0);

      if (!sameAddress(source, invoice.expected_from_address)) continue;
      if (!sameAddress(destination, invoice.deposit_address)) continue;
      if (lamports !== expectedAmount) continue;

      return {
        txHash: signatureInfo.signature,
        fromAddress: source,
        toAddress: destination,
        amountAtomic: lamports,
        confirmations: 1,
      };
    }
  }

  return null;
}

export function hasEnoughConfirmations({
  chain,
  confirmations,
}: {
  chain: DepositChain;
  confirmations: number;
}) {
  if (chain !== "solana") return false;

  return confirmations >= 1;
}
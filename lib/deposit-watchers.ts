import { Connection, PublicKey } from "@solana/web3.js";
import { parseUnits } from "viem";
import {
  CHAIN_CONFIG,
  DepositChain,
  hasEnoughConfirmations,
} from "@/lib/crypto-deposits";

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
  if (invoice.chain === "solana") {
    return findSolanaPayment(invoice);
  }

  if (invoice.chain === "ethereum") {
    return findEthereumPayment(invoice);
  }

  if (invoice.chain === "bitcoin") {
    return findBitcoinPayment(invoice);
  }

  return null;
}

async function findSolanaPayment(
  invoice: DepositInvoice
): Promise<FoundPayment | null> {
  const rpcUrl = process.env.SOLANA_RPC_URL;

  if (!rpcUrl) {
    throw new Error("Missing SOLANA_RPC_URL");
  }

  const expectedAmount = BigInt(invoice.expected_amount_atomic);

  const connection = new Connection(rpcUrl, "finalized");
  const depositPubkey = new PublicKey(invoice.deposit_address);

  const signatures = await connection.getSignaturesForAddress(depositPubkey, {
    limit: 50,
  });

  for (const sig of signatures) {
    if (sig.err) continue;

    const tx = await connection.getParsedTransaction(sig.signature, {
      commitment: "finalized",
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
        txHash: sig.signature,
        fromAddress: source,
        toAddress: destination,
        amountAtomic: lamports,
        confirmations: 1,
      };
    }
  }

  return null;
}

async function findEthereumPayment(
  invoice: DepositInvoice
): Promise<FoundPayment | null> {
  const alchemyUrl = process.env.ALCHEMY_ETH_URL;

  if (!alchemyUrl) {
    throw new Error("Missing ALCHEMY_ETH_URL");
  }

  const expectedAmount = BigInt(invoice.expected_amount_atomic);

  const transfersRes = await fetch(alchemyUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "alchemy_getAssetTransfers",
      params: [
        {
          fromBlock: "0x0",
          toBlock: "latest",
          fromAddress: invoice.expected_from_address,
          toAddress: invoice.deposit_address,
          category: ["external"],
          withMetadata: true,
          excludeZeroValue: true,
          maxCount: "0x64",
          order: "desc",
        },
      ],
    }),
  });

  const transfersJson = await transfersRes.json();

  const latestBlockRes = await fetch(alchemyUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "eth_blockNumber",
      params: [],
    }),
  });

  const latestBlockJson = await latestBlockRes.json();
  const latestBlock = Number.parseInt(latestBlockJson.result, 16);

  const transfers = transfersJson?.result?.transfers ?? [];

  for (const transfer of transfers) {
    const from = String(transfer.from || "");
    const to = String(transfer.to || "");

    if (!sameAddress(from, invoice.expected_from_address)) continue;
    if (!sameAddress(to, invoice.deposit_address)) continue;

    let amountAtomic: bigint;

    if (transfer.rawContract?.value) {
      amountAtomic = BigInt(transfer.rawContract.value);
    } else {
      amountAtomic = parseUnits(String(transfer.value), CHAIN_CONFIG.ethereum.decimals);
    }

    if (amountAtomic !== expectedAmount) continue;

    const txBlock = Number.parseInt(transfer.blockNum, 16);
    const confirmations = latestBlock - txBlock + 1;

    return {
      txHash: transfer.hash,
      fromAddress: from,
      toAddress: to,
      amountAtomic,
      confirmations,
    };
  }

  return null;
}

async function findBitcoinPayment(
  invoice: DepositInvoice
): Promise<FoundPayment | null> {
  const baseUrl =
    process.env.BLOCKSTREAM_API_URL || "https://blockstream.info/api";

  const expectedAmount = BigInt(invoice.expected_amount_atomic);

  const [confirmedRes, mempoolRes, tipHeightRes] = await Promise.all([
    fetch(`${baseUrl}/address/${invoice.deposit_address}/txs`),
    fetch(`${baseUrl}/address/${invoice.deposit_address}/txs/mempool`),
    fetch(`${baseUrl}/blocks/tip/height`),
  ]);

  if (!confirmedRes.ok || !mempoolRes.ok || !tipHeightRes.ok) {
    throw new Error("Unable to read Bitcoin transactions.");
  }

  const confirmedTxs = await confirmedRes.json();
  const mempoolTxs = await mempoolRes.json();
  const tipHeight = Number(await tipHeightRes.text());

  const txs = [...mempoolTxs, ...confirmedTxs];

  for (const tx of txs) {
    const matchingOutput = tx.vout?.find((output: any) => {
      return (
        output.scriptpubkey_address === invoice.deposit_address &&
        BigInt(output.value) === expectedAmount
      );
    });

    if (!matchingOutput) continue;

    const matchingInput = tx.vin?.some((input: any) => {
      return (
        input.prevout?.scriptpubkey_address ===
        invoice.expected_from_address
      );
    });

    if (!matchingInput) continue;

    const confirmed = Boolean(tx.status?.confirmed);
    const blockHeight = tx.status?.block_height;

    const confirmations =
      confirmed && blockHeight ? tipHeight - Number(blockHeight) + 1 : 0;

    return {
      txHash: tx.txid,
      fromAddress: invoice.expected_from_address,
      toAddress: invoice.deposit_address,
      amountAtomic: expectedAmount,
      confirmations,
    };
  }

  return null;
}

export { hasEnoughConfirmations };
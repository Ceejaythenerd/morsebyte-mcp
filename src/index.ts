#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const API_BASE = "https://api.morsebyte.co.za";

function getPaidFetch() {
  const pk = process.env.EVM_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) return globalThis.fetch;
  const account = privateKeyToAccount(pk);
  return wrapFetchWithPaymentFromConfig(globalThis.fetch, {
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
  });
}

const server = new McpServer({
  name: "morsebyte-x402-refinery",
  version: "1.1.0",
});

server.tool(
  "morsebyte_refine_url",
  "Fetch any public URL and extract clean LLM-ready text and metadata ($0.015 USDC via x402)",
  { url: z.string().url().describe("Public HTTPS URL to scrape and refine") },
  async ({ url }) => {
    const res = await getPaidFetch()(`${API_BASE}/v1/refine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    return { content: [{ type: "text", text: await res.text() }] };
  }
);

server.tool(
  "morsebyte_verify_links",
  "Deterministically verify up to 20 URLs in parallel for HTTP status, liveness, and redirects ($0.005 USDC via x402)",
  { urls: z.array(z.string().url()).max(20).describe("Array of URLs to audit (max 20)") },
  async ({ urls }) => {
    const res = await getPaidFetch()(`${API_BASE}/v1/verify-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls }),
    });
    return { content: [{ type: "text", text: await res.text() }] };
  }
);

server.tool(
  "morsebyte_extract_json",
  "Scrape any URL and extract structured JSON matching a custom prompt via Cloudflare Workers AI ($0.030 USDC via x402)",
  {
    url: z.string().url().describe("Target HTTPS URL to scrape"),
    prompt: z.string().describe("Instructions on what fields or entities to extract into JSON"),
  },
  async ({ url, prompt }) => {
    const res = await getPaidFetch()(`${API_BASE}/v1/extract-json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, prompt }),
    });
    return { content: [{ type: "text", text: await res.text() }] };
  }
);

server.tool(
  "morsebyte_quant_regime",
  "Compute RSI-14, EMA-20/50 alignment, volatility, and momentum/mean-reversion regime from closing prices ($0.050 USDC via x402)",
  {
    symbol: z.string().optional().describe("Ticker symbol, e.g. BTCUSD, XAUUSD, V75"),
    closes: z.array(z.number()).min(30).describe("Array of chronological closing prices (min 30)"),
  },
  async ({ symbol, closes }) => {
    const res = await getPaidFetch()(`${API_BASE}/v1/quant-regime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, closes }),
    });
    return { content: [{ type: "text", text: await res.text() }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP Server error:", err);
  process.exit(1);
});

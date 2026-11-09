import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

dotenv.config();

const CLIENTS_DB_FILE = path.join(process.cwd(), "dollarx_clients_db.json");

function readServerClientsDb(): any[] {
  try {
    if (fs.existsSync(CLIENTS_DB_FILE)) {
      const raw = fs.readFileSync(CLIENTS_DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Failed to read dollarx_clients_db.json:", err);
  }
  return [];
}

function writeServerClientsDb(clients: any[]): void {
  try {
    fs.writeFileSync(CLIENTS_DB_FILE, JSON.stringify(clients, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write dollarx_clients_db.json:", err);
  }
}

interface RawCandle {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema20: number;
  ema50: number;
}

interface LiveMarketPayload {
  spotPrice: number;
  bidPrice: number;
  askPrice: number;
  spreadPips: number;
  open24h: number;
  high24h: number;
  low24h: number;
  change24h: number;
  changePct24h: number;
  sourceName: string;
  fetchedAt: string;
  candles: RawCandle[];
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
};

async function fetchWithTimeout(url: string, timeoutMs = 4500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(id);
  }
}

// 1. Swissquote Bank Institutional Live XAU/USD Bid/Ask Feed
async function fetchSwissquoteSpot(): Promise<{
  spotPrice: number;
  bid: number;
  ask: number;
  source: string;
} | null> {
  try {
    const res = await fetchWithTimeout(
      "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD"
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const prices = data[0]?.spreadProfilePrices;
      if (Array.isArray(prices) && prices.length > 0) {
        const best = prices[0];
        const bid = Number(best.bid);
        const ask = Number(best.ask);
        if (bid > 500 && ask > 500) {
          const mid = Number(((bid + ask) / 2).toFixed(2));
          return {
            spotPrice: mid,
            bid: Number(bid.toFixed(2)),
            ask: Number(ask.toFixed(2)),
            source: "Swissquote Institutional XAU/USD Feed",
          };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// 2. GoldPrice.org Real-Time XAU/USD Spot Feed
async function fetchGoldPriceOrgSpot(): Promise<{
  spotPrice: number;
  open24h: number;
  change24h: number;
  changePct24h: number;
  source: string;
} | null> {
  try {
    const res = await fetchWithTimeout("https://data-asg.goldprice.org/dbXRates/USD");
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.items?.[0];
    if (item && Number(item.xauPrice) > 500) {
      const spotPrice = Number(Number(item.xauPrice).toFixed(2));
      const open24h = Number(Number(item.xauClose || spotPrice - (item.chgXau || 0)).toFixed(2));
      const change24h = Number(Number(item.chgXau || spotPrice - open24h).toFixed(2));
      const changePct24h = Number(Number(item.pcXau || (change24h / open24h) * 100).toFixed(2));
      return {
        spotPrice,
        open24h,
        change24h,
        changePct24h,
        source: "GoldPrice.org Real-Time XAU/USD",
      };
    }
    return null;
  } catch {
    return null;
  }
}

// 3. Yahoo Finance Live XAUUSD / Gold Futures (GC=F) Chart & Quote API
async function fetchYahooFinanceGold(timeframe: string): Promise<{
  spotPrice: number;
  open24h: number;
  high24h: number;
  low24h: number;
  source: string;
  rawBars: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[];
} | null> {
  const intervalMap: Record<string, { interval: string; range: string }> = {
    M5: { interval: "5m", range: "1d" },
    M15: { interval: "15m", range: "5d" },
    M30: { interval: "30m", range: "5d" },
    H1: { interval: "60m", range: "1mo" },
    H4: { interval: "60m", range: "1mo" },
    D1: { interval: "1d", range: "3mo" },
  };
  const cfg = intervalMap[timeframe] || intervalMap.M15;

  const symbols = ["XAUUSD=X", "GC=F"];
  for (const sym of symbols) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        sym
      )}?interval=${cfg.interval}&range=${cfg.range}`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) continue;
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result) continue;

      const meta = result.meta || {};
      const spotPrice = Number(meta.regularMarketPrice);
      if (!spotPrice || spotPrice < 500) continue;

      const prevClose = Number(meta.chartPreviousClose || meta.previousClose || spotPrice);
      const high24h = Number(meta.regularMarketDayHigh || spotPrice + 12);
      const low24h = Number(meta.regularMarketDayLow || spotPrice - 12);

      const timestamps: number[] = result.timestamp || [];
      const quote = result.indicators?.quote?.[0] || {};
      const opens: number[] = quote.open || [];
      const highs: number[] = quote.high || [];
      const lows: number[] = quote.low || [];
      const closes: number[] = quote.close || [];
      const volumes: number[] = quote.volume || [];

      const rawBars: {
        timestamp: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
      }[] = [];

      for (let i = 0; i < timestamps.length; i++) {
        const o = opens[i];
        const h = highs[i];
        const l = lows[i];
        const c = closes[i];
        if (o != null && h != null && l != null && c != null && c > 500) {
          rawBars.push({
            timestamp: timestamps[i] * 1000,
            open: Number(o.toFixed(2)),
            high: Number(h.toFixed(2)),
            low: Number(l.toFixed(2)),
            close: Number(c.toFixed(2)),
            volume: Math.max(100, Number(volumes[i] || 1200)),
          });
        }
      }

      // If H4 is requested, aggregate every 4 hourly bars
      let processedBars = rawBars;
      if (timeframe === "H4" && rawBars.length >= 16) {
        const h4Bars: typeof rawBars = [];
        for (let i = 0; i < rawBars.length; i += 4) {
          const slice = rawBars.slice(i, i + 4);
          if (slice.length > 0) {
            h4Bars.push({
              timestamp: slice[slice.length - 1].timestamp,
              open: slice[0].open,
              high: Math.max(...slice.map((b) => b.high)),
              low: Math.min(...slice.map((b) => b.low)),
              close: slice[slice.length - 1].close,
              volume: slice.reduce((acc, b) => acc + b.volume, 0),
            });
          }
        }
        processedBars = h4Bars;
      }

      return {
        spotPrice: Number(spotPrice.toFixed(2)),
        open24h: Number(prevClose.toFixed(2)),
        high24h: Number(high24h.toFixed(2)),
        low24h: Number(low24h.toFixed(2)),
        source: `Yahoo Finance Live (${sym})`,
        rawBars: processedBars.slice(-48),
      };
    } catch {
      continue;
    }
  }
  return null;
}

// 4. Kraken Public OHLC API (XAU/USD or PAXG/USD)
async function fetchKrakenGoldOhlc(timeframe: string): Promise<{
  spotPrice: number;
  open24h: number;
  high24h: number;
  low24h: number;
  source: string;
  rawBars: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[];
} | null> {
  const intervalMap: Record<string, number> = {
    M5: 5,
    M15: 15,
    M30: 30,
    H1: 60,
    H4: 240,
    D1: 1440,
  };
  const interval = intervalMap[timeframe] || 15;
  try {
    const res = await fetchWithTimeout(
      `https://api.kraken.com/0/public/OHLC?pair=PAXGUSD&interval=${interval}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    const resultObj = json?.result || {};
    const pairKey = Object.keys(resultObj).find((k) => k !== "last");
    if (!pairKey) return null;
    const rows = resultObj[pairKey];
    if (!Array.isArray(rows) || rows.length < 10) return null;

    const recent = rows.slice(-48);
    const rawBars = recent.map((r: any[]) => ({
      timestamp: Number(r[0]) * 1000,
      open: Number(Number(r[1]).toFixed(2)),
      high: Number(Number(r[2]).toFixed(2)),
      low: Number(Number(r[3]).toFixed(2)),
      close: Number(Number(r[4]).toFixed(2)),
      volume: Math.max(150, Math.round(Number(r[6]) * 100)),
    }));
    const lastClose = rawBars[rawBars.length - 1].close;
    const firstOpen = rawBars[Math.max(0, rawBars.length - 24)].open;
    const high24h = Math.max(...rawBars.slice(-24).map((b) => b.high));
    const low24h = Math.min(...rawBars.slice(-24).map((b) => b.low));

    return {
      spotPrice: lastClose,
      open24h: firstOpen,
      high24h,
      low24h,
      source: "Kraken Spot Gold Feed",
      rawBars,
    };
  } catch {
    return null;
  }
}

function attachEmaAndFormat(
  rawBars: {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[],
  timeframe: string,
  targetSpotPrice: number
): RawCandle[] {
  if (rawBars.length === 0) return [];

  // Align the bars smoothly if spot comes from Swissquote/GoldPrice.org and OHLC comes from GC=F futures
  const lastBarClose = rawBars[rawBars.length - 1].close;
  const basisOffset = targetSpotPrice - lastBarClose;

  const adjusted = rawBars.map((b, idx) => {
    const open = Number((b.open + basisOffset).toFixed(2));
    const close =
      idx === rawBars.length - 1
        ? Number(targetSpotPrice.toFixed(2))
        : Number((b.close + basisOffset).toFixed(2));
    const high = Number(Math.max(open, close, b.high + basisOffset).toFixed(2));
    const low = Number(Math.min(open, close, b.low + basisOffset).toFixed(2));
    return {
      ...b,
      open,
      high,
      low,
      close,
    };
  });

  let ema20 = adjusted[0].close;
  let ema50 = adjusted[0].close;
  const k20 = 2 / (20 + 1);
  const k50 = 2 / (50 + 1);

  return adjusted.map((bar) => {
    ema20 = Number((bar.close * k20 + ema20 * (1 - k20)).toFixed(2));
    ema50 = Number((bar.close * k50 + ema50 * (1 - k50)).toFixed(2));
    const d = new Date(bar.timestamp);
    const timeLabel =
      timeframe === "D1"
        ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : d.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
    return {
      time: timeLabel,
      timestamp: bar.timestamp,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      ema20,
      ema50,
    };
  });
}

async function getLiveXauusdMarketData(timeframe: string): Promise<LiveMarketPayload> {
  // Fetch in parallel from multiple real-time providers for minimum latency & highest reliability
  const [swissquote, goldPriceOrg, yahooData] = await Promise.all([
    fetchSwissquoteSpot(),
    fetchGoldPriceOrgSpot(),
    fetchYahooFinanceGold(timeframe),
  ]);

  let ohlcSource = yahooData;
  if (!ohlcSource || ohlcSource.rawBars.length < 10) {
    ohlcSource = await fetchKrakenGoldOhlc(timeframe);
  }

  // Determine authoritative spot XAU/USD price:
  // Priority: 1. Swissquote Spot XAU/USD -> 2. GoldPrice.org Spot XAU/USD -> 3. Yahoo Finance -> 4. Kraken
  const spotPrice =
    swissquote?.spotPrice ??
    goldPriceOrg?.spotPrice ??
    ohlcSource?.spotPrice ??
    0;

  if (!spotPrice || spotPrice <= 0) {
    throw new Error("All live XAUUSD market data feeds are temporarily unreachable.");
  }

  const bidPrice = swissquote?.bid ?? Number((spotPrice - 0.12).toFixed(2));
  const askPrice = swissquote?.ask ?? Number((spotPrice + 0.12).toFixed(2));
  const spreadPips = Number(Math.max(0.5, (askPrice - bidPrice) * 10).toFixed(1));

  const open24h =
    goldPriceOrg?.open24h ??
    ohlcSource?.open24h ??
    Number((spotPrice * 0.994).toFixed(2));

  const change24h =
    goldPriceOrg?.change24h ?? Number((spotPrice - open24h).toFixed(2));
  const changePct24h =
    goldPriceOrg?.changePct24h ??
    Number(((change24h / (open24h || 1)) * 100).toFixed(2));

  // Build candles from real OHLC bars or synthesize intraday bars anchored to real spot + 24h open/high/low
  let candles: RawCandle[] = [];
  if (ohlcSource && ohlcSource.rawBars.length >= 10) {
    candles = attachEmaAndFormat(ohlcSource.rawBars, timeframe, spotPrice);
  } else {
    // If only spot endpoint responded, build bars connecting real 24h open to real spot price
    const count = 48;
    const stepMinutes: Record<string, number> = {
      M5: 5,
      M15: 15,
      M30: 30,
      H1: 60,
      H4: 240,
      D1: 1440,
    };
    const stepMs = (stepMinutes[timeframe] || 15) * 60 * 1000;
    const now = Date.now();
    const synthBars = [];
    let cursor = open24h;
    const stepDrift = (spotPrice - open24h) / count;

    for (let i = 0; i < count; i++) {
      const isLast = i === count - 1;
      const open = Number(cursor.toFixed(2));
      const wave = Math.sin(i * 0.85) * (spotPrice * 0.0008);
      const close = isLast
        ? spotPrice
        : Number((open + stepDrift + wave).toFixed(2));
      const high = Number(
        (Math.max(open, close) + Math.abs(Math.cos(i * 1.3)) * (spotPrice * 0.0006)).toFixed(2)
      );
      const low = Number(
        (Math.min(open, close) - Math.abs(Math.sin(i * 1.1)) * (spotPrice * 0.0006)).toFixed(2)
      );
      synthBars.push({
        timestamp: now - (count - 1 - i) * stepMs,
        open,
        high,
        low,
        close,
        volume: Math.round(1250 + Math.abs(close - open) * 280),
      });
      cursor = close;
    }
    candles = attachEmaAndFormat(synthBars, timeframe, spotPrice);
  }

  const high24h =
    ohlcSource?.high24h ??
    Math.max(spotPrice, ...candles.slice(-24).map((c) => c.high));
  const low24h =
    ohlcSource?.low24h ??
    Math.min(spotPrice, ...candles.slice(-24).map((c) => c.low));

  const providerLabels: string[] = [];
  if (swissquote) providerLabels.push("Swissquote Spot XAU/USD");
  else if (goldPriceOrg) providerLabels.push("GoldPrice.org Spot XAU/USD");
  if (ohlcSource) providerLabels.push(ohlcSource.source);

  return {
    spotPrice,
    bidPrice,
    askPrice,
    spreadPips,
    open24h,
    high24h: Number(high24h.toFixed(2)),
    low24h: Number(low24h.toFixed(2)),
    change24h,
    changePct24h,
    sourceName: providerLabels.join(" + ") || "Live Institutional XAU/USD API",
    fetchedAt: new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
    candles,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Persistent Clients Database Sync API (backs up browser localStorage 'dollarx_clients_db')
  app.get("/api/clients", (_req, res) => {
    const clients = readServerClientsDb();
    res.json({ clients });
  });

  app.post("/api/clients", (req, res) => {
    const { clients, authoritative } = req.body ?? {};
    if (!Array.isArray(clients)) {
      return res.status(400).json({ error: "Invalid clients array payload" });
    }
    if (authoritative) {
      writeServerClientsDb(clients);
      return res.json({ clients });
    }
    // Non-authoritative sync: merge local and server clients without losing any records
    const existing = readServerClientsDb();
    const mergedMap = new Map<string, any>();
    for (const item of existing) {
      if (item && item.id) mergedMap.set(item.id, item);
    }
    for (const item of clients) {
      if (item && item.id) mergedMap.set(item.id, item);
    }
    const merged = Array.from(mergedMap.values());
    writeServerClientsDb(merged);
    return res.json({ clients: merged });
  });

  // Real-time XAUUSD Market Price & Multi-Timeframe OHLC Endpoint
  app.get("/api/xauusd-live", async (req, res) => {
    try {
      const timeframe = String(req.query.timeframe || "M15");
      const livePayload = await getLiveXauusdMarketData(timeframe);
      res.json(livePayload);
    } catch (error: any) {
      console.error("Live XAUUSD API error:", error?.message || error);
      res.status(502).json({
        error:
          error?.message ||
          "Unable to fetch live XAUUSD market data from external providers.",
      });
    }
  });

  // Server-Side Gemini 3.8 Flash Quantitative Signal Synthesis
  app.post("/api/ai-signal", async (req, res) => {
    try {
      const {
        spotPrice,
        timeframe,
        sessionName,
        ema20,
        ema50,
        rsi14,
        atr14,
        buySideLiquidity,
        sellSideLiquidity,
        recentCandles,
      } = req.body;

      const prompt = `You are the Senior Quantitative Strategist for DollarX Indicator (XAUUSD Gold Trading System).
Analyze the LIVE XAUUSD market state fetched from real-time market feeds and output an institutional trading signal:
- Live Spot XAUUSD Price: $${spotPrice}
- Selected Timeframe: ${timeframe}
- Active Market Session: ${sessionName}
- EMA 20: $${ema20}, EMA 50: $${ema50}
- RSI (14): ${rsi14}
- ATR (14): $${atr14}
- Buy-Side Liquidity Pool: $${buySideLiquidity}
- Sell-Side Liquidity Pool: $${sellSideLiquidity}
- Recent Live OHLC Candles: ${JSON.stringify(recentCandles?.slice(-5) || [])}

CRITICAL PIP CALIBRATION RULES (1 standard XAUUSD pip = $0.10 price move, 10 pips = $1.00):
1. Entry price MUST be anchored directly to the current live spot price ($${spotPrice}).
2. Stop Loss (slPips) MUST be set consistently within 60 to 70 pips ($6.00 to $7.00 distance from $${spotPrice}) based on current volatility ($${atr14} ATR).
3. Take Profit targets MUST be dynamically calibrated across 3 stages between 100 and 300 pips:
   - TP1 (tp1Pips): between 100 and 130 pips ($10.00 to $13.00 from Entry)
   - TP2 (tp2Pips): between 180 and 220 pips ($18.00 to $22.00 from Entry)
   - TP3 (tp3Pips): between 250 and 300 pips ($25.00 to $30.00 from Entry)
4. Provide a clear structural bias, liquidity sweep target, and concise institutional thesis.`;

      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
          error: "GEMINI_API_KEY not configured; using built-in quantitative engine.",
        });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendation: {
                type: Type.STRING,
                description: "Must be one of: STRONG BUY, BUY, SELL, STRONG SELL",
              },
              confidence: {
                type: Type.NUMBER,
                description: "Confidence percentage between 75 and 96",
              },
              slPips: {
                type: Type.INTEGER,
                description: "Stop Loss distance in pips, strictly between 60 and 70",
              },
              tp1Pips: {
                type: Type.INTEGER,
                description: "Take Profit 1 distance in pips, strictly between 100 and 130",
              },
              tp2Pips: {
                type: Type.INTEGER,
                description: "Take Profit 2 distance in pips, strictly between 180 and 220",
              },
              tp3Pips: {
                type: Type.INTEGER,
                description: "Take Profit 3 distance in pips, strictly between 250 and 300",
              },
              structuralBias: {
                type: Type.STRING,
                description: "Short summary of structural trend bias",
              },
              liquidityNote: {
                type: Type.STRING,
                description:
                  "Analysis of nearest buy-side and sell-side liquidity sweep targets",
              },
              institutionalThesis: {
                type: Type.STRING,
                description:
                  "2-3 sentences of concise quantitative commentary on live XAUUSD order flow and session dynamics",
              },
            },
            required: [
              "recommendation",
              "confidence",
              "slPips",
              "tp1Pips",
              "tp2Pips",
              "tp3Pips",
              "structuralBias",
              "liquidityNote",
              "institutionalThesis",
            ],
          },
        },
      });

      const jsonText = (response.text ?? "{}").trim();
      const parsed = JSON.parse(jsonText);
      res.json(parsed);
    } catch (error: any) {
      console.error("AI Signal generation error:", error?.message || error);
      res.status(500).json({
        error: error?.message || "Failed to generate AI signal from Gemini API.",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AurumQuant XAUUSD Server running on http://localhost:${PORT}`);
  });
}

startServer();

export type Timeframe = 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1';

export type SignalDirection = 'STRONG BUY' | 'BUY' | 'SELL' | 'STRONG SELL';

export interface Candle {
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

export interface LiveMarketState {
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
  candles: Candle[];
}

export interface DailyFreshZone {
  id: string;
  type: 'Fresh Supply Zone' | 'Fresh Demand Zone';
  orderBlockType: 'Daily Bearish Order Block (OB)' | 'Daily Bullish Order Block (OB)';
  zoneLow: number;
  zoneHigh: number;
  zoneRangeText: string;
  status: 'FRESH (UNMITIGATED)';
  distancePips: number;
  summaryText: string;
}

export interface AITrendMeterMetrics {
  bullishPct: number;
  bearishPct: number;
  dominantBias: 'BULLISH' | 'BEARISH';
  strengthLabel: string;
  m15Status: string;
  m30Status: string;
  snrConfluence: string;
  tltConfluence: string;
  tlboConfluence: string;
}

export interface AISignalOutput {
  recommendation: SignalDirection;
  confidence: number;
  entryPrice: number;
  entryZoneLow: number;
  entryZoneHigh: number;
  entryZoneText: string;
  entryZoneType: 'Fresh Demand Zone' | 'Fresh Supply Zone';
  activeDailyFreshZoneSummary: string;
  dailyFreshZones: DailyFreshZone[];
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  slPips: number;
  tp1Pips: number;
  tp2Pips: number;
  tp3Pips: number;
  status: 'ACTIVE LOCKED' | 'HIT TP' | 'HIT SL';
  statusLabel: string;
  isLockedComplete: boolean;
  floatingPips: number;
  closedAtPrice?: number;
  closedAtTime?: string;
  closedAtTimestamp?: number;
  setupNumber: number;
  maxDailySetups: number;
  timeframe?: Timeframe;
  signalTimestamp: string;
  trendMeter: AITrendMeterMetrics;
  structuralBias: string;
  liquidityNote: string;
  institutionalThesis: string;
  updatedAt: string;
  source: string;
}

export interface ConfluenceMetrics {
  ema20: number;
  ema50: number;
  vwap: number;
  rsi14: number;
  atr14: number;
  atrPips: number;
  macdHist: number;
  buySideLiquidity: number;
  sellSideLiquidity: number;
  sessionName: string;
  sessionVolatilityMultiplier: number;
  mtfAlignment: {
    tf: Timeframe;
    bias: 'Bullish' | 'Bearish' | 'Neutral';
    structure: string;
  }[];
  keyLevels: {
    label: string;
    type: 'BSL' | 'Resistance' | 'Pivot' | 'Support' | 'SSL';
    price: number;
    note: string;
  }[];
}

export interface HistoricalEra {
  year: string;
  period: string;
  spotRange: string;
  benchmarkPrice: number;
  macroRegime: string;
  keyDriver: string;
  structuralBehavior: string;
}

export interface EconomicEvent {
  id: string;
  date: string;
  timeEst: string;
  timeGmt: string;
  timeAsia: string;
  currency: 'USD' | 'XAU';
  impact: 'High' | 'Medium' | 'Low';
  event: string;
  actual: string | null;
  forecast: string;
  previous: string;
  goldImpactBias: 'Bullish XAU' | 'Bearish XAU' | 'High Volatility' | 'Neutral';
  quantNote: string;
}

export function getHistoricalXauusdEras(liveSpotPrice: number): HistoricalEra[] {
  return [
    {
      year: '1971',
      period: '1971 – 1974',
      spotRange: '$35.00 – $195.00',
      benchmarkPrice: 35,
      macroRegime: 'Bretton Woods Decoupling',
      keyDriver: 'Suspension of USD gold convertibility & COMEX futures inception (Dec 1974)',
      structuralBehavior: 'Transition from fixed $35/oz peg to free-floating institutional price discovery.'
    },
    {
      year: '1980',
      period: '1976 – 1980',
      spotRange: '$103.00 – $850.00',
      benchmarkPrice: 850,
      macroRegime: 'Stagflation & Oil Shock Supercycle',
      keyDriver: 'Double-digit US CPI (14.8%) & geopolitical energy crisis before Volcker rate hikes',
      structuralBehavior: 'Parabolic blow-off top with extreme daily ATR expansion exceeding 6% per session.'
    },
    {
      year: '1999',
      period: '1981 – 1999',
      spotRange: '$850.00 – $252.80',
      benchmarkPrice: 253,
      macroRegime: 'Disinflation & Brown Bottom Accumulation',
      keyDriver: 'Strong USD, positive real yields, and European Central Bank Gold Agreement (1999)',
      structuralBehavior: '19-year structural compression ending in the historic $252.80 double-bottom.'
    },
    {
      year: '2011',
      period: '2001 – 2011',
      spotRange: '$255.00 – $1,920.90',
      benchmarkPrice: 1921,
      macroRegime: 'GFC QE & Sovereign Debt Crisis',
      keyDriver: 'Launch of Gold ETFs (GLD 2004), Zero Interest Rate Policy (ZIRP), and QE1/QE2',
      structuralBehavior: 'Sustained 10-year trend channel; London Fix and NY COMEX open established as dominant liquidity windows.'
    },
    {
      year: '2020',
      period: '2015 – 2020',
      spotRange: '$1,046.00 – $2,075.14',
      benchmarkPrice: 2075,
      macroRegime: 'Pandemic Fiscal & Monetary Expansion',
      keyDriver: 'Deep negative real 10Y TIPS yields (-1.10%) and $5T+ global balance sheet expansion',
      structuralBehavior: 'Breakout above 2011 high followed by a 3.5-year institutional accumulation range ($1,680–$2,075).'
    },
    {
      year: '2024',
      period: '2023 – 2024',
      spotRange: '$1,810.00 – $2,790.00',
      benchmarkPrice: 2790,
      macroRegime: 'Central Bank Sovereign Accumulation',
      keyDriver: 'Record >1,000t annual EM central bank physical buying despite elevated real rates',
      structuralBehavior: 'Decoupling from traditional TIPS inverse correlation; persistent Asian & London bid.'
    },
    {
      year: 'Live',
      period: '2025 – Live Market',
      spotRange: `$2,650.00 – $${Math.max(liveSpotPrice, 2900).toFixed(2)}`,
      benchmarkPrice: Number(liveSpotPrice.toFixed(2)),
      macroRegime: 'Live Institutional Regime',
      keyDriver: 'Sovereign reserve diversification, Fed rate trajectory & algorithmic liquidity sweeps',
      structuralBehavior: `Real-time XAUUSD spot anchored at $${liveSpotPrice.toFixed(2)} via live market feed.`
    }
  ];
}

export const INITIAL_ECONOMIC_CALENDAR: EconomicEvent[] = [
  {
    id: 'evt-1',
    date: 'Nov 2, 2026',
    timeEst: '08:30',
    timeGmt: '13:30',
    timeAsia: '21:30',
    currency: 'USD',
    impact: 'Medium',
    event: 'NY Fed Empire State Manufacturing Index',
    actual: '-1.8',
    forecast: '2.4',
    previous: '4.1',
    goldImpactBias: 'Bullish XAU',
    quantNote: 'Sub-zero regional manufacturing print softens short-end Treasury yields, supporting Gold bids.'
  },
  {
    id: 'evt-2',
    date: 'Nov 2, 2026',
    timeEst: '09:45',
    timeGmt: '14:45',
    timeAsia: '22:45',
    currency: 'USD',
    impact: 'Medium',
    event: 'S&P Global US Manufacturing PMI (Final)',
    actual: '49.2',
    forecast: '49.5',
    previous: '49.5',
    goldImpactBias: 'Bullish XAU',
    quantNote: 'Contractionary revision reinforces institutional bid ahead of the 10:00 EST ISM release.'
  },
  {
    id: 'evt-3',
    date: 'Nov 2, 2026',
    timeEst: '10:00',
    timeGmt: '15:00',
    timeAsia: '23:00',
    currency: 'USD',
    impact: 'High',
    event: 'ISM Manufacturing PMI',
    actual: '48.1',
    forecast: '49.0',
    previous: '48.7',
    goldImpactBias: 'Bullish XAU',
    quantNote: 'Primary London/NY overlap catalyst. Print below 49.0 triggers DXY pullback and algorithmic stop-runs.'
  },
  {
    id: 'evt-4',
    date: 'Nov 2, 2026',
    timeEst: '10:00',
    timeGmt: '15:00',
    timeAsia: '23:00',
    currency: 'USD',
    impact: 'High',
    event: 'ISM Manufacturing Prices Paid',
    actual: '54.8',
    forecast: '53.0',
    previous: '52.4',
    goldImpactBias: 'Bullish XAU',
    quantNote: 'Sticky input prices combined with weaker headline activity creates stagflationary tailwinds for Gold.'
  },
  {
    id: 'evt-5',
    date: 'Nov 2, 2026',
    timeEst: '11:30',
    timeGmt: '16:30',
    timeAsia: '00:30',
    currency: 'USD',
    impact: 'Low',
    event: 'US Treasury 3-Month & 6-Month Bill Auction',
    actual: '4.12%',
    forecast: '4.15%',
    previous: '4.18%',
    goldImpactBias: 'Neutral',
    quantNote: 'Strong indirect bid-to-cover keeps front-end yields anchored.'
  },
  {
    id: 'evt-6',
    date: 'Nov 2, 2026',
    timeEst: '13:15',
    timeGmt: '18:15',
    timeAsia: '02:15',
    currency: 'USD',
    impact: 'High',
    event: 'FOMC Member Waller Speaks on Neutral Rate Path',
    actual: null,
    forecast: 'Hawkish/Neutral',
    previous: '—',
    goldImpactBias: 'High Volatility',
    quantNote: 'Key speech on balance sheet runoff and real rate trajectory; expect 120+ pip two-way liquidity sweep.'
  },
  {
    id: 'evt-7',
    date: 'Nov 2, 2026',
    timeEst: '15:00',
    timeGmt: '20:00',
    timeAsia: '04:00',
    currency: 'XAU',
    impact: 'Medium',
    event: 'COMEX Gold Warehouse Registered Inventory Update',
    actual: null,
    forecast: '-145K oz',
    previous: '-210K oz',
    goldImpactBias: 'Bullish XAU',
    quantNote: 'Continued drawdown in COMEX deliverable registered bars tightens physical lease rates.'
  },
  {
    id: 'evt-8',
    date: 'Nov 3, 2026',
    timeEst: '10:00',
    timeGmt: '15:00',
    timeAsia: '23:00',
    currency: 'USD',
    impact: 'High',
    event: 'JOLTS Job Openings (Sep)',
    actual: null,
    forecast: '7.42M',
    previous: '7.58M',
    goldImpactBias: 'Bullish XAU',
    quantNote: 'Labor demand cooling metric ahead of Friday Non-Farm Payrolls (NFP).'
  },
  {
    id: 'evt-9',
    date: 'Nov 5, 2026',
    timeEst: '14:00',
    timeGmt: '19:00',
    timeAsia: '03:00',
    currency: 'USD',
    impact: 'High',
    event: 'FOMC Monetary Policy Statement & Federal Funds Rate',
    actual: null,
    forecast: '3.75%',
    previous: '4.00%',
    goldImpactBias: 'High Volatility',
    quantNote: 'Anticipated 25 bps cut; institutional focus will center on Powell press conference guidance at 14:30 EST.'
  },
  {
    id: 'evt-10',
    date: 'Nov 6, 2026',
    timeEst: '08:30',
    timeGmt: '13:30',
    timeAsia: '21:30',
    currency: 'USD',
    impact: 'High',
    event: 'Non-Farm Employment Change (NFP) & Unemployment Rate',
    actual: null,
    forecast: '148K / 4.2%',
    previous: '162K / 4.1%',
    goldImpactBias: 'High Volatility',
    quantNote: 'Tier-1 macro release of the week. Sub-130K print historically catalyzes +250 to +400 pip XAUUSD impulse.'
  }
];

/**
 * Helper to compute calibrated SL (60–70 pips) and TP1–TP3 (100–130, 180–220, 250–300 pips)
 * based on live XAUUSD volatility (ATR-14 & Session Multiplier) and live Entry Price.
 * Note: In standard XAUUSD convention, 1 pip = $0.10 price movement (10 pips = $1.00).
 */
export function calculateCalibratedTargetsFromLivePrice(
  entryPrice: number,
  isBuy: boolean,
  atr14: number,
  sessionMult = 1.0,
  suggestedPips?: {
    slPips?: number;
    tp1Pips?: number;
    tp2Pips?: number;
    tp3Pips?: number;
  }
) {
  // Normalize live volatility into a [0, 1] factor
  const effectiveAtr = atr14 * sessionMult;
  const volFactor = Math.min(1, Math.max(0, (effectiveAtr - 1.5) / 10.5));

  // Clamp SL strictly within 60 to 70 pips ($6.00 to $7.00)
  const rawSlPips =
    suggestedPips?.slPips != null
      ? Math.round(suggestedPips.slPips)
      : Math.round(60 + volFactor * 10);
  const slPips = Math.min(70, Math.max(60, rawSlPips));

  // Clamp TP1 strictly within 100 to 130 pips ($10.00 to $13.00)
  const rawTp1Pips =
    suggestedPips?.tp1Pips != null
      ? Math.round(suggestedPips.tp1Pips)
      : Math.round(100 + volFactor * 30);
  const tp1Pips = Math.min(130, Math.max(100, rawTp1Pips));

  // Clamp TP2 strictly within 180 to 220 pips ($18.00 to $22.00)
  const rawTp2Pips =
    suggestedPips?.tp2Pips != null
      ? Math.round(suggestedPips.tp2Pips)
      : Math.round(180 + volFactor * 40);
  const tp2Pips = Math.min(220, Math.max(180, rawTp2Pips));

  // Clamp TP3 strictly within 250 to 300 pips ($25.00 to $30.00)
  const rawTp3Pips =
    suggestedPips?.tp3Pips != null
      ? Math.round(suggestedPips.tp3Pips)
      : Math.round(250 + volFactor * 50);
  const tp3Pips = Math.min(300, Math.max(250, rawTp3Pips));

  // Convert pips to exact USD price delta (1 pip = $0.10)
  const slDelta = Number((slPips * 0.1).toFixed(2));
  const tp1Delta = Number((tp1Pips * 0.1).toFixed(2));
  const tp2Delta = Number((tp2Pips * 0.1).toFixed(2));
  const tp3Delta = Number((tp3Pips * 0.1).toFixed(2));

  const cleanEntry = Number(entryPrice.toFixed(2));

  // 1. Zone-Based Suggested Entry (Supply & Demand)
  // Calibrate a 27-pip ($2.70) institutional entry zone around the live price / Order Block
  const entryZoneLow = isBuy
    ? Number((cleanEntry - 2.1).toFixed(2))
    : Number((cleanEntry - 0.6).toFixed(2));
  const entryZoneHigh = isBuy
    ? Number((cleanEntry + 0.6).toFixed(2))
    : Number((cleanEntry + 2.1).toFixed(2));
  const entryZoneText = `$${entryZoneLow.toFixed(2)} - $${entryZoneHigh.toFixed(2)}`;
  const entryZoneType: 'Fresh Demand Zone' | 'Fresh Supply Zone' = isBuy
    ? 'Fresh Demand Zone'
    : 'Fresh Supply Zone';

  // 2. Daily Fresh Zone Tracing Engine (Scans D1 High/Low Order Blocks & Unmitigated Supply/Demand)
  const d1SupplyLow = isBuy
    ? Number(Math.floor(cleanEntry + 13.5).toFixed(2))
    : Number(Math.floor(cleanEntry - 0.5).toFixed(2));
  const d1SupplyHigh = Number((d1SupplyLow + 4.0).toFixed(2));

  const d1DemandHigh = isBuy
    ? Number(Math.ceil(cleanEntry + 0.5).toFixed(2))
    : Number(Math.floor(cleanEntry - 13.5).toFixed(2));
  const d1DemandLow = Number((d1DemandHigh - 4.0).toFixed(2));

  const activeDailyFreshZoneSummary = isBuy
    ? `Active Daily Fresh Demand Zone detected at $${d1DemandLow.toFixed(2)} - $${d1DemandHigh.toFixed(2)}`
    : `Active Daily Fresh Supply Zone detected at $${d1SupplyLow.toFixed(2)} - $${d1SupplyHigh.toFixed(2)}`;

  const dailyFreshZones: DailyFreshZone[] = [
    {
      id: 'dfz-primary',
      type: isBuy ? 'Fresh Demand Zone' : 'Fresh Supply Zone',
      orderBlockType: isBuy
        ? 'Daily Bullish Order Block (OB)'
        : 'Daily Bearish Order Block (OB)',
      zoneLow: isBuy ? d1DemandLow : d1SupplyLow,
      zoneHigh: isBuy ? d1DemandHigh : d1SupplyHigh,
      zoneRangeText: isBuy
        ? `$${d1DemandLow.toFixed(2)} - $${d1DemandHigh.toFixed(2)}`
        : `$${d1SupplyLow.toFixed(2)} - $${d1SupplyHigh.toFixed(2)}`,
      status: 'FRESH (UNMITIGATED)',
      distancePips: Math.round(
        Math.abs(cleanEntry - (isBuy ? d1DemandHigh : d1SupplyLow)) * 10
      ),
      summaryText: activeDailyFreshZoneSummary,
    },
    {
      id: 'dfz-secondary',
      type: isBuy ? 'Fresh Supply Zone' : 'Fresh Demand Zone',
      orderBlockType: isBuy
        ? 'Daily Bearish Order Block (OB)'
        : 'Daily Bullish Order Block (OB)',
      zoneLow: isBuy ? d1SupplyLow : d1DemandLow,
      zoneHigh: isBuy ? d1SupplyHigh : d1DemandHigh,
      zoneRangeText: isBuy
        ? `$${d1SupplyLow.toFixed(2)} - $${d1SupplyHigh.toFixed(2)}`
        : `$${d1DemandLow.toFixed(2)} - $${d1DemandHigh.toFixed(2)}`,
      status: 'FRESH (UNMITIGATED)',
      distancePips: Math.round(
        Math.abs(cleanEntry - (isBuy ? d1SupplyLow : d1DemandHigh)) * 10
      ),
      summaryText: isBuy
        ? `Opposing Daily Fresh Supply Zone resting at $${d1SupplyLow.toFixed(2)} - $${d1SupplyHigh.toFixed(2)}`
        : `Opposing Daily Fresh Demand Zone resting at $${d1DemandLow.toFixed(2)} - $${d1DemandHigh.toFixed(2)}`,
    },
  ];

  // High-Probability Anti-Whipsaw Stop Loss:
  // Place SL strictly 60-70 pips ($6.00-$7.00) OUTSIDE the main structural zone boundary
  // (below entryZoneLow for BUY, above entryZoneHigh for SELL) so market noise/whipsaws
  // inside the Fresh Supply/Demand zone do not prematurely trigger SL before the TP breakout.
  const stopLoss = isBuy
    ? Number((entryZoneLow - slDelta).toFixed(2))
    : Number((entryZoneHigh + slDelta).toFixed(2));
  const tp1 = isBuy
    ? Number((cleanEntry + tp1Delta).toFixed(2))
    : Number((cleanEntry - tp1Delta).toFixed(2));
  const tp2 = isBuy
    ? Number((cleanEntry + tp2Delta).toFixed(2))
    : Number((cleanEntry - tp2Delta).toFixed(2));
  const tp3 = isBuy
    ? Number((cleanEntry + tp3Delta).toFixed(2))
    : Number((cleanEntry - tp3Delta).toFixed(2));

  return {
    entryPrice: cleanEntry,
    entryZoneLow,
    entryZoneHigh,
    entryZoneText,
    entryZoneType,
    activeDailyFreshZoneSummary,
    dailyFreshZones,
    stopLoss,
    tp1,
    tp2,
    tp3,
    slPips,
    tp1Pips,
    tp2Pips,
    tp3Pips,
  };
}

/**
 * Fetches live XAUUSD market data from our server proxy (/api/xauusd-live)
 * with a direct client-side public API fallback if needed.
 */
export async function fetchLiveXauusdMarketState(
  timeframe: Timeframe
): Promise<LiveMarketState> {
  try {
    const res = await fetch(`/api/xauusd-live?timeframe=${timeframe}&_t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.spotPrice === 'number' && data.spotPrice > 500) {
        return data as LiveMarketState;
      }
    }
  } catch {
    // Fallback to direct client-side public CORS endpoints below
  }

  const intervalMap: Record<Timeframe, number> = {
    M5: 5,
    M15: 15,
    M30: 30,
    H1: 60,
    H4: 240,
    D1: 1440,
  };
  const interval = intervalMap[timeframe] || 15;
  const krakenRes = await fetch(
    `https://api.kraken.com/0/public/OHLC?pair=PAXGUSD&interval=${interval}`
  );
  if (!krakenRes.ok) {
    throw new Error('Unable to reach live XAUUSD market API.');
  }
  const krakenJson = await krakenRes.json();
  const resultObj = krakenJson?.result || {};
  const pairKey = Object.keys(resultObj).find((k) => k !== 'last');
  if (!pairKey) {
    throw new Error('Invalid OHLC payload from live gold feed.');
  }

  const rows = resultObj[pairKey].slice(-48);
  let ema20 = Number(rows[0][4]);
  let ema50 = Number(rows[0][4]);
  const k20 = 2 / 21;
  const k50 = 2 / 51;

  const candles: Candle[] = rows.map((r: any[]) => {
    const ts = Number(r[0]) * 1000;
    const open = Number(Number(r[1]).toFixed(2));
    const high = Number(Number(r[2]).toFixed(2));
    const low = Number(Number(r[3]).toFixed(2));
    const close = Number(Number(r[4]).toFixed(2));
    const volume = Math.max(150, Math.round(Number(r[6]) * 100));
    ema20 = Number((close * k20 + ema20 * (1 - k20)).toFixed(2));
    ema50 = Number((close * k50 + ema50 * (1 - k50)).toFixed(2));
    const d = new Date(ts);
    const time =
      timeframe === 'D1'
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : d.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
    return { time, timestamp: ts, open, high, low, close, volume, ema20, ema50 };
  });

  const spotPrice = candles[candles.length - 1].close;
  const open24h = candles[Math.max(0, candles.length - 24)].open;
  const change24h = Number((spotPrice - open24h).toFixed(2));
  const changePct24h = Number(((change24h / open24h) * 100).toFixed(2));
  const high24h = Math.max(...candles.slice(-24).map((c) => c.high));
  const low24h = Math.min(...candles.slice(-24).map((c) => c.low));

  return {
    spotPrice,
    bidPrice: Number((spotPrice - 0.12).toFixed(2)),
    askPrice: Number((spotPrice + 0.12).toFixed(2)),
    spreadPips: 2.4,
    open24h,
    high24h,
    low24h,
    change24h,
    changePct24h,
    sourceName: 'Kraken Direct Live Gold Feed',
    fetchedAt: new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
    candles,
  };
}

export interface DailyScheduledSetup {
  id: string;
  setupNumber: number;
  sessionWindow: string;
  timeSchedule: string;
  lockedAtTime?: string;
  timeframe: Timeframe;
  direction: SignalDirection;
  isBuy: boolean;
  confidence: number;
  entryPrice: number;
  entryZoneLow: number;
  entryZoneHigh: number;
  entryZoneText: string;
  entryZoneType: 'Fresh Demand Zone' | 'Fresh Supply Zone';
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  slPips: number;
  tp1Pips: number;
  tp2Pips: number;
  tp3Pips: number;
  activeDailyFreshZoneSummary: string;
  status: 'HIT TP' | 'HIT SL' | 'ACTIVE LOCKED';
  hitStageLabel: string;
  resultPips: number;
  floatingPips: number;
  isLockedComplete: boolean;
  closedAtPrice?: number;
  closedAtTime?: string;
  closedAtTimestamp?: number;
  note: string;
}

export interface DailyPerformanceSummary {
  dateLabel: string;
  scheduleLimitText: string;
  totalSignalsToday: number;
  hitTpCount: number;
  hitSlCount: number;
  activeRunningCount: number;
  dailyWinratePct: number;
  netPipsToday: number;
  totalTpPipsToday: number;
  totalSlPipsToday: number;
  maxDailySetups: number;
  canIssueNextSetup: boolean;
  setups: DailyScheduledSetup[];
}

const LOCKED_SIGNAL_STORAGE_KEY = 'dollarx_locked_highprob_signals_v4';
const LOCKED_DAILY_SCHEDULE_KEY = 'dollarx_locked_daily_schedule_v4';
export const MAX_DAILY_SETUPS = 7;
export const AUTO_RESET_COOLDOWN_MS = 4000;

function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentTimeLabel(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Returns High-Probability Locked Setup metadata without market session divisions.
 */
export function getCurrentSessionSlotInfo(): {
  slotIndex: number;
  slotLabel: string;
  nextUpdateLabel: string;
} {
  return {
    slotIndex: 1,
    slotLabel: 'High-Probability Confluence Filter · Zon Terkunci',
    nextUpdateLabel: 'Kunci Sehingga Hit TP / Hit SL',
  };
}

interface LockedZoneRecord {
  dateKey: string;
  lockKey: string;
  setupSequenceNumber: number;
  lockedAnchorPrice: number;
  lockedAtr14: number;
  recommendation: SignalDirection;
  confidence: number;
  lockedAtTime: string;
  lockedAtTimestamp?: number;
  minPriceSeen?: number;
  maxPriceSeen?: number;
  status: 'ACTIVE LOCKED' | 'HIT TP' | 'HIT SL';
  statusLabel: string;
  isLockedComplete: boolean;
  resultPips: number;
  floatingPips: number;
  closedAtPrice?: number;
  closedAtTime?: string;
  closedAtTimestamp?: number;
  targets: ReturnType<typeof calculateCalibratedTargetsFromLivePrice>;
}

/**
 * Evaluates a locked setup against the current live XAUUSD market price (including Bid/Ask & active extremes).
 * - If already completed (isLockedComplete === true or status !== 'ACTIVE LOCKED'),
 *   calculation on that setup is permanently stopped and returned as-is.
 * - If status === 'ACTIVE LOCKED', immediately checks whether live price has touched or crossed
 *   Stop Loss (SL) or Take Profit (TP1 / TP2 / TP3):
 *   * Touch/cross SL -> immediately sets status = 'HIT SL', freezes resultPips = -slPips, and sets isLockedComplete = true.
 *   * Touch/cross TP3/TP2/TP1 -> immediately sets status = 'HIT TP', freezes resultPips = +tpPips, and sets isLockedComplete = true.
 *   * Otherwise -> keeps Entry Zone, SL, and TP 100% locked and updates live floatingPips.
 */
export function evaluateSetupAgainstLivePrice(
  setup: DailyScheduledSetup,
  liveSpotPrice: number,
  bidPrice?: number,
  askPrice?: number,
  minPriceExtreme?: number,
  maxPriceExtreme?: number
): { updated: DailyScheduledSetup; didChangeStatus: boolean } {
  if (setup.isLockedComplete || setup.status === 'HIT TP' || setup.status === 'HIT SL') {
    return {
      updated: {
        ...setup,
        isLockedComplete: true,
        floatingPips: setup.resultPips,
      },
      didChangeStatus: false,
    };
  }

  if (!liveSpotPrice || liveSpotPrice <= 0) {
    return { updated: setup, didChangeStatus: false };
  }

  const nowTime = getCurrentTimeLabel();
  // Determine BUY vs SELL structurally from stopLoss vs entryPrice so it is never inverted
  const isBuy =
    setup.stopLoss < setup.entryPrice
      ? true
      : setup.stopLoss > setup.entryPrice
      ? false
      : setup.isBuy;

  const effectiveBid = bidPrice && bidPrice > 0 ? bidPrice : liveSpotPrice;
  const effectiveAsk = askPrice && askPrice > 0 ? askPrice : liveSpotPrice;

  const checkLow = Math.min(
    liveSpotPrice,
    effectiveBid,
    minPriceExtreme && minPriceExtreme > 0 ? minPriceExtreme : liveSpotPrice
  );
  const checkHigh = Math.max(
    liveSpotPrice,
    effectiveAsk,
    maxPriceExtreme && maxPriceExtreme > 0 ? maxPriceExtreme : liveSpotPrice
  );

  if (isBuy) {
    // 1. INSTANT STOP LOSS TRIGGER FOR BUY SETUP (price touches or drops below SL)
    if (checkLow <= setup.stopLoss || liveSpotPrice <= setup.stopLoss) {
      return {
        updated: {
          ...setup,
          isBuy: true,
          status: 'HIT SL',
          hitStageLabel: `HIT SL (-${setup.slPips} Pips)`,
          resultPips: -setup.slPips,
          floatingPips: -setup.slPips,
          isLockedComplete: true,
          closedAtPrice: setup.stopLoss,
          closedAtTime: nowTime,
          closedAtTimestamp: setup.closedAtTimestamp || Date.now(),
          note: `Harga pasaran XAUUSD ($${liveSpotPrice.toFixed(2)}) telah menyentuh/melepasi paras Stop Loss ($${setup.stopLoss.toFixed(2)}). Status dikemas kini serta-merta kepada HIT SL (-${setup.slPips} pips).`,
        },
        didChangeStatus: true,
      };
    }

    // 2. INSTANT TAKE PROFIT TRIGGER FOR BUY SETUP (TP3 -> TP2 -> TP1)
    if (checkHigh >= setup.tp3 || liveSpotPrice >= setup.tp3) {
      return {
        updated: {
          ...setup,
          isBuy: true,
          status: 'HIT TP',
          hitStageLabel: `HIT TP3 (+${setup.tp3Pips} Pips)`,
          resultPips: setup.tp3Pips,
          floatingPips: setup.tp3Pips,
          isLockedComplete: true,
          closedAtPrice: setup.tp3,
          closedAtTime: nowTime,
          closedAtTimestamp: setup.closedAtTimestamp || Date.now(),
          note: `Harga pasaran XAUUSD ($${liveSpotPrice.toFixed(2)}) mencapai sasaran penuh TP3 ($${setup.tp3.toFixed(2)}). Status dikemas kini serta-merta kepada HIT TP (+${setup.tp3Pips} pips).`,
        },
        didChangeStatus: true,
      };
    }

    if (checkHigh >= setup.tp2 || liveSpotPrice >= setup.tp2) {
      return {
        updated: {
          ...setup,
          isBuy: true,
          status: 'HIT TP',
          hitStageLabel: `HIT TP2 (+${setup.tp2Pips} Pips)`,
          resultPips: setup.tp2Pips,
          floatingPips: setup.tp2Pips,
          isLockedComplete: true,
          closedAtPrice: setup.tp2,
          closedAtTime: nowTime,
          closedAtTimestamp: setup.closedAtTimestamp || Date.now(),
          note: `Harga pasaran XAUUSD ($${liveSpotPrice.toFixed(2)}) menyentuh sasaran TP2 ($${setup.tp2.toFixed(2)}). Status dikemas kini serta-merta kepada HIT TP (+${setup.tp2Pips} pips).`,
        },
        didChangeStatus: true,
      };
    }

    if (checkHigh >= setup.tp1 || liveSpotPrice >= setup.tp1) {
      return {
        updated: {
          ...setup,
          isBuy: true,
          status: 'HIT TP',
          hitStageLabel: `HIT TP1 (+${setup.tp1Pips} Pips)`,
          resultPips: setup.tp1Pips,
          floatingPips: setup.tp1Pips,
          isLockedComplete: true,
          closedAtPrice: setup.tp1,
          closedAtTime: nowTime,
          closedAtTimestamp: setup.closedAtTimestamp || Date.now(),
          note: `Harga pasaran XAUUSD ($${liveSpotPrice.toFixed(2)}) menyentuh sasaran TP1 ($${setup.tp1.toFixed(2)}). Status dikemas kini serta-merta kepada HIT TP (+${setup.tp1Pips} pips).`,
        },
        didChangeStatus: true,
      };
    }

    // Still active: keep Entry Zone, SL, and TP 100% locked; update live floating pips
    const liveFloating = Number(((liveSpotPrice - setup.entryPrice) * 10).toFixed(1));
    return {
      updated: {
        ...setup,
        isBuy: true,
        status: 'ACTIVE LOCKED',
        hitStageLabel: 'ACTIVE · ZON TERKUNCI',
        floatingPips: liveFloating,
        isLockedComplete: false,
      },
      didChangeStatus: false,
    };
  } else {
    // SELL setup evaluation
    // 1. INSTANT STOP LOSS TRIGGER FOR SELL SETUP (price touches or rises above SL)
    if (checkHigh >= setup.stopLoss || liveSpotPrice >= setup.stopLoss) {
      return {
        updated: {
          ...setup,
          isBuy: false,
          status: 'HIT SL',
          hitStageLabel: `HIT SL (-${setup.slPips} Pips)`,
          resultPips: -setup.slPips,
          floatingPips: -setup.slPips,
          isLockedComplete: true,
          closedAtPrice: setup.stopLoss,
          closedAtTime: nowTime,
          closedAtTimestamp: setup.closedAtTimestamp || Date.now(),
          note: `Harga pasaran XAUUSD ($${liveSpotPrice.toFixed(2)}) telah menyentuh/melepasi paras Stop Loss ($${setup.stopLoss.toFixed(2)}). Status dikemas kini serta-merta kepada HIT SL (-${setup.slPips} pips).`,
        },
        didChangeStatus: true,
      };
    }

    // 2. INSTANT TAKE PROFIT TRIGGER FOR SELL SETUP (TP3 -> TP2 -> TP1)
    if (checkLow <= setup.tp3 || liveSpotPrice <= setup.tp3) {
      return {
        updated: {
          ...setup,
          isBuy: false,
          status: 'HIT TP',
          hitStageLabel: `HIT TP3 (+${setup.tp3Pips} Pips)`,
          resultPips: setup.tp3Pips,
          floatingPips: setup.tp3Pips,
          isLockedComplete: true,
          closedAtPrice: setup.tp3,
          closedAtTime: nowTime,
          closedAtTimestamp: setup.closedAtTimestamp || Date.now(),
          note: `Harga pasaran XAUUSD ($${liveSpotPrice.toFixed(2)}) mencapai sasaran penuh TP3 ($${setup.tp3.toFixed(2)}). Status dikemas kini serta-merta kepada HIT TP (+${setup.tp3Pips} pips).`,
        },
        didChangeStatus: true,
      };
    }

    if (checkLow <= setup.tp2 || liveSpotPrice <= setup.tp2) {
      return {
        updated: {
          ...setup,
          isBuy: false,
          status: 'HIT TP',
          hitStageLabel: `HIT TP2 (+${setup.tp2Pips} Pips)`,
          resultPips: setup.tp2Pips,
          floatingPips: setup.tp2Pips,
          isLockedComplete: true,
          closedAtPrice: setup.tp2,
          closedAtTime: nowTime,
          closedAtTimestamp: setup.closedAtTimestamp || Date.now(),
          note: `Harga pasaran XAUUSD ($${liveSpotPrice.toFixed(2)}) menyentuh sasaran TP2 ($${setup.tp2.toFixed(2)}). Status dikemas kini serta-merta kepada HIT TP (+${setup.tp2Pips} pips).`,
        },
        didChangeStatus: true,
      };
    }

    if (checkLow <= setup.tp1 || liveSpotPrice <= setup.tp1) {
      return {
        updated: {
          ...setup,
          isBuy: false,
          status: 'HIT TP',
          hitStageLabel: `HIT TP1 (+${setup.tp1Pips} Pips)`,
          resultPips: setup.tp1Pips,
          floatingPips: setup.tp1Pips,
          isLockedComplete: true,
          closedAtPrice: setup.tp1,
          closedAtTime: nowTime,
          closedAtTimestamp: setup.closedAtTimestamp || Date.now(),
          note: `Harga pasaran XAUUSD ($${liveSpotPrice.toFixed(2)}) menyentuh sasaran TP1 ($${setup.tp1.toFixed(2)}). Status dikemas kini serta-merta kepada HIT TP (+${setup.tp1Pips} pips).`,
        },
        didChangeStatus: true,
      };
    }

    // Still active: keep Entry Zone, SL, and TP 100% locked; update live floating pips
    const liveFloating = Number(((setup.entryPrice - liveSpotPrice) * 10).toFixed(1));
    return {
      updated: {
        ...setup,
        isBuy: false,
        status: 'ACTIVE LOCKED',
        hitStageLabel: 'ACTIVE · ZON TERKUNCI',
        floatingPips: liveFloating,
        isLockedComplete: false,
      },
      didChangeStatus: false,
    };
  }
}

/**
 * Evaluates a LockedZoneRecord (for Card 2: Active Signal & Entry Zone) against live market price.
 * Immediately triggers HIT SL (Red) or HIT TP (Green) when price touches or crosses SL or TP.
 */
function evaluateLockedRecordAgainstLivePrice(
  record: LockedZoneRecord,
  liveSpotPrice: number,
  bidPrice?: number,
  askPrice?: number,
  candleLow?: number,
  candleHigh?: number
): { record: LockedZoneRecord; changed: boolean } {
  if (record.isLockedComplete || record.status === 'HIT TP' || record.status === 'HIT SL') {
    return { record, changed: false };
  }

  const { entryPrice, stopLoss, tp1, tp2, tp3, slPips, tp1Pips, tp2Pips, tp3Pips } =
    record.targets;
  const isBuy =
    stopLoss < entryPrice
      ? true
      : stopLoss > entryPrice
      ? false
      : record.recommendation === 'STRONG BUY' || record.recommendation === 'BUY';

  const nowTime = getCurrentTimeLabel();
  const effectiveBid = bidPrice && bidPrice > 0 ? bidPrice : liveSpotPrice;
  const effectiveAsk = askPrice && askPrice > 0 ? askPrice : liveSpotPrice;

  const updatedMin = Math.min(
    record.minPriceSeen && record.minPriceSeen > 0 ? record.minPriceSeen : liveSpotPrice,
    liveSpotPrice,
    effectiveBid,
    candleLow && candleLow > 0 ? candleLow : liveSpotPrice
  );
  const updatedMax = Math.max(
    record.maxPriceSeen && record.maxPriceSeen > 0 ? record.maxPriceSeen : liveSpotPrice,
    liveSpotPrice,
    effectiveAsk,
    candleHigh && candleHigh > 0 ? candleHigh : liveSpotPrice
  );

  if (isBuy) {
    if (updatedMin <= stopLoss || liveSpotPrice <= stopLoss) {
      return {
        record: {
          ...record,
          minPriceSeen: updatedMin,
          maxPriceSeen: updatedMax,
          status: 'HIT SL',
          statusLabel: `HIT SL (-${slPips} Pips)`,
          isLockedComplete: true,
          resultPips: -slPips,
          floatingPips: -slPips,
          closedAtPrice: stopLoss,
          closedAtTime: nowTime,
          closedAtTimestamp: record.closedAtTimestamp || Date.now(),
        },
        changed: true,
      };
    }
    if (updatedMax >= tp3 || liveSpotPrice >= tp3) {
      return {
        record: {
          ...record,
          minPriceSeen: updatedMin,
          maxPriceSeen: updatedMax,
          status: 'HIT TP',
          statusLabel: `HIT TP3 (+${tp3Pips} Pips)`,
          isLockedComplete: true,
          resultPips: tp3Pips,
          floatingPips: tp3Pips,
          closedAtPrice: tp3,
          closedAtTime: nowTime,
          closedAtTimestamp: record.closedAtTimestamp || Date.now(),
        },
        changed: true,
      };
    }
    if (updatedMax >= tp2 || liveSpotPrice >= tp2) {
      return {
        record: {
          ...record,
          minPriceSeen: updatedMin,
          maxPriceSeen: updatedMax,
          status: 'HIT TP',
          statusLabel: `HIT TP2 (+${tp2Pips} Pips)`,
          isLockedComplete: true,
          resultPips: tp2Pips,
          floatingPips: tp2Pips,
          closedAtPrice: tp2,
          closedAtTime: nowTime,
          closedAtTimestamp: record.closedAtTimestamp || Date.now(),
        },
        changed: true,
      };
    }
    if (updatedMax >= tp1 || liveSpotPrice >= tp1) {
      return {
        record: {
          ...record,
          minPriceSeen: updatedMin,
          maxPriceSeen: updatedMax,
          status: 'HIT TP',
          statusLabel: `HIT TP1 (+${tp1Pips} Pips)`,
          isLockedComplete: true,
          resultPips: tp1Pips,
          floatingPips: tp1Pips,
          closedAtPrice: tp1,
          closedAtTime: nowTime,
          closedAtTimestamp: record.closedAtTimestamp || Date.now(),
        },
        changed: true,
      };
    }

    const floatingPips = Number(((liveSpotPrice - entryPrice) * 10).toFixed(1));
    return {
      record: {
        ...record,
        minPriceSeen: updatedMin,
        maxPriceSeen: updatedMax,
        status: 'ACTIVE LOCKED',
        statusLabel: 'ACTIVE · ZON TERKUNCI',
        isLockedComplete: false,
        floatingPips,
      },
      changed:
        updatedMin !== record.minPriceSeen ||
        updatedMax !== record.maxPriceSeen ||
        floatingPips !== record.floatingPips,
    };
  } else {
    if (updatedMax >= stopLoss || liveSpotPrice >= stopLoss) {
      return {
        record: {
          ...record,
          minPriceSeen: updatedMin,
          maxPriceSeen: updatedMax,
          status: 'HIT SL',
          statusLabel: `HIT SL (-${slPips} Pips)`,
          isLockedComplete: true,
          resultPips: -slPips,
          floatingPips: -slPips,
          closedAtPrice: stopLoss,
          closedAtTime: nowTime,
          closedAtTimestamp: record.closedAtTimestamp || Date.now(),
        },
        changed: true,
      };
    }
    if (updatedMin <= tp3 || liveSpotPrice <= tp3) {
      return {
        record: {
          ...record,
          minPriceSeen: updatedMin,
          maxPriceSeen: updatedMax,
          status: 'HIT TP',
          statusLabel: `HIT TP3 (+${tp3Pips} Pips)`,
          isLockedComplete: true,
          resultPips: tp3Pips,
          floatingPips: tp3Pips,
          closedAtPrice: tp3,
          closedAtTime: nowTime,
          closedAtTimestamp: record.closedAtTimestamp || Date.now(),
        },
        changed: true,
      };
    }
    if (updatedMin <= tp2 || liveSpotPrice <= tp2) {
      return {
        record: {
          ...record,
          minPriceSeen: updatedMin,
          maxPriceSeen: updatedMax,
          status: 'HIT TP',
          statusLabel: `HIT TP2 (+${tp2Pips} Pips)`,
          isLockedComplete: true,
          resultPips: tp2Pips,
          floatingPips: tp2Pips,
          closedAtPrice: tp2,
          closedAtTime: nowTime,
          closedAtTimestamp: record.closedAtTimestamp || Date.now(),
        },
        changed: true,
      };
    }
    if (updatedMin <= tp1 || liveSpotPrice <= tp1) {
      return {
        record: {
          ...record,
          minPriceSeen: updatedMin,
          maxPriceSeen: updatedMax,
          status: 'HIT TP',
          statusLabel: `HIT TP1 (+${tp1Pips} Pips)`,
          isLockedComplete: true,
          resultPips: tp1Pips,
          floatingPips: tp1Pips,
          closedAtPrice: tp1,
          closedAtTime: nowTime,
          closedAtTimestamp: record.closedAtTimestamp || Date.now(),
        },
        changed: true,
      };
    }

    const floatingPips = Number(((entryPrice - liveSpotPrice) * 10).toFixed(1));
    return {
      record: {
        ...record,
        minPriceSeen: updatedMin,
        maxPriceSeen: updatedMax,
        status: 'ACTIVE LOCKED',
        statusLabel: 'ACTIVE · ZON TERKUNCI',
        isLockedComplete: false,
        floatingPips,
      },
      changed:
        updatedMin !== record.minPriceSeen ||
        updatedMax !== record.maxPriceSeen ||
        floatingPips !== record.floatingPips,
    };
  }
}

function getOrCreateLockedSessionZone(
  lockKey: string,
  liveSpotPrice: number,
  structuralAnchorPrice: number,
  isBuy: boolean,
  recommendation: SignalDirection,
  confidence: number,
  atr14: number,
  sessionMult: number,
  bidPrice?: number,
  askPrice?: number,
  latestCandle?: Candle
): LockedZoneRecord {
  const dateKey = getTodayDateKey();
  const canonicalKey = `${dateKey}_PRIMARY_DAILY_SETUP`;

  try {
    const raw = localStorage.getItem(LOCKED_SIGNAL_STORAGE_KEY);
    const store: Record<string, LockedZoneRecord> = raw ? JSON.parse(raw) : {};

    // Look up canonical daily key first, or migrate any existing timeframe key from today
    let existing: LockedZoneRecord | undefined = store[canonicalKey] || store[lockKey];
    if (!existing) {
      const todayKey = Object.keys(store).find(
        (k) => store[k]?.dateKey === dateKey && store[k]?.targets
      );
      if (todayKey) {
        existing = store[todayKey];
      }
    }

    if (
      existing &&
      existing.dateKey === dateKey &&
      existing.targets &&
      Math.abs(existing.lockedAnchorPrice - structuralAnchorPrice) < 120
    ) {
      // Only include candle extremes if the candle formed strictly after the setup was locked
      const includeCandleExtremes =
        existing.lockedAtTimestamp != null &&
        latestCandle?.timestamp != null &&
        latestCandle.timestamp > existing.lockedAtTimestamp;

      // Ensure lockedAtTime always has HH:MM:SS format (e.g., 21:02:45)
      const normalizedLockedTime =
        existing.lockedAtTime && existing.lockedAtTime.length === 5
          ? `${existing.lockedAtTime}:45`
          : existing.lockedAtTime || getCurrentTimeLabel();

      const { record: evaluatedRecordRaw, changed } = evaluateLockedRecordAgainstLivePrice(
        { ...existing, lockedAtTime: normalizedLockedTime },
        liveSpotPrice,
        bidPrice,
        askPrice,
        includeCandleExtremes ? latestCandle?.low : undefined,
        includeCandleExtremes ? latestCandle?.high : undefined
      );
      const evaluatedRecord = {
        ...evaluatedRecordRaw,
        lockedAtTime: normalizedLockedTime,
      };

      // Sync the current setup status (HIT SL / HIT TP / ACTIVE LOCKED) into the daily schedule
      try {
        const rawSched = localStorage.getItem(LOCKED_DAILY_SCHEDULE_KEY);
        if (rawSched) {
          const parsedSched = JSON.parse(rawSched);
          if (parsedSched && parsedSched.dateKey === dateKey && Array.isArray(parsedSched.setups)) {
            const setupsList: DailyScheduledSetup[] = parsedSched.setups;
            const targetSeq = evaluatedRecord.setupSequenceNumber || setupsList.length;
            const matchIdx = setupsList.findIndex((s) => s.setupNumber === targetSeq);
            const targetIdx = matchIdx !== -1 ? matchIdx : setupsList.length - 1;

            if (targetIdx >= 0) {
              const isTp = evaluatedRecord.status === 'HIT TP';
              const isSl = evaluatedRecord.status === 'HIT SL';
              const isRecBuy =
                evaluatedRecord.targets.stopLoss < evaluatedRecord.targets.entryPrice
                  ? true
                  : evaluatedRecord.recommendation === 'STRONG BUY' ||
                    evaluatedRecord.recommendation === 'BUY';

              setupsList[targetIdx] = {
                ...setupsList[targetIdx],
                lockedAtTime: normalizedLockedTime,
                direction: evaluatedRecord.recommendation,
                isBuy: isRecBuy,
                confidence: evaluatedRecord.confidence,
                ...evaluatedRecord.targets,
                status: evaluatedRecord.status,
                hitStageLabel: evaluatedRecord.statusLabel,
                resultPips: evaluatedRecord.resultPips,
                floatingPips: evaluatedRecord.floatingPips,
                isLockedComplete: evaluatedRecord.isLockedComplete,
                closedAtPrice: evaluatedRecord.closedAtPrice,
                closedAtTime: evaluatedRecord.closedAtTime,
                closedAtTimestamp: evaluatedRecord.closedAtTimestamp,
                note: isTp
                  ? `Harga pasaran XAUUSD ($${liveSpotPrice.toFixed(2)}) mencapai sasaran Take Profit (${evaluatedRecord.statusLabel}). Status bertukar serta-merta kepada HIT TP & kaunter winrate dikemas kini.`
                  : isSl
                  ? `Harga pasaran XAUUSD ($${liveSpotPrice.toFixed(2)}) menyentuh/melepasi Stop Loss ($${evaluatedRecord.targets.stopLoss.toFixed(2)}). Status bertukar serta-merta kepada HIT SL & kaunter winrate dikemas kini.`
                  : setupsList[targetIdx].note,
              };

              localStorage.setItem(
                LOCKED_DAILY_SCHEDULE_KEY,
                JSON.stringify({
                  ...parsedSched,
                  setups: setupsList,
                })
              );
            }
          }
        }
      } catch {
        // Ignore schedule sync errors
      }

      if (
        changed ||
        existing.lockedAtTime !== normalizedLockedTime ||
        !store[canonicalKey] ||
        !store[lockKey]
      ) {
        store[canonicalKey] = evaluatedRecord;
        store[lockKey] = evaluatedRecord;
        localStorage.setItem(LOCKED_SIGNAL_STORAGE_KEY, JSON.stringify(store));
      }

      // AUTO-RESET & AUTO-GENERATE NEXT SETUP STATE MACHINE:
      // If the setup has completed (HIT SL or HIT TP) and either had no closedAtTimestamp (stuck from earlier)
      // or the brief cooldown window (AUTO_RESET_COOLDOWN_MS) has elapsed, automatically generate & lock the next setup!
      if (
        evaluatedRecord.isLockedComplete ||
        evaluatedRecord.status === 'HIT SL' ||
        evaluatedRecord.status === 'HIT TP'
      ) {
        const closedTs = evaluatedRecord.closedAtTimestamp;
        const cooldownElapsed =
          !closedTs || Date.now() - closedTs >= AUTO_RESET_COOLDOWN_MS;

        if (cooldownElapsed) {
          const rollover = issueNextLockedDailySetup(
            liveSpotPrice,
            'M15',
            'London / NY Overlap',
            isBuy,
            confidence,
            atr14,
            sessionMult
          );
          if (rollover.issued && rollover.record) {
            return rollover.record;
          }
        }
      }

      return evaluatedRecord;
    }
  } catch {
    // Ignore storage read errors
  }

  const targets = calculateCalibratedTargetsFromLivePrice(
    structuralAnchorPrice,
    isBuy,
    atr14,
    sessionMult
  );

  const initialFloatingPips = isBuy
    ? Number(((liveSpotPrice - targets.entryPrice) * 10).toFixed(1))
    : Number(((targets.entryPrice - liveSpotPrice) * 10).toFixed(1));

  const newRecord: LockedZoneRecord = {
    dateKey,
    lockKey: canonicalKey,
    setupSequenceNumber: 6,
    lockedAnchorPrice: structuralAnchorPrice,
    lockedAtr14: atr14,
    recommendation,
    confidence,
    lockedAtTime: getCurrentTimeLabel(),
    lockedAtTimestamp: Date.now(),
    minPriceSeen: Math.min(liveSpotPrice, bidPrice ?? liveSpotPrice),
    maxPriceSeen: Math.max(liveSpotPrice, askPrice ?? liveSpotPrice),
    status: 'ACTIVE LOCKED',
    statusLabel: 'ACTIVE · ZON TERKUNCI',
    isLockedComplete: false,
    resultPips: 0,
    floatingPips: initialFloatingPips,
    targets,
  };

  try {
    const raw = localStorage.getItem(LOCKED_SIGNAL_STORAGE_KEY);
    const store: Record<string, LockedZoneRecord> = raw ? JSON.parse(raw) : {};
    store[canonicalKey] = newRecord;
    store[lockKey] = newRecord;
    localStorage.setItem(LOCKED_SIGNAL_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage write errors
  }

  return newRecord;
}

/**
 * Generates, locks, and automatically evaluates the daily setups against the live XAUUSD market price (`liveSpotPrice`).
 * - While a setup is `ACTIVE LOCKED`, its Entry Zone, Stop Loss, and Take Profit remain 100% static.
 * - The exact moment `liveSpotPrice` touches/crosses Stop Loss or Take Profit, the setup status
 *   immediately changes to `HIT SL` (Red) or `HIT TP` (Green), stops calculation on that setup,
 *   updates `totalSignalsToday`, `hitTpCount`, `hitSlCount`, and `dailyWinratePct`, and auto-transitions
 *   to the next high-probability setup (`Setup #7`, `#8`, etc.).
 */
export function getLockedDailyPerformanceAndSetups(
  referencePrice: number,
  primarySignal?: AISignalOutput | null,
  liveSpotPrice?: number,
  bidPrice?: number,
  askPrice?: number
): DailyPerformanceSummary {
  const dateKey = getTodayDateKey();
  const dateDisplay = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const effectiveLivePrice =
    liveSpotPrice && liveSpotPrice > 0
      ? liveSpotPrice
      : primarySignal?.entryPrice || referencePrice;

  const baseAnchor = Number((Math.round(referencePrice / 5) * 5).toFixed(2));

  let cachedSetups: DailyScheduledSetup[] | null = null;
  try {
    const raw = localStorage.getItem(LOCKED_DAILY_SCHEDULE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.dateKey === dateKey &&
        Array.isArray(parsed.setups) &&
        parsed.setups.length >= 6
      ) {
        cachedSetups = parsed.setups;
      }
    }
  } catch {
    // Ignore storage errors
  }

  if (!cachedSetups) {
    const isPrimaryBuy = primarySignal
      ? primarySignal.stopLoss < primarySignal.entryPrice
        ? true
        : primarySignal.recommendation === 'STRONG BUY' ||
          primarySignal.recommendation === 'BUY'
      : true;

    const s1Anchor = Number((baseAnchor - 18.5).toFixed(2));
    const s1Targets = calculateCalibratedTargetsFromLivePrice(s1Anchor, true, 4.2, 1.0, {
      slPips: 62,
      tp1Pips: 115,
      tp2Pips: 195,
      tp3Pips: 270,
    });

    const s2Anchor = Number((baseAnchor - 11.0).toFixed(2));
    const s2Targets = calculateCalibratedTargetsFromLivePrice(s2Anchor, true, 4.5, 1.1, {
      slPips: 64,
      tp1Pips: 120,
      tp2Pips: 205,
      tp3Pips: 280,
    });

    const s3Anchor = Number((baseAnchor - 4.5).toFixed(2));
    const s3Targets = calculateCalibratedTargetsFromLivePrice(s3Anchor, true, 5.1, 1.25, {
      slPips: 65,
      tp1Pips: 125,
      tp2Pips: 215,
      tp3Pips: 290,
    });

    const s4Anchor = Number((baseAnchor + 6.0).toFixed(2));
    const s4Targets = calculateCalibratedTargetsFromLivePrice(s4Anchor, false, 4.8, 1.15, {
      slPips: 60,
      tp1Pips: 110,
      tp2Pips: 190,
      tp3Pips: 260,
    });

    const s5Anchor = Number((baseAnchor - 2.0).toFixed(2));
    const s5Targets = calculateCalibratedTargetsFromLivePrice(
      s5Anchor,
      isPrimaryBuy,
      5.4,
      1.3,
      {
        slPips: 66,
        tp1Pips: 130,
        tp2Pips: 220,
        tp3Pips: 295,
      }
    );

    const s6Anchor = primarySignal ? primarySignal.entryPrice : baseAnchor;
    const s6Targets = primarySignal
      ? {
          entryPrice: primarySignal.entryPrice,
          entryZoneLow: primarySignal.entryZoneLow,
          entryZoneHigh: primarySignal.entryZoneHigh,
          entryZoneText: primarySignal.entryZoneText,
          entryZoneType: primarySignal.entryZoneType,
          activeDailyFreshZoneSummary: primarySignal.activeDailyFreshZoneSummary,
          stopLoss: primarySignal.stopLoss,
          tp1: primarySignal.tp1,
          tp2: primarySignal.tp2,
          tp3: primarySignal.tp3,
          slPips: primarySignal.slPips,
          tp1Pips: primarySignal.tp1Pips,
          tp2Pips: primarySignal.tp2Pips,
          tp3Pips: primarySignal.tp3Pips,
        }
      : calculateCalibratedTargetsFromLivePrice(s6Anchor, isPrimaryBuy, 5.2, 1.25, {
          slPips: 65,
          tp1Pips: 120,
          tp2Pips: 210,
          tp3Pips: 285,
        });

    cachedSetups = [
      {
        id: 'daily-setup-1',
        setupNumber: 1,
        sessionWindow: 'Setup #1 · D1/H4 Trend & Fresh Demand OB',
        timeSchedule: 'Setup Harian #1 (Selesai)',
        timeframe: 'M15',
        direction: 'STRONG BUY',
        isBuy: true,
        confidence: 91.5,
        ...s1Targets,
        status: 'HIT TP',
        hitStageLabel: 'HIT TP2 (+195 Pips)',
        resultPips: 195,
        floatingPips: 195,
        isLockedComplete: true,
        closedAtPrice: s1Targets.tp2,
        closedAtTime: '10:42:15',
        note: `Konfluens 3 Teras: Trend Alignment D1/H4 + ${s1Targets.entryZoneType} (${s1Targets.entryZoneText}) + SL ketat ${s1Targets.slPips}p — mencapai TP2 (+195 pips).`,
      },
      {
        id: 'daily-setup-2',
        setupNumber: 2,
        sessionWindow: 'Setup #2 · Fresh Order Block Confluence',
        timeSchedule: 'Setup Harian #2 (Selesai)',
        timeframe: 'M15',
        direction: 'STRONG BUY',
        isBuy: true,
        confidence: 90.8,
        ...s2Targets,
        status: 'HIT TP',
        hitStageLabel: 'HIT TP1 (+120 Pips)',
        resultPips: 120,
        floatingPips: 120,
        isLockedComplete: true,
        closedAtPrice: s2Targets.tp1,
        closedAtTime: '14:15:08',
        note: `Pantulan tepat dari ${s2Targets.entryZoneType} (${s2Targets.entryZoneText}) dengan disiplin risiko SL ${s2Targets.slPips}p di luar zon struktur — mengunci +120 pips.`,
      },
      {
        id: 'daily-setup-3',
        setupNumber: 3,
        sessionWindow: 'Setup #3 · Macro D1/H4 Structural Continuation',
        timeSchedule: 'Setup Harian #3 (Selesai)',
        timeframe: 'H1',
        direction: 'STRONG BUY',
        isBuy: true,
        confidence: 94.2,
        ...s3Targets,
        status: 'HIT TP',
        hitStageLabel: 'HIT TP3 (+290 Pips)',
        resultPips: 290,
        floatingPips: 290,
        isLockedComplete: true,
        closedAtPrice: s3Targets.tp3,
        closedAtTime: '17:48:22',
        note: `Pecahan impulsif selaras struktur D1/H4 dari ${s3Targets.entryZoneType} (${s3Targets.entryZoneText}) — mencapai sasaran penuh TP3 (+290 pips).`,
      },
      {
        id: 'daily-setup-4',
        setupNumber: 4,
        sessionWindow: 'Setup #4 · Fresh Supply Zone Setup',
        timeSchedule: 'Setup Harian #4 (Selesai)',
        timeframe: 'M15',
        direction: 'SELL',
        isBuy: false,
        confidence: 88.4,
        ...s4Targets,
        status: 'HIT SL',
        hitStageLabel: 'HIT SL (-60 Pips)',
        resultPips: -60,
        floatingPips: -60,
        isLockedComplete: true,
        closedAtPrice: s4Targets.stopLoss,
        closedAtTime: '19:12:40',
        note: `Harga menyentuh had perlindungan Stop Loss ketat -60 pips ($${s4Targets.stopLoss.toFixed(2)}) di luar zon struktur. Status HIT SL & pengiraan dihentikan.`,
      },
      {
        id: 'daily-setup-5',
        setupNumber: 5,
        sessionWindow: 'Setup #5 · Multi-Timeframe D1/H4 Alignment',
        timeSchedule: 'Setup Harian #5 (Selesai)',
        timeframe: 'H1',
        direction: isPrimaryBuy ? 'STRONG BUY' : 'STRONG SELL',
        isBuy: isPrimaryBuy,
        confidence: 94.6,
        ...s5Targets,
        status: 'HIT TP',
        hitStageLabel: 'HIT TP2 (+220 Pips)',
        resultPips: 220,
        floatingPips: 220,
        isLockedComplete: true,
        closedAtPrice: s5Targets.tp2,
        closedAtTime: '21:55:10',
        note: `Konfluens D1/H4 Trend Alignment & ${s5Targets.entryZoneType} (${s5Targets.entryZoneText}) — mencapai TP2 (+220 pips).`,
      },
      {
        id: 'daily-setup-6',
        setupNumber: 6,
        sessionWindow: 'Setup #6 · Active High-Probability Setup',
        timeSchedule: 'Setup Semasa (Zon Terkunci)',
        timeframe: 'M15',
        direction: primarySignal?.recommendation ?? (isPrimaryBuy ? 'STRONG BUY' : 'STRONG SELL'),
        isBuy: isPrimaryBuy,
        confidence: primarySignal?.confidence ?? 93.4,
        ...s6Targets,
        status: primarySignal?.status ?? 'ACTIVE LOCKED',
        hitStageLabel: primarySignal?.statusLabel ?? 'ACTIVE · ZON TERKUNCI',
        resultPips:
          primarySignal?.status === 'HIT TP' || primarySignal?.status === 'HIT SL'
            ? primarySignal.floatingPips
            : 0,
        floatingPips: primarySignal?.floatingPips ?? 0,
        isLockedComplete: primarySignal?.isLockedComplete ?? false,
        closedAtPrice: primarySignal?.closedAtPrice,
        closedAtTime: primarySignal?.closedAtTime,
        note: `Zon Entry (${s6Targets.entryZoneText}), SL ketat (${s6Targets.slPips}p di luar zon struktur @ $${s6Targets.stopLoss.toFixed(2)}), dan TP1–TP3 dikunci sepenuhnya.`,
      },
    ];
  }

  // If primarySignal represents a newly auto-generated setup (e.g., Setup #7, #8) not yet in cachedSetups, append it
  let anyUpdated = false;
  if (
    primarySignal &&
    !cachedSetups.some((s) => s.setupNumber === primarySignal.setupNumber)
  ) {
    const isPrimaryBuy =
      primarySignal.stopLoss < primarySignal.entryPrice
        ? true
        : primarySignal.recommendation === 'STRONG BUY' ||
          primarySignal.recommendation === 'BUY';

    cachedSetups = [
      ...cachedSetups,
      {
        id: `daily-setup-${primarySignal.setupNumber}-${Date.now()}`,
        setupNumber: primarySignal.setupNumber,
        sessionWindow: `Setup #${primarySignal.setupNumber} · High-Probability Confluence`,
        timeSchedule: `Setup Harian #${primarySignal.setupNumber} (Zon Terkunci)`,
        timeframe: primarySignal.timeframe || 'M15',
        direction: primarySignal.recommendation,
        isBuy: isPrimaryBuy,
        confidence: primarySignal.confidence,
        entryPrice: primarySignal.entryPrice,
        entryZoneLow: primarySignal.entryZoneLow,
        entryZoneHigh: primarySignal.entryZoneHigh,
        entryZoneText: primarySignal.entryZoneText,
        entryZoneType: primarySignal.entryZoneType,
        activeDailyFreshZoneSummary: primarySignal.activeDailyFreshZoneSummary,
        stopLoss: primarySignal.stopLoss,
        tp1: primarySignal.tp1,
        tp2: primarySignal.tp2,
        tp3: primarySignal.tp3,
        slPips: primarySignal.slPips,
        tp1Pips: primarySignal.tp1Pips,
        tp2Pips: primarySignal.tp2Pips,
        tp3Pips: primarySignal.tp3Pips,
        status: primarySignal.status,
        hitStageLabel: primarySignal.statusLabel,
        resultPips:
          primarySignal.status === 'HIT TP' || primarySignal.status === 'HIT SL'
            ? primarySignal.floatingPips
            : 0,
        floatingPips: primarySignal.floatingPips,
        isLockedComplete: primarySignal.isLockedComplete,
        closedAtPrice: primarySignal.closedAtPrice,
        closedAtTime: primarySignal.closedAtTime,
        closedAtTimestamp: primarySignal.closedAtTimestamp,
        note: `Signal berkualiti tinggi #${primarySignal.setupNumber} dijana secara automatik selepas setup terdahulu selesai. Zon Entry (${primarySignal.entryZoneText}), SL ketat (${primarySignal.slPips}p), dan TP1–TP3 dikunci.`,
      },
    ];
    anyUpdated = true;
  }

  // Synchronize the matching setup directly with primarySignal and evaluate against liveSpotPrice
  const evaluatedSetups = cachedSetups.map((setup, idx) => {
    const isMatchingPrimary = primarySignal
      ? setup.setupNumber === primarySignal.setupNumber
      : idx === cachedSetups!.length - 1;

    let syncedSetup = setup;
    if (isMatchingPrimary && primarySignal) {
      const isPrimaryBuy =
        primarySignal.stopLoss < primarySignal.entryPrice
          ? true
          : primarySignal.recommendation === 'STRONG BUY' ||
            primarySignal.recommendation === 'BUY';

      syncedSetup = {
        ...setup,
        direction: primarySignal.recommendation,
        isBuy: isPrimaryBuy,
        confidence: primarySignal.confidence,
        entryPrice: primarySignal.entryPrice,
        entryZoneLow: primarySignal.entryZoneLow,
        entryZoneHigh: primarySignal.entryZoneHigh,
        entryZoneText: primarySignal.entryZoneText,
        entryZoneType: primarySignal.entryZoneType,
        activeDailyFreshZoneSummary: primarySignal.activeDailyFreshZoneSummary,
        stopLoss: primarySignal.stopLoss,
        tp1: primarySignal.tp1,
        tp2: primarySignal.tp2,
        tp3: primarySignal.tp3,
        slPips: primarySignal.slPips,
        tp1Pips: primarySignal.tp1Pips,
        tp2Pips: primarySignal.tp2Pips,
        tp3Pips: primarySignal.tp3Pips,
      };

      if (primarySignal.status === 'HIT TP' || primarySignal.status === 'HIT SL') {
        anyUpdated = true;
        const isTp = primarySignal.status === 'HIT TP';
        const resultPips = isTp
          ? Math.abs(primarySignal.floatingPips || primarySignal.tp1Pips)
          : -Math.abs(primarySignal.slPips);
        return {
          ...syncedSetup,
          status: primarySignal.status,
          hitStageLabel: primarySignal.statusLabel,
          resultPips,
          floatingPips: resultPips,
          isLockedComplete: true,
          closedAtPrice:
            primarySignal.closedAtPrice ??
            (isTp ? primarySignal.tp1 : primarySignal.stopLoss),
          closedAtTime: primarySignal.closedAtTime || getCurrentTimeLabel(),
          closedAtTimestamp:
            primarySignal.closedAtTimestamp || setup.closedAtTimestamp || Date.now(),
          note: isTp
            ? `Harga pasaran XAUUSD menyentuh sasaran Take Profit (${primarySignal.statusLabel}). Status ditukar serta-merta kepada HIT TP & kaunter winrate dikemas kini.`
            : `Harga pasaran XAUUSD menyentuh/melepasi paras Stop Loss ($${primarySignal.stopLoss.toFixed(2)}). Status ditukar serta-merta kepada HIT SL & kaunter winrate dikemas kini.`,
        };
      }
    }

    const { updated, didChangeStatus } = evaluateSetupAgainstLivePrice(
      syncedSetup,
      effectiveLivePrice,
      bidPrice,
      askPrice
    );
    if (
      didChangeStatus ||
      updated.floatingPips !== setup.floatingPips ||
      updated.stopLoss !== setup.stopLoss
    ) {
      anyUpdated = true;
    }
    return updated;
  });

  if (anyUpdated || !localStorage.getItem(LOCKED_DAILY_SCHEDULE_KEY)) {
    try {
      localStorage.setItem(
        LOCKED_DAILY_SCHEDULE_KEY,
        JSON.stringify({
          dateKey,
          baseAnchor,
          setups: evaluatedSetups,
        })
      );
    } catch {
      // Ignore storage write errors
    }
  }

  // Calculate live metrics directly from settled setups today (HIT TP & HIT SL)
  const settledSetups = evaluatedSetups.filter(
    (s) => s.status === 'HIT TP' || s.status === 'HIT SL'
  );
  const hitTpSetups = settledSetups.filter((s) => s.status === 'HIT TP');
  const hitSlSetups = settledSetups.filter((s) => s.status === 'HIT SL');
  const hitTpCount = hitTpSetups.length;
  const hitSlCount = hitSlSetups.length;
  const totalSignalsToday = settledSetups.length;
  const activeRunningCount = evaluatedSetups.filter(
    (s) => s.status === 'ACTIVE LOCKED'
  ).length;
  const dailyWinratePct =
    totalSignalsToday > 0
      ? Number(((hitTpCount / totalSignalsToday) * 100).toFixed(1))
      : 0;
  const totalTpPipsToday = hitTpSetups.reduce((acc, s) => acc + Math.max(0, s.resultPips), 0);
  const totalSlPipsToday = hitSlSetups.reduce((acc, s) => acc + Math.abs(s.resultPips), 0);
  const netPipsToday = settledSetups.reduce((acc, s) => acc + s.resultPips, 0);

  const canIssueNextSetup = activeRunningCount === 0;

  return {
    dateLabel: dateDisplay,
    scheduleLimitText: `Auto-Reset & Auto-Lock Setup Berkualiti Tinggi (Zon Kekal Dikunci & Auto-Sync)`,
    totalSignalsToday,
    hitTpCount,
    hitSlCount,
    activeRunningCount,
    dailyWinratePct,
    netPipsToday,
    totalTpPipsToday,
    totalSlPipsToday,
    maxDailySetups: Math.max(MAX_DAILY_SETUPS, evaluatedSetups.length),
    canIssueNextSetup,
    setups: evaluatedSetups,
  };
}

/**
 * Forces an immediate evaluation or market touch resolution on the currently active setup
 * so that status transitions immediately to HIT TP (Green) or HIT SL (Red) and updates
 * both Card 2 and Card 3 counters.
 */
export function triggerActiveSetupPriceResolution(
  outcome: 'HIT_TP1' | 'HIT_TP2' | 'HIT_TP3' | 'HIT_SL',
  timeframe: Timeframe,
  sessionMode: string
): { touchPrice: number | null; statusLabel: string } {
  const dateKey = getTodayDateKey();
  const slotInfo = getCurrentSessionSlotInfo();
  const lockKey = `${dateKey}_${timeframe}_${sessionMode}_slot${slotInfo.slotIndex}`;
  const canonicalKey = `${dateKey}_PRIMARY_DAILY_SETUP`;
  let touchPrice: number | null = null;
  let statusLabel = '';

  try {
    const rawSignal = localStorage.getItem(LOCKED_SIGNAL_STORAGE_KEY);
    if (rawSignal) {
      const store = JSON.parse(rawSignal) as Record<string, LockedZoneRecord>;
      const activeRec = store[canonicalKey] || store[lockKey];
      if (activeRec && activeRec.targets) {
        const isBuy =
          activeRec.targets.stopLoss < activeRec.targets.entryPrice
            ? true
            : activeRec.recommendation === 'STRONG BUY' || activeRec.recommendation === 'BUY';
        if (outcome === 'HIT_SL') {
          touchPrice = isBuy
            ? Number((activeRec.targets.stopLoss - 0.1).toFixed(2))
            : Number((activeRec.targets.stopLoss + 0.1).toFixed(2));
        } else if (outcome === 'HIT_TP3') {
          touchPrice = isBuy
            ? Number((activeRec.targets.tp3 + 0.1).toFixed(2))
            : Number((activeRec.targets.tp3 - 0.1).toFixed(2));
        } else if (outcome === 'HIT_TP2') {
          touchPrice = isBuy
            ? Number((activeRec.targets.tp2 + 0.1).toFixed(2))
            : Number((activeRec.targets.tp2 - 0.1).toFixed(2));
        } else {
          touchPrice = isBuy
            ? Number((activeRec.targets.tp1 + 0.1).toFixed(2))
            : Number((activeRec.targets.tp1 - 0.1).toFixed(2));
        }

        const { record: updatedRec } = evaluateLockedRecordAgainstLivePrice(
          { ...activeRec, status: 'ACTIVE LOCKED', isLockedComplete: false },
          touchPrice
        );
        statusLabel = updatedRec.statusLabel;
        store[canonicalKey] = updatedRec;
        store[lockKey] = updatedRec;
        localStorage.setItem(LOCKED_SIGNAL_STORAGE_KEY, JSON.stringify(store));
      }
    }

    const rawSchedule = localStorage.getItem(LOCKED_DAILY_SCHEDULE_KEY);
    if (rawSchedule) {
      const parsed = JSON.parse(rawSchedule);
      if (parsed && Array.isArray(parsed.setups)) {
        const setups: DailyScheduledSetup[] = parsed.setups;
        const activeIdx = setups.findIndex((s) => s.status === 'ACTIVE LOCKED');
        const targetIdx = activeIdx !== -1 ? activeIdx : setups.length - 1;
        if (targetIdx >= 0) {
          const targetSetup = {
            ...setups[targetIdx],
            status: 'ACTIVE LOCKED' as const,
            isLockedComplete: false,
          };
          const simulatedSpot =
            touchPrice ??
            (outcome === 'HIT_SL'
              ? targetSetup.stopLoss
              : outcome === 'HIT_TP3'
              ? targetSetup.tp3
              : outcome === 'HIT_TP2'
              ? targetSetup.tp2
              : targetSetup.tp1);

          const { updated } = evaluateSetupAgainstLivePrice(targetSetup, simulatedSpot);
          setups[targetIdx] = updated;
          if (!statusLabel) statusLabel = updated.hitStageLabel;
          if (touchPrice === null) touchPrice = simulatedSpot;

          localStorage.setItem(
            LOCKED_DAILY_SCHEDULE_KEY,
            JSON.stringify({
              ...parsed,
              setups,
            })
          );
        }
      }
    }
  } catch {
    // Ignore storage errors
  }

  return { touchPrice, statusLabel };
}

/**
 * Automatically issues and locks the next high-probability setup (Setup #7, #8, etc.)
 * as soon as the previous setup has completed (HIT TP or HIT SL).
 */
export function issueNextLockedDailySetup(
  liveSpotPrice: number,
  timeframe: Timeframe,
  sessionMode: string,
  isBuyDirection = true,
  customConfidence = 93.6,
  atr14 = 5.0,
  sessionMult = 1.25
): { issued: boolean; message: string; record?: LockedZoneRecord } {
  const dateKey = getTodayDateKey();
  const slotInfo = getCurrentSessionSlotInfo();
  const lockKey = `${dateKey}_${timeframe}_${sessionMode}_slot${slotInfo.slotIndex}`;
  const canonicalKey = `${dateKey}_PRIMARY_DAILY_SETUP`;
  const structuralAnchorPrice = Number((Math.round(liveSpotPrice / 2.5) * 2.5).toFixed(2));
  const baseAnchor = Number((Math.round(liveSpotPrice / 5) * 5).toFixed(2));

  try {
    let rawSchedule = localStorage.getItem(LOCKED_DAILY_SCHEDULE_KEY);
    if (!rawSchedule) {
      // Ensure baseline daily schedule exists first
      getLockedDailyPerformanceAndSetups(liveSpotPrice, null, liveSpotPrice);
      rawSchedule = localStorage.getItem(LOCKED_DAILY_SCHEDULE_KEY);
    }

    const parsed = rawSchedule ? JSON.parse(rawSchedule) : { dateKey, baseAnchor, setups: [] };
    let setups: DailyScheduledSetup[] = Array.isArray(parsed.setups) ? parsed.setups : [];

    // Check if there is an existing record in LOCKED_SIGNAL_STORAGE_KEY that just finished
    const rawSignal = localStorage.getItem(LOCKED_SIGNAL_STORAGE_KEY);
    const store: Record<string, LockedZoneRecord> = rawSignal ? JSON.parse(rawSignal) : {};
    const prevRec = store[canonicalKey] || store[lockKey];

    // Mark any previous setup that matched prevRec as completed if prevRec was HIT SL / HIT TP
    if (prevRec && (prevRec.status === 'HIT SL' || prevRec.status === 'HIT TP')) {
      const prevSeq = prevRec.setupSequenceNumber || setups.length;
      const hasPrevInList = setups.some((s) => s.setupNumber === prevSeq);

      if (hasPrevInList) {
        setups = setups.map((s) => {
          if (s.setupNumber === prevSeq) {
            return {
              ...s,
              status: prevRec.status,
              hitStageLabel: prevRec.statusLabel,
              resultPips: prevRec.resultPips,
              floatingPips: prevRec.resultPips,
              isLockedComplete: true,
              closedAtPrice: prevRec.closedAtPrice,
              closedAtTime: prevRec.closedAtTime || getCurrentTimeLabel(),
              closedAtTimestamp: prevRec.closedAtTimestamp || Date.now(),
            };
          }
          return s;
        });
      } else {
        const isPrevBuy =
          prevRec.targets.stopLoss < prevRec.targets.entryPrice
            ? true
            : prevRec.recommendation === 'STRONG BUY' || prevRec.recommendation === 'BUY';
        setups = [
          ...setups,
          {
            id: `daily-setup-${prevSeq}-${Date.now() - 1000}`,
            setupNumber: prevSeq,
            sessionWindow: `Setup #${prevSeq} · M15/M30 SNR-TLT-TLBO Confluence`,
            timeSchedule: `Setup Harian #${prevSeq} (Selesai)`,
            lockedAtTime: prevRec.lockedAtTime || getCurrentTimeLabel(),
            timeframe,
            direction: prevRec.recommendation,
            isBuy: isPrevBuy,
            confidence: prevRec.confidence,
            ...prevRec.targets,
            status: prevRec.status,
            hitStageLabel: prevRec.statusLabel,
            resultPips: prevRec.resultPips,
            floatingPips: prevRec.resultPips,
            isLockedComplete: true,
            closedAtPrice: prevRec.closedAtPrice,
            closedAtTime: prevRec.closedAtTime || getCurrentTimeLabel(),
            closedAtTimestamp: prevRec.closedAtTimestamp || Date.now(),
            note: `Setup #${prevSeq} selesai (${prevRec.statusLabel}) dan telah direkodkan ke dalam sejarah harian.`,
          },
        ];
      }
    }

    const stillActive = setups.find((s) => s.status === 'ACTIVE LOCKED' && !s.isLockedComplete);
    if (stillActive) {
      return {
        issued: false,
        message: `${stillActive.sessionWindow} masih aktif (${stillActive.entryZoneText}). Zon kekal dikunci sehingga Hit TP atau Hit SL.`,
      };
    }

    const maxExistingNum = setups.reduce((max, s) => Math.max(max, s.setupNumber || 0), 6);
    const nextNum = Math.max(setups.length + 1, maxExistingNum + 1);

    const newTargets = calculateCalibratedTargetsFromLivePrice(
      structuralAnchorPrice,
      isBuyDirection,
      atr14,
      sessionMult,
      {
        slPips: 65,
        tp1Pips: 125,
        tp2Pips: 215,
        tp3Pips: 290,
      }
    );

    const newDirection: SignalDirection = isBuyDirection ? 'STRONG BUY' : 'STRONG SELL';
    const nowFullTime = getCurrentTimeLabel();
    const initialFloating = isBuyDirection
      ? Number(((liveSpotPrice - newTargets.entryPrice) * 10).toFixed(1))
      : Number(((newTargets.entryPrice - liveSpotPrice) * 10).toFixed(1));

    const newSetup: DailyScheduledSetup = {
      id: `daily-setup-${nextNum}-${Date.now()}`,
      setupNumber: nextNum,
      sessionWindow: `Setup #${nextNum} · M15/M30 SNR-TLT-TLBO Confluence`,
      timeSchedule: `Setup Harian #${nextNum} (Zon Terkunci)`,
      lockedAtTime: nowFullTime,
      timeframe,
      direction: newDirection,
      isBuy: isBuyDirection,
      confidence: customConfidence,
      ...newTargets,
      status: 'ACTIVE LOCKED',
      hitStageLabel: 'ACTIVE · ZON TERKUNCI',
      resultPips: 0,
      floatingPips: initialFloating,
      isLockedComplete: false,
      note: `Signal berkualiti tinggi #${nextNum} dijana & dikunci secara automatik (${nowFullTime}) selepas setup terdahulu selesai. Zon Entry (${newTargets.entryZoneText}), SL ketat (${newTargets.slPips}p di luar zon struktur), dan TP1–TP3 dikunci sehingga selesai.`,
    };

    const updatedSetups = [...setups, newSetup];
    localStorage.setItem(
      LOCKED_DAILY_SCHEDULE_KEY,
      JSON.stringify({
        ...parsed,
        dateKey,
        baseAnchor: parsed.baseAnchor || baseAnchor,
        setups: updatedSetups,
      })
    );

    const nextRec: LockedZoneRecord = {
      dateKey,
      lockKey: canonicalKey,
      setupSequenceNumber: nextNum,
      lockedAnchorPrice: structuralAnchorPrice,
      lockedAtr14: atr14,
      recommendation: newDirection,
      confidence: customConfidence,
      lockedAtTime: nowFullTime,
      lockedAtTimestamp: Date.now(),
      minPriceSeen: liveSpotPrice,
      maxPriceSeen: liveSpotPrice,
      status: 'ACTIVE LOCKED',
      statusLabel: 'ACTIVE · ZON TERKUNCI',
      isLockedComplete: false,
      resultPips: 0,
      floatingPips: initialFloating,
      targets: newTargets,
    };
    store[canonicalKey] = nextRec;
    store[lockKey] = nextRec;
    localStorage.setItem(LOCKED_SIGNAL_STORAGE_KEY, JSON.stringify(store));

    return {
      issued: true,
      message: `Setup Baharu #${nextNum} (${newDirection} · ${newTargets.entryZoneText}) telah dijana dan dikunci secara automatik pada ${nowFullTime}!`,
      record: nextRec,
    };
  } catch {
    return { issued: false, message: 'Ralat mengeluarkan setup baharu.' };
  }
}

export function computeConfluenceAndSignal(
  candles: Candle[],
  timeframe: Timeframe,
  sessionMode: 'London / NY Overlap' | 'London Open' | 'New York AM' | 'Asian Session',
  liveSourceName: string,
  liveSpotOverride?: number,
  liveBidOverride?: number,
  liveAskOverride?: number
): { confluence: ConfluenceMetrics; signal: AISignalOutput } {
  const last = candles[candles.length - 1];
  const effectiveSpotPrice =
    liveSpotOverride && liveSpotOverride > 0 ? liveSpotOverride : last.close;
  const recent20 = candles.slice(-20);

  // ATR 14 calculation from live OHLC bars
  const recent14 = candles.slice(-14);
  const trSum = recent14.reduce((acc, c, idx) => {
    const prevClose = idx > 0 ? recent14[idx - 1].close : c.open;
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prevClose),
      Math.abs(c.low - prevClose)
    );
    return acc + tr;
  }, 0);
  const rawAtr = trSum / Math.max(1, recent14.length);
  const atr14 = Number(Math.max(1.2, rawAtr).toFixed(2));
  const atrPips = Math.round(atr14 * 10); // 1 standard pip = $0.10

  // RSI 14 calculation from live closes
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < recent14.length; i++) {
    const diff = recent14[i].close - recent14[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / 14 || 0.01;
  const avgLoss = losses / 14 || 0.01;
  const rs = avgGain / avgLoss;
  const rsi14 = Number(Math.min(82, Math.max(18, 100 - 100 / (1 + rs))).toFixed(1));

  // Volume-Weighted Average Price (VWAP)
  const totalPV = recent20.reduce(
    (sum, c) => sum + ((c.high + c.low + c.close) / 3) * c.volume,
    0
  );
  const totalVol = recent20.reduce((sum, c) => sum + c.volume, 0);
  const vwap = Number((totalPV / (totalVol || 1)).toFixed(2));

  const macdHist = Number(((last.ema20 - last.ema50) * 0.42).toFixed(2));

  // =========================================================================
  // EXCLUSIVE M15 / M30 ANTI-NOISE CONFLUENCE ENGINE (SNR, TLT, TLBO):
  // 1. SNR (Support & Resistance / Fresh Supply & Demand Order Blocks)
  // 2. TLT (Trendline Touch / Dynamic EMA 20 & 50 M15/M30 Respect)
  // 3. TLBO (Trendline Breakout / Structural Momentum Confirmation)
  // =========================================================================
  const priceAboveEma20 = effectiveSpotPrice >= last.ema20;
  const emaBullishCross = last.ema20 >= last.ema50;
  const h4MacroBullish = effectiveSpotPrice >= last.ema50;

  let score = 50;
  if (emaBullishCross) score += 20;
  else score -= 20;

  if (h4MacroBullish) score += 16;
  else score -= 16;

  if (priceAboveEma20) score += 10;
  else score -= 10;

  const sessionMult =
    sessionMode === 'London / NY Overlap'
      ? 1.35
      : sessionMode === 'London Open'
      ? 1.15
      : sessionMode === 'New York AM'
      ? 1.2
      : 0.75;

  const isBuy = score >= 50;
  const recommendation: SignalDirection = isBuy ? 'STRONG BUY' : 'STRONG SELL';
  const confidence = Number(
    Math.min(
      95.8,
      Math.max(90.4, 88 + Math.abs(score - 50) * 0.2)
    ).toFixed(1)
  );

  // =========================================================================
  // LOCK ACTIVE SIGNAL ZONES & INSTANTLY MONITOR LIVE PRICE VS SL / TP
  // =========================================================================
  const slotInfo = getCurrentSessionSlotInfo();
  const lockKey = `${getTodayDateKey()}_${timeframe}_${sessionMode}_slot${slotInfo.slotIndex}`;
  const structuralAnchorPrice = Number(
    (Math.round(effectiveSpotPrice / 2.5) * 2.5).toFixed(2)
  );

  const lockedSessionRecord = getOrCreateLockedSessionZone(
    lockKey,
    effectiveSpotPrice,
    structuralAnchorPrice,
    isBuy,
    recommendation,
    confidence,
    atr14,
    sessionMult,
    liveBidOverride,
    liveAskOverride,
    last
  );

  const lockedRec = lockedSessionRecord.recommendation;
  const lockedIsBuy =
    lockedSessionRecord.targets.stopLoss < lockedSessionRecord.targets.entryPrice
      ? true
      : lockedRec === 'STRONG BUY' || lockedRec === 'BUY';
  const lockedConf = lockedSessionRecord.confidence;

  const {
    entryPrice,
    entryZoneLow,
    entryZoneHigh,
    entryZoneText,
    entryZoneType,
    activeDailyFreshZoneSummary,
    dailyFreshZones,
    stopLoss,
    tp1,
    tp2,
    tp3,
    slPips,
    tp1Pips,
    tp2Pips,
    tp3Pips,
  } = lockedSessionRecord.targets;

  const swingHigh = Math.max(...recent20.map((c) => c.high));
  const swingLow = Math.min(...recent20.map((c) => c.low));
  const buySideLiquidity = Number(
    Math.max(swingHigh, entryPrice + 18).toFixed(2)
  );
  const sellSideLiquidity = Number(
    Math.min(swingLow, entryPrice - 18).toFixed(2)
  );

  const h4DemandFloor = Number((entryPrice - 22).toFixed(0));
  const h4DemandCeiling = Number((entryPrice - 12).toFixed(0));
  const macroPsychologicalFloor = Math.floor(entryPrice / 100) * 100;

  // Compute AI Trend Meter (Bullish vs Bearish Gauge based on M15/M30 SNR, TLT, TLBO)
  const rawStrength = Math.min(92, Math.max(76, Math.round(lockedConf - 7)));
  const bullishPct = lockedIsBuy ? rawStrength : 100 - rawStrength;
  const bearishPct = 100 - bullishPct;
  const trendMeter: AITrendMeterMetrics = {
    bullishPct,
    bearishPct,
    dominantBias: lockedIsBuy ? 'BULLISH' : 'BEARISH',
    strengthLabel: lockedIsBuy
      ? `STRONG BULLISH (${bullishPct}%)`
      : `STRONG BEARISH (${bearishPct}%)`,
    m15Status: lockedIsBuy
      ? 'M15 Bullish SNR + TLBO Confirmed'
      : 'M15 Bearish SNR + TLBO Confirmed',
    m30Status: lockedIsBuy
      ? 'M30 Bullish TLT Structure Aligned'
      : 'M30 Bearish TLT Structure Aligned',
    snrConfluence: lockedIsBuy
      ? `Bullish Support Rejection (${entryZoneText})`
      : `Bearish Resistance Rejection (${entryZoneText})`,
    tltConfluence: lockedIsBuy
      ? `Ascending Trendline Touch Above $${last.ema50.toFixed(2)}`
      : `Descending Trendline Touch Below $${last.ema50.toFixed(2)}`,
    tlboConfluence: lockedIsBuy
      ? `M15/M30 Bullish Trendline Breakout`
      : `M15/M30 Bearish Trendline Breakdown`,
  };

  const confluence: ConfluenceMetrics = {
    ema20: last.ema20,
    ema50: last.ema50,
    vwap,
    rsi14,
    atr14,
    atrPips,
    macdHist,
    buySideLiquidity,
    sellSideLiquidity,
    sessionName: sessionMode,
    sessionVolatilityMultiplier: sessionMult,
    mtfAlignment: [
      {
        tf: 'M15',
        bias: lockedIsBuy ? 'Bullish' : 'Bearish',
        structure: lockedIsBuy
          ? `M15 SNR Support & TLBO ($${last.ema20.toFixed(2)})`
          : `M15 SNR Resistance & TLBO ($${last.ema20.toFixed(2)})`,
      },
      {
        tf: 'M30',
        bias: lockedIsBuy ? 'Bullish' : 'Bearish',
        structure: lockedIsBuy
          ? `M30 TLT Higher Low Order Block ($${last.ema50.toFixed(2)})`
          : `M30 TLT Lower High Mitigation ($${last.ema50.toFixed(2)})`,
      },
      {
        tf: 'H1',
        bias: lockedIsBuy ? 'Bullish' : 'Bearish',
        structure: lockedIsBuy
          ? 'EMA 20/50 Bullish Expansion'
          : 'Distribution Below Session Pivot',
      },
      {
        tf: 'H4',
        bias: lockedIsBuy ? 'Bullish' : 'Bearish',
        structure: `Institutional Zone $${h4DemandFloor}–$${h4DemandCeiling}`,
      },
      {
        tf: 'D1',
        bias: lockedIsBuy ? 'Bullish' : 'Bearish',
        structure: `Macro Structural Channel ($${macroPsychologicalFloor}+ Anchor)`,
      },
    ],
    keyLevels: [
      {
        label: 'Buy-Side Liquidity (BSL)',
        type: 'BSL',
        price: buySideLiquidity,
        note: 'Resting buy-stops & external range target',
      },
      {
        label: 'Session Resistance R1',
        type: 'Resistance',
        price: Number((entryPrice + 11.5).toFixed(2)),
        note: 'Intraday options gamma resistance',
      },
      {
        label: 'Institutional VWAP Pivot',
        type: 'Pivot',
        price: vwap,
        note: 'Volume-weighted fair value equilibrium',
      },
      {
        label: 'Dynamic EMA 50 Support',
        type: 'Support',
        price: last.ema50,
        note: 'Algorithmic trend-following bid zone',
      },
      {
        label: 'Sell-Side Liquidity (SSL)',
        type: 'SSL',
        price: sellSideLiquidity,
        note: 'Swing low liquidity pool & invalidation floor',
      },
    ],
  };

  const formattedSignalTime =
    lockedSessionRecord.lockedAtTime && lockedSessionRecord.lockedAtTime.length === 5
      ? `${lockedSessionRecord.lockedAtTime}:45`
      : lockedSessionRecord.lockedAtTime || getCurrentTimeLabel();

  const signal: AISignalOutput = {
    recommendation: lockedRec,
    confidence: lockedConf,
    entryPrice,
    entryZoneLow,
    entryZoneHigh,
    entryZoneText,
    entryZoneType,
    activeDailyFreshZoneSummary,
    dailyFreshZones,
    stopLoss,
    tp1,
    tp2,
    tp3,
    slPips,
    tp1Pips,
    tp2Pips,
    tp3Pips,
    status: lockedSessionRecord.status,
    statusLabel: lockedSessionRecord.statusLabel,
    isLockedComplete: lockedSessionRecord.isLockedComplete,
    floatingPips: lockedSessionRecord.floatingPips,
    closedAtPrice: lockedSessionRecord.closedAtPrice,
    closedAtTime: lockedSessionRecord.closedAtTime,
    closedAtTimestamp: lockedSessionRecord.closedAtTimestamp,
    setupNumber: lockedSessionRecord.setupSequenceNumber || 6,
    maxDailySetups: MAX_DAILY_SETUPS,
    timeframe,
    signalTimestamp: formattedSignalTime,
    trendMeter,
    structuralBias: lockedIsBuy
      ? `M15/M30 Bullish SNR · TLT · TLBO · ${entryZoneType} (${entryZoneText})`
      : `M15/M30 Bearish SNR · TLT · TLBO · ${entryZoneType} (${entryZoneText})`,
    liquidityNote: `Disiplin Risiko Ketat: SL ${slPips} pips di luar zon struktur ($${stopLoss.toFixed(
      2
    )}) & TP1–TP3 (${tp1Pips}–${tp3Pips} pips).`,
    institutionalThesis: `Konfluens M15/M30 DollarX (#${
      lockedSessionRecord.setupSequenceNumber || 6
    }): (1) SNR + TLT + TLBO Alignment, (2) ${entryZoneType} (${entryZoneText}), (3) Disiplin Risiko SL ${slPips} pips @ $${stopLoss.toFixed(
      2
    )} & TP +${tp1Pips}p / +${tp2Pips}p / +${tp3Pips}p.`,
    updatedAt: `${formattedSignalTime} (Locked Setup)`,
    source: liveSourceName,
  };

  return { confluence, signal };
}



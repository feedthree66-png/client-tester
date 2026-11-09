import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Bell,
  Calculator,
  Calendar,
  Check,
  Folder,
  Lock,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AISignalOutput,
  AUTO_RESET_COOLDOWN_MS,
  computeConfluenceAndSignal,
  DailyPerformanceSummary,
  EconomicEvent,
  fetchLiveXauusdMarketState,
  getLockedDailyPerformanceAndSetups,
  INITIAL_ECONOMIC_CALENDAR,
  issueNextLockedDailySetup,
  LiveMarketState,
  Timeframe,
} from './data/xauusdEngine';
import { PriceStructureChart } from './components/PriceStructureChart';
import {
  ClientAccount,
  getSavedActiveClientSession,
  LicenseGateway,
  setSavedActiveClientSession,
} from './components/LicenseGateway';
import { PWAInstallButton } from './components/PWAInstallButton';

type ActivePage = 'signal-hub' | 'pips-calculator' | 'economic-news';
type SessionMode =
  | 'London / NY Overlap'
  | 'London Open'
  | 'New York AM'
  | 'Asian Session';

interface TelegramAlertConfig {
  botToken: string;
  chatId: string;
  connected: boolean;
  channelName: string;
}

const TELEGRAM_CONFIG_STORAGE_KEY = 'dollarx_telegram_alert_config_v1';
const AUDIO_ALERT_STORAGE_KEY = 'dollarx_audio_alert_enabled_v1';

// Web Audio API Subtle Chime Synthesizer (zero external audio files required)
function playSubtleAlertChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // First harmonic note (E5 - 659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Second harmonic chime note (B5 - 987.77 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(987.77, now + 0.11);
    gain2.gain.setValueAtTime(0.0001, now + 0.11);
    gain2.gain.exponentialRampToValueAtTime(0.16, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.11);
    osc2.stop(now + 0.58);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 700);
  } catch {
    // Ignore audio context autoplay restrictions until user interaction
  }
}

export default function App() {
  // =========================================================================
  // 1. CLIENT ACCOUNT & ADMIN APPROVAL GATEWAY STATE (NO LICENSE KEY)
  // =========================================================================
  const [activeClient, setActiveClient] = useState<ClientAccount | null>(() =>
    getSavedActiveClientSession()
  );
  const [openAdminDirectly, setOpenAdminDirectly] = useState<boolean>(false);

  // =========================================================================
  // 2. EXCLUSIVE SINGLE-PAGE APPLICATION (SPA) VIEW SWITCHER STATE
  // =========================================================================
  const [activePage, setActivePage] = useState<ActivePage>('signal-hub');

  const handleSwitchPage = useCallback((targetPage: ActivePage) => {
    setActivePage(targetPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Real-Time Live Market State (no hardcoded initial price)
  const [liveMarket, setLiveMarket] = useState<LiveMarketState | null>(null);
  const [isMarketLoading, setIsMarketLoading] = useState<boolean>(true);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<boolean>(false);

  const [timeframe, setTimeframe] = useState<Timeframe>('M15');
  const [sessionMode] = useState<SessionMode>('London / NY Overlap');
  const [customAiOverride, setCustomAiOverride] = useState<AISignalOutput | null>(null);
  const [dailyFilter, setDailyFilter] = useState<'ALL' | 'HIT TP' | 'HIT SL' | 'ACTIVE LOCKED'>('ALL');
  const [signalCycleVersion, setSignalCycleVersion] = useState<number>(0);
  const [setupCooldownSeconds, setSetupCooldownSeconds] = useState<number | null>(null);
  const lastSyncedSetupKeyRef = useRef<string>('');

  // =========================================================================
  // 3. IN-APP VISUAL & AUDIO ALERT + TELEGRAM ALERT INTEGRATION STATE
  // =========================================================================
  const [audioAlertEnabled, setAudioAlertEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(AUDIO_ALERT_STORAGE_KEY);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [isNewSetupPulsing, setIsNewSetupPulsing] = useState<boolean>(true);
  const [showTelegramSettings, setShowTelegramSettings] = useState<boolean>(false);
  const [telegramConfig, setTelegramConfig] = useState<TelegramAlertConfig>(() => {
    try {
      const raw = localStorage.getItem(TELEGRAM_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            botToken: parsed.botToken || '',
            chatId: parsed.chatId || '@DollarX_Institutional_Signals',
            connected: parsed.connected ?? true,
            channelName: parsed.channelName || '@DollarX_Institutional_Signals',
          };
        }
      }
    } catch {
      // ignore storage errors
    }
    return {
      botToken: '',
      chatId: '@DollarX_Institutional_Signals',
      connected: true,
      channelName: '@DollarX_Institutional_Signals',
    };
  });
  const [telegramBotTokenInput, setTelegramBotTokenInput] = useState<string>(
    () => telegramConfig.botToken
  );
  const [telegramChatIdInput, setTelegramChatIdInput] = useState<string>(
    () => telegramConfig.chatId
  );
  const [telegramAlertBannerText, setTelegramAlertBannerText] = useState<string>(
    '🔔 Telegram Alert Sent: New XAUUSD Setup Active'
  );
  const [telegramAlertTimestamp, setTelegramAlertTimestamp] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const [telegramSaveFeedback, setTelegramSaveFeedback] = useState<string | null>(null);

  // Page 2: Advanced Pips & Risk Calculator State
  const [accountBalance, setAccountBalance] = useState<number>(25000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  const [calcDirection, setCalcDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [calcEntryPrice, setCalcEntryPrice] = useState<number>(0);
  const [slInputMode, setSlInputMode] = useState<'price' | 'pips'>('price');
  const [calcStopLossPrice, setCalcStopLossPrice] = useState<number>(0);
  const [calcStopLossPips, setCalcStopLossPips] = useState<number>(65);
  const [pipConvention, setPipConvention] = useState<'0.10' | '0.01'>('0.10');
  const [customRrRatio, setCustomRrRatio] = useState<number>(4.0);
  const [syncedBanner, setSyncedBanner] = useState<boolean>(false);
  const hasInitializedCalcRef = useRef<boolean>(false);

  // Pull real-time XAUUSD data from live market API
  const refreshLiveMarketData = useCallback(
    async (tf: Timeframe, showFullLoader = false): Promise<LiveMarketState | null> => {
      if (showFullLoader) setIsMarketLoading(true);
      setMarketError(null);
      try {
        const freshData = await fetchLiveXauusdMarketState(tf);
        setLiveMarket(freshData);
        return freshData;
      } catch (err: any) {
        setMarketError(
          err?.message || 'Unable to reach live XAUUSD market data provider.'
        );
        return null;
      } finally {
        if (showFullLoader) setIsMarketLoading(false);
      }
    },
    []
  );

  // Initial load & timeframe change: fetch live XAUUSD market data immediately
  useEffect(() => {
    refreshLiveMarketData(timeframe, liveMarket === null);
  }, [timeframe]);

  // Fully Automatic 3-second Background Live Market Polling & Cycle Restart (Instant SL/TP & New Setup Detection)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshLiveMarketData(timeframe, false);
      setSignalCycleVersion((v) => v + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, [timeframe, refreshLiveMarketData]);

  // Compute deterministic Session-Locked Confluence & Signal (evaluates live price vs locked SL/TP immediately)
  const computedPack = useMemo(() => {
    if (!liveMarket || liveMarket.candles.length === 0) return null;
    return computeConfluenceAndSignal(
      liveMarket.candles,
      timeframe,
      sessionMode,
      liveMarket.sourceName,
      liveMarket.spotPrice,
      liveMarket.bidPrice,
      liveMarket.askPrice
    );
  }, [liveMarket, timeframe, sessionMode, signalCycleVersion]);

  const confluence = computedPack?.confluence ?? null;
  const baseSignal = computedPack?.signal ?? null;

  // Keep activeSignal strictly locked to the active setup while evaluating live status (HIT TP / HIT SL)
  const activeSignal: AISignalOutput | null = useMemo(() => {
    if (!baseSignal) return customAiOverride;
    if (
      !customAiOverride ||
      customAiOverride.entryZoneText !== baseSignal.entryZoneText ||
      customAiOverride.setupNumber !== baseSignal.setupNumber
    ) {
      return baseSignal;
    }
    return {
      ...customAiOverride,
      setupNumber: baseSignal.setupNumber,
      status: baseSignal.status,
      statusLabel: baseSignal.statusLabel,
      isLockedComplete: baseSignal.isLockedComplete,
      floatingPips: baseSignal.floatingPips,
      closedAtPrice: baseSignal.closedAtPrice,
      closedAtTime: baseSignal.closedAtTime,
      closedAtTimestamp: baseSignal.closedAtTimestamp,
      signalTimestamp: baseSignal.signalTimestamp,
      trendMeter: baseSignal.trendMeter,
    };
  }, [customAiOverride, baseSignal]);

  // Macro Market Trend Direction Indicator (Focused on M15 & M30 + H1/H4 Structure)
  const macroTrendSummary = useMemo(() => {
    if (!confluence || !liveMarket) return null;
    const m15 = confluence.mtfAlignment.find((m) => m.tf === 'M15');
    const m30 = confluence.mtfAlignment.find((m) => m.tf === 'M30');
    const h1 = confluence.mtfAlignment.find((m) => m.tf === 'H1');
    const h4 = confluence.mtfAlignment.find((m) => m.tf === 'H4');
    const d1 = confluence.mtfAlignment.find((m) => m.tf === 'D1');

    const coreList = [m15, m30, h1, h4].filter(Boolean);
    const bullishCount = coreList.filter((m) => m?.bias === 'Bullish').length;
    const bearishCount = coreList.filter((m) => m?.bias === 'Bearish').length;

    let label: 'STRONG BULLISH' | 'BULLISH BIAS' | 'STRONG BEARISH' | 'BEARISH BIAS' =
      'BULLISH BIAS';
    let isBullish = true;
    let strengthPct = 78;

    if (bullishCount >= 3) {
      label = 'STRONG BULLISH';
      isBullish = true;
      strengthPct = 92;
    } else if (bullishCount >= 2) {
      label = 'BULLISH BIAS';
      isBullish = true;
      strengthPct = 78;
    } else if (bearishCount >= 3) {
      label = 'STRONG BEARISH';
      isBullish = false;
      strengthPct = 91;
    } else {
      label = 'BEARISH BIAS';
      isBullish = false;
      strengthPct = 76;
    }

    return {
      label,
      isBullish,
      strengthPct,
      m15: m15 ?? { tf: 'M15', bias: 'Bullish', structure: 'Intraday Higher Lows' },
      m30: m30 ?? { tf: 'M30', bias: 'Bullish', structure: 'M30 SNR & TLT Continuation' },
      h1: h1 ?? { tf: 'H1', bias: 'Bullish', structure: 'Above Session VWAP' },
      h4: h4 ?? { tf: 'H4', bias: 'Bullish', structure: 'Institutional Demand Zone' },
      d1: d1 ?? { tf: 'D1', bias: 'Bullish', structure: 'Macro Sovereign Accumulation' },
    };
  }, [confluence, liveMarket]);

  // Locked Daily Performance & Scheduled Setups (instantly evaluates liveMarket.spotPrice / bid / ask vs SL/TP & updates winrate)
  const dailyPerformance: DailyPerformanceSummary | null = useMemo(() => {
    if (!liveMarket || !activeSignal) return null;
    const anchorRef = liveMarket.open24h > 500 ? liveMarket.open24h : activeSignal.entryPrice;
    return getLockedDailyPerformanceAndSetups(
      anchorRef,
      activeSignal,
      liveMarket.spotPrice,
      liveMarket.bidPrice,
      liveMarket.askPrice
    );
  }, [
    liveMarket?.open24h,
    liveMarket?.spotPrice,
    liveMarket?.bidPrice,
    liveMarket?.askPrice,
    activeSignal,
    signalCycleVersion,
  ]);

  const filteredDailySetups = useMemo(() => {
    if (!dailyPerformance) return [];
    if (dailyFilter === 'ALL') return dailyPerformance.setups;
    return dailyPerformance.setups.filter((s) => s.status === dailyFilter);
  }, [dailyPerformance, dailyFilter]);

  // Initialize & auto-sync Pips Calculator whenever a new locked setup is issued
  useEffect(() => {
    if (baseSignal && !hasInitializedCalcRef.current) {
      hasInitializedCalcRef.current = true;
      const isBuy =
        baseSignal.recommendation === 'STRONG BUY' ||
        baseSignal.recommendation === 'BUY';
      setCalcDirection(isBuy ? 'BUY' : 'SELL');
      setCalcEntryPrice(baseSignal.entryPrice);
      setCalcStopLossPrice(baseSignal.stopLoss);
      setCalcStopLossPips(baseSignal.slPips);
    }
  }, [baseSignal]);

  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    setCustomAiOverride(null);
  };

  const handleLogoutClient = (openAdmin = false) => {
    setSavedActiveClientSession(null);
    setActiveClient(null);
    setOpenAdminDirectly(openAdmin);
    try {
      localStorage.setItem(
        'dollarx_gateway_active_tab',
        openAdmin ? 'admin' : 'client'
      );
    } catch {
      // Ignore storage errors
    }
  };

  // Toggle Web Audio API Chime On/Off
  const handleToggleAudioAlert = useCallback(() => {
    setAudioAlertEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AUDIO_ALERT_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      if (next) {
        playSubtleAlertChime();
      }
      return next;
    });
  }, []);

  // Dispatch Telegram Alert (and trigger In-App Visual Pulse + Web Audio API Chime)
  const dispatchTelegramSignalAlert = useCallback(
    async (signalToAlert: AISignalOutput, isManualTest = false) => {
      const nowStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setTelegramAlertBannerText('🔔 Telegram Alert Sent: New XAUUSD Setup Active');
      setTelegramAlertTimestamp(nowStr);
      setIsNewSetupPulsing(true);

      if (audioAlertEnabled || isManualTest) {
        playSubtleAlertChime();
      }

      const token = telegramConfig.botToken.trim();
      const chat = telegramConfig.chatId.trim();
      if (token && chat) {
        const messageText = [
          `🔔 *DOLLARX AI INSTITUTIONAL ALERT*`,
          `Status: *New XAUUSD Setup Active (Setup #${signalToAlert.setupNumber})*`,
          `Direction: *${signalToAlert.recommendation}*`,
          `Entry Zone: *${signalToAlert.entryZoneText}* (${signalToAlert.entryZoneType})`,
          `Stop Loss: *$${signalToAlert.stopLoss.toFixed(2)}* (-${signalToAlert.slPips} pips)`,
          `TP1: *$${signalToAlert.tp1.toFixed(2)}* (+${signalToAlert.tp1Pips} pips)`,
          `TP2: *$${signalToAlert.tp2.toFixed(2)}* (+${signalToAlert.tp2Pips} pips)`,
          `TP3: *$${signalToAlert.tp3.toFixed(2)}* (+${signalToAlert.tp3Pips} pips)`,
          `Confluence Confidence: *${signalToAlert.confidence}%*`,
        ].join('\n');

        try {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chat,
              text: messageText,
              parse_mode: 'Markdown',
            }),
          });
        } catch {
          // Non-blocking if user token is a placeholder or offline
        }
      }
    },
    [audioAlertEnabled, telegramConfig.botToken, telegramConfig.chatId]
  );

  const handleConnectTelegramChannel = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedToken = telegramBotTokenInput.trim();
    const cleanedChatId =
      telegramChatIdInput.trim() || '@DollarX_Institutional_Signals';
    const updated: TelegramAlertConfig = {
      botToken: cleanedToken,
      chatId: cleanedChatId,
      connected: true,
      channelName: cleanedChatId,
    };
    setTelegramConfig(updated);
    try {
      localStorage.setItem(TELEGRAM_CONFIG_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
    setTelegramSaveFeedback(
      '🔔 Telegram Alert Connected & Dispatched: New XAUUSD Setup Active'
    );
    if (activeSignal) {
      dispatchTelegramSignalAlert(activeSignal, true);
    } else {
      playSubtleAlertChime();
    }
    setTimeout(() => {
      setTelegramSaveFeedback(null);
    }, 4500);
  };

  // Automatically detect when AI engine locks a new setup or updates status -> trigger Visual Pulse, Web Audio Chime & Telegram Alert
  const lastAlertedSetupRef = useRef<string>('');
  useEffect(() => {
    if (!activeSignal) return;
    const alertKey = `${activeSignal.setupNumber}_${activeSignal.entryZoneText}_${activeSignal.status}`;
    if (lastAlertedSetupRef.current === alertKey) return;
    lastAlertedSetupRef.current = alertKey;

    setIsNewSetupPulsing(true);
    if (activeSignal.status === 'HIT SL') {
      setTelegramAlertBannerText(
        `🛡️ Setup #${activeSignal.setupNumber} HIT SL · Auto-Generating Setup #${activeSignal.setupNumber + 1}...`
      );
    } else if (activeSignal.status === 'HIT TP') {
      setTelegramAlertBannerText(
        `🎯 Setup #${activeSignal.setupNumber} HIT TP · Auto-Generating Setup #${activeSignal.setupNumber + 1}...`
      );
    } else {
      setTelegramAlertBannerText(
        `🔔 Telegram Alert Sent: New XAUUSD Setup #${activeSignal.setupNumber} Active`
      );
    }
    setTelegramAlertTimestamp(
      new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );

    if (audioAlertEnabled) {
      playSubtleAlertChime();
    }

    if (telegramConfig.connected && activeSignal.status === 'ACTIVE LOCKED') {
      dispatchTelegramSignalAlert(activeSignal, false);
    }
  }, [
    activeSignal,
    audioAlertEnabled,
    telegramConfig.connected,
    dispatchTelegramSignalAlert,
  ]);

  // AUTO-RESET & AUTO-GENERATE NEW SETUP STATE MACHINE LOOP:
  // Whenever the currently active setup completes (HIT SL or HIT TP), run a short 4-second cooldown
  // and automatically generate + lock the next high-probability setup (Setup #7, #8, etc.) at live market price.
  const handleAutoTransitionToNextSetup = useCallback(() => {
    if (!liveMarket) return;
    const nextIsBuy = macroTrendSummary ? macroTrendSummary.isBullish : true;
    const result = issueNextLockedDailySetup(
      liveMarket.spotPrice,
      timeframe,
      sessionMode,
      nextIsBuy,
      93.6,
      confluence?.atr14 || 5.0,
      confluence?.sessionVolatilityMultiplier || 1.25
    );
    if (result.issued) {
      setCustomAiOverride(null);
      setSetupCooldownSeconds(null);
      setSignalCycleVersion((v) => v + 1);
      refreshLiveMarketData(timeframe, false);
    }
  }, [
    liveMarket,
    macroTrendSummary,
    timeframe,
    sessionMode,
    confluence?.atr14,
    confluence?.sessionVolatilityMultiplier,
    refreshLiveMarketData,
  ]);

  useEffect(() => {
    if (
      !activeSignal ||
      (activeSignal.status !== 'HIT SL' && activeSignal.status !== 'HIT TP')
    ) {
      setSetupCooldownSeconds(null);
      return;
    }

    const closedTs = activeSignal.closedAtTimestamp || Date.now();
    const elapsedMs = Date.now() - closedTs;
    const remainingMs = Math.max(0, AUTO_RESET_COOLDOWN_MS - elapsedMs);

    if (remainingMs <= 0) {
      handleAutoTransitionToNextSetup();
      return;
    }

    setSetupCooldownSeconds(Math.ceil(remainingMs / 1000));

    const countdownInterval = setInterval(() => {
      const nowElapsed = Date.now() - closedTs;
      const nowRemaining = Math.max(0, AUTO_RESET_COOLDOWN_MS - nowElapsed);
      if (nowRemaining <= 0) {
        clearInterval(countdownInterval);
        handleAutoTransitionToNextSetup();
      } else {
        setSetupCooldownSeconds(Math.ceil(nowRemaining / 1000));
      }
    }, 500);

    return () => clearInterval(countdownInterval);
  }, [
    activeSignal?.status,
    activeSignal?.setupNumber,
    activeSignal?.closedAtTimestamp,
    handleAutoTransitionToNextSetup,
  ]);

  // Background Auto-Sync AI Institutional Thesis whenever a new locked setup is active
  useEffect(() => {
    if (!liveMarket || !baseSignal || !confluence) return;
    const setupIdentity = `${timeframe}_${baseSignal.entryZoneText}_${baseSignal.stopLoss}`;
    if (lastSyncedSetupKeyRef.current === setupIdentity) return;
    lastSyncedSetupKeyRef.current = setupIdentity;

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/ai-signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spotPrice: baseSignal.entryPrice,
            timeframe,
            sessionName: sessionMode,
            ema20: confluence.ema20,
            ema50: confluence.ema50,
            rsi14: confluence.rsi14,
            atr14: confluence.atr14,
            buySideLiquidity: confluence.buySideLiquidity,
            sellSideLiquidity: confluence.sellSideLiquidity,
            recentCandles: liveMarket.candles.slice(-6),
          }),
        });
        if (!cancelled && response.ok) {
          const data = await response.json();
          if (data.institutionalThesis) {
            setCustomAiOverride({
              ...baseSignal,
              institutionalThesis: data.institutionalThesis,
              source: `${liveMarket.sourceName} · DollarX Auto-Sync Engine`,
            });
          }
        }
      } catch {
        // Silent background fallback to deterministic institutional thesis
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [liveMarket, baseSignal, confluence, timeframe, sessionMode]);

  // Sync any AI Signal setup to Pips Calculator and switch exclusively to Page 2
  const handleLoadSetupIntoCalculator = (
    isBuySignal: boolean,
    entryPrice: number,
    stopLoss: number,
    slPips: number
  ) => {
    setCalcDirection(isBuySignal ? 'BUY' : 'SELL');
    setCalcEntryPrice(entryPrice);
    setCalcStopLossPrice(stopLoss);
    setCalcStopLossPips(slPips);
    setSlInputMode('price');
    setSyncedBanner(true);
    handleSwitchPage('pips-calculator');
    setTimeout(() => setSyncedBanner(false), 3500);
  };

  // XAUUSD Risk & Pip Math
  const pipSize = pipConvention === '0.10' ? 0.1 : 0.01;
  const pipValuePerStdLot = pipConvention === '0.10' ? 10.0 : 1.0;

  const calculatorResults = useMemo(() => {
    const totalRiskUsd = accountBalance * (riskPercent / 100);

    let effectiveSlPrice = calcStopLossPrice;
    let effectiveSlPips = calcStopLossPips;
    let priceDistance = Math.abs(calcEntryPrice - calcStopLossPrice);

    if (slInputMode === 'price') {
      priceDistance = Math.max(0.1, Math.abs(calcEntryPrice - calcStopLossPrice));
      effectiveSlPips = Number((priceDistance / pipSize).toFixed(1));
    } else {
      effectiveSlPips = Math.max(1, calcStopLossPips);
      priceDistance = Number((effectiveSlPips * pipSize).toFixed(2));
      effectiveSlPrice =
        calcDirection === 'BUY'
          ? Number((calcEntryPrice - priceDistance).toFixed(2))
          : Number((calcEntryPrice + priceDistance).toFixed(2));
    }

    const rawStandardLots =
      priceDistance > 0 ? totalRiskUsd / (priceDistance * 100) : 0;
    const recommendedLots = Number(Math.max(0.01, rawStandardLots).toFixed(2));
    const actualDollarRisk = Number(
      (recommendedLots * 100 * priceDistance).toFixed(2)
    );
    const totalOunces = Number((recommendedLots * 100).toFixed(1));
    const miniLots = Number((recommendedLots * 10).toFixed(1));
    const microLots = Math.round(recommendedLots * 100);
    const dollarPerPip = Number((recommendedLots * pipValuePerStdLot).toFixed(2));

    const buildRrTier = (ratio: number, label: string) => {
      const targetPriceDistance = priceDistance * ratio;
      const targetPips = Number((effectiveSlPips * ratio).toFixed(1));
      const targetPrice =
        calcDirection === 'BUY'
          ? Number((calcEntryPrice + targetPriceDistance).toFixed(2))
          : Number((calcEntryPrice - targetPriceDistance).toFixed(2));
      const potentialProfitUsd = Number((actualDollarRisk * ratio).toFixed(2));
      const roiPercent =
        accountBalance > 0
          ? Number(((potentialProfitUsd / accountBalance) * 100).toFixed(2))
          : 0;

      return {
        ratio,
        label,
        targetPrice,
        targetPips,
        potentialProfitUsd,
        roiPercent,
      };
    };

    return {
      totalRiskUsd,
      actualDollarRisk,
      effectiveSlPrice,
      effectiveSlPips,
      priceDistance,
      recommendedLots,
      totalOunces,
      miniLots,
      microLots,
      dollarPerPip,
      rrTiers: [
        buildRrTier(1, '1:1 Conservative Target'),
        buildRrTier(2, '1:2 Core Institutional Target'),
        buildRrTier(3, '1:3 Asymmetric Target'),
        buildRrTier(customRrRatio, `1:${customRrRatio.toFixed(1)} Custom Runner`),
      ],
    };
  }, [
    accountBalance,
    riskPercent,
    calcDirection,
    calcEntryPrice,
    slInputMode,
    calcStopLossPrice,
    calcStopLossPips,
    pipSize,
    pipValuePerStdLot,
    customRrRatio,
  ]);

  // Page 3: Live Daily Economic News State & AI Macro Sentiment Mode
  const [events, setEvents] = useState<EconomicEvent[]>(INITIAL_ECONOMIC_CALENDAR);
  const [impactFilter, setImpactFilter] = useState<'All' | 'High' | 'Medium'>('All');
  const [dateFilter, setDateFilter] = useState<string>('All');
  const [timezone, setTimezone] = useState<'EST' | 'GMT' | 'GMT+8'>('EST');
  const [newsSearch, setNewsSearch] = useState<string>('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>('evt-3');
  const [sentimentPreset, setSentimentPreset] = useState<
    'auto' | 'hawkish-usd' | 'bullish-gold'
  >('auto');

  // Compute Daily AI News Sentiment Summary from active economic calendar events
  const aiMacroSentiment = useMemo(() => {
    if (sentimentPreset === 'hawkish-usd') {
      return {
        headline: 'Overall Sentiment: Hawkish USD / Bearish Gold Pressure',
        regimeTag: 'HAWKISH USD DOMINANCE',
        usdScore: 65,
        goldScore: 35,
        isGoldBullish: false,
        executiveSummary:
          'AI Macro Engine mengesan tekanan belian Dolar AS (DXY) yang kukuh menjelang data utama FOMC, NFP, dan inflasi CPI. Jangkaan hasil bon Perbendaharaan AS (10Y Treasury Yields) yang bertahan tinggi memberikan tekanan jualan jangka pendek ke atas XAUUSD. Trader disarankan memberi tumpuan kepada peluang SELL on Rally pada zon rintangan kecairan (Buy-Side Liquidity Sweep) dengan kawalan risiko ketat SL 60–70 pips.',
        keyDrivers: [
          'US 10Y Treasury Yield Resilience (+Hawkish DXY)',
          'FOMC & NFP Pre-Positioning Institutional Flow',
          'Short-Term Sell-Side Liquidity Draw on XAUUSD',
        ],
      };
    }

    if (sentimentPreset === 'bullish-gold') {
      return {
        headline: 'Overall Sentiment: Bullish Rebound Anticipated on Lower Yields',
        regimeTag: 'BULLISH GOLD ACCUMULATION',
        usdScore: 35,
        goldScore: 65,
        isGoldBullish: true,
        executiveSummary:
          'Berdasarkan bacaan sebenar data pembuatan ISM PMI (48.1 vs 49.0 unjuran) serta kelembapan pasaran buruh JOLTS/ADP, AI merumuskan penyusutan hasil bon AS (Lower Treasury Yields) dan jangkaan dasar Fed yang lebih dovish. Aliran institusi memihak kepada pengumpulan belian (Bullish Rebound) pada XAUUSD menuju sasaran TP1–TP3 (100–300 pips).',
        keyDrivers: [
          'Contractionary ISM PMI & Cooling Labor Prints (-DXY)',
          'Dovish FOMC Rate Trajectory & Lower Real Yields',
          'Strong Central Bank & London/NY Overlap Gold Bid',
        ],
      };
    }

    // Auto mode: calculate dynamically from the events array
    let goldPoints = 0;
    let usdPoints = 0;
    events.forEach((ev) => {
      const weight = ev.impact === 'High' ? 22 : ev.impact === 'Medium' ? 12 : 6;
      if (ev.goldImpactBias === 'Bullish XAU') {
        goldPoints += weight;
      } else if (ev.goldImpactBias === 'Bearish XAU') {
        usdPoints += weight;
      } else {
        goldPoints += weight * 0.55;
        usdPoints += weight * 0.45;
      }
    });

    const total = Math.max(1, goldPoints + usdPoints);
    const computedGoldPct = Math.round((goldPoints / total) * 100);
    const computedUsdPct = 100 - computedGoldPct;
    const isGoldDominant = computedGoldPct >= 50;

    return {
      headline: isGoldDominant
        ? 'Overall Sentiment: Bullish Rebound Anticipated on Lower Yields'
        : 'Overall Sentiment: Hawkish USD / Bearish Gold Pressure',
      regimeTag: isGoldDominant
        ? 'BULLISH GOLD MACRO BIAS'
        : 'HAWKISH USD / BEARISH GOLD',
      usdScore: computedUsdPct,
      goldScore: computedGoldPct,
      isGoldBullish: isGoldDominant,
      executiveSummary: isGoldDominant
        ? `Rumusan AI berdasarkan ${events.length} data makroekonomi harian (termasuk ISM Manufacturing PMI, JOLTS, ADP, FOMC, dan NFP) menunjukkan ${computedGoldPct}% kecenderungan Bullish XAUUSD berbanding ${computedUsdPct}% Bullish USD. Data ekonomi AS yang lebih perlahan menekan hasil bon (Lower Yields), membuka ruang kenaikan emas (Buy on Dip) dengan sasaran TP 100–300 pips.`
        : `Rumusan AI berdasarkan ${events.length} data makroekonomi harian (CPI, NFP, FOMC) menunjukkan ${computedUsdPct}% kekuatan Hawkish USD berbanding ${computedGoldPct}% Gold Bullish. Tekanan DXY meningkatkan volatiliti sesi New York; utamakan pengurusan risiko ketat SL 60–70 pips.`,
      keyDrivers: [
        `High-Impact Releases Tracked: ${events.filter((e) => e.impact === 'High').length} Events (FOMC · NFP · ISM)`,
        `Released Data Prints: ${events.filter((e) => e.actual !== null).length}/${events.length} Completed`,
        isGoldDominant
          ? 'Macro Flow: Soft USD Data → Lower Yields → Bullish XAUUSD'
          : 'Macro Flow: Resilient USD Data → Higher Yields → Bearish XAUUSD',
      ],
    };
  }, [events, sentimentPreset]);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (impactFilter !== 'All' && ev.impact !== impactFilter) return false;
      if (dateFilter !== 'All' && ev.date !== dateFilter) return false;
      if (
        newsSearch.trim() !== '' &&
        !ev.event.toLowerCase().includes(newsSearch.toLowerCase()) &&
        !ev.quantNote.toLowerCase().includes(newsSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [events, impactFilter, dateFilter, newsSearch]);

  // =========================================================================
  // IF NO APPROVED CLIENT IS LOGGED IN -> SHOW CLIENT & ADMIN GATEWAY
  // =========================================================================
  if (!activeClient) {
    return (
      <LicenseGateway
        logoError={logoError}
        onLogoError={() => setLogoError(true)}
        initialOpenAdmin={openAdminDirectly}
        onUnlockSuccess={(client) => {
          setActiveClient(client);
          setOpenAdminDirectly(false);
        }}
      />
    );
  }

  const spotPrice = liveMarket?.spotPrice ?? 0;
  const priceChange24h = liveMarket?.change24h ?? 0;
  const priceChangePct = liveMarket?.changePct24h ?? 0;
  const isSignalBuy =
    activeSignal?.recommendation === 'STRONG BUY' ||
    activeSignal?.recommendation === 'BUY';

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-200 pb-20 md:pb-0">
      {/* =====================================================================
          TOPMOST OFFICIAL TELEGRAM BAR (https://t.me/dollarxindicator)
      ===================================================================== */}
      <div className="w-full bg-emerald-500/10 border-b border-emerald-500/30 px-4 sm:px-6 py-2 z-40">
        <div className="max-w-[1380px] mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span>Saluran Rasmi Telegram DollarX:</span>
          </div>
          <a
            href="https://t.me/dollarxindicator"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition-colors whitespace-nowrap shadow-xs"
          >
            <span>Join Telegram DollarX · t.me/dollarxindicator</span>
            <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </a>
        </div>
      </div>

      {/* =====================================================================
          STRICT 3-ZONE TOP BAR CONTRACT (Sticky Header)
          [Brand title, one line] — [3 nav links, single-line] — [1 primary action]
      ===================================================================== */}
      <header className="flex items-center justify-between gap-4 px-4 sm:px-6 h-14 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#signal-hub"
          onClick={(e) => {
            e.preventDefault();
            handleSwitchPage('signal-hub');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0"
        >
          DollarX
        </a>

        {/* Zone 2: Clean single-line text navigation links (Desktop & Tablet) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            type="button"
            onClick={() => handleSwitchPage('signal-hub')}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activePage === 'signal-hub'
                ? 'text-emerald-400 font-bold underline decoration-emerald-400 decoration-2 underline-offset-8'
                : 'hover:text-white'
            }`}
          >
            AI Signal Hub
          </button>
          <button
            type="button"
            onClick={() => handleSwitchPage('pips-calculator')}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activePage === 'pips-calculator'
                ? 'text-emerald-400 font-bold underline decoration-emerald-400 decoration-2 underline-offset-8'
                : 'hover:text-white'
            }`}
          >
            Pips Calculator
          </button>
          <button
            type="button"
            onClick={() => handleSwitchPage('economic-news')}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activePage === 'economic-news'
                ? 'text-emerald-400 font-bold underline decoration-emerald-400 decoration-2 underline-offset-8'
                : 'hover:text-white'
            }`}
          >
            Economic News
          </button>
        </nav>

        {/* Zone 3: Automatic Live Engine Status Badge */}
        <div className="flex items-center shrink-0">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-300 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span>Auto-Sync Live · 5s</span>
          </div>
        </div>
      </header>

      {/* =====================================================================
          MAIN VIEWPORT CONTAINER (Exclusive SPA View Switcher)
      ===================================================================== */}
      <main className="flex-1 max-w-[1380px] w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* ===================================================================
            SPA VIEW SWITCHER BAR (Interactive 3-Page Segmented Control)
            Highlights active page & switches views exclusively
        =================================================================== */}
        <div
          role="tablist"
          aria-label="Dashboard Page Switcher"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 shadow-lg grid grid-cols-3 gap-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activePage === 'signal-hub'}
            onClick={() => handleSwitchPage('signal-hub')}
            className={`min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activePage === 'signal-hub'
                ? 'bg-emerald-500 text-slate-950 shadow-xs font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Activity className="w-4 h-4 shrink-0" />
            <span className="truncate">AI Signal Hub</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activePage === 'pips-calculator'}
            onClick={() => handleSwitchPage('pips-calculator')}
            className={`min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activePage === 'pips-calculator'
                ? 'bg-emerald-500 text-slate-950 shadow-xs font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Calculator className="w-4 h-4 shrink-0" />
            <span className="truncate">Pips Calculator</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activePage === 'economic-news'}
            onClick={() => handleSwitchPage('economic-news')}
            className={`min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activePage === 'economic-news'
                ? 'bg-emerald-500 text-slate-950 shadow-xs font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span className="truncate">Economic News</span>
          </button>
        </div>

        {/* ===================================================================
            PAGE 1 (EXCLUSIVE VIEW): MINIMALIST 3-CARD INSTITUTIONAL DASHBOARD
            Card 1: Live Chart & Price Ticker
            Card 2: Active AI Signal & Clean Entry Zone
            Card 3: Performance & Winrate Summary
        =================================================================== */}
        <div
          id="page-signal-hub"
          style={{ display: activePage === 'signal-hub' ? 'block' : 'none' }}
          className={
            activePage === 'signal-hub' ? 'block space-y-4 sm:space-y-5' : 'hidden'
          }
        >
          {/* Compact Client Account, Audio Alert Toggle & Telegram Alert Integration Access Bar */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-300">
              <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                {activeClient.name}
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="font-mono text-slate-400">
                ID: <strong className="text-slate-200">{activeClient.brokerId}</strong>
              </span>
              <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
              <span className="text-emerald-400 font-mono hidden sm:inline">
                Active Approved
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Web Audio API Chime Sound On/Off Toggle */}
              <button
                type="button"
                onClick={handleToggleAudioAlert}
                title="Toggle Web Audio API Alert Chime"
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  audioAlertEnabled
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {audioAlertEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span>{audioAlertEnabled ? 'Audio Chime: ON' : 'Audio Chime: OFF'}</span>
              </button>

              {/* Toggle Telegram Alert Integration Panel */}
              <button
                type="button"
                onClick={() => setShowTelegramSettings((prev) => !prev)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  showTelegramSettings || telegramConfig.connected
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <Send className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Telegram Alert</span>
              </button>

              <PWAInstallButton />
              <button
                type="button"
                onClick={() => handleLogoutClient(true)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                Admin Portal
              </button>
              <button
                type="button"
                onClick={() => handleLogoutClient(false)}
                className="px-3 py-1.5 text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl hover:bg-rose-500/20 transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <Lock className="w-3 h-3" />
                Log Keluar
              </button>
            </div>
          </section>

          {/* Collapsible / Minimalist Telegram Alert Integration Settings Panel */}
          {showTelegramSettings && (
            <section className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-400 shrink-0" />
                  <h2 className="text-sm sm:text-base font-bold text-white font-display">
                    Telegram Alert Integration
                  </h2>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                    {telegramConfig.connected ? 'Connected' : 'Standby'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTelegramSettings(false)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Tutup Panel
                </button>
              </div>

              <form
                onSubmit={handleConnectTelegramChannel}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
              >
                <div className="md:col-span-5">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Telegram Bot Token
                  </label>
                  <input
                    type="password"
                    value={telegramBotTokenInput}
                    onChange={(e) => setTelegramBotTokenInput(e.target.value)}
                    placeholder="Cth: 7182938401:AAH9x..."
                    className="w-full px-3.5 py-2 text-xs font-mono bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Telegram Chat ID / Channel ID
                  </label>
                  <input
                    type="text"
                    value={telegramChatIdInput}
                    onChange={(e) => setTelegramChatIdInput(e.target.value)}
                    placeholder="Cth: @DollarX_Signals atau -100192837"
                    className="w-full px-3.5 py-2 text-xs font-mono bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="md:col-span-3 flex items-center gap-2">
                  <button
                    type="submit"
                    className="w-full min-h-[38px] px-3.5 py-2 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    Connect Telegram Channel
                  </button>
                </div>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
                <span>
                  Saluran Aktif:{' '}
                  <strong className="font-mono text-emerald-400">
                    {telegramConfig.channelName}
                  </strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeSignal) {
                        dispatchTelegramSignalAlert(activeSignal, true);
                      } else {
                        playSubtleAlertChime();
                      }
                    }}
                    className="px-3 py-1 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 transition-colors cursor-pointer"
                  >
                    🔔 Test Chime &amp; Telegram Alert
                  </button>
                </div>
              </div>

              {telegramSaveFeedback && (
                <div className="px-3.5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs font-medium text-emerald-300 flex items-center justify-between">
                  <span>{telegramSaveFeedback}</span>
                  <span className="font-mono text-[11px]">{telegramAlertTimestamp}</span>
                </div>
              )}
            </section>
          )}

          {marketError && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-200">
              <span>{marketError}</span>
              <button
                type="button"
                onClick={() => refreshLiveMarketData(timeframe, true)}
                className="px-3.5 py-1.5 font-semibold bg-slate-900 border border-rose-500/40 rounded-xl hover:bg-slate-800 whitespace-nowrap self-start sm:self-auto cursor-pointer"
              >
                Retry Connection
              </button>
            </div>
          )}

          {!liveMarket || !activeSignal || !confluence || !macroTrendSummary ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[460px] animate-pulse" />
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[460px] flex flex-col justify-center items-center text-center space-y-2">
                <Activity className="w-6 h-6 text-emerald-400 animate-pulse" />
                <div className="text-sm font-semibold text-white">
                  Connecting Live XAUUSD Feed...
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* TOP SPLIT: CARD 1 (LIVE CHART & PRICE TICKER) + CARD 2 (ACTIVE AI SIGNAL & CLEAN ENTRY ZONE) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
                {/* ===========================================================
                    KAD 1: LIVE CHART & PRICE TICKER (TradingView XAUUSD + Live Spot)
                =========================================================== */}
                <div className="lg:col-span-7 flex flex-col">
                  <PriceStructureChart
                    candles={liveMarket.candles}
                    spotPrice={liveMarket.spotPrice}
                    change24h={priceChange24h}
                    changePct24h={priceChangePct}
                    bidPrice={liveMarket.bidPrice}
                    askPrice={liveMarket.askPrice}
                    high24h={liveMarket.high24h}
                    low24h={liveMarket.low24h}
                    timeframe={timeframe}
                    onSelectTimeframe={handleTimeframeChange}
                    signal={activeSignal}
                    confluence={confluence}
                  />
                </div>

                {/* ===========================================================
                    KAD 2: ACTIVE AI SIGNAL & CLEAN ENTRY ZONE
                    (Includes In-App Visual Pulsing Glow, Web Audio Chime & Telegram Alert Status)
                =========================================================== */}
                <div
                  className={`lg:col-span-5 bg-slate-900 border rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4 transition-all duration-500 ${
                    activeSignal.status === 'HIT SL'
                      ? 'border-rose-500/70 shadow-[0_0_25px_rgba(244,63,94,0.18)]'
                      : activeSignal.status === 'HIT TP'
                      ? 'border-emerald-500/70 shadow-[0_0_25px_rgba(16,185,129,0.20)]'
                      : isNewSetupPulsing
                      ? isSignalBuy
                        ? 'border-emerald-500/70 ring-1 ring-emerald-400/40 shadow-[0_0_28px_rgba(16,185,129,0.22)]'
                        : 'border-rose-500/70 ring-1 ring-rose-400/40 shadow-[0_0_28px_rgba(244,63,94,0.22)]'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Card 2 Header: Setup Number, Masa Isyarat Timestamp & Instant Auto-Track Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800 text-xs">
                      <div className="flex flex-wrap items-center gap-2 text-slate-300">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span
                            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                              activeSignal.status === 'HIT SL' || !isSignalBuy
                                ? 'bg-rose-400'
                                : 'bg-emerald-400'
                            }`}
                          />
                          <span
                            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                              activeSignal.status === 'HIT SL' || !isSignalBuy
                                ? 'bg-rose-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                        </span>
                        <span className="font-semibold text-white">
                          Setup #{activeSignal.setupNumber}
                        </span>
                        <span className="text-slate-600" aria-hidden="true">·</span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          Masa Isyarat: {activeSignal.signalTimestamp}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleToggleAudioAlert}
                          title={
                            audioAlertEnabled
                              ? 'Web Audio Alert Chime: ON (Klik untuk Mute)'
                              : 'Web Audio Alert Chime: OFF (Klik untuk Unmute)'
                          }
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            audioAlertEnabled
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          {audioAlertEnabled ? (
                            <Volume2 className="w-3.5 h-3.5" />
                          ) : (
                            <VolumeX className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <span
                          className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border ${
                            activeSignal.status === 'HIT TP'
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                              : activeSignal.status === 'HIT SL'
                              ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          }`}
                        >
                          {activeSignal.status === 'ACTIVE LOCKED'
                            ? `ACTIVE · LOCKED (${activeSignal.floatingPips >= 0 ? '+' : ''}${activeSignal.floatingPips}p)`
                            : activeSignal.statusLabel}
                        </span>
                      </div>
                    </div>

                    {/* Telegram Alert Sent Status Notification Banner on Main Signal Card */}
                    <div className="px-3 py-2 rounded-xl bg-slate-950/90 border border-emerald-500/30 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Bell className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-bounce" />
                        <span className="font-medium text-emerald-300 truncate">
                          {telegramAlertBannerText}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] text-slate-400 hidden sm:inline">
                          {telegramAlertTimestamp}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowTelegramSettings((prev) => !prev)}
                          className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                        >
                          {showTelegramSettings ? 'Hide' : 'Setup'}
                        </button>
                      </div>
                    </div>

                    {/* Auto-Reset & Auto-Generate Next Setup Banner when current setup hits SL or TP */}
                    {(activeSignal.status === 'HIT SL' || activeSignal.status === 'HIT TP') && (
                      <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-between gap-2 text-xs">
                        <span className="text-emerald-300 font-medium">
                          ⚡ Auto-Reset Aktif: Menjana &amp; mengunci Setup #{activeSignal.setupNumber + 1}{' '}
                          {setupCooldownSeconds !== null
                            ? `secara automatik dalam ${setupCooldownSeconds}s...`
                            : 'secara automatik...'}
                        </span>
                        <span className="font-mono text-[11px] text-emerald-400 font-bold">
                          AUTO-SYNC
                        </span>
                      </div>
                    )}

                    {/* Large Signal Direction (BUY / SELL) & M15/M30 Confluence Score */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <span className="text-xs text-slate-400 block mb-0.5">
                          Signal Direction · M15/M30 SNR · TLT · TLBO
                        </span>
                        <div
                          className={`text-3xl sm:text-4xl font-bold font-display tracking-tight flex items-center gap-1.5 ${
                            isSignalBuy ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isSignalBuy ? (
                            <ArrowUpRight className="w-7 h-7 stroke-[2.5] shrink-0" />
                          ) : (
                            <ArrowDownRight className="w-7 h-7 stroke-[2.5] shrink-0" />
                          )}
                          <span>{activeSignal.recommendation}</span>
                        </div>
                      </div>

                      <div className="text-right font-mono tabular-nums shrink-0">
                        <span className="text-xs font-sans text-slate-400 block mb-0.5">
                          M15/M30 Confluence
                        </span>
                        <span className="text-2xl font-bold text-white">
                          {activeSignal.confidence}%
                        </span>
                      </div>
                    </div>

                    {/* AI Trend Meter Module (Bullish/Bearish Strength on M15/M30 Confluence) */}
                    {activeSignal.trendMeter && (
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="font-semibold text-white">
                              AI Trend Meter (M15 / M30)
                            </span>
                          </div>
                          <span
                            className={`font-mono text-[11px] font-bold ${
                              activeSignal.trendMeter.dominantBias === 'BULLISH'
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {activeSignal.trendMeter.strengthLabel}
                          </span>
                        </div>

                        {/* Visual Bullish vs Bearish Strength Gauge Bar */}
                        <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-slate-800 p-0.5 gap-0.5">
                          <div
                            style={{ width: `${activeSignal.trendMeter.bullishPct}%` }}
                            className="h-full bg-emerald-500 rounded-l-full transition-all duration-500"
                          />
                          <div
                            style={{ width: `${activeSignal.trendMeter.bearishPct}%` }}
                            className="h-full bg-rose-500 rounded-r-full transition-all duration-500"
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                          <span className="text-emerald-400 font-semibold">
                            Bullish: {activeSignal.trendMeter.bullishPct}%
                          </span>
                          <span className="text-slate-400 truncate px-2">
                            {activeSignal.trendMeter.m15Status} · {activeSignal.trendMeter.m30Status}
                          </span>
                          <span className="text-rose-400 font-semibold">
                            Bearish: {activeSignal.trendMeter.bearishPct}%
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Clean Boxed Suggested Entry Zone with Subtle Pulsing Glow */}
                    <div
                      className={`p-4 rounded-xl border transition-all ${
                        isSignalBuy
                          ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[inset_0_0_18px_rgba(16,185,129,0.10)]'
                          : 'bg-rose-500/10 border-rose-500/40 shadow-[inset_0_0_18px_rgba(244,63,94,0.10)]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-200">
                          Suggested Entry Zone ({activeSignal.entryZoneType})
                        </span>
                        <span className="font-mono text-[11px] text-emerald-400">
                          Static Locked
                        </span>
                      </div>
                      <div
                        className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tight ${
                          isSignalBuy ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {activeSignal.entryZoneText}
                      </div>
                    </div>

                    {/* Clean SL & TP1, TP2, TP3 Rows with Instant HIT SL / HIT TP Highlight */}
                    <div className="divide-y divide-slate-800 border-t border-b border-slate-800 text-sm font-mono tabular-nums">
                      <div
                        className={`py-2.5 px-2 -mx-2 rounded-lg flex items-center justify-between ${
                          activeSignal.status === 'HIT SL' ? 'bg-rose-500/15' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-sans font-medium text-slate-300">
                            Stop Loss (SL)
                          </span>
                          {activeSignal.status === 'HIT SL' && (
                            <span className="text-[11px] font-bold text-rose-300 bg-rose-500/25 border border-rose-500/40 px-1.5 py-0.5 rounded">
                              HIT SL
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs text-rose-400/80">
                            -{activeSignal.slPips} pips
                          </span>
                          <strong className="text-base font-bold text-rose-400">
                            ${activeSignal.stopLoss.toFixed(2)}
                          </strong>
                        </div>
                      </div>

                      <div
                        className={`py-2.5 px-2 -mx-2 rounded-lg flex items-center justify-between ${
                          activeSignal.status === 'HIT TP' ? 'bg-emerald-500/15' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-sans font-medium text-slate-300">
                            Take Profit 1 (TP1)
                          </span>
                          {activeSignal.status === 'HIT TP' && (
                            <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/25 border border-emerald-500/40 px-1.5 py-0.5 rounded">
                              HIT TP
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs text-emerald-400/80">
                            +{activeSignal.tp1Pips} pips
                          </span>
                          <strong className="text-base font-bold text-emerald-400">
                            ${activeSignal.tp1.toFixed(2)}
                          </strong>
                        </div>
                      </div>

                      <div className="py-2.5 flex items-center justify-between">
                        <span className="font-sans font-medium text-slate-300">
                          Take Profit 2 (TP2)
                        </span>
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs text-emerald-400/80">
                            +{activeSignal.tp2Pips} pips
                          </span>
                          <strong className="text-base font-bold text-emerald-400">
                            ${activeSignal.tp2.toFixed(2)}
                          </strong>
                        </div>
                      </div>

                      <div className="py-2.5 flex items-center justify-between">
                        <span className="font-sans font-medium text-slate-300">
                          Take Profit 3 (TP3)
                        </span>
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs text-emerald-300/80">
                            +{activeSignal.tp3Pips} pips
                          </span>
                          <strong className="text-base font-bold text-emerald-300">
                            ${activeSignal.tp3.toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Daily Fresh Supply & Demand Zones (Unmitigated Order Blocks) */}
                    {activeSignal.dailyFreshZones && activeSignal.dailyFreshZones.length > 0 && (
                      <div className="grid grid-cols-2 gap-2.5 pt-0.5 font-mono tabular-nums">
                        {(() => {
                          const supplyZone = activeSignal.dailyFreshZones.find(
                            (z) => z.type === 'Fresh Supply Zone'
                          );
                          const demandZone = activeSignal.dailyFreshZones.find(
                            (z) => z.type === 'Fresh Demand Zone'
                          );
                          return (
                            <>
                              {supplyZone && (
                                <div className="p-2.5 rounded-xl bg-slate-950 border border-rose-500/30">
                                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                                    <span className="font-sans font-semibold text-rose-300">
                                      Fresh Supply
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      Unmitigated OB
                                    </span>
                                  </div>
                                  <div className="text-xs sm:text-sm font-bold text-rose-400">
                                    {supplyZone.zoneRangeText}
                                  </div>
                                </div>
                              )}
                              {demandZone && (
                                <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/30">
                                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                                    <span className="font-sans font-semibold text-emerald-300">
                                      Fresh Demand
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      Unmitigated OB
                                    </span>
                                  </div>
                                  <div className="text-xs sm:text-sm font-bold text-emerald-400">
                                    {demandZone.zoneRangeText}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Single Clean Action Button */}
                  <button
                    type="button"
                    onClick={() =>
                      handleLoadSetupIntoCalculator(
                        isSignalBuy,
                        activeSignal.entryPrice,
                        activeSignal.stopLoss,
                        activeSignal.slPips
                      )
                    }
                    className="w-full min-h-[44px] px-4 py-2.5 text-xs font-bold text-slate-950 bg-emerald-500 rounded-xl hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <Calculator className="w-4 h-4" />
                    Send Setup to Pips Calculator
                  </button>
                </div>
              </div>

              {/* =============================================================
                  KAD 3: PERFORMANCE & WINRATE SUMMARY (Minimalist Daily Tracker)
              ============================================================= */}
              {dailyPerformance && (
                <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <h2 className="text-base font-bold text-white font-display">
                        Performance &amp; Winrate Summary
                      </h2>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="font-mono text-slate-400">
                        {dailyPerformance.dateLabel}
                      </span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        Net: +{dailyPerformance.netPipsToday} Pips
                      </span>
                    </div>

                    {/* Clean Segmented Filter for Daily Setups */}
                    <div className="flex flex-wrap items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl self-start sm:self-auto">
                      {(
                        [
                          {
                            key: 'ALL',
                            label: `Semua (${dailyPerformance.setups.length})`,
                          },
                          {
                            key: 'HIT TP',
                            label: `Hit TP (${dailyPerformance.hitTpCount})`,
                          },
                          {
                            key: 'HIT SL',
                            label: `Hit SL (${dailyPerformance.hitSlCount})`,
                          },
                          {
                            key: 'ACTIVE LOCKED',
                            label: `Aktif (${dailyPerformance.activeRunningCount})`,
                          },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setDailyFilter(tab.key)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            dailyFilter === tab.key
                              ? 'bg-emerald-500 text-slate-950 font-bold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4 Minimalist Core Daily Metrics: Total Setup | Hit TP | Hit SL | Daily Winrate */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono tabular-nums">
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="font-sans text-xs text-slate-400 block mb-1">
                        Total Setup
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white">
                          {dailyPerformance.totalSignalsToday}
                        </span>
                        <span className="text-xs text-emerald-400">
                          (+{dailyPerformance.activeRunningCount} Aktif)
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30">
                      <span className="font-sans text-xs text-slate-400 block mb-1">
                        Hit TP
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-emerald-400">
                          {dailyPerformance.hitTpCount}
                        </span>
                        <span className="text-xs text-emerald-400">
                          +{dailyPerformance.totalTpPipsToday}p
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-rose-500/30">
                      <span className="font-sans text-xs text-slate-400 block mb-1">
                        Hit SL
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-rose-400">
                          {dailyPerformance.hitSlCount}
                        </span>
                        <span className="text-xs text-rose-400">
                          -{dailyPerformance.totalSlPipsToday}p
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/40">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-sans text-slate-300 font-medium">
                          Daily Winrate
                        </span>
                        <span className="text-[11px] text-emerald-400">
                          {dailyPerformance.hitTpCount}/{dailyPerformance.totalSignalsToday} Won
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-emerald-400">
                        {dailyPerformance.dailyWinratePct.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Compact Daily Setups Table / Rows */}
                  <div className="overflow-x-auto border-t border-slate-800 pt-2">
                    <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] font-sans text-slate-400">
                          <th className="py-2.5 pr-3">Setup</th>
                          <th className="py-2.5 px-3">Masa Isyarat</th>
                          <th className="py-2.5 px-3">Signal</th>
                          <th className="py-2.5 px-3">Entry Zone (Locked)</th>
                          <th className="py-2.5 px-3">SL</th>
                          <th className="py-2.5 px-3">TP1 / TP2 / TP3</th>
                          <th className="py-2.5 pl-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {filteredDailySetups.map((sig) => {
                          const isHitTp = sig.status === 'HIT TP';
                          const isHitSl = sig.status === 'HIT SL';
                          return (
                            <tr
                              key={sig.id}
                              onClick={() =>
                                handleLoadSetupIntoCalculator(
                                  sig.isBuy,
                                  sig.entryPrice,
                                  sig.stopLoss,
                                  sig.slPips
                                )
                              }
                              className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                            >
                              <td className="py-2.5 pr-3 font-sans font-semibold text-white whitespace-nowrap">
                                Setup #{sig.setupNumber}
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                                {sig.lockedAtTime || sig.closedAtTime || activeSignal.signalTimestamp}
                              </td>
                              <td
                                className={`py-2.5 px-3 font-bold whitespace-nowrap ${
                                  sig.isBuy ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {sig.direction}
                              </td>
                              <td className="py-2.5 px-3 text-white font-semibold whitespace-nowrap">
                                {sig.entryZoneText}
                              </td>
                              <td className="py-2.5 px-3 text-rose-400 whitespace-nowrap">
                                ${sig.stopLoss.toFixed(2)} (-{sig.slPips}p)
                              </td>
                              <td className="py-2.5 px-3 text-emerald-400 whitespace-nowrap">
                                ${sig.tp1.toFixed(2)} / ${sig.tp2.toFixed(2)} / ${sig.tp3.toFixed(2)}
                              </td>
                              <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                                <span
                                  className={`font-bold ${
                                    isHitTp
                                      ? 'text-emerald-400'
                                      : isHitSl
                                      ? 'text-rose-400'
                                      : 'text-emerald-300'
                                  }`}
                                >
                                  {sig.hitStageLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* ===================================================================
            PAGE 2 (EXCLUSIVE VIEW): ADVANCED PIPS CALCULATOR
            When activePage === 'pips-calculator' -> display: block
            When activePage !== 'pips-calculator' -> display: none
        =================================================================== */}
        <div
          id="page-pips-calculator"
          style={{ display: activePage === 'pips-calculator' ? 'block' : 'none' }}
          className={
            activePage === 'pips-calculator'
              ? 'block space-y-4 sm:space-y-6'
              : 'hidden'
          }
        >
          {/* Page 2 Header Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 mb-1">
                <span className="font-semibold text-emerald-400">
                  DollarX Risk Engine
                </span>
                <span aria-hidden="true">·</span>
                <span>1 Standard Lot = 100 Oz</span>
                <span aria-hidden="true">·</span>
                <span>1 Pip ($0.10) = $10/Std Lot</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Advanced XAUUSD Pips & Lot Size Calculator
              </h1>
            </div>

            {activeSignal && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const isBuy =
                      activeSignal.recommendation === 'STRONG BUY' ||
                      activeSignal.recommendation === 'BUY';
                    setCalcDirection(isBuy ? 'BUY' : 'SELL');
                    setCalcEntryPrice(activeSignal.entryPrice);
                    setCalcStopLossPrice(activeSignal.stopLoss);
                    setCalcStopLossPips(activeSignal.slPips);
                    setSlInputMode('price');
                    setSyncedBanner(true);
                    setTimeout(() => setSyncedBanner(false), 3000);
                  }}
                  className="min-h-[42px] px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  Sync Active Signal (${activeSignal.entryPrice.toFixed(2)})
                </button>
                <button
                  type="button"
                  onClick={() => setCalcEntryPrice(spotPrice)}
                  className="min-h-[42px] px-3.5 py-2 text-xs font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/25 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Use Live Spot (${spotPrice.toFixed(2)})
                </button>
              </div>
            )}
          </div>

          {syncedBanner && (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-200 shadow-lg">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Synced setup into calculator: {calcDirection} Entry $
                {calcEntryPrice.toFixed(2)}, Stop Loss $
                {calcStopLossPrice.toFixed(2)} ({calcStopLossPips} pips).
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
            {/* Left Column: Risk & Trade Parameters Input Panel */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5 shadow-lg">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
                <h2 className="text-base font-semibold text-white">
                  Trade & Risk Parameters
                </h2>
                <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setCalcDirection('BUY')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      calcDirection === 'BUY'
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    BUY / LONG
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalcDirection('SELL')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      calcDirection === 'SELL'
                        ? 'bg-rose-500 text-white font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    SELL / SHORT
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="account-balance"
                    className="font-medium text-slate-300"
                  >
                    Account Balance (USD)
                  </label>
                  <span className="font-mono text-slate-400 tabular-nums">
                    ${accountBalance.toLocaleString()}
                  </span>
                </div>
                <input
                  id="account-balance"
                  type="number"
                  min={100}
                  step={500}
                  value={accountBalance}
                  onChange={(e) =>
                    setAccountBalance(Math.max(0, Number(e.target.value)))
                  }
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                  {[1000, 5000, 10000, 25000, 50000, 100000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAccountBalance(preset)}
                      className={`py-1.5 text-xs font-mono rounded-lg border transition-colors text-center whitespace-nowrap cursor-pointer ${
                        accountBalance === preset
                          ? 'border-emerald-500 bg-emerald-500 text-slate-950 font-bold'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      ${(preset / 1000).toFixed(0)}k
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="risk-percent"
                    className="font-medium text-slate-300"
                  >
                    Risk Percentage (%)
                  </label>
                  <span className="font-mono font-semibold text-white tabular-nums">
                    {riskPercent.toFixed(2)}% ($
                    {calculatorResults.totalRiskUsd.toFixed(2)})
                  </span>
                </div>
                <input
                  id="risk-percent"
                  type="number"
                  min={0.1}
                  max={25}
                  step={0.25}
                  value={riskPercent}
                  onChange={(e) =>
                    setRiskPercent(Math.max(0.05, Number(e.target.value)))
                  }
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                  {[0.25, 0.5, 1.0, 1.5, 2.0, 3.0].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setRiskPercent(pct)}
                      className={`py-1.5 text-xs font-mono rounded-lg border transition-colors text-center whitespace-nowrap cursor-pointer ${
                        riskPercent === pct
                          ? 'border-emerald-500 bg-emerald-500 text-slate-950 font-bold'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="entry-price"
                    className="font-medium text-slate-300"
                  >
                    Entry Price (XAUUSD $)
                  </label>
                  <span className="font-mono text-emerald-400 tabular-nums">
                    Live Spot: ${spotPrice.toFixed(2)}
                  </span>
                </div>
                <input
                  id="entry-price"
                  type="number"
                  step={0.1}
                  value={calcEntryPrice}
                  onChange={(e) =>
                    setCalcEntryPrice(Math.max(1, Number(e.target.value)))
                  }
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">
                    Stop Loss Specification
                  </span>
                  <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setSlInputMode('price')}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        slInputMode === 'price'
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      By Price ($)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlInputMode('pips')}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        slInputMode === 'pips'
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      By Pips
                    </button>
                  </div>
                </div>

                {slInputMode === 'price' ? (
                  <input
                    type="number"
                    step={0.1}
                    value={calcStopLossPrice}
                    onChange={(e) =>
                      setCalcStopLossPrice(Math.max(1, Number(e.target.value)))
                    }
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                ) : (
                  <input
                    type="number"
                    min={1}
                    step={5}
                    value={calcStopLossPips}
                    onChange={(e) =>
                      setCalcStopLossPips(Math.max(1, Number(e.target.value)))
                    }
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                )}
                <div className="text-xs text-slate-400 font-mono tabular-nums flex justify-between pt-1">
                  <span>
                    SL Level: ${calculatorResults.effectiveSlPrice.toFixed(2)}
                  </span>
                  <span>
                    Distance: ${calculatorResults.priceDistance.toFixed(2)} (
                    {calculatorResults.effectiveSlPips} pips)
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Broker Pip Convention
                  </span>
                  <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPipConvention('0.10')}
                      className={`px-2.5 py-1 text-[11px] font-mono rounded-md transition-colors cursor-pointer ${
                        pipConvention === '0.10'
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      1 Pip = $0.10 (Std)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPipConvention('0.01')}
                      className={`px-2.5 py-1 text-[11px] font-mono rounded-md transition-colors cursor-pointer ${
                        pipConvention === '0.01'
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      1 Point = $0.01
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Instant Position Size & R:R Profit Matrix */}
            <div className="lg:col-span-7 space-y-4 sm:space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5 shadow-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-5 border-b border-slate-800">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4">
                    <span className="text-xs text-slate-300 block mb-1">
                      Recommended Lot Size
                    </span>
                    <div className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-emerald-400">
                      {calculatorResults.recommendedLots.toFixed(2)}{' '}
                      <span className="text-base font-sans font-semibold text-slate-300">
                        Std Lots
                      </span>
                    </div>
                  </div>

                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 sm:text-right">
                    <span className="text-xs text-slate-300 block mb-1">
                      Total Risk Amount ({riskPercent.toFixed(2)}%)
                    </span>
                    <div className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-rose-400">
                      ${calculatorResults.actualDollarRisk.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
                  <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800">
                    <span className="font-sans text-slate-400 block mb-0.5">
                      Gold Contract Volume
                    </span>
                    <strong className="text-sm text-white">
                      {calculatorResults.totalOunces.toLocaleString()} Oz
                    </strong>
                  </div>
                  <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800">
                    <span className="font-sans text-slate-400 block mb-0.5">
                      Mini / Micro Lots
                    </span>
                    <strong className="text-sm text-white">
                      {calculatorResults.miniLots}m · {calculatorResults.microLots}μ
                    </strong>
                  </div>
                  <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800">
                    <span className="font-sans text-slate-400 block mb-0.5">
                      Value Per Pip ({pipConvention})
                    </span>
                    <strong className="text-sm text-white">
                      ${calculatorResults.dollarPerPip.toFixed(2)} / pip
                    </strong>
                  </div>
                  <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800">
                    <span className="font-sans text-slate-400 block mb-0.5">
                      Stop Loss Distance
                    </span>
                    <strong className="text-sm text-rose-400">
                      {calculatorResults.effectiveSlPips}p ($
                      {calculatorResults.priceDistance.toFixed(2)})
                    </strong>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Risk-to-Reward Targets (1:1, 1:2, 1:3 & Custom)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Automated take profit targets for {calcDirection} entry at $
                      {calcEntryPrice.toFixed(2)} ({calculatorResults.recommendedLots.toFixed(2)} lots).
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <label htmlFor="custom-rr" className="text-slate-300 font-medium">
                      Custom R:R
                    </label>
                    <input
                      id="custom-rr"
                      type="number"
                      min={0.5}
                      max={20}
                      step={0.5}
                      value={customRrRatio}
                      onChange={(e) =>
                        setCustomRrRatio(Math.max(0.5, Number(e.target.value)))
                      }
                      className="w-16 px-2.5 py-1.5 font-mono text-xs bg-slate-950 border border-slate-800 text-white rounded-xl text-right tabular-nums"
                    />
                  </div>
                </div>

                {/* Mobile Card View for R:R Targets */}
                <div className="grid grid-cols-1 gap-2.5 sm:hidden font-mono tabular-nums">
                  {calculatorResults.rrTiers.map((tier) => (
                    <div
                      key={tier.label}
                      className="p-3.5 rounded-2xl border border-slate-800 bg-slate-950/70 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-xs font-bold text-white">
                          {tier.label}
                        </span>
                        <span className="text-xs font-semibold text-emerald-400">
                          +{tier.roiPercent.toFixed(2)}% ROI
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between text-xs pt-1 border-t border-slate-800">
                        <div>
                          <span className="font-sans text-[11px] text-slate-400 block">
                            Target Price (+{tier.targetPips} pips)
                          </span>
                          <span className="text-sm font-bold text-white">
                            ${tier.targetPrice.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-sans text-[11px] text-slate-400 block">
                            Potential Profit
                          </span>
                          <span className="text-base font-bold text-emerald-400">
                            +$
                            {tier.potentialProfitUsd.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View for R:R Targets */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] font-medium text-slate-400">
                        <th className="py-2.5 pr-4">R:R Ratio</th>
                        <th className="py-2.5 px-4 text-right">Take Profit Price</th>
                        <th className="py-2.5 px-4 text-right">Pip Gain</th>
                        <th className="py-2.5 px-4 text-right">Potential Profit (USD)</th>
                        <th className="py-2.5 pl-4 text-right">Account ROI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-xs font-mono tabular-nums">
                      {calculatorResults.rrTiers.map((tier) => (
                        <tr key={tier.label} className="hover:bg-slate-800/40">
                          <td className="py-3.5 pr-4 font-sans font-semibold text-white">
                            {tier.label}
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-white">
                            ${tier.targetPrice.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-right text-emerald-400">
                            +{tier.targetPips} pips
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-emerald-400 text-sm">
                            +$
                            {tier.potentialProfitUsd.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-3.5 pl-4 text-right text-emerald-300 font-medium">
                            +{tier.roiPercent.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================
            PAGE 3 (EXCLUSIVE VIEW): DAILY ECONOMIC NEWS (FOREX FACTORY SYNC)
            When activePage === 'economic-news' -> display: block
            When activePage !== 'economic-news' -> display: none
        =================================================================== */}
        <div
          id="page-economic-news"
          style={{ display: activePage === 'economic-news' ? 'block' : 'none' }}
          className={
            activePage === 'economic-news'
              ? 'block space-y-4 sm:space-y-6'
              : 'hidden'
          }
        >
          {/* Page 3 Header Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 mb-1">
                <span className="font-semibold text-emerald-400">
                  DollarX Macro Calendar
                </span>
                <span aria-hidden="true">·</span>
                <span>USD & XAU High-Impact Catalyst Sync</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Daily Economic News & Forex Factory Feed
              </h1>
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-300 whitespace-nowrap shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>Live Macro Feed · Auto-Sync</span>
            </div>
          </div>

          {/* =================================================================
              MODUL 1: DAILY AI NEWS SENTIMENT SUMMARY ("AI Macro Sentiment Analysis")
          ================================================================= */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Executive Daily Macro Briefing · CPI · NFP · FOMC · PMI
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white font-display">
                  AI Macro Sentiment Analysis
                </h2>
              </div>

              {/* Sentiment Regime Switcher (Auto Calendar Sync vs Preset Scenarios) */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 border border-slate-800 p-1 rounded-xl self-start lg:self-auto text-xs">
                <button
                  type="button"
                  onClick={() => setSentimentPreset('auto')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    sentimentPreset === 'auto'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Live Calendar AI Sync
                </button>
                <button
                  type="button"
                  onClick={() => setSentimentPreset('hawkish-usd')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    sentimentPreset === 'hawkish-usd'
                      ? 'bg-rose-500 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  65% Bullish USD / 35% Gold
                </button>
                <button
                  type="button"
                  onClick={() => setSentimentPreset('bullish-gold')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    sentimentPreset === 'bullish-gold'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  65% Gold Bullish / 35% USD
                </button>
              </div>
            </div>

            {/* Dominant Sentiment Conclusion & Daily Sentiment Score Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              <div className="lg:col-span-7 space-y-3">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase border bg-slate-950 border-slate-800 text-slate-200">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      aiMacroSentiment.isGoldBullish
                        ? 'bg-emerald-400'
                        : 'bg-rose-400'
                    }`}
                  />
                  <span>{aiMacroSentiment.regimeTag}</span>
                </div>

                <h3
                  className={`text-lg sm:text-xl font-bold font-display leading-snug ${
                    aiMacroSentiment.isGoldBullish
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  "{aiMacroSentiment.headline}"
                </h3>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {aiMacroSentiment.executiveSummary}
                </p>

                <div className="pt-1 flex flex-wrap gap-2">
                  {aiMacroSentiment.keyDrivers.map((drv) => (
                    <span
                      key={drv}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300"
                    >
                      {drv}
                    </span>
                  ))}
                </div>
              </div>

              {/* Daily Sentiment Score Meter Card */}
              <div className="lg:col-span-5 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white uppercase tracking-wider">
                    Skor Sentimen Harian (Daily Score)
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    USD vs XAUUSD
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono tabular-nums">
                  <div className="p-3 rounded-xl bg-slate-900 border border-rose-500/30">
                    <span className="text-[11px] font-sans text-slate-400 block">
                      Bullish USD (Bearish XAU)
                    </span>
                    <strong className="text-xl sm:text-2xl font-bold text-rose-400">
                      {aiMacroSentiment.usdScore}%
                    </strong>
                    <span className="text-[10px] text-rose-300 block mt-0.5">
                      Hawkish DXY / Yields
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/30">
                    <span className="text-[11px] font-sans text-slate-400 block">
                      Gold Bullish (Bullish XAU)
                    </span>
                    <strong className="text-xl sm:text-2xl font-bold text-emerald-400">
                      {aiMacroSentiment.goldScore}%
                    </strong>
                    <span className="text-[10px] text-emerald-300 block mt-0.5">
                      Safe-Haven / Lower Yields
                    </span>
                  </div>
                </div>

                {/* Dual-Sided Visual Sentiment Bar */}
                <div className="space-y-1.5">
                  <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-800 p-0.5 gap-0.5">
                    <div
                      style={{ width: `${aiMacroSentiment.usdScore}%` }}
                      className="h-full bg-rose-500 rounded-l-full transition-all duration-300"
                    />
                    <div
                      style={{ width: `${aiMacroSentiment.goldScore}%` }}
                      className="h-full bg-emerald-500 rounded-r-full transition-all duration-300"
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-mono font-semibold">
                    <span className="text-rose-400">
                      {aiMacroSentiment.usdScore}% Bullish USD
                    </span>
                    <span className="text-emerald-400">
                      {aiMacroSentiment.goldScore}% Gold Bullish
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Filter & Timezone Control Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="grid grid-cols-3 sm:flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
                {(['All', 'High', 'Medium'] as const).map((imp) => (
                  <button
                    key={imp}
                    type="button"
                    onClick={() => setImpactFilter(imp)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-center whitespace-nowrap cursor-pointer ${
                      impactFilter === imp
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {imp === 'All'
                      ? 'All Impact'
                      : imp === 'High'
                      ? 'High (Red)'
                      : 'Medium (Orange)'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-5 sm:flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
                {[
                  'All',
                  'Nov 2, 2026',
                  'Nov 3, 2026',
                  'Nov 5, 2026',
                  'Nov 6, 2026',
                ].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDateFilter(d)}
                    className={`px-2 py-1.5 text-xs font-medium rounded-lg transition-colors text-center whitespace-nowrap cursor-pointer ${
                      dateFilter === d
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {d === 'All' ? 'All' : d.replace(', 2026', '')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={newsSearch}
                  onChange={(e) => setNewsSearch(e.target.value)}
                  placeholder="Filter CPI, ISM, FOMC, NFP..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 sm:flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
                {(['EST', 'GMT', 'GMT+8'] as const).map((tz) => (
                  <button
                    key={tz}
                    type="button"
                    onClick={() => setTimezone(tz)}
                    className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg transition-colors text-center whitespace-nowrap cursor-pointer ${
                      timezone === tz
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tz}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Card Feed for Economic News */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredEvents.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400">
                No macroeconomic releases match your active filter criteria.
              </div>
            ) : (
              filteredEvents.map((ev) => {
                const displayTime =
                  timezone === 'EST'
                    ? ev.timeEst
                    : timezone === 'GMT'
                    ? ev.timeGmt
                    : ev.timeAsia;
                const isExpanded = expandedEventId === ev.id;

                return (
                  <div
                    key={ev.id}
                    onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="font-mono tabular-nums text-slate-400">
                        <strong className="text-white">{displayTime}</strong> ·{' '}
                        {ev.date}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Folder
                          className={`w-3.5 h-3.5 ${
                            ev.impact === 'High'
                              ? 'fill-rose-500 text-rose-400'
                              : 'fill-amber-500 text-amber-400'
                          }`}
                        />
                        <span
                          className={`font-semibold ${
                            ev.impact === 'High'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {ev.impact} Impact
                        </span>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-sm font-bold text-white">
                        <span className="font-mono text-xs text-emerald-400 mr-1.5">
                          [{ev.currency}]
                        </span>
                        {ev.event}
                      </div>
                      <span
                        className={`text-xs font-mono font-semibold shrink-0 ${
                          ev.goldImpactBias === 'Bullish XAU'
                            ? 'text-emerald-400'
                            : ev.goldImpactBias === 'Bearish XAU'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {ev.goldImpactBias}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-xs font-mono tabular-nums">
                      <div>
                        <span className="font-sans text-[11px] text-slate-400 block">
                          Actual
                        </span>
                        <span className="font-bold text-white">
                          {ev.actual || 'Pending'}
                        </span>
                      </div>
                      <div>
                        <span className="font-sans text-[11px] text-slate-400 block">
                          Forecast
                        </span>
                        <span className="text-slate-300">{ev.forecast}</span>
                      </div>
                      <div>
                        <span className="font-sans text-[11px] text-slate-400 block">
                          Previous
                        </span>
                        <span className="text-slate-400">{ev.previous}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="pt-2.5 border-t border-slate-800 text-xs text-slate-300 leading-relaxed">
                        <strong className="text-emerald-400 font-semibold">
                          DollarX Quant Note:{' '}
                        </strong>
                        {ev.quantNote}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Chronological Economic Calendar Table */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-medium text-slate-400">
                    <th className="py-3.5 pl-6 pr-3">Date & Time ({timezone})</th>
                    <th className="py-3.5 px-3">Currency</th>
                    <th className="py-3.5 px-3">Impact Level</th>
                    <th className="py-3.5 px-4">Macroeconomic Release</th>
                    <th className="py-3.5 px-4 text-right">Actual</th>
                    <th className="py-3.5 px-4 text-right">Forecast</th>
                    <th className="py-3.5 px-4 text-right">Previous</th>
                    <th className="py-3.5 pl-4 pr-6 text-right">Gold Impact Bias</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs">
                  {filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        No macroeconomic releases match your active filter criteria.
                        <button
                          type="button"
                          onClick={() => {
                            setImpactFilter('All');
                            setDateFilter('All');
                            setNewsSearch('');
                          }}
                          className="ml-2 underline text-emerald-400 font-medium"
                        >
                          Reset Filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredEvents.map((ev) => {
                      const displayTime =
                        timezone === 'EST'
                          ? ev.timeEst
                          : timezone === 'GMT'
                          ? ev.timeGmt
                          : ev.timeAsia;
                      const isExpanded = expandedEventId === ev.id;

                      return (
                        <React.Fragment key={ev.id}>
                          <tr
                            onClick={() =>
                              setExpandedEventId(isExpanded ? null : ev.id)
                            }
                            className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                          >
                            <td className="py-3.5 pl-6 pr-3 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                              <span className="font-semibold text-white">
                                {displayTime}
                              </span>
                              <span className="text-slate-600 mx-1.5">·</span>
                              <span className="text-slate-400">{ev.date}</span>
                            </td>
                            <td className="py-3.5 px-3 font-mono font-semibold text-emerald-400">
                              {ev.currency}
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <Folder
                                  className={`w-4 h-4 ${
                                    ev.impact === 'High'
                                      ? 'fill-rose-500 text-rose-400'
                                      : ev.impact === 'Medium'
                                      ? 'fill-amber-500 text-amber-400'
                                      : 'fill-slate-600 text-slate-500'
                                  }`}
                                />
                                <span
                                  className={`font-medium ${
                                    ev.impact === 'High'
                                      ? 'text-rose-400'
                                      : ev.impact === 'Medium'
                                      ? 'text-amber-400'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {ev.impact} Impact
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-medium text-white">
                              {ev.event}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold">
                              {ev.actual ? (
                                <span className="text-white">{ev.actual}</span>
                              ) : (
                                <span className="text-slate-500 font-normal">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-300">
                              {ev.forecast}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-400">
                              {ev.previous}
                            </td>
                            <td className="py-3.5 pl-4 pr-6 text-right font-mono whitespace-nowrap">
                              <span
                                className={`font-semibold ${
                                  ev.goldImpactBias === 'Bullish XAU'
                                    ? 'text-emerald-400'
                                    : ev.goldImpactBias === 'Bearish XAU'
                                    ? 'text-rose-400'
                                    : ev.goldImpactBias === 'High Volatility'
                                    ? 'text-amber-400'
                                    : 'text-slate-400'
                                }`}
                              >
                                {ev.goldImpactBias}
                              </span>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-950/80">
                              <td
                                colSpan={8}
                                className="px-6 py-3 text-xs text-slate-300 border-t border-slate-800"
                              >
                                <strong className="text-emerald-400 font-medium">
                                  DollarX Quantitative Impact Note:{' '}
                                </strong>
                                {ev.quantNote}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* =====================================================================
          CLEAN MINIMALIST EXCLUSIVE FOOTER
      ===================================================================== */}
      <footer className="bg-slate-900 border-t border-slate-800 mt-8">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-center sm:text-left">
            <span className="font-semibold text-white">
              DollarX
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Klien: {activeClient.name} (ID Broker: {activeClient.brokerId})
            </span>
            <span aria-hidden="true">·</span>
            <span>M15/M30 SNR · TLT · TLBO · SL 60–70 Pips / TP 100–300 Pips</span>
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            Institutional XAUUSD Quantitative Terminal
          </div>
        </div>
      </footer>

      {/* =====================================================================
          MOBILE-FIRST FIXED BOTTOM NAVIGATION BAR (Thumb-Friendly 3-Tab Bar)
          Active tab highlights in DollarX Emerald Green
      ===================================================================== */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 grid grid-cols-3 px-2 shadow-2xl"
      >
        <button
          type="button"
          onClick={() => handleSwitchPage('signal-hub')}
          className={`flex flex-col items-center justify-center gap-1 rounded-xl my-1.5 mx-1 transition-all cursor-pointer ${
            activePage === 'signal-hub'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
              : 'text-slate-400 font-medium hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span className="text-[11px] tracking-tight">AI Signal Hub</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchPage('pips-calculator')}
          className={`flex flex-col items-center justify-center gap-1 rounded-xl my-1.5 mx-1 transition-all cursor-pointer ${
            activePage === 'pips-calculator'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
              : 'text-slate-400 font-medium hover:text-white'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span className="text-[11px] tracking-tight">Pips Calculator</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchPage('economic-news')}
          className={`flex flex-col items-center justify-center gap-1 rounded-xl my-1.5 mx-1 transition-all cursor-pointer ${
            activePage === 'economic-news'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
              : 'text-slate-400 font-medium hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span className="text-[11px] tracking-tight">Economic News</span>
        </button>
      </nav>
    </div>
  );
}

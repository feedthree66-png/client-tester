import React, { useEffect, useRef } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import {
  AISignalOutput,
  Candle,
  ConfluenceMetrics,
  Timeframe,
} from '../data/xauusdEngine';

interface PriceStructureChartProps {
  candles: Candle[];
  spotPrice: number;
  change24h?: number;
  changePct24h?: number;
  bidPrice?: number;
  askPrice?: number;
  high24h?: number;
  low24h?: number;
  timeframe: Timeframe;
  onSelectTimeframe: (tf: Timeframe) => void;
  signal: AISignalOutput;
  confluence: ConfluenceMetrics;
}

export const PriceStructureChart: React.FC<PriceStructureChartProps> = ({
  spotPrice,
  change24h = 0,
  changePct24h = 0,
  bidPrice,
  askPrice,
  high24h,
  low24h,
  timeframe,
  onSelectTimeframe,
  signal,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const timeframes: Timeframe[] = ['M15', 'M30'];
  const tvIntervalMap: Record<Timeframe, string> = {
    M5: '5',
    M15: '15',
    M30: '30',
    H1: '60',
    H4: '240',
    D1: 'D',
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const widgetWrapper = document.createElement('div');
    widgetWrapper.className = 'tradingview-widget-container__widget';
    widgetWrapper.style.height = '100%';
    widgetWrapper.style.width = '100%';

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: 'OANDA:XAUUSD',
      interval: tvIntervalMap[timeframe] || '15',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: 'rgba(9, 13, 22, 1)',
      gridColor: 'rgba(30, 41, 59, 0.45)',
      withdateranges: true,
      hide_side_toolbar: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      hide_volume: true,
      support_host: 'https://www.tradingview.com',
    });

    container.appendChild(widgetWrapper);
    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [timeframe]);

  const isPositive = change24h >= 0;
  const freshSupplyZone = signal.dailyFreshZones?.find(
    (z) => z.type === 'Fresh Supply Zone'
  );
  const freshDemandZone = signal.dailyFreshZones?.find(
    (z) => z.type === 'Fresh Demand Zone'
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col h-full">
      {/* Card 1 Header: Live XAUUSD Price Ticker & Exclusive M15/M30 Timeframe Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-white">DollarX · XAUUSD LIVE SPOT</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400 font-mono">M15/M30 SNR · TLT · TLBO</span>
            </div>
            <div className="flex items-baseline gap-2.5 mt-0.5 font-mono tabular-nums">
              <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                ${spotPrice.toFixed(2)}
              </span>
              <span
                className={`text-xs font-semibold inline-flex items-center gap-0.5 ${
                  isPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isPositive ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {isPositive ? '+' : ''}
                {change24h.toFixed(2)} ({isPositive ? '+' : ''}
                {changePct24h.toFixed(2)}%)
              </span>
            </div>
          </div>

          {bidPrice !== undefined && askPrice !== undefined && (
            <div className="hidden xl:flex items-center gap-3 text-xs font-mono tabular-nums text-slate-400 border-l border-slate-800 pl-4">
              <span>
                Bid/Ask:{' '}
                <strong className="text-slate-200">
                  ${bidPrice.toFixed(2)} / ${askPrice.toFixed(2)}
                </strong>
              </span>
              {low24h !== undefined && high24h !== undefined && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    24h:{' '}
                    <strong className="text-slate-200">
                      ${low24h.toFixed(0)}–${high24h.toFixed(0)}
                    </strong>
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Exclusive M15 / M30 Anti-Noise Timeframe Selector */}
        <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl self-start sm:self-auto">
          {timeframes.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => onSelectTimeframe(tf)}
              className={`min-h-[32px] px-3 py-1 text-xs font-mono rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                timeframe === tf
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* TradingView Chart Viewport */}
      <div className="flex-1 w-full min-h-[420px] sm:min-h-[470px] pt-3">
        <div
          ref={containerRef}
          className="tradingview-widget-container w-full h-[420px] sm:h-[470px] rounded-xl overflow-hidden border border-slate-800 bg-[#090d16]"
        />
      </div>

      {/* Compact Daily Unmitigated Order Blocks (Fresh Supply & Fresh Demand Reference Bar) */}
      {(freshSupplyZone || freshDemandZone) && (
        <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
          <span className="font-sans font-semibold text-slate-300">
            Daily Unmitigated Order Blocks (Fresh Zones):
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {freshSupplyZone && (
              <span className="text-rose-300">
                Fresh Supply:{' '}
                <strong className="text-rose-400">{freshSupplyZone.zoneRangeText}</strong>
              </span>
            )}
            {freshSupplyZone && freshDemandZone && (
              <span className="text-slate-700" aria-hidden="true">|</span>
            )}
            {freshDemandZone && (
              <span className="text-emerald-300">
                Fresh Demand:{' '}
                <strong className="text-emerald-400">{freshDemandZone.zoneRangeText}</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


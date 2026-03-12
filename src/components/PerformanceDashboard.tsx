/**
 * PerformanceDashboard - Development mode performance metrics display
 *
 * Shows render times, API call durations, and interaction timings
 * Only visible in development mode
 */

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { perfMonitor, type PerformanceStats } from '../utils/performance';

interface MetricDisplay {
  name: string;
  stats: PerformanceStats;
  category: 'render' | 'api' | 'interaction' | 'custom';
}

const categoryColors: Record<string, string> = {
  render: 'bg-blue-500/20 text-blue-400 border-blue-400/30',
  api: 'bg-green-500/20 text-green-400 border-green-400/30',
  interaction: 'bg-purple-500/20 text-purple-400 border-purple-400/30',
  custom: 'bg-gray-500/20 text-gray-400 border-gray-400/30',
};

const REFRESH_INTERVAL_MS = 2000;

/**
 * Inner component - only rendered in DEV mode
 */
const PerformanceDashboardInner: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricDisplay[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refreshMetrics = useCallback(() => {
    const allStats = perfMonitor.getAllStats();
    const metricNames = perfMonitor.getMetricNames();

    const displays: MetricDisplay[] = metricNames
      .map((name) => {
        const stats = allStats.get(name);
        if (!stats) return null;

        // Determine category from metric name prefix
        let category: MetricDisplay['category'] = 'custom';
        if (name.startsWith('render:')) category = 'render';
        else if (name.startsWith('api:')) category = 'api';
        else if (name.startsWith('interaction:')) category = 'interaction';

        return {
          name: name.replace(/^(render:|api:|interaction:)/, ''),
          stats,
          category,
        };
      })
      .filter((m): m is MetricDisplay => m !== null)
      .sort((a, b) => b.stats.avgDuration - a.stats.avgDuration);

    setMetrics(displays);
  }, []);

  // Auto-refresh metrics
  useEffect(() => {
    refreshMetrics();

    if (autoRefresh) {
      const interval = setInterval(refreshMetrics, REFRESH_INTERVAL_MS);
      return () => clearInterval(interval);
    }

    return undefined;
  }, [autoRefresh, refreshMetrics]);

  const handleClear = useCallback(() => {
    perfMonitor.clear();
    refreshMetrics();
  }, [refreshMetrics]);

  // Calculate totals with memoization
  const { totalRenderTime, totalApiTime, totalInteractions } = useMemo(() => {
    return {
      totalRenderTime: metrics
        .filter((m) => m.category === 'render')
        .reduce((sum, m) => sum + m.stats.totalDuration, 0),
      totalApiTime: metrics
        .filter((m) => m.category === 'api')
        .reduce((sum, m) => sum + m.stats.totalDuration, 0),
      totalInteractions: metrics
        .filter((m) => m.category === 'interaction')
        .reduce((sum, m) => sum + m.stats.count, 0),
    };
  }, [metrics]);

  if (!isExpanded) {
    // Collapsed view - small indicator
    return (
      <div
        className="ios-pressable fixed bottom-4 left-4 z-50 cursor-pointer rounded-full bg-slate-900/90 px-3 py-1.5 text-xs text-white/70 shadow-lg backdrop-blur-sm border border-white/10"
        onClick={() => setIsExpanded(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsExpanded(true);
          }
        }}
        aria-label="Expand performance dashboard"
      >
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Perf: {metrics.length} metrics
        </span>
      </div>
    );
  }

  return (
    <div className="ios-glass-surface fixed bottom-4 left-4 z-50 max-h-[60vh] w-80 overflow-hidden rounded-[1.2rem] bg-slate-900/95 shadow-xl border border-white/10">
      {/* Header */}
      <div
        className="flex items-center justify-between border-b border-white/10 bg-slate-800/50 px-3 py-2 cursor-pointer"
        onClick={() => setIsExpanded(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsExpanded(false);
          }
        }}
        aria-label="Collapse performance dashboard"
      >
        <h3 className="text-sm font-medium text-white">Performance Dashboard</h3>
        <div className="flex items-center gap-2">
          <label htmlFor="auto-refresh-checkbox" className="flex items-center gap-1 text-xs text-white/50 cursor-pointer">
            <input
              id="auto-refresh-checkbox"
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="rounded"
            />
            Auto
          </label>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="ios-pressable rounded px-2 py-0.5 text-xs text-white/50 hover:bg-white/10 hover:text-white"
          >
            Clear
          </button>
          <span className="h-2 w-2 rounded-full bg-green-500" />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 border-b border-white/5 bg-slate-800/30 p-2">
        <div className="text-center">
          <div className="text-xs text-blue-400">Render</div>
          <div className="text-sm font-medium text-white">{totalRenderTime.toFixed(1)}ms</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-green-400">API</div>
          <div className="text-sm font-medium text-white">{totalApiTime.toFixed(1)}ms</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-purple-400">Interactions</div>
          <div className="text-sm font-medium text-white">{totalInteractions}</div>
        </div>
      </div>

      {/* Metrics List */}
      <div className="max-h-[200px] overflow-y-auto p-2">
        {metrics.length === 0 ? (
          <div className="py-4 text-center text-xs text-white/40">
            No metrics recorded yet
          </div>
        ) : (
          <div className="space-y-1">
            {metrics.map((metric) => (
              <div
                key={`${metric.category}-${metric.name}`}
                className="ios-list-row flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-2 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                      categoryColors[metric.category]
                    }`}
                  >
                    {metric.category.charAt(0)}
                  </span>
                  <span className="text-xs text-white/80">{metric.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-white/50">
                    avg: <span className="text-white">{metric.stats.avgDuration.toFixed(1)}ms</span>
                  </span>
                  <span className="text-white/40">
                    max: {metric.stats.maxDuration.toFixed(1)}ms
                  </span>
                  <span className="text-white/30">({metric.stats.count})</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 bg-slate-800/30 px-2 py-1">
        <div className="flex items-center justify-between text-[10px] text-white/30">
          <span>Only visible in DEV mode</span>
          <span>Updated every 2s</span>
        </div>
      </div>
    </div>
  );
};

PerformanceDashboardInner.displayName = 'PerformanceDashboardInner';

/**
 * PerformanceDashboard - Only renders in development mode
 * Uses conditional component pattern to avoid hooks rule violation
 */
const PerformanceDashboard: React.FC = () => {
  // Early return at component level - this is safe because we haven't called any hooks yet
  if (!import.meta.env.DEV) {
    return null;
  }

  return <PerformanceDashboardInner />;
};

PerformanceDashboard.displayName = 'PerformanceDashboard';

export default memo(PerformanceDashboard);

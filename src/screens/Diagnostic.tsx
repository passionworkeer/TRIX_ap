import React, { useEffect, useState } from 'react';
import { getClawbotEndpoints } from '../config/clawbotEndpoints';
import trixNativeChannelClient from '../services/TrixNativeChannelClient';
import { getErrorMessage } from '../utils/errorHandler';

interface DiagnosticResult {
  serviceUrl?: string;
  healthUrl?: string;
  paired?: boolean;
  conversationId?: string;
  connectionTest?: {
    success: boolean;
    message: string;
    agentOnline?: boolean;
    error?: string;
  };
}

const Diagnostic: React.FC = () => {
  const [results, setResults] = useState<DiagnosticResult>({});
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const endpoints = getClawbotEndpoints();
    const serviceUrl = (endpoints.nativePublicUrl || endpoints.nativeServerUrl || '').replace(/\/$/, '');
    const session = trixNativeChannelClient.getSession();

    setResults({
      serviceUrl,
      healthUrl: serviceUrl ? `${serviceUrl}/health` : '',
      paired: Boolean(session),
      conversationId: session?.conversationId,
    });
  }, []);

  const testConnection = async () => {
    setTesting(true);
    const { healthUrl } = results;
    if (!healthUrl) {
      setResults((prev) => ({
        ...prev,
        connectionTest: {
          success: false,
          message: 'Service URL Missing',
          error: 'Missing TRIX Native service URL',
        },
      }));
      setTesting(false);
      return;
    }

    try {
      const response = await fetch(healthUrl, { method: 'GET' });
      const payload = await response.json().catch(() => ({})) as { ok?: boolean; agentOnline?: boolean };
      if (!response.ok || payload.ok !== true) {
        setResults((prev) => ({
          ...prev,
          connectionTest: {
            success: false,
            message: 'Service Unreachable',
            error: `HTTP ${response.status}`,
          },
        }));
        setTesting(false);
        return;
      }

      setResults((prev) => ({
        ...prev,
        connectionTest: {
          success: true,
          message: payload.agentOnline ? 'Service reachable, OpenClaw plugin online' : 'Service reachable, waiting for OpenClaw plugin',
          agentOnline: Boolean(payload.agentOnline),
        },
      }));
    } catch (error: unknown) {
      setResults((prev) => ({
        ...prev,
        connectionTest: {
          success: false,
          message: 'Service Test Failed',
          error: getErrorMessage(error, 'Error'),
        },
      }));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-10 font-sans text-white">
      <div className="ios-glass-surface mx-auto max-w-xl rounded-[2rem] border border-slate-700 bg-slate-800/96 p-8 shadow-2xl">
        <h1 className="mb-8 bg-gradient-to-r from-cyan-300 to-emerald-400 bg-clip-text text-3xl font-black text-transparent">
          Trix Native Diagnostic
        </h1>
        <div className="mb-10 space-y-4">
          <div className="ios-glass-surface rounded-[1.35rem] border border-slate-700 bg-slate-900/72 p-4">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Trix Service URL</div>
            <div className="font-mono text-sm">{results.serviceUrl || 'NONE'}</div>
          </div>
          <div className="ios-glass-surface rounded-[1.35rem] border border-slate-700 bg-slate-900/72 p-4">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Local Pairing Session</div>
            <div className="font-mono text-sm">{results.paired ? `READY (${results.conversationId})` : 'NOT PAIRED'}</div>
          </div>
        </div>
        <button
          onClick={testConnection}
          disabled={testing}
          className="ios-pressable ios-primary-button w-full rounded-2xl py-4 font-bold text-white disabled:opacity-50"
        >
          {testing ? 'Testing Service...' : 'Run Service Test'}
        </button>
        {results.connectionTest && (
          <div className={`mt-8 rounded-2xl border p-6 ${results.connectionTest.success ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-red-500/50 bg-red-500/10 text-red-300'}`}>
            <div className="text-lg font-bold">{results.connectionTest.success ? 'Success' : 'Failed'}</div>
            <div className="text-sm opacity-80">{results.connectionTest.message}</div>
            {results.connectionTest.error ? (
              <div className="mt-2 text-xs opacity-80">{results.connectionTest.error}</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default Diagnostic;

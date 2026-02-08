import React, { useEffect, useState } from 'react';

interface DiagnosticResult {
  wsUrl?: string;
  authToken?: string;
  supabaseUrl?: string;
  connectionTest?: {
    success: boolean;
    message: string;
    error?: string;
  };
}

const Diagnostic: React.FC = () => {
  const [results, setResults] = useState<DiagnosticResult>({});
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_PC_WEBSOCKET_URL as string;
    const authToken = import.meta.env.VITE_PC_AUTH_TOKEN as string;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    setResults({ wsUrl, authToken, supabaseUrl });
  }, []);

  const testConnection = async () => {
    setTesting(true);
    const { wsUrl, authToken } = results;
    if (!wsUrl || !authToken) {
      setResults(prev => ({ ...prev, connectionTest: { success: false, message: 'Env Missing', error: 'Missing WS URL or Token' } }));
      setTesting(false);
      return;
    }
    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => console.log('Connected');
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'connect.challenge') {
          ws.send(JSON.stringify({
            type: 'req', id: '1', method: 'connect',
            params: { minProtocol: 3, maxProtocol: 3, role: 'operator', client: { id: 'diag', mode: 'web', platform: 'web', displayName: 'Diag', version: '1.0', instanceId: '1' }, auth: { token: authToken } }
          }));
        } else if (data.type === 'res' && data.payload?.type === 'hello-ok') {
          setResults(prev => ({ ...prev, connectionTest: { success: true, message: 'Authenticated Successfully' } }));
          ws.close();
          setTesting(false);
        }
      };
      ws.onerror = () => {
        setResults(prev => ({ ...prev, connectionTest: { success: false, message: 'Connection Failed', error: 'WS Error' } }));
        setTesting(false);
      };
    } catch (e: any) {
      setResults(prev => ({ ...prev, connectionTest: { success: false, message: 'Error', error: e.message } }));
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-10 font-sans">
      <div className="max-w-xl mx-auto bg-slate-800 rounded-3xl p-8 shadow-2xl border border-slate-700">
        <h1 className="text-3xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
          Clawdbot Diagnostic
        </h1>
        <div className="space-y-4 mb-10">
          <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Gateway URL</div>
            <div className="font-mono text-sm">{results.wsUrl || 'NONE'}</div>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Auth Token</div>
            <div className="font-mono text-sm">{results.authToken ? 'PRESENT' : 'MISSING'}</div>
          </div>
        </div>
        <button 
          onClick={testConnection} 
          disabled={testing}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 py-4 rounded-2xl font-bold transition-all"
        >
          {testing ? 'Testing...' : 'Run Connection Test'}
        </button>
        {results.connectionTest && (
          <div className={`mt-8 p-6 rounded-2xl border ${results.connectionTest.success ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
            <div className="text-lg font-bold">{results.connectionTest.success ? 'Success' : 'Failed'}</div>
            <div className="text-sm opacity-80">{results.connectionTest.message}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Diagnostic;

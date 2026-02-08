import { useState } from "react";

export default function DiagnosticAdvanced() {
  const [logs, setLogs] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<"idle" | "testing" | "success" | "failed">("idle");

  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };

  const testDirectConnection = () => {
    setLogs([]);
    setTestResult("testing");
    log(" 开始直接 WebSocket 测试...");
    
    const wsUrl = "ws://192.168.101.4:18789";
    const authToken = "8743d26357758f202c9bb5a21db706185d66f9c98f9c3ff1";
    
    log(` 目标: ${wsUrl}`);
    log("");
    
    try {
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          log(" 连接超时 (10s)");
          ws.close();
          setTestResult("failed");
        }
      }, 10000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        log(" WebSocket 连接已打开!");
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          log(` 收到: ${data.event || data.type}`);
          if (data.event === "connect.challenge") {
            const response = {
              type: "req",
              id: data.payload.nonce,
              method: "connect",
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                role: "operator",
                client: { id: "clawdbot-ios", mode: "webchat", platform: "web", displayName: "TRIX Diagnostic", version: "1.0.0", instanceId: Math.random().toString(36).substring(2, 15) },
                caps: [],
                auth: { token: authToken }
              }
            };
            ws.send(JSON.stringify(response));
          }
          if (data.payload?.type === "hello-ok") {
            log(" 认证成功!");
            setTestResult("success");
            setTimeout(() => ws.close(), 1000);
          }
        } catch (e: any) { log(` 消息解析失败: ${e.message}`); }
      };
      
      ws.onerror = () => {
        clearTimeout(timeout);
        log(" WebSocket 错误!");
        setTestResult("failed");
      };
      
    } catch (e: any) {
      log(` 创建 WebSocket 失败: ${e.message}`);
      setTestResult("failed");
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "monospace", background: "#1e1e1e", color: "#d4d4d4", minHeight: "100vh" }}>
      <h2 style={{ color: "#007acc" }}> 高级 WebSocket 诊断</h2>
      <div style={{ marginBottom: "20px" }}>
        <button onClick={testDirectConnection} style={{ padding: "10px 20px", margin: "5px", background: "#007acc", color: "white", border: "none", borderRadius: "3px", cursor: "pointer" }}>测试直接连接</button>
        <button onClick={() => setLogs([])} style={{ padding: "10px 20px", margin: "5px", background: "#6c757d", color: "white", border: "none", borderRadius: "3px", cursor: "pointer" }}>清空日志</button>
      </div>
      {testResult !== "idle" && (
        <div style={{ padding: "10px", marginBottom: "20px", background: testResult === "success" ? "#28a745" : testResult === "failed" ? "#dc3545" : "#ffc107", color: "white", borderRadius: "3px" }}>
          {testResult === "testing" && " 测试中..."}
          {testResult === "success" && " 测试成功!"}
          {testResult === "failed" && " 测试失败"}
        </div>
      )}
      <div style={{ background: "#2d2d2d", padding: "15px", borderRadius: "5px", maxHeight: "600px", overflowY: "auto" }}>
        <h3 style={{ marginTop: 0, color: "#007acc" }}> 日志</h3>
        {logs.length === 0 ? <div style={{ color: "#888" }}>点击按钮开始测试...</div> : logs.map((log, index) => <div key={index} style={{ marginBottom: "5px", fontSize: "12px" }}>{log}</div>)}
      </div>
    </div>
  );
}

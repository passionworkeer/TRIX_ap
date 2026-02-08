import React, { useState, useEffect } from 'react';
import { useGlobalConnection } from "../contexts/WebSocketContext";

const StatusHeader: React.FC = () => {
  const { status: pcStatus } = useGlobalConnection();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pt-12 px-6 flex justify-between items-center pointer-events-none">
      {/* 左侧：连接状态 */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)] ${
          pcStatus === "CONNECTED" ? "bg-[#00FFFF] animate-pulse" : "bg-red-500"
        }`} />
        <span className="text-[10px] font-bold tracking-widest text-white/60 uppercase">
          {pcStatus === "CONNECTED" ? "PC LINKED" : "OFFLINE"}
        </span>
      </div>

      {/* 右侧：时间 */}
      <div className="text-sm font-medium text-white/80 tracking-wide font-mono">
        {formatTime(time)}
      </div>

      {/* 顶部渐变遮罩，增加文字可读性 */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent -z-10" />
    </header>
  );
};

export default StatusHeader;

import { useRef, useEffect } from "react";
import heroVideo from "../assets/roles/role1/role_video.mp4";
import sayingVideo from "../assets/roles/role1/Saying.mp4";

// 视频路径 (通过 import 导入,Vite 会自动处理)
const IDLE_VIDEO = heroVideo;
const SAYING_VIDEO = sayingVideo;

export default function HeroBackground() {
  // TODO: 集成 Nanobot 后恢复说话动画
  // const fullResponse = "";
  const isSpeaking = false;

  const idleVideoRef = useRef<HTMLVideoElement>(null);
  const sayingVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isSpeaking) {
      // 开始说话：播放 saying video
      sayingVideoRef.current?.play();
      idleVideoRef.current?.pause();
    } else {
      // 停止说话：恢复播放 idle video
      idleVideoRef.current?.play();
      sayingVideoRef.current?.pause();
      sayingVideoRef.current && (sayingVideoRef.current.currentTime = 0);
    }
  }, [isSpeaking]);

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden"
      style={{
        zIndex: 0,
        backgroundColor: '#1a1a1a',
      }}
    >
      {/* 待机视频层：循环播放 */}
      <video
        ref={idleVideoRef}
        src={IDLE_VIDEO}
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          display: 'block',
          opacity: isSpeaking ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out',
          zIndex: 1,
        }}
        onError={(e) => console.error("❌ 待机视频加载失败:", IDLE_VIDEO)}
      />

      {/* 说话视频层：机器人说话时播放 */}
      <video
        ref={sayingVideoRef}
        src={SAYING_VIDEO}
        muted
        playsInline
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          display: 'block',
          opacity: isSpeaking ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
          zIndex: 1,
        }}
        onError={(e) => console.error("❌ 说话视频加载失败:", SAYING_VIDEO)}
      />

      {/* 渐变遮罩 (美化) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), transparent, rgba(0,0,0,0.6))',
          zIndex: 2
        }}
      />
    </div>
  );
}
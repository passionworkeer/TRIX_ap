import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  color: string;
}

interface DynamicBackgroundProps {
  /** 背景类型 */
  type?: 'particles' | 'gradient' | 'both';
  /** 主题色（渐变用） */
  primaryColor?: string;
  /** 次要色（渐变用） */
  secondaryColor?: string;
  /** 粒子数量 */
  particleCount?: number;
}

/**
 * DynamicBackground - 动态背景组件
 *
 * 支持粒子漂浮、渐变呼吸效果
 */
export function DynamicBackground({
  type = 'both',
  primaryColor = 'rgba(139, 92, 246, 0.3)', // 紫色
  secondaryColor = 'rgba(236, 72, 153, 0.3)', // 粉色
  particleCount = 50
}: DynamicBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    if (type === 'gradient') return; // 只有渐变不需要 canvas

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置 canvas 尺寸
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 初始化粒子
    const initParticles = () => {
      particlesRef.current = [];
      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 3 + 1,
          speedX: (Math.random() - 0.5) * 0.5,
          speedY: (Math.random() - 0.5) * 0.5,
          opacity: Math.random() * 0.5 + 0.2,
          color: Math.random() > 0.5 ? primaryColor : secondaryColor
        });
      }
    };
    initParticles();

    // 动画循环
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 更新和绘制粒子
      particlesRef.current.forEach(particle => {
        // 更新位置
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        // 边界检测
        if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1;

        // 绘制粒子
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.opacity;
        ctx.fill();
        ctx.globalAlpha = 1;

        // 绘制光晕效果
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size * 3
        );
        gradient.addColorStop(0, particle.color);
        gradient.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = particle.opacity * 0.3;
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [type, particleCount, primaryColor, secondaryColor]);

  return (
    <>
      {/* 粒子 Canvas */}
      {(type === 'particles' || type === 'both') && (
        <canvas
          ref={canvasRef}
          className="fixed inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 1 }}
        />
      )}

      {/* 渐变呼吸背景 */}
      {(type === 'gradient' || type === 'both') && (
        <div
          className="fixed inset-0 w-full h-full pointer-events-none animate-gradient-breath"
          style={{
            zIndex: 0,
            background: `linear-gradient(45deg,
              ${primaryColor},
              ${secondaryColor},
              ${primaryColor}
            )`,
            backgroundSize: '400% 400%',
            animation: 'gradientBreath 15s ease infinite'
          }}
        />
      )}

      <style>{`
        @keyframes gradientBreath {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
      `}</style>
    </>
  );
}

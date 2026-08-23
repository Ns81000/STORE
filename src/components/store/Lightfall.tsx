import { useEffect, useRef } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";

export type LightfallProps = {
  className?: string;
  colors?: string[];
  backgroundColor?: string;
  speed?: number;
  streakCount?: number;
  streakWidth?: number;
  streakLength?: number;
  glow?: number;
  density?: number;
  twinkle?: number;
  zoom?: number;
  backgroundGlow?: number;
  opacity?: number;
  mouseStrength?: number;
  mouseRadius?: number;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 1, 1];
  return [
    parseInt(result[1]!, 16) / 255,
    parseInt(result[2]!, 16) / 255,
    parseInt(result[3]!, 16) / 255,
  ];
};

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uStreakCount;
uniform float uStreakWidth;
uniform float uStreakLength;
uniform float uGlow;
uniform float uDensity;
uniform float uTwinkle;
uniform float uZoom;
uniform float uBackgroundGlow;
uniform float uOpacity;
uniform vec2 uMouse;
uniform float uMouseStrength;
uniform float uMouseRadius;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uBgColor;
out vec4 fragColor;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
  uv *= uZoom;

  vec2 mouseNorm = (uMouse - 0.5) * (iResolution.xy / min(iResolution.x, iResolution.y)) * uZoom;
  float mouseDist = length(uv - mouseNorm);
  float mouseInfluence = smoothstep(uMouseRadius, 0.0, mouseDist) * uMouseStrength;
  uv += (mouseNorm - uv) * mouseInfluence * 0.35;

  float t = iTime * uSpeed;
  vec3 accumulatedColor = vec3(0.0);
  float accumulatedAlpha = 0.0;

  int streaks = int(clamp(uStreakCount, 1.0, 16.0));
  float countF = float(streaks);

  for (int i = 0; i < 16; i++) {
    if (i >= streaks) break;
    float fi = float(i);
    float seed = fi * 17.13 + 1.0;

    float angle = -0.32 + (hash11(seed) - 0.5) * 0.25;
    float cosA = cos(angle);
    float sinA = sin(angle);
    mat2 rot = mat2(cosA, -sinA, sinA, cosA);
    vec2 p = rot * uv;

    float spacing = 2.4 / max(countF * uDensity, 1.0);
    float xOffset = (hash11(seed * 2.3) - 0.5) * 4.0;
    float speedMod = 0.6 + hash11(seed * 3.7) * 0.8;

    float yPos = p.y + t * speedMod + hash11(seed * 4.1) * 10.0;
    float xPos = p.x - xOffset;

    float cellX = floor(xPos / spacing);
    float localX = xPos - (cellX + 0.5) * spacing;

    float cellY = floor(yPos / (uStreakLength * 3.0));
    float localY = mod(yPos, uStreakLength * 3.0) - uStreakLength * 1.5;

    float cellSeed = hash12(vec2(cellX, cellY + fi * 5.0));

    float twinkleFactor = 1.0;
    if (uTwinkle > 0.01) {
      twinkleFactor = 1.0 - uTwinkle * 0.5 * (sin(t * 3.0 + cellSeed * 6.28) * 0.5 + 0.5);
    }

    float dX = abs(localX) / (uStreakWidth * 0.08);
    float dY = abs(localY) / (uStreakLength * 1.0);

    float beam = exp(-dX * dX * 2.0) * smoothstep(1.0, 0.0, dY);
    float halo = exp(-dX * 0.8) * exp(-dY * 1.2) * uGlow * 0.6;
    float intensity = (beam + halo) * twinkleFactor * (0.6 + 0.4 * cellSeed);

    float colorT = fract(cellSeed + fi * 0.33 + p.y * 0.1);
    vec3 streakColor;
    if (colorT < 0.5) {
      streakColor = mix(uColor1, uColor2, colorT * 2.0);
    } else {
      streakColor = mix(uColor2, uColor3, (colorT - 0.5) * 2.0);
    }

    accumulatedColor += streakColor * intensity;
    accumulatedAlpha += intensity;
  }

  vec2 screenUV = gl_FragCoord.xy / iResolution.xy;
  float bgGlowVal = (1.0 - length(screenUV - vec2(0.5, 0.2))) * uBackgroundGlow;
  bgGlowVal = clamp(bgGlowVal, 0.0, 1.0);
  vec3 bgGlowColor = mix(uColor1, uColor2, screenUV.x) * bgGlowVal * 0.5;

  vec3 finalColor = uBgColor + accumulatedColor + bgGlowColor;
  float finalAlpha = clamp((accumulatedAlpha * 0.7 + bgGlowVal * 0.4), 0.0, 1.0) * uOpacity;

  fragColor = vec4(finalColor * finalAlpha, finalAlpha);
}
`;

export function Lightfall({
  colors = ["#ff6161", "#57c1ff", "#d78bff"],
  backgroundColor = "#07080a",
  speed = 0.38,
  streakCount = 4,
  streakWidth = 0.78,
  streakLength = 1.35,
  glow = 0.72,
  density = 0.52,
  twinkle = 0.68,
  zoom = 3.35,
  backgroundGlow = 0.28,
  opacity = 0.62,
  mouseStrength = 0.28,
  mouseRadius = 1,
  className = "",
}: LightfallProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({
    colors,
    backgroundColor,
    speed,
    streakCount,
    streakWidth,
    streakLength,
    glow,
    density,
    twinkle,
    zoom,
    backgroundGlow,
    opacity,
    mouseStrength,
    mouseRadius,
  });

  propsRef.current = {
    colors,
    backgroundColor,
    speed,
    streakCount,
    streakWidth,
    streakLength,
    glow,
    density,
    twinkle,
    zoom,
    backgroundGlow,
    opacity,
    mouseStrength,
    mouseRadius,
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const probe = document.createElement("canvas");
    if (!probe.getContext("webgl2")) return;

    const small = window.matchMedia("(max-width: 768px)").matches;
    const p = propsRef.current;

    const renderer = new Renderer({
      webgl: 2,
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.75),
    });

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    // SAFETY: ogl's gl.canvas is the underlying HTMLCanvasElement in DOM environments.
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const c1 = hexToRgb(p.colors[0] ?? "#ff6161");
    const c2 = hexToRgb(p.colors[1] ?? "#57c1ff");
    const c3 = hexToRgb(p.colors[2] ?? "#d78bff");
    const bg = hexToRgb(p.backgroundColor);

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uSpeed: { value: p.speed },
        uStreakCount: { value: p.streakCount },
        uStreakWidth: { value: p.streakWidth },
        uStreakLength: { value: p.streakLength },
        uGlow: { value: p.glow },
        uDensity: { value: p.density },
        uTwinkle: { value: p.twinkle },
        uZoom: { value: p.zoom },
        uBackgroundGlow: { value: p.backgroundGlow },
        uOpacity: { value: p.opacity },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uMouseStrength: { value: p.mouseStrength },
        uMouseRadius: { value: p.mouseRadius },
        uColor1: { value: new Float32Array(c1) },
        uColor2: { value: new Float32Array(c2) },
        uColor3: { value: new Float32Array(c3) },
        uBgColor: { value: new Float32Array(bg) },
      },
    });

    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const setSize = () => {
      const rect = container.getBoundingClientRect();
      renderer.setSize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
      // SAFETY: iResolution uniform is initialized above with Float32Array(2).
      const res = program.uniforms["iResolution"]!.value as Float32Array;
      res[0] = gl.drawingBufferWidth;
      res[1] = gl.drawingBufferHeight;
      renderer.render({ scene: mesh });
    };

    const ro = new ResizeObserver(setSize);
    ro.observe(container);
    setSize();

    const current: [number, number] = [0.5, 0.5];
    const target: [number, number] = [0.5, 0.5];
    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      target[0] = (event.clientX - rect.left) / rect.width;
      target[1] = 1 - (event.clientY - rect.top) / rect.height;
    };
    const onPointerLeave = () => {
      target[0] = 0.5;
      target[1] = 0.5;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerleave", onPointerLeave);

    let raf = 0;
    let visible = true;
    let pageVisible = !document.hidden;
    const t0 = performance.now();

    const loop = (t: number) => {
      program.uniforms["iTime"]!.value = (t - t0) * 0.001;
      current[0] += 0.05 * (target[0] - current[0]);
      current[1] += 0.05 * (target[1] - current[1]);
      // SAFETY: uMouse uniform is initialized above with Float32Array(2).
      const mouse = program.uniforms["uMouse"]!.value as Float32Array;
      mouse[0] = current[0];
      mouse[1] = current[1];
      renderer.render({ scene: mesh });
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (visible && pageVisible && raf === 0) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? false;
        if (visible) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(container);

    const onVisibility = () => {
      pageVisible = !document.hidden;
      if (pageVisible) start();
      else stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      try {
        container.removeChild(canvas);
      } catch {
        /* already detached */
      }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <div ref={containerRef} className={`lightfall-container ${className}`.trim()} />;
}

import { useEffect, useState } from 'react';
import {
  Sun, Cloud, CloudSun, CloudFog, CloudDrizzle, CloudRain,
  CloudSnow, CloudLightning, Wind, Droplets, MapPin, RefreshCw
} from 'lucide-react';

// Toạ độ trung tâm xã Trà Bồng (Trà Xuân cũ), Quảng Ngãi
const LAT = 15.2486;
const LON = 108.5127;
const WEATHER_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
  `&timezone=Asia%2FBangkok`;

// Ánh xạ mã thời tiết WMO -> nhãn tiếng Việt + icon + bảng màu điểm nhấn
// iconColor: màu icon | glow: màu quầng sáng phía sau | aura: gradient nền thẻ
function mapWeather(code) {
  if (code === 0)
    return { label: 'Trời quang', Icon: Sun, scene: 'sun', iconColor: 'text-amber-300', glow: 'bg-amber-400/60', aura: 'from-amber-400/30 via-orange-400/20 to-yellow-300/10' };
  if (code === 1 || code === 2)
    return { label: 'Ít mây', Icon: CloudSun, scene: 'partly', iconColor: 'text-yellow-200', glow: 'bg-yellow-300/50', aura: 'from-sky-400/25 via-amber-300/20 to-blue-400/10' };
  if (code === 3)
    return { label: 'Nhiều mây', Icon: Cloud, scene: 'cloud', iconColor: 'text-slate-100', glow: 'bg-sky-300/45', aura: 'from-slate-300/25 via-sky-400/20 to-blue-500/10' };
  if (code === 45 || code === 48)
    return { label: 'Sương mù', Icon: CloudFog, scene: 'fog', iconColor: 'text-slate-200', glow: 'bg-slate-300/40', aura: 'from-slate-400/25 via-slate-300/20 to-slate-500/10' };
  if (code >= 51 && code <= 57)
    return { label: 'Mưa phùn', Icon: CloudDrizzle, scene: 'rain', iconColor: 'text-cyan-200', glow: 'bg-cyan-300/50', aura: 'from-cyan-400/25 via-sky-400/20 to-blue-500/10' };
  if (code >= 61 && code <= 67)
    return { label: 'Có mưa', Icon: CloudRain, scene: 'rain', iconColor: 'text-cyan-200', glow: 'bg-cyan-400/50', aura: 'from-cyan-500/25 via-blue-500/20 to-indigo-500/10' };
  if (code >= 71 && code <= 77)
    return { label: 'Có tuyết', Icon: CloudSnow, scene: 'snow', iconColor: 'text-white', glow: 'bg-white/50', aura: 'from-white/25 via-sky-200/20 to-blue-300/10' };
  if (code >= 80 && code <= 82)
    return { label: 'Mưa rào', Icon: CloudRain, scene: 'rain', iconColor: 'text-cyan-200', glow: 'bg-cyan-400/55', aura: 'from-cyan-500/25 via-blue-500/20 to-indigo-500/10' };
  if (code >= 85 && code <= 86)
    return { label: 'Mưa tuyết', Icon: CloudSnow, scene: 'snow', iconColor: 'text-white', glow: 'bg-white/50', aura: 'from-white/25 via-sky-200/20 to-blue-300/10' };
  if (code >= 95)
    return { label: 'Dông sét', Icon: CloudLightning, scene: 'storm', iconColor: 'text-violet-200', glow: 'bg-violet-400/60', aura: 'from-violet-500/30 via-fuchsia-500/20 to-indigo-500/10' };
  return { label: 'Không rõ', Icon: Cloud, scene: 'cloud', iconColor: 'text-slate-100', glow: 'bg-sky-300/45', aura: 'from-slate-300/25 via-sky-400/20 to-blue-500/10' };
}

// Lớp hiệu ứng cảnh động phía sau nội dung (mưa, nắng, mây, tuyết, giông...)
function WeatherScene({ scene }) {
  if (scene === 'rain') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="wx-raindrop"
            style={{
              left: `${(i * 5.7 + 3) % 100}%`,
              animationDelay: `${(i % 9) * 0.09}s`,
              animationDuration: `${0.7 + (i % 4) * 0.12}s`,
              height: `${12 + (i % 3) * 4}px`,
            }}
          />
        ))}
      </div>
    );
  }

  if (scene === 'storm') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="wx-raindrop"
            style={{
              left: `${(i * 7.3 + 4) % 100}%`,
              animationDelay: `${(i % 7) * 0.08}s`,
              animationDuration: `${0.6 + (i % 3) * 0.1}s`,
            }}
          />
        ))}
        <div className="wx-lightning" />
        <svg className="wx-bolt absolute right-4 top-1 h-10 w-6" viewBox="0 0 24 40" fill="none">
          <path d="M13 0 L4 22 H11 L8 40 L21 14 H13 L18 0 Z"
            fill="rgba(253,224,71,0.95)"
            style={{ filter: 'drop-shadow(0 0 6px rgba(253,224,71,0.9))' }} />
        </svg>
      </div>
    );
  }

  if (scene === 'snow') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 16 }).map((_, i) => {
          const s = 3 + (i % 3) * 1.5;
          return (
            <span
              key={i}
              className="wx-snowflake"
              style={{
                left: `${(i * 6.3 + 2) % 100}%`,
                width: `${s}px`,
                height: `${s}px`,
                animationDelay: `${(i % 8) * 0.35}s`,
                animationDuration: `${2.6 + (i % 4) * 0.5}s`,
              }}
            />
          );
        })}
      </div>
    );
  }

  if (scene === 'sun' || scene === 'partly') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="wx-sunrays" style={{ top: '-46px', right: '-46px' }} />
        {scene === 'partly' && (
          <>
            <div className="wx-cloud" style={{ top: '18%', width: '70px', height: '20px', animationDuration: '16s' }} />
            <div className="wx-cloud" style={{ top: '55%', width: '48px', height: '14px', animationDuration: '22s', animationDelay: '4s' }} />
          </>
        )}
      </div>
    );
  }

  if (scene === 'cloud') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="wx-cloud" style={{ top: '14%', width: '90px', height: '24px', animationDuration: '18s' }} />
        <div className="wx-cloud" style={{ top: '46%', width: '64px', height: '18px', animationDuration: '26s', animationDelay: '3s' }} />
        <div className="wx-cloud" style={{ top: '72%', width: '76px', height: '20px', animationDuration: '21s', animationDelay: '8s' }} />
      </div>
    );
  }

  if (scene === 'fog') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="wx-fog" style={{ top: '25%', animationDuration: '9s' }} />
        <div className="wx-fog" style={{ top: '50%', animationDuration: '12s', animationDelay: '2s' }} />
        <div className="wx-fog" style={{ top: '75%', animationDuration: '10s', animationDelay: '4s' }} />
      </div>
    );
  }

  return null;
}

export default function WeatherWidget() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ok | error

  const fetchWeather = async () => {
    setStatus('loading');
    try {
      const res = await fetch(WEATHER_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      setData(json.current);
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    fetchWeather();
    // Tự cập nhật mỗi 30 phút
    const id = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const weather = data ? mapWeather(data.weather_code) : null;
  const Icon = weather?.Icon ?? Cloud;
  const aura = weather?.aura ?? 'from-sky-400/25 via-blue-500/20 to-indigo-500/10';
  const glow = weather?.glow ?? 'bg-sky-300/45';
  const iconColor = weather?.iconColor ?? 'text-yellow-300';
  const scene = weather?.scene ?? 'cloud';

  return (
    <div className="weather-3d relative z-10 shrink-0 w-full sm:w-auto animate-weather-float">
      {/* Quầng sáng lan toả phía sau tạo hiệu ứng nổi */}
      <div className={`pointer-events-none absolute -inset-3 rounded-[28px] blur-2xl ${glow} animate-weather-glow`} />

      <div className="weather-3d-card relative overflow-hidden rounded-[22px] p-[1.5px] bg-gradient-to-br from-white/60 via-white/20 to-white/5 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.55)]">
        {/* Nền kính mờ + gradient màu theo thời tiết */}
        <div className="relative rounded-[21px] bg-white/10 backdrop-blur-xl px-4 py-3 min-w-[200px] overflow-hidden">
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${aura}`} />
          {/* Cảnh thời tiết động: mưa / nắng / mây / tuyết / giông */}
          {data && <WeatherScene scene={scene} />}
          {/* Vệt sáng quét ngang */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-0 -left-1/3 h-full w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-weather-sheen" />
          </div>

          <div className="relative">
            <div className="flex items-center gap-1 text-white/90 text-[10px] font-bold uppercase tracking-wider mb-1.5 drop-shadow">
              <MapPin size={11} strokeWidth={2.5} className="text-amber-200" />
              <span>Xã Trà Bồng</span>
              <button
                onClick={fetchWeather}
                className="ml-auto text-white/70 hover:text-white hover:scale-110 active:scale-95 transition-all"
                title="Cập nhật thời tiết"
              >
                <RefreshCw size={12} strokeWidth={2.5} className={status === 'loading' ? 'animate-spin' : ''} />
              </button>
            </div>

            {status === 'error' && (
              <p className="text-white/80 text-[12px] font-medium py-1">Không tải được thời tiết</p>
            )}

            {status === 'loading' && !data && (
              <p className="text-white/80 text-[12px] font-medium py-1">Đang tải…</p>
            )}

            {data && (
              <>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`absolute inset-0 blur-lg ${glow} rounded-full animate-weather-glow`} />
                    <Icon
                      size={40}
                      strokeWidth={1.8}
                      className={`relative ${iconColor} drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] animate-weather-icon-sway`}
                    />
                  </div>
                  <div className="leading-none">
                    <div className="text-3xl md:text-4xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] tabular-nums">
                      {Math.round(data.temperature_2m)}°C
                    </div>
                    <div className="text-white/90 text-[11px] font-semibold mt-1 drop-shadow">
                      {weather.label}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2.5 text-white/90 text-[10px] font-semibold">
                  <span className="flex items-center gap-1">
                    <Droplets size={11} strokeWidth={2.5} className="text-cyan-200" /> {data.relative_humidity_2m}%
                  </span>
                  <span className="flex items-center gap-1">
                    <Wind size={11} strokeWidth={2.5} className="text-sky-200" /> {Math.round(data.wind_speed_10m)} km/h
                  </span>
                  <span className="opacity-80">Cảm giác {Math.round(data.apparent_temperature)}°</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

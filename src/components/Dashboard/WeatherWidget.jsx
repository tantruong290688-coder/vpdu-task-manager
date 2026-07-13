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

// Ánh xạ mã thời tiết WMO -> nhãn tiếng Việt + icon
function mapWeather(code) {
  if (code === 0) return { label: 'Trời quang', Icon: Sun };
  if (code === 1 || code === 2) return { label: 'Ít mây', Icon: CloudSun };
  if (code === 3) return { label: 'Nhiều mây', Icon: Cloud };
  if (code === 45 || code === 48) return { label: 'Sương mù', Icon: CloudFog };
  if (code >= 51 && code <= 57) return { label: 'Mưa phùn', Icon: CloudDrizzle };
  if (code >= 61 && code <= 67) return { label: 'Có mưa', Icon: CloudRain };
  if (code >= 71 && code <= 77) return { label: 'Có tuyết', Icon: CloudSnow };
  if (code >= 80 && code <= 82) return { label: 'Mưa rào', Icon: CloudRain };
  if (code >= 85 && code <= 86) return { label: 'Mưa tuyết', Icon: CloudSnow };
  if (code >= 95) return { label: 'Dông sét', Icon: CloudLightning };
  return { label: 'Không rõ', Icon: Cloud };
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

  return (
    <div className="relative z-10 shrink-0 w-full md:w-auto">
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 shadow-lg min-w-[190px]">
        <div className="flex items-center gap-1 text-blue-100 text-[10px] font-bold uppercase tracking-wide mb-1">
          <MapPin size={11} strokeWidth={2.5} />
          <span>Xã Trà Bồng</span>
          <button
            onClick={fetchWeather}
            className="ml-auto text-blue-100/70 hover:text-white transition-colors"
            title="Cập nhật thời tiết"
          >
            <RefreshCw size={11} strokeWidth={2.5} className={status === 'loading' ? 'animate-spin' : ''} />
          </button>
        </div>

        {status === 'error' && (
          <p className="text-blue-100/80 text-[12px] font-medium py-1">Không tải được thời tiết</p>
        )}

        {status === 'loading' && !data && (
          <p className="text-blue-100/80 text-[12px] font-medium py-1">Đang tải…</p>
        )}

        {data && (
          <>
            <div className="flex items-center gap-3">
              <Icon size={34} strokeWidth={1.8} className="text-yellow-300 drop-shadow" />
              <div className="leading-none">
                <div className="text-2xl md:text-3xl font-black text-white">
                  {Math.round(data.temperature_2m)}°C
                </div>
                <div className="text-blue-100 text-[11px] font-semibold mt-0.5">
                  {weather.label}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 text-blue-100/90 text-[10px] font-medium">
              <span className="flex items-center gap-1">
                <Droplets size={11} strokeWidth={2.5} /> {data.relative_humidity_2m}%
              </span>
              <span className="flex items-center gap-1">
                <Wind size={11} strokeWidth={2.5} /> {Math.round(data.wind_speed_10m)} km/h
              </span>
              <span className="opacity-80">Cảm giác {Math.round(data.apparent_temperature)}°</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

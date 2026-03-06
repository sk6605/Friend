/**
 * Weather utility — detects weather-related queries and fetches real-time data
 * from OpenWeatherMap API.
 */

const WEATHER_KEYWORDS = [
  // English
  'weather', 'temperature', 'forecast', 'rain', 'sunny', 'cloudy', 'snow',
  'humidity', 'wind', 'storm', 'hot today', 'cold today', 'umbrella',
  // Chinese
  '天气', '气温', '温度', '下雨', '晴天', '多云', '下雪', '湿度', '风',
  '暴风', '预报', '热不热', '冷不冷', '带伞',
  // Spanish
  'clima', 'temperatura', 'lluvia', 'soleado', 'nublado', 'nieve', 'tormenta',
  // Japanese
  '天気', '気温', '雨', '晴れ', '曇り', '雪', '風', '嵐', '予報',
  // Korean
  '날씨', '기온', '비', '맑음', '흐림', '눈', '바람',
  // Malay
  'cuaca', 'suhu', 'hujan', 'cerah', 'mendung', 'ribut',
];

export function isWeatherQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return WEATHER_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Try to extract a city name from the user's message.
 * Falls back to null if no city is found.
 */
export function extractCity(text: string): string | null {
  // Common patterns: "weather in Tokyo", "天气 北京", "clima en Madrid"
  const patterns = [
    /weather\s+(?:in|at|for|of)\s+([a-zA-Z\s]+)/i,
    /forecast\s+(?:in|at|for|of)\s+([a-zA-Z\s]+)/i,
    /temperature\s+(?:in|at|for|of)\s+([a-zA-Z\s]+)/i,
    /clima\s+(?:en|de)\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ\s]+)/i,
    /天气.{0,2}([\u4e00-\u9fff]{2,})/,
    /気温.{0,2}([\u4e00-\u9fff]{2,})/,
    /天気.{0,2}([\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]{2,})/,
    /날씨.{0,2}([\uac00-\ud7af]{2,})/,
    /cuaca\s+(?:di|untuk)\s+([a-zA-Z\s]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

interface WeatherData {
  city: string;
  country: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  description: string;
  windSpeed: number;
  icon: string;
}

export async function fetchWeather(city: string): Promise<WeatherData | null> {
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    console.warn('WEATHER_API_KEY not set — weather feature disabled');
    return null;
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    const res = await fetch(url, { next: { revalidate: 600 } }); // cache 10 min

    if (!res.ok) return null;

    const data = await res.json();

    return {
      city: data.name,
      country: data.sys?.country || '',
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      description: data.weather?.[0]?.description || '',
      windSpeed: data.wind?.speed || 0,
      icon: data.weather?.[0]?.icon || '',
    };
  } catch (err) {
    console.error('Weather fetch failed:', err);
    return null;
  }
}

export function formatWeatherForPrompt(weather: WeatherData): string {
  return `
[Real-time weather data — use this to answer the user's weather question naturally]
City: ${weather.city}, ${weather.country}
Temperature: ${weather.temp}°C (feels like ${weather.feelsLike}°C)
Condition: ${weather.description}
Humidity: ${weather.humidity}%
Wind: ${weather.windSpeed} m/s
`;
}

// ─── Forecast API (5-day / 3-hour) ─────────────────────────────

interface ForecastEntry {
  dt: number;
  dt_txt: string;
  main: { temp: number; feels_like: number; humidity: number };
  weather: { id: number; main: string; description: string; icon: string }[];
  wind: { speed: number };
  pop: number; // probability of precipitation (0–1)
}

export interface RainForecast {
  willRain: boolean;
  rainPeriods: { time: string; description: string; probability: number }[];
  city: string;
}

export async function fetchForecast(city: string): Promise<ForecastEntry[] | null> {
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    const res = await fetch(url, { next: { revalidate: 1800 } }); // cache 30 min
    if (!res.ok) return null;
    const data = await res.json();
    return data.list || null;
  } catch (err) {
    console.error('Forecast fetch failed:', err);
    return null;
  }
}

export function detectRainToday(forecast: ForecastEntry[]): RainForecast {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10); // "YYYY-MM-DD"

  const todayEntries = forecast.filter(entry => entry.dt_txt.startsWith(todayStr));

  const rainPeriods = todayEntries
    .filter(entry => {
      const weatherMain = entry.weather[0]?.main?.toLowerCase() || '';
      return (
        weatherMain === 'rain' ||
        weatherMain === 'drizzle' ||
        weatherMain === 'thunderstorm' ||
        entry.pop > 0.5
      );
    })
    .map(entry => ({
      time: entry.dt_txt.slice(11, 16), // "HH:MM"
      description: entry.weather[0]?.description || 'rain',
      probability: Math.round(entry.pop * 100),
    }));

  return {
    willRain: rainPeriods.length > 0,
    rainPeriods,
    city: '',
  };
}

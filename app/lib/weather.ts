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
 * 
 * IMPORTANT: Only extracts when users explicitly mention a location.
 * Does NOT try to parse generic weather questions like "今天天气怎么样"
 * because those should fall back to the user's saved city.
 */
export function extractCity(text: string): string | null {
  // ─── Known city names (direct match) ───
  const KNOWN_CITIES_CN: Record<string, string> = {
    '北京': 'Beijing', '上海': 'Shanghai', '广州': 'Guangzhou', '深圳': 'Shenzhen',
    '成都': 'Chengdu', '杭州': 'Hangzhou', '武汉': 'Wuhan', '西安': "Xi'an",
    '南京': 'Nanjing', '重庆': 'Chongqing', '天津': 'Tianjin', '苏州': 'Suzhou',
    '长沙': 'Changsha', '厦门': 'Xiamen', '青岛': 'Qingdao', '大连': 'Dalian',
    '昆明': 'Kunming', '福州': 'Fuzhou', '郑州': 'Zhengzhou', '济南': 'Jinan',
    '沈阳': 'Shenyang', '哈尔滨': 'Harbin', '长春': 'Changchun', '合肥': 'Hefei',
    '东京': 'Tokyo', '大阪': 'Osaka', '首尔': 'Seoul', '台北': 'Taipei',
    '香港': 'Hong Kong', '澳门': 'Macau', '新加坡': 'Singapore',
    '吉隆坡': 'Kuala Lumpur', '曼谷': 'Bangkok', '雅加达': 'Jakarta',
    '纽约': 'New York', '伦敦': 'London', '巴黎': 'Paris', '东莞': 'Dongguan',
    '佛山': 'Foshan', '珠海': 'Zhuhai', '中山': 'Zhongshan', '惠州': 'Huizhou',
    '无锡': 'Wuxi', '宁波': 'Ningbo', '温州': 'Wenzhou',
  };

  // Check if any known Chinese city name appears in the text
  for (const [cn, en] of Object.entries(KNOWN_CITIES_CN)) {
    if (text.includes(cn)) {
      return en;
    }
  }

  // ─── English patterns: "weather in Tokyo", "forecast for London" ───
  const enPatterns = [
    /weather\s+(?:in|at|for|of)\s+([a-zA-Z][a-zA-Z\s]{1,30})/i,
    /forecast\s+(?:in|at|for|of)\s+([a-zA-Z][a-zA-Z\s]{1,30})/i,
    /temperature\s+(?:in|at|for|of)\s+([a-zA-Z][a-zA-Z\s]{1,30})/i,
    /(?:how(?:'s| is) the weather in|what(?:'s| is) the weather (?:like )?in)\s+([a-zA-Z][a-zA-Z\s]{1,30})/i,
  ];

  // Words that should NOT be treated as cities
  const notCities = new Set([
    'today', 'tomorrow', 'now', 'tonight', 'this', 'the', 'my', 'our', 'your',
    'here', 'there', 'outside', 'morning', 'afternoon', 'evening', 'week',
  ]);

  for (const pattern of enPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const candidate = match[1].trim().replace(/[?.!,]+$/, '').trim();
      const firstWord = candidate.split(/\s+/)[0].toLowerCase();
      if (!notCities.has(firstWord) && candidate.length >= 2) {
        return candidate;
      }
    }
  }

  // ─── Spanish: "clima en Madrid" ───
  const esMatch = text.match(/clima\s+(?:en|de)\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{2,25})/i);
  if (esMatch?.[1]) return esMatch[1].trim();

  // ─── Malay: "cuaca di Kuala Lumpur" ───
  const msMatch = text.match(/cuaca\s+(?:di|untuk)\s+([a-zA-Z\s]{2,25})/i);
  if (msMatch?.[1]) return msMatch[1].trim();

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

export interface ForecastEntry {
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

export async function fetchForecast(city: string): Promise<{ list: ForecastEntry[], timezone: number } | null> {
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    const res = await fetch(url, { next: { revalidate: 1800 } }); // cache 30 min
    if (!res.ok) return null;
    const data = await res.json();
    return {
      list: data.list || [],
      timezone: data.city?.timezone || 0
    };
  } catch (err) {
    console.error('Forecast fetch failed:', err);
    return null;
  }
}

export function detectRainToday(forecast: ForecastEntry[], timezoneOffset = 0): RainForecast {
  // Calculate user's local "today" using timezone offset (seconds from UTC)
  const nowMs = Date.now() + timezoneOffset * 1000;
  const localDate = new Date(nowMs);
  const todayStr = localDate.toISOString().slice(0, 10); // "YYYY-MM-DD" in user's local time

  // Filter forecast entries: convert each entry's UTC time to local time and check if it's "today"
  const todayEntries = forecast.filter(entry => {
    const entryLocalMs = entry.dt * 1000 + timezoneOffset * 1000;
    const entryLocalDate = new Date(entryLocalMs);
    return entryLocalDate.toISOString().slice(0, 10) === todayStr;
  });

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
    .map(entry => {
      // Convert to user's local time for display
      const entryLocalMs = entry.dt * 1000 + timezoneOffset * 1000;
      const entryLocalDate = new Date(entryLocalMs);
      const hours = entryLocalDate.getUTCHours().toString().padStart(2, '0');
      const minutes = entryLocalDate.getUTCMinutes().toString().padStart(2, '0');
      return {
        time: `${hours}:${minutes}`,
        description: entry.weather[0]?.description || 'rain',
        probability: Math.round(entry.pop * 100),
      };
    });

  return {
    willRain: rainPeriods.length > 0,
    rainPeriods,
    city: '',
  };
}

// ─── Tomorrow's Forecast ─────────────────────────────────────

export interface TomorrowForecast {
  willRain: boolean;
  rainPeriods: { time: string; description: string; probability: number }[];
  tempMin: number;
  tempMax: number;
  humidity: number;
  summary: string;
}

export function detectRainTomorrow(forecast: ForecastEntry[], timezoneOffset = 0): TomorrowForecast {
  const nowMs = Date.now() + timezoneOffset * 1000;
  const localDate = new Date(nowMs);
  // Get tomorrow's date string
  localDate.setUTCDate(localDate.getUTCDate() + 1);
  const tomorrowStr = localDate.toISOString().slice(0, 10);

  const tomorrowEntries = forecast.filter(entry => {
    const entryLocalMs = entry.dt * 1000 + timezoneOffset * 1000;
    const entryLocalDate = new Date(entryLocalMs);
    return entryLocalDate.toISOString().slice(0, 10) === tomorrowStr;
  });

  if (tomorrowEntries.length === 0) {
    return { willRain: false, rainPeriods: [], tempMin: 0, tempMax: 0, humidity: 0, summary: 'No forecast data available' };
  }

  const temps = tomorrowEntries.map(e => e.main.temp);
  const humidities = tomorrowEntries.map(e => e.main.humidity);
  const tempMin = Math.round(Math.min(...temps));
  const tempMax = Math.round(Math.max(...temps));
  const avgHumidity = Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length);

  const rainPeriods = tomorrowEntries
    .filter(entry => {
      const weatherMain = entry.weather[0]?.main?.toLowerCase() || '';
      return (
        weatherMain === 'rain' ||
        weatherMain === 'drizzle' ||
        weatherMain === 'thunderstorm' ||
        entry.pop > 0.5
      );
    })
    .map(entry => {
      const entryLocalMs = entry.dt * 1000 + timezoneOffset * 1000;
      const entryLocalDate = new Date(entryLocalMs);
      const hours = entryLocalDate.getUTCHours().toString().padStart(2, '0');
      const minutes = entryLocalDate.getUTCMinutes().toString().padStart(2, '0');
      return {
        time: `${hours}:${minutes}`,
        description: entry.weather[0]?.description || 'rain',
        probability: Math.round(entry.pop * 100),
      };
    });

  // Build summary
  const mainConditions = tomorrowEntries.map(e => e.weather[0]?.main || '').filter(Boolean);
  const conditionCounts: Record<string, number> = {};
  mainConditions.forEach(c => { conditionCounts[c] = (conditionCounts[c] || 0) + 1; });
  const dominantCondition = Object.entries(conditionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Clear';

  const summary = `${dominantCondition}, ${tempMin}-${tempMax}°C, humidity ${avgHumidity}%${rainPeriods.length > 0 ? `, rain at ${rainPeriods.map(r => r.time).join(', ')}` : ''}`;

  return {
    willRain: rainPeriods.length > 0,
    rainPeriods,
    tempMin,
    tempMax,
    humidity: avgHumidity,
    summary,
  };
}

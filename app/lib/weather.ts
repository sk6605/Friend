/**
 * 天气工具库核心枢纽 (Weather Utility)
 * 作用：嗅探判定用户的语句中是否含有查天气的意图，并且承接 OpenWeatherMap API 的实时拉取与预报解析业务。
 */

// 预构筑的天气触发池（多国语言覆盖：英、中、西、日、韩、马），命中任何一个词将强行切断普通闲聊通道转交给天气组件
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

/**
 * 判断辅助函数：语句级意图检测
 * @param {string} text 用户输入的原始消息片段
 * @returns {boolean} 是否含有强天气查询意图
 */
export function isWeatherQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return WEATHER_KEYWORDS.some(kw => lower.includes(kw)); // 使用原生数组探测只要命中一项即返回 True
}

/**
 * 提取辅助函数：城市名正则截取槽
 * 作用：如果在聊天中明确附带了城市实体名（如：东京的天气怎么样），则必须强行抽出“东京”而不是沿用自己注册账号填的家。
 * 
 * 重要点：只在明确提供地址时生效挂载，对于类似于“今天天气怎么样”的无修饰询问安全回撤，使用 user.city 主键查阅。
 */
export function extractCity(text: string): string | null {
  // ─── 已知直接命中列表（用作中文高频词直译规避 OpenAI 二次转化带来的延迟与费用） ───
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

  // 优先级极高：遍历匹配强中文字典
  for (const [cn, en] of Object.entries(KNOWN_CITIES_CN)) {
    if (text.includes(cn)) {
      return en;
    }
  }

  // ─── 英语口癖匹配抓取器（用正则捕获在 weather in 后面的地名） ───
  const enPatterns = [
    /weather\s+(?:in|at|for|of)\s+([a-zA-Z][a-zA-Z\s]{1,30})/i,
    /forecast\s+(?:in|at|for|of)\s+([a-zA-Z][a-zA-Z\s]{1,30})/i,
    /temperature\s+(?:in|at|for|of)\s+([a-zA-Z][a-zA-Z\s]{1,30})/i,
    /(?:how(?:'s| is) the weather in|what(?:'s| is) the weather (?:like )?in)\s+([a-zA-Z][a-zA-Z\s]{1,30})/i,
  ];

  // 排除误伤集：不要把口语连带里的副词、时间代词误以为是城市名截下来去请求报错
  const notCities = new Set([
    'today', 'tomorrow', 'now', 'tonight', 'this', 'the', 'my', 'our', 'your',
    'here', 'there', 'outside', 'morning', 'afternoon', 'evening', 'week',
  ]);

  for (const pattern of enPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const candidate = match[1].trim().replace(/[?.!,]+$/, '').trim(); // 拿走尾巴上的标点符号
      const firstWord = candidate.split(/\s+/)[0].toLowerCase();
      // 如果切割出的首词不是口癖集里的黑名单，则当做城市名返回
      if (!notCities.has(firstWord) && candidate.length >= 2) {
        return candidate;
      }
    }
  }

  // ─── 西班牙语匹配逻辑: "clima en Madrid" ───
  const esMatch = text.match(/clima\s+(?:en|de)\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{2,25})/i);
  if (esMatch?.[1]) return esMatch[1].trim();

  // ─── 马来语匹配逻辑: "cuaca di Kuala Lumpur" ───
  const msMatch = text.match(/cuaca\s+(?:di|untuk)\s+([a-zA-Z\s]{2,25})/i);
  if (msMatch?.[1]) return msMatch[1].trim();

  // 如果上面都不中，说明要么没有主动写城市，要么匹配不到外星语，返回空指针交给下一步。
  return null;
}

// 契约格式定义：结构化拉取完实时的天气响应
interface WeatherData {
  city: string; // 城市本地名
  country: string; // 国标段（简码）
  temp: number; // 当下单指的公制单位温度
  feelsLike: number; // 叠加了湿度风速后的感知体感温度（更利于决定穿衣）
  humidity: number; // 绝对湿度比例
  description: string; // 全局英文短文本天气简报 (如：broken clouds)
  windSpeed: number; // 绝对风速 m/s
  icon: string; // openWeather 专用图表挂载键池代称
}

/**
 * 中心调用：获取特定城市的当场实时天气
 * @param {string} city 城市英文或系统代号指认
 */
export async function fetchWeather(city: string): Promise<WeatherData | null> {
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    console.warn('WEATHER_API_KEY not set — weather feature disabled');
    return null; // 配置遗失保底退回，保证主业务逻辑不断流
  }

  try {
    // 构建 GET 请求路径。&units=metric 规范其为摄氏度而不是令人费解的华氏度。
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    // 使用 Next JS 原生扩展的 fetch 附带服务端 10分钟短缓存功能规避接口狂刷超额度扣费
    const res = await fetch(url, { next: { revalidate: 600 } });

    if (!res.ok) return null;

    const data = await res.json();

    // 将不规整的长篇大论提纯出需要投喂的 8 项数据返回
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

/**
 * 附带工具：将拉取的天气格式化拼成一段 Markdown/英文长句。
 * 用途：隐形插在用户与 AI 聊天的 System Prompt 环境文里，“强迫” 大模型看见以对答如流。
 */
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

// ─── Forecast API (5天 / 每3小时一段的预报抽样抽取) ─────────────────────────────

export interface ForecastEntry {
  dt: number;
  dt_txt: string;
  main: { temp: number; feels_like: number; humidity: number };
  weather: { id: number; main: string; description: string; icon: string }[];
  wind: { speed: number };
  pop: number; // 降水几率分布概率（probability of precipitation (0–1)）
}

// 定制返回：为当天是否下雨和具体时间段打造
export interface RainForecast {
  willRain: boolean;
  rainPeriods: { time: string; description: string; probability: number }[];
  city: string;
}

/**
 * 并发预报调用主入口：针对接下来几十个小时做数据统筹
 * 后挂：{ revalidate: 1800 } (设定在半个小时内所有同城请求走缓存，节约远端限额)
 */
export async function fetchForecast(city: string): Promise<{ list: ForecastEntry[], timezone: number } | null> {
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    const res = await fetch(url, { next: { revalidate: 1800 } }); 
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

/**
 * 数据研判算法：今天会下雨吗？
 * 特殊性：由于数据自带的数据全是 UTC，因此务必要用时区差（timezoneOffset）手动调回到请求城市的相对本地时间再运算
 */
export function detectRainToday(forecast: ForecastEntry[], timezoneOffset = 0): RainForecast {
  // 通过把服务器格林威治时间戳加上时差秒数，推衍模拟目标城市的真正今天时间戳以锁定切割
  const nowMs = Date.now() + timezoneOffset * 1000;
  const localDate = new Date(nowMs);
  const todayStr = localDate.toISOString().slice(0, 10); // "YYYY-MM-DD" in user's local time

  // 将列表数组高阶操作清洗一次，剔除除了 “今天” 之外所有的预报切片
  const todayEntries = forecast.filter(entry => {
    const entryLocalMs = entry.dt * 1000 + timezoneOffset * 1000;
    const entryLocalDate = new Date(entryLocalMs);
    return entryLocalDate.toISOString().slice(0, 10) === todayStr;
  });

  // 映射提取落雨时间区间
  const rainPeriods = todayEntries
    .filter(entry => {
      const weatherMain = entry.weather[0]?.main?.toLowerCase() || '';
      return (
        weatherMain === 'rain' ||
        weatherMain === 'drizzle' ||
        weatherMain === 'thunderstorm' ||
        entry.pop > 0.5 // 或者它的落雨几率被判定在百分之 50 % 以上也算数
      );
    })
    .map(entry => {
      // 在格式化阶段把 UTC 时间变成漂亮的目标城市小时间（如 13:00）送给前端或是 AI 朗读
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
    willRain: rainPeriods.length > 0, // 利用数组长度判真假最方便快捷
    rainPeriods,
    city: '',
  };
}

// ─── Tomorrow's Forecast (次日预报处理管道) ─────────────────────────────────────

export interface TomorrowForecast {
  willRain: boolean;
  rainPeriods: { time: string; description: string; probability: number }[];
  tempMin: number;
  tempMax: number;
  humidity: number;
  summary: string;
}

/**
 * 同样是算下雨，不过是将探针拨动至未来的 24 小时后（明天）的早八晚八去预测，
 * 作用是配合用户的“晚安报告邮件/推送”功能提醒。
 */
export function detectRainTomorrow(forecast: ForecastEntry[], timezoneOffset = 0): TomorrowForecast {
  const nowMs = Date.now() + timezoneOffset * 1000;
  const localDate = new Date(nowMs);
  // 获取明天的目标时间串字符基底
  localDate.setUTCDate(localDate.getUTCDate() + 1);
  const tomorrowStr = localDate.toISOString().slice(0, 10);

  // 截留提取出所有贴合明天的段落对象切片
  const tomorrowEntries = forecast.filter(entry => {
    const entryLocalMs = entry.dt * 1000 + timezoneOffset * 1000;
    const entryLocalDate = new Date(entryLocalMs);
    return entryLocalDate.toISOString().slice(0, 10) === tomorrowStr;
  });

  if (tomorrowEntries.length === 0) {
    // 无数据时的静态防御填充值
    return { willRain: false, rainPeriods: [], tempMin: 0, tempMax: 0, humidity: 0, summary: 'No forecast data available' };
  }

  // 极值寻找算法：利用三点点延展（Spread）与内置的数学对比函数快速把最高的和最低的数字拿出来
  const temps = tomorrowEntries.map(e => e.main.temp);
  const humidities = tomorrowEntries.map(e => e.main.humidity);
  const tempMin = Math.round(Math.min(...temps));
  const tempMax = Math.round(Math.max(...temps));
  const avgHumidity = Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length);

  // 落雨条件判断
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

  // 拼接合成一句话：如 "明朗, 18-24°C, 湿度 60%, 在 13:00 左右下点雨"
  // 这里加入了最高频条件统计，寻找出所有 3小时里出现最多次的标签 (Main Conditions Counting Mode)
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

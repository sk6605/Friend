/** 
 * 静态数据字典：国家 → 城市/行政区 映射表 
 * 作用：用作前端或后端的下拉选项、天气数据抓取的城市预挂载。减少外部 API 请求寻找城市级联关系的消耗。
 */

// 类型定义：明确一个国家包含自己的国标大写缩写、国名实称、Emoji 国旗和几个重点被包含的城市列表
export interface Country {
  code: string;
  name: string;
  flag: string;
  cities: string[];
}

// 核心字典库：包含全球主要重点国家，数组内容写死为了零延迟提取
export const COUNTRIES: Country[] = [
  {
    code: 'MY',
    name: 'Malaysia', // 第一主要服务目标国家（大马）
    flag: '🇲🇾',
    cities: ['Kuala Lumpur', 'Penang', 'Johor Bahru', 'Ipoh', 'Kota Kinabalu', 'Kuching', 'Malacca', 'Shah Alam', 'Petaling Jaya', 'Seremban'],
  },
  {
    code: 'CN',
    name: 'China', // 中国境内数据，方便本地化及拼音匹配
    flag: '🇨🇳',
    cities: ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Hangzhou', 'Wuhan', 'Nanjing', 'Chongqing', 'Tianjin', 'Xiamen', 'Suzhou'],
  },
  {
    code: 'JP',
    name: 'Japan',
    flag: '🇯🇵',
    cities: ['Tokyo', 'Osaka', 'Kyoto', 'Yokohama', 'Nagoya', 'Sapporo', 'Fukuoka', 'Kobe', 'Hiroshima', 'Sendai'],
  },
  {
    code: 'KR',
    name: 'South Korea',
    flag: '🇰🇷',
    cities: ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju', 'Suwon', 'Jeju'],
  },
  {
    code: 'SG',
    name: 'Singapore', // 城邦制国家直写名字本身
    flag: '🇸🇬',
    cities: ['Singapore'],
  },
  {
    code: 'TH',
    name: 'Thailand',
    flag: '🇹🇭',
    cities: ['Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya', 'Hat Yai', 'Nakhon Ratchasima'],
  },
  {
    code: 'ID',
    name: 'Indonesia',
    flag: '🇮🇩',
    cities: ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Bali', 'Yogyakarta', 'Makassar'],
  },
  {
    code: 'PH',
    name: 'Philippines',
    flag: '🇵🇭',
    cities: ['Manila', 'Cebu', 'Davao', 'Quezon City', 'Makati'],
  },
  {
    code: 'VN',
    name: 'Vietnam',
    flag: '🇻🇳',
    cities: ['Ho Chi Minh City', 'Hanoi', 'Da Nang', 'Hue', 'Nha Trang'],
  },
  {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
    cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur'],
  },
  {
    code: 'TW',
    name: 'Taiwan',
    flag: '🇹🇼',
    cities: ['Taipei', 'Kaohsiung', 'Taichung', 'Tainan', 'Hsinchu'],
  },
  {
    code: 'HK',
    name: 'Hong Kong',
    flag: '🇭🇰',
    cities: ['Hong Kong'],
  },
  {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'San Francisco', 'Seattle', 'Miami', 'Boston', 'Denver', 'Austin'],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    cities: ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow', 'Liverpool', 'Bristol', 'Leeds'],
  },
  {
    code: 'AU',
    name: 'Australia',
    flag: '🇦🇺',
    cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra', 'Gold Coast'],
  },
  {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    cities: ['Toronto', 'Vancouver', 'Montreal', 'Ottawa', 'Calgary', 'Edmonton'],
  },
  {
    code: 'DE',
    name: 'Germany',
    flag: '🇩🇪',
    cities: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart'],
  },
  {
    code: 'FR',
    name: 'France',
    flag: '🇫🇷',
    cities: ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Bordeaux'],
  },
  {
    code: 'ES',
    name: 'Spain',
    flag: '🇪🇸',
    cities: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Malaga', 'Bilbao'],
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    flag: '🇦🇪', // 增加阿联酋以覆盖中东服务集
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah'],
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    flag: '🇳🇿',
    cities: ['Auckland', 'Wellington', 'Christchurch', 'Queenstown'],
  },
  {
    code: 'BR',
    name: 'Brazil',
    flag: '🇧🇷',
    cities: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Curitiba'],
  },
];

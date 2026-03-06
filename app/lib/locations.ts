/** Country → city/region mapping for location settings */

export interface Country {
  code: string;
  name: string;
  flag: string;
  cities: string[];
}

export const COUNTRIES: Country[] = [
  {
    code: 'MY',
    name: 'Malaysia',
    flag: '🇲🇾',
    cities: ['Kuala Lumpur', 'Penang', 'Johor Bahru', 'Ipoh', 'Kota Kinabalu', 'Kuching', 'Malacca', 'Shah Alam', 'Petaling Jaya', 'Seremban'],
  },
  {
    code: 'CN',
    name: 'China',
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
    name: 'Singapore',
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
    flag: '🇦🇪',
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

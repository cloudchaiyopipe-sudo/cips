# โคกหนองนา (Khok Nong Na) Components

ระบบวางระบบน้ำสำหรับโคกหนองนา ตามแนวคิดเศรษฐกิจพอเพียง

## Components

### KhokNongNaMap
แผนที่ Google Maps สำหรับเลือกตำแหน่งและวิเคราะห์พื้นที่

**Features:**
- Google Maps integration
- Location selection by clicking
- Custom map styling for agricultural areas
- Marker placement and management

**Props:**
- `onLocationSelect?: (location: google.maps.LatLng) => void` - Callback when location is selected
- `initialCenter?: google.maps.LatLngLiteral` - Initial map center (default: Bangkok)
- `initialZoom?: number` - Initial zoom level (default: 10)
- `height?: string` - Map height (default: '400px')

### KhokNongNaSearch
ระบบค้นหาตำแหน่งด้วย Google Places API

**Features:**
- Google Places Autocomplete
- Thailand location restriction
- Real-time search results
- Click outside to close

**Props:**
- `onLocationSelect: (location: google.maps.LatLng, address: string) => void` - Callback when location is selected
- `placeholder?: string` - Search input placeholder

## Usage

```tsx
import { KhokNongNaMap, KhokNongNaSearch } from './components/KhokNongNaModel';

// In your component
const handleLocationSelect = (location: google.maps.LatLng, address: string) => {
  console.log('Selected location:', location.lat(), location.lng());
  console.log('Address:', address);
};

<KhokNongNaSearch onLocationSelect={handleLocationSelect} />
<KhokNongNaMap onLocationSelect={handleLocationSelect} />
```

## Requirements

- Google Maps API Key must be set in environment variables as `REACT_APP_GOOGLE_MAPS_API_KEY`
- Google Places API must be enabled for the API key

## Features Overview

โคกหนองนา (Khok Nong Na) เป็นระบบที่ออกแบบตามแนวคิดเศรษฐกิจพอเพียง ประกอบด้วย:

1. **โคก** - เนินดินสำหรับปลูกพืช
2. **หนอง** - บ่อน้ำสำหรับกักเก็บน้ำ
3. **นา** - พื้นที่ปลูกข้าว
4. **ระบบน้ำ** - การจัดการน้ำอัตโนมัติ

ระบบนี้ช่วยในการวางแผนและจัดการระบบน้ำสำหรับพื้นที่เกษตรกรรมแบบยั่งยืน

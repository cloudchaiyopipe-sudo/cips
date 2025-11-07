import React, { useState } from 'react';
import { Head } from '@inertiajs/react';
import KhokNongNaMap from '../components/KhokNongNaModel/KhokNongNaMap';
import KhokNongNaSearch from '../components/KhokNongNaModel/KhokNongNaSearch';

interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

const KhokNongNaPage: React.FC = () => {
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>({
    lat: 13.7563,
    lng: 100.5018
  });
  const [mapZoom, setMapZoom] = useState(10);

  const handleLocationSelect = (location: google.maps.LatLng, address: string) => {
    const locationData: LocationData = {
      lat: location.lat(),
      lng: location.lng(),
      address
    };
    setSelectedLocation(locationData);
    setMapCenter({ lat: location.lat(), lng: location.lng() });
    setMapZoom(15);
  };

  const handleSearchSelect = (location: google.maps.LatLng, address: string) => {
    handleLocationSelect(location, address);
  };

  return (
    <>
      <Head title="โคกหนองนา - ระบบวางระบบน้ำ" />
      
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-xl font-bold">โค</span>
                  </div>
                </div>
                <div className="ml-4">
                  <h1 className="text-xl font-semibold text-gray-900">
                    โคกหนองนา
                  </h1>
                  <p className="text-sm text-gray-500">
                    ระบบวางระบบน้ำสำหรับโคกหนองนา
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  บันทึกโครงการ
                </button>
                <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  เริ่มต้นใหม่
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Panel - Search and Controls */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  ค้นหาตำแหน่ง
                </h2>
                
                {/* Search Component */}
                <div className="mb-6">
                  <KhokNongNaSearch
                    onLocationSelect={handleSearchSelect}
                    placeholder="ค้นหาตำแหน่งสำหรับโคกหนองนา..."
                  />
                </div>

                {/* Selected Location Info */}
                {selectedLocation && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <h3 className="text-sm font-medium text-green-800 mb-2">
                      ตำแหน่งที่เลือก
                    </h3>
                    <p className="text-sm text-green-700 mb-2">
                      {selectedLocation.address}
                    </p>
                    <div className="text-xs text-green-600">
                      ละติจูด: {selectedLocation.lat.toFixed(6)}
                    </div>
                    <div className="text-xs text-green-600">
                      ลองจิจูด: {selectedLocation.lng.toFixed(6)}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-900">
                    การดำเนินการ
                  </h3>
                  
                  <button className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500">
                    วิเคราะห์พื้นที่
                  </button>
                  
                  <button className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    วางแผนระบบน้ำ
                  </button>
                  
                  <button className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    คำนวณต้นทุน
                  </button>
                </div>

                {/* Project Info */}
                <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">
                    ข้อมูลโครงการ
                  </h3>
                  <div className="space-y-2 text-xs text-blue-700">
                    <div>ชื่อโครงการ: -</div>
                    <div>พื้นที่: -</div>
                    <div>วันที่สร้าง: {new Date().toLocaleDateString('th-TH')}</div>
                    <div>สถานะ: กำลังวางแผน</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel - Map */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    แผนที่พื้นที่
                  </h2>
                  <div className="flex items-center space-x-2">
                    <button className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
                      วัดระยะ
                    </button>
                    <button className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
                      วาดพื้นที่
                    </button>
                    <button className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
                      ดูภาพดาวเทียม
                    </button>
                  </div>
                </div>

                {/* Map Component */}
                <KhokNongNaMap
                  onLocationSelect={(location: google.maps.LatLng) => handleLocationSelect(location, '')}
                  initialCenter={mapCenter}
                  initialZoom={mapZoom}
                  height="500px"
                />

                {/* Map Instructions */}
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.725-1.36 3.49 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-800">
                        <strong>คำแนะนำ:</strong> คลิกบนแผนที่เพื่อเลือกตำแหน่ง หรือใช้ช่องค้นหาด้านซ้ายเพื่อหาตำแหน่งที่ต้องการ
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Panel - Features */}
          <div className="mt-8">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                ฟีเจอร์โคกหนองนา
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">โคก</h3>
                  <p className="text-xs text-gray-500 mt-1">เนินดินสำหรับปลูกพืช</p>
                </div>
                
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">หนอง</h3>
                  <p className="text-xs text-gray-500 mt-1">บ่อน้ำสำหรับกักเก็บน้ำ</p>
                </div>
                
                <div className="text-center">
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">นา</h3>
                  <p className="text-xs text-gray-500 mt-1">พื้นที่ปลูกข้าว</p>
                </div>
                
                <div className="text-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">ระบบน้ำ</h3>
                  <p className="text-xs text-gray-500 mt-1">การจัดการน้ำอัตโนมัติ</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default KhokNongNaPage;

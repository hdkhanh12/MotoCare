import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';

interface MarketPriceItem {
  id: number;
  service_name: string;
  price_range: string;
  notes: string | null;
}

async function fetchMarketPricesApi() {
  const { data, error } = await supabase
    .from('market_prices')
    .select('*')
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return data as MarketPriceItem[];
}

export default function MarketPriceScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: prices, isLoading, isError, refetch } = useQuery({
    queryKey: ['market_prices'],
    queryFn: fetchMarketPricesApi,
    staleTime: 1000 * 60 * 30, // Cache 30 phút vì giá không đổi liên tục
  });

  // --- SEARCH LOGIC (Client-side filtering) ---
  const filteredData = useMemo(() => {
    if (!prices) return [];
    if (!searchQuery) return prices;
    
    const lowerQuery = searchQuery.toLowerCase();
    return prices.filter(item => 
      item.service_name.toLowerCase().includes(lowerQuery) || 
      (item.notes && item.notes.toLowerCase().includes(lowerQuery))
    );
  }, [searchQuery, prices]);

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} className="flex-1">

        {/* HEADER */}
        <View className="px-4 py-3 flex-row items-center border-b border-slate-100 bg-white/80 z-10">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center rounded-full bg-slate-50">
                <MaterialIcons name="arrow-back-ios" size={20} color="#0F172A" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
            <Text className="flex-1 text-center text-lg font-bold text-[#0F172A] mr-10">
                Tra Cứu Giá Thị Trường
            </Text>
        </View>

        <View className="flex-1 px-4 pt-4">
          
          {/* DISCLAIMER */}
          <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex-row gap-3 mb-4 items-start">              
              <View className="flex-1">
                  <MaterialIcons name="info-outline" size={20} color="#d97706" />
                  <Text className="text-amber-800 font-bold text-sm mb-1">
                      Lưu ý quan trọng
                  </Text>
                  <Text className="text-amber-700 text-xs leading-5">
                      Bảng giá được cập nhật từ hệ thống nhưng chỉ mang tính chất tham khảo. 
                      Giá thực tế phụ thuộc vào dòng xe và khu vực.
                  </Text>
              </View>
          </View>


          {/* SEARCH BAR */}
          <View className="relative mb-4">
              <View className="absolute inset-y-0 left-0 pl-3 justify-center pointer-events-none z-10">
                  <MaterialIcons name="search" size={24} color="#94A3B8" />
              </View>
              <TextInput 
                  className="w-full h-12 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium shadow-sm focus:border-teal-500"
                  placeholder="Tìm dịch vụ (ví dụ: nhớt, phanh...)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#94A3B8"
              />
          </View>

          {/* CONTENT LIST */}
          {isLoading ? (
             <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#14b8a6" />
                <Text className="text-slate-400 mt-3">Đang cập nhật bảng giá...</Text>
             </View>
          ) : isError ? (
             <View className="flex-1 items-center justify-center">
                <MaterialIcons name="wifi-off" size={48} color="#ef4444" />
                <Text className="text-slate-500 mt-2">Không thể tải dữ liệu.</Text>
                <TouchableOpacity onPress={() => refetch()} className="mt-4 px-4 py-2 bg-slate-200 rounded-lg">
                    <Text className="font-semibold text-slate-700">Thử lại</Text>
                </TouchableOpacity>
             </View>
          ) : (
            <FlatList 
              data={filteredData}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
              refreshControl={
                 <RefreshControl refreshing={isLoading} onRefresh={refetch} colors={['#14b8a6']} />
              }
              ListEmptyComponent={
                <View className="items-center justify-center py-10">
                   <MaterialIcons name="search-off" size={48} color="#cbd5e1" />
                   <Text className="text-slate-400 mt-2">Không tìm thấy dịch vụ nào.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View className="bg-white rounded-xl p-4 mb-3 shadow-sm shadow-slate-100 border border-slate-50">
                    <View className="flex-row justify-between items-start mb-2">
                        <Text className="text-slate-800 font-bold text-base flex-1 mr-2">
                            {item.service_name}
                        </Text>
                        {/* Giá tiền */}
                        <View className="bg-teal-50 px-2 py-1 rounded text-right">
                            <Text className="text-teal-700 font-bold text-sm">
                                {item.price_range}
                            </Text>
                            <Text className="text-teal-600 text-[10px] text-right font-medium">VNĐ</Text>
                        </View>
                    </View>
                    
                    {/* Ghi chú */}
                    {item.notes && (
                      <View className="flex-row items-center mt-1">
                          <MaterialIcons name="notes" size={14} color="#64748b" />
                          <Text className="text-slate-500 text-xs ml-1 flex-1">
                              {item.notes}
                          </Text>
                      </View>
                    )}
                </View>
              )}
            />
          )}

        </View>
      </SafeAreaView>
    </View>
  );
}
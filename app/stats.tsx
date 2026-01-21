import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';

async function fetchStatsData() {
  // Lấy ID xe đang chọn
  const vehicleId = await AsyncStorage.getItem('last_selected_vehicle_id');
  if (!vehicleId) return { history: [], templateItems: [] };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập");

  // Lấy Template ID của xe để biết tên các hạng mục
  const { data: vehicle } = await supabase
    .from('user_vehicles')
    .select('template_id')
    .eq('id', vehicleId)
    .single();

  let templateItems: any[] = [];
  if (vehicle?.template_id) {
    const { data: template } = await supabase
      .from('maintenance_templates')
      .select('items')
      .eq('id', vehicle.template_id)
      .single();
    if (template?.items) templateItems = template.items;
  }

  // Lấy Lịch sử
  const { data: history, error } = await supabase
    .from('maintenance_history')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  return { history: history || [], templateItems };
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const calculateChartSteps = (maxValue: number) => {
  if (maxValue === 0) return { max: 100000, step: 25000 };
  
  const digits = Math.floor(Math.log10(maxValue));
  const factor = Math.pow(10, digits);
  const roundedMax = Math.ceil(maxValue / factor) * factor;
  
  return { max: roundedMax, step: roundedMax / 4 };
};

export default function StatsScreen() {
  const router = useRouter();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['maintenance-stats-final'],
    queryFn: fetchStatsData,
    staleTime: 1000 * 60 * 5,
  });

  const stats = useMemo(() => {
    if (!data || !data.history.length) return null;

    const { history, templateItems } = data;
    let totalCost = 0;
    
    const monthlyData: Record<string, number> = {};
    const categoryData: Record<string, number> = {};

    history.forEach((item: any) => {
      const cost = Number(item.cost) || 0;
      totalCost += cost;

      const date = new Date(item.created_at);
      const monthKey = `T${date.getMonth() + 1}`; // Ví dụ: T1
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + cost;

      let partName = 'Chi phí khác';
      if (item.service_rule_id) {
          const rule = templateItems.find((t: any) => t.id === item.service_rule_id);
          if (rule) partName = rule.part_name;
      } else {
          partName = 'Sửa chữa phát sinh';
      }

      categoryData[partName] = (categoryData[partName] || 0) + cost;
    });

    // Format Data Biểu đồ
    const barData = Object.keys(monthlyData).map(key => ({
        value: monthlyData[key],
        label: key,
        frontColor: '#14b8a6',
        topLabelComponent: () => (
            <Text style={{fontSize: 10, color: '#64748b', marginBottom: 2, fontWeight: 'bold'}}>
                {(monthlyData[key] / 1000).toFixed(0)}k
            </Text>
        )
    }));

    const maxVal = Math.max(...Object.values(monthlyData));
    const chartConfig = calculateChartSteps(maxVal);

    // Format Data Danh sách (Sort giảm dần theo tiền)
    const categoryList = Object.keys(categoryData)
      .map(key => ({
        name: key,
        value: categoryData[key],
        percent: totalCost > 0 ? (categoryData[key] / totalCost) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    return { totalCost, count: history.length, barData, categoryList, chartConfig };
  }, [data]);

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
                Thống Kê Chi Phí
            </Text>
        </View>

        <ScrollView 
          className="flex-1 px-4 pt-6"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} colors={['#14b8a6']} />
          }
        >
          {isLoading && (
            <View className="h-60 items-center justify-center">
              <ActivityIndicator size="large" color="#14b8a6" />
            </View>
          )}

          {!isLoading && !stats && (
             <View className="items-center mt-20">
                <MaterialIcons name="analytics" size={60} color="#cbd5e1" />
                <Text className="text-slate-400 mt-4">Chưa có dữ liệu thống kê</Text>
             </View>
          )}

          {!isLoading && stats && (
            <View className="pb-10">
                
                {/* TỔNG TIỀN */}
                <View className="bg-white rounded-2xl p-5 shadow-sm shadow-slate-200 mb-6 border border-slate-50">
                    <Text className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-1">Tổng chi tiêu</Text>
                    <Text className="text-3xl font-extrabold text-slate-800">
                        {formatCurrency(stats.totalCost)}
                    </Text>
                    <Text className="text-slate-400 text-xs mt-2 font-medium">
                        Tổng cộng {stats.count} lần bảo dưỡng
                    </Text>
                </View>

                {/* BIỂU ĐỒ */}
                <View className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-6">
                    <Text className="text-slate-700 font-bold mb-6 ml-1">Xu hướng theo tháng</Text>
                    <View className="items-center overflow-hidden pb-2 pr-2">
                        {stats.barData.length > 0 ? (
                            <BarChart
                                data={stats.barData}
                                barWidth={32}
                                spacing={20}
                                noOfSections={4}
                                maxValue={stats.chartConfig.max}
                                stepValue={stats.chartConfig.step}
                                barBorderRadius={6}
                                frontColor="#14b8a6"
                                yAxisThickness={0}
                                xAxisThickness={0}
                                hideRules={false}
                                rulesColor="#f1f5f9"
                                yAxisTextStyle={{ color: '#94a3b8', fontSize: 10 }}
                                xAxisLabelTextStyle={{ color: '#64748b', fontSize: 11, fontWeight: '500' }}
                                isAnimated
                                height={200}
                                width={280} 
                            />
                        ) : (
                            <Text className="text-slate-400 py-10">Chưa đủ dữ liệu vẽ biểu đồ</Text>
                        )}
                    </View>
                </View>

                {/* CHI TIẾT TỪNG MỤC (Tên + Tổng tiền) */}
                <View className="mb-6">
                    <Text className="text-slate-700 font-bold text-base mb-3 ml-1">Chi tiết hạng mục</Text>
                    <View className="bg-white rounded-2xl p-2 shadow-sm shadow-slate-200 border border-slate-50">
                        {stats.categoryList.map((item, index) => (
                            <View key={index} className="mb-1">
                                <View className="flex-row items-center justify-between py-3 px-3">
                                    <View className="flex-1 pr-4">
                                        <Text className="text-slate-800 font-bold text-sm mb-1">
                                            {item.name}
                                        </Text>
                                        <View className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <View 
                                                style={{ width: `${item.percent}%` }} 
                                                className="h-full bg-teal-500 rounded-full" 
                                            />
                                        </View>
                                    </View>
                                    <View className="items-end">
                                        <Text className="text-slate-900 font-bold text-sm">
                                            {formatCurrency(item.value)}
                                        </Text>
                                        <Text className="text-slate-400 text-xs font-medium">
                                            {item.percent.toFixed(1)}%
                                        </Text>
                                    </View>
                                </View>
                                {index < stats.categoryList.length - 1 && (
                                    <View className="h-[1px] bg-slate-50 mx-3" />
                                )}
                            </View>
                        ))}
                    </View>
                </View>

            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
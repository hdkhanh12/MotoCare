import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import { COLORS } from '../../constants/Colors';
import { useGlobalModal } from '../../contexts/ModalContext';
import {
    addPersonalScheduleApi,
    deletePersonalScheduleApi,
    getPersonalSchedulesApi
} from '../../services/maintenance';
import { supabase } from '../../services/supabase';

// --- HELPER FUNCTION ---
const getIconForPart = (name: string) => {
  const n = name ? name.toLowerCase() : '';
  if (n.includes('dầu') || n.includes('nhớt')) return 'water-drop';
  if (n.includes('lọc') || n.includes('khí')) return 'filter-alt';
  if (n.includes('bugi') || n.includes('lửa')) return 'flash-on';
  if (n.includes('phanh') || n.includes('thắng')) return 'disc-full';
  if (n.includes('xích') || n.includes('sên')) return 'link';
  if (n.includes('curoa') || n.includes('đai')) return 'settings';
  if (n.includes('lốp') || n.includes('vỏ')) return 'circle';
  if (n.includes('nước') || n.includes('mát')) return 'ac-unit';
  if (n.includes('rửa') || n.includes('vệ sinh')) return 'cleaning-services';
  return 'build';
};

async function fetchScheduleData() {
  const currentVehicleId = await AsyncStorage.getItem('last_selected_vehicle_id');
  if (!currentVehicleId) return null;

  const [vehicleRes, historyRes, personalRes] = await Promise.all([
    supabase.from('user_vehicles').select('*').eq('id', currentVehicleId).single(),
    supabase.from('maintenance_history').select('service_rule_id, performed_at_odo').eq('vehicle_id', currentVehicleId),
    getPersonalSchedulesApi(currentVehicleId) // Lấy thêm lịch cá nhân
  ]);

  if (vehicleRes.error || !vehicleRes.data) throw new Error("Không tìm thấy xe");
  
  const vehicle = vehicleRes.data;
  const history = historyRes.data || [];
  const personalSchedules = personalRes || [];

  let templateItems: any[] = [];
  if (vehicle.template_id) {
    const { data: template } = await supabase
      .from('maintenance_templates')
      .select('items')
      .eq('id', vehicle.template_id)
      .single();
    if (template?.items) templateItems = template.items;
  }

  const currentOdo = vehicle.current_odo || 0;
  const customRules = vehicle.custom_settings || {};
  
  const calculatedTemplateItems = templateItems.map((item: any) => {
    const override = customRules[item.id];
    const partName = override?.part_name || item.part_name;
    const intervalKm = override?.interval_km || item.schedule?.interval_km || 999999;
    
    const lastHistory = history.find((h: any) => h.service_rule_id == item.id);
    let lastPerformedOdo = 0;
    
    if (lastHistory) {
      lastPerformedOdo = lastHistory.performed_at_odo;
    } else {
      if (intervalKm <= 100000) {
         lastPerformedOdo = Math.floor(currentOdo / intervalKm) * intervalKm;
      }
    }
    
    const nextDueOdo = lastPerformedOdo + intervalKm;
    const remainingKm = nextDueOdo - currentOdo;
    
    // Progress
    const distanceCovered = currentOdo - lastPerformedOdo;
    let progressPercent = (distanceCovered / intervalKm) * 100;
    if (progressPercent < 0) progressPercent = 0;

    return {
      id: item.id,
      type: 'template',
      part_name: partName,
      iconName: getIconForPart(partName),
      interval_km: intervalKm,
      nextDueOdo,
      remainingKm,
      displayRemaining: remainingKm < 0 ? `Quá ${Math.abs(remainingKm).toLocaleString()} km` : `Còn ${remainingKm.toLocaleString()} km`,
      progressPercent,
      note: item.schedule?.note || 'Theo khuyến nghị nhà sản xuất'
    };
  });

  // TÍNH TOÁN (CÁ NHÂN - PERSONAL)
  const calculatedPersonalItems = personalSchedules.map((item: any) => {
      // Logic tính toán cho lịch cá nhân (Giả sử chưa có history riêng, tính theo ODO tròn)
      const intervalKm = item.interval_km;
      const lastPerformedOdo = Math.floor(currentOdo / intervalKm) * intervalKm;
      const nextDueOdo = lastPerformedOdo + intervalKm;
      const remainingKm = nextDueOdo - currentOdo;
      
      const distanceCovered = currentOdo - lastPerformedOdo;
      const progressPercent = (distanceCovered / intervalKm) * 100;

      return {
          id: item.id,
          type: 'personal',
          part_name: item.service_name,
          iconName: getIconForPart(item.service_name),
          interval_km: intervalKm,
          nextDueOdo,
          remainingKm,
          displayRemaining: `Còn ${remainingKm.toLocaleString()} km`,
          progressPercent,
          note: 'Lịch trình cá nhân của bạn'
      };
  });

  let finalItems = [...calculatedTemplateItems, ...calculatedPersonalItems];
  
  finalItems.sort((a: any, b: any) => {
     // Đẩy các mục theo thời gian (interval lớn) xuống cuối
     if (a.interval_km > 100000) return 1;
     if (b.interval_km > 100000) return -1;
     // Sắp xếp theo cái nào sắp đến hạn nhất
     return a.remainingKm - b.remainingKm;
  });

  return {
    vehicleInfo: vehicle,
    scheduleItems: finalItems
  };
}

export default function ScheduleScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useGlobalModal();

  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newInterval, setNewInterval] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vehicle-schedule-full'],
    queryFn: fetchScheduleData,
  });

  useFocusEffect(
    useCallback(() => { refetch(); }, [refetch])
  );

  const addMutation = useMutation({
      mutationFn: async () => {
          if (!data?.vehicleInfo?.id) throw new Error("Không tìm thấy xe");
          if (!newName || !newInterval) throw new Error("Vui lòng nhập đủ thông tin");
          await addPersonalScheduleApi(data.vehicleInfo.id, newName, parseInt(newInterval));
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['vehicle-schedule-full'] });
          setModalVisible(false);
          setNewName('');
          setNewInterval('');
          showSuccess("Thành công", "Đã thêm lịch trình mới");
      },
      onError: (err) => showError(err.message)
  });

  const deleteMutation = useMutation({
      mutationFn: deletePersonalScheduleApi,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['vehicle-schedule-full'] });
        showSuccess("Đã xóa", "Lịch trình cá nhân đã được xóa.");
      },
      onError: (err) => showError(err.message)
  });

  const handleDeleteItem = (item: any) => {
      if (item.type === 'personal') {
          showConfirm("Xóa lịch trình", `Bạn muốn xóa mục "${item.part_name}"?`, () => deleteMutation.mutate(item.id));
      } else {
          showError("Đây là lịch trình mặc định của hãng, không thể xóa.");
      }
  };

  const scheduleItems = data?.scheduleItems || [];
  const vehicleInfo = data?.vehicleInfo || null;

  const renderItem = ({ item }: { item: any }) => {
    let progressColor = 'bg-teal-500';
    let trackColor = 'bg-teal-100';
    let statusText = 'Tốt';
    let statusTextColor = 'text-teal-600';

    if (item.interval_km < 100000) {
        if (item.progressPercent >= 100) {
            progressColor = 'bg-red-500'; trackColor = 'bg-red-100';
            statusText = 'Quá hạn'; statusTextColor = 'text-red-600';
        } else if (item.progressPercent >= 75) {
            progressColor = 'bg-amber-500'; trackColor = 'bg-amber-100';
            statusText = 'Sắp đến hạn'; statusTextColor = 'text-amber-600';
        }
    }

    const displayProgress = Math.min(item.progressPercent, 100);
    const isPersonal = item.type === 'personal';

    return (       
      <TouchableOpacity 
        activeOpacity={0.7}
        onLongPress={() => isPersonal && handleDeleteItem(item)}
        onPress={() => {
             router.push({
                pathname: '/service-detail',
                params: { 
                    item: JSON.stringify({ ...item, currentOdo: vehicleInfo?.current_odo || 0 }),
                    vehicleId: vehicleInfo?.id 
                }
            });
        }}
        className={`bg-white p-4 rounded-xl mb-4 border shadow-sm ${isPersonal ? 'border-teal-200' : 'border-slate-100'}`}
      >
        <View className="flex-row items-center mb-3">
            <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${trackColor}`}>
                <MaterialIcons name={item.iconName as any} size={20} color={item.progressPercent >= 100 ? '#EF4444' : (item.progressPercent >= 75 ? '#F59E0B' : '#14b8a5')} />
            </View>
            <View className="flex-1">
                <View className="flex-row items-center">
                    <Text className="font-bold text-slate-900 text-base mr-2">{item.part_name}</Text>
                    {isPersonal && <MaterialIcons name="person" size={14} color="#14B8A6" />}
                </View>
                <Text className="text-xs text-slate-400">
                    {item.interval_km < 100000 ? `Chu kỳ: ${item.interval_km.toLocaleString()} km` : item.note}
                </Text>
            </View>
            <View className="items-end">
                <Text className={`font-bold ${statusTextColor}`}>{statusText}</Text>
                <Text className="text-xs text-slate-500 font-medium">{item.displayRemaining}</Text>
            </View>
        </View>

        {item.interval_km < 100000 && (
            <View className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                <View className={`h-full rounded-full ${progressColor}`} style={{ width: `${displayProgress}%` }} />
            </View>
        )}
        
        <View className="flex-row justify-between pt-1">
            <Text className="text-[10px] text-slate-400 italic flex-1 mr-4">{item.note}</Text>
            {item.interval_km < 100000 && (
                <Text className="text-[10px] text-slate-900 font-medium">
                    Hạn tới: {item.nextDueOdo.toLocaleString()} km
                </Text>
            )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar style="dark" />
      
      {/* HEADER */}
      <View className="bg-white/95 pt-12 pb-4 px-4 border-b border-slate-100 flex-row items-center justify-between z-10">
          <View className="w-10" /> 
          <Text className="text-[#0F172A] text-lg font-bold flex-1 text-center">Lịch trình</Text>
          <View className="w-10" /> 
      </View>

      {/* LIST */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList 
            data={scheduleItems}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            renderItem={renderItem}
            ListHeaderComponent={
                <View className="px-6 py-4">
                    <View className="flex-row justify-between items-end mb-2">
                        <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider">Dự báo bảo dưỡng</Text>
                        {vehicleInfo && (
                            <View className="bg-slate-200 px-3 py-1 rounded-full flex-row items-center gap-1">
                                <MaterialIcons name="two-wheeler" size={14} color="#475569" />
                                <Text className="text-xs font-bold text-slate-600">{vehicleInfo.model}</Text>
                            </View>
                        )}
                    </View>
                    <Text className="text-2xl font-bold text-[#0F172A]">Sức khỏe xe</Text>
                    <Text className="text-xs text-slate-400 mt-1 italic">* Nhấn giữ vào mục cá nhân để xóa</Text>
                </View>
            }
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
            ListEmptyComponent={
                <View className="items-center justify-center mt-20">
                    <Text className="text-slate-400">Chưa có dữ liệu</Text>
                </View>
            }
        />
      )}

      {/* FAB ADD BUTTON */}
      <TouchableOpacity 
        onPress={() => setModalVisible(true)}
        className="absolute bottom-6 right-6 w-14 h-14 bg-[#0F172A] rounded-full items-center justify-center shadow-lg shadow-slate-400 z-50"
      >
         <MaterialIcons name="add" size={32} color="white" />
      </TouchableOpacity>

      {/* MODAL ADD */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
         >
         <TouchableOpacity 
            className="flex-1 bg-black/50 justify-end"
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
         >
            <View className="bg-white rounded-t-3xl p-6" onStartShouldSetResponder={() => true}>
                <Text className="text-xl font-bold text-slate-800 mb-4">Thêm lịch trình riêng</Text>
                
                <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Tên hạng mục</Text>
                <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 mb-4 text-slate-900"
                    placeholder="Ví dụ: Rửa xe, Xịt sên..."
                    value={newName}
                    onChangeText={setNewName}
                />

                <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Lặp lại sau (km)</Text>
                <TextInput 
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 mb-6 text-slate-900"
                    placeholder="Ví dụ: 500"
                    keyboardType="numeric"
                    value={newInterval}
                    onChangeText={setNewInterval}
                />

                <View className="flex-row gap-3">
                    <TouchableOpacity onPress={() => setModalVisible(false)} className="flex-1 h-12 rounded-xl bg-slate-100 items-center justify-center">
                        <Text className="font-bold text-slate-600">Hủy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => addMutation.mutate()}
                        className="flex-1 h-12 rounded-xl bg-[#0F172A] items-center justify-center"
                    >
                         {addMutation.isPending ? <ActivityIndicator color="white"/> : <Text className="font-bold text-white">Thêm ngay</Text>}
                    </TouchableOpacity>
                </View>
            </View>
         </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}
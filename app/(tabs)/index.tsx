import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DailyOdoModal } from '../../components/modals/DailyOdoModal';
import { EmptyState } from '../../components/ui/EmptyState';
import { COLORS } from '../../constants/Colors';
import { useGlobalModal } from '../../contexts/ModalContext';
import { supabase } from '../../services/supabase';
import { openNearbyRepairShops } from '../../utils/mapHelper';

const getIconForPart = (name: string) => {
  const n = name ? name.toLowerCase() : '';
  if (n.includes('dầu') || n.includes('nhớt')) return 'water-drop';
  if (n.includes('lọc gió') || n.includes('khí')) return 'filter-alt';
  if (n.includes('bugi') || n.includes('lửa')) return 'flash-on';
  if (n.includes('phanh') || n.includes('thắng')) return 'disc-full';
  if (n.includes('xích') || n.includes('sên')) return 'link';
  if (n.includes('curoa') || n.includes('đai')) return 'settings';
  if (n.includes('lốp') || n.includes('vỏ')) return 'circle';
  if (n.includes('nước') || n.includes('mát')) return 'ac-unit';
  return 'build';
};

async function fetchUserVehicles() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_vehicles')
    .select('*')
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchMaintenanceAlerts(vehicleId: string | undefined, currentOdo: number, templateId: string | undefined | null) {
  if (!vehicleId || !templateId) return [];

  const { data: templateData, error: templateError } = await supabase
    .from('maintenance_templates')
    .select('items')
    .eq('id', templateId)
    .single();

  if (templateError) throw new Error(templateError.message);
  if (!templateData?.items) return [];

  const { data: history, error: historyError } = await supabase
    .from('maintenance_history')
    .select('service_rule_id, performed_at_odo')
    .eq('vehicle_id', vehicleId);

  if (historyError) throw new Error(historyError.message);

  const newAlerts: any[] = [];
  const rawItems: any[] = templateData.items;

  rawItems.forEach((item: any) => {
    const intervalKm = item.schedule?.interval_km;
    if (!intervalKm) return; 

    const ruleId = item.id;
    const lastHistory = history?.find((h: any) => h.service_rule_id === ruleId);

    let nextDueOdo = 0;
    if (lastHistory) {
      nextDueOdo = lastHistory.performed_at_odo + intervalKm;
    } else {
      nextDueOdo = Math.ceil((currentOdo + 1) / intervalKm) * intervalKm;
    }

    const remaining = nextDueOdo - currentOdo;
    const warningThreshold = Math.min(300, intervalKm * 0.15); 

    if (remaining <= warningThreshold) {
      let color = COLORS.primary, bg = 'bg-teal-50', border = 'border-l-teal-500';

      if (remaining < 0) { 
        color = '#EF4444'; bg = 'bg-red-50'; border = 'border-l-red-500';
      } else if (remaining < warningThreshold) { 
        color = '#F59E0B'; bg = 'bg-amber-50'; border = 'border-l-yellow-500';
      }

      newAlerts.push({
        rule_id: ruleId,
        name: item.part_name,
        icon: getIconForPart(item.part_name),
        color, bg, border,
        isOverdue: remaining < 0,
        message: remaining < 0
          ? `Quá hạn ${Math.abs(remaining).toLocaleString()} km`
          : `Còn ${remaining.toLocaleString()} km`,
        remaining
      });
    }
  });

  return newAlerts;
}

async function updateVehicleOdoApi({ vehicleId, newOdo }: { vehicleId: string, newOdo: number }) {
  const { data, error } = await supabase
    .from('user_vehicles')
    .update({ current_odo: newOdo })
    .eq('id', vehicleId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function saveMaintenanceRecordApi(payload: any) {
  const { error } = await supabase.from('maintenance_history').insert([payload]);
  if (error) throw new Error(error.message);
  return true;
}

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);
  const [showOdoModal, setShowOdoModal] = useState(false);
  const [newOdo, setNewOdo] = useState('');
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  const { showConfirm, showSuccess, showError } = useGlobalModal();

  // QUERY: DANH SÁCH XE
  const {
    data: vehiclesData,
    isLoading: isLoadingVehicles,
    error: vehiclesError,
    refetch: refetchVehicles,
  } = useQuery({
    queryKey: ['user-vehicles'],
    queryFn: fetchUserVehicles,
  });

  // XỬ LÝ LOGIC CHỌN XE MẶC ĐỊNH
  useEffect(() => {
    const initSelectedVehicle = async () => {
      if (vehiclesData && vehiclesData.length > 0) {
        if (selectedVehicle) return; 

        const lastVehicleId = await AsyncStorage.getItem('last_selected_vehicle_id');
        const foundVehicle = vehiclesData.find((v: any) => v.id === lastVehicleId);

        if (foundVehicle) {
          setSelectedVehicle(foundVehicle);
        } else {
          setSelectedVehicle(vehiclesData[0]);
          await AsyncStorage.setItem('last_selected_vehicle_id', vehiclesData[0].id);
        }
      } else if (vehiclesData && vehiclesData.length === 0) {
        setSelectedVehicle(null);
      }
    };
    
    initSelectedVehicle();
  }, [vehiclesData]);


  // QUERY: CẢNH BÁO BẢO DƯỠNG
  const {
    data: alertsData,
    isLoading: isLoadingAlerts,
    error: alertsError,
    refetch: refetchAlerts,
  } = useQuery({
    queryKey: ['maintenance-alerts', selectedVehicle?.id], 
    queryFn: () => fetchMaintenanceAlerts(
      selectedVehicle?.id,
      selectedVehicle?.current_odo ?? 0, 
      selectedVehicle?.template_id
    ),
    enabled: !!selectedVehicle?.id,
  });

  // UPDATE ODO
  const updateOdoMutation = useMutation({
      mutationFn: updateVehicleOdoApi,
      onSuccess: (updatedVehicle) => {
        setShowOdoModal(false);
        setNewOdo('');
        
        // Cập nhật dữ liệu Cache & State
        setSelectedVehicle(updatedVehicle);
        queryClient.invalidateQueries({ queryKey: ['user-vehicles'] });
        queryClient.invalidateQueries({ queryKey: ['maintenance-alerts', updatedVehicle.id] });

        setTimeout(() => {
          showSuccess(
            "Thành công!", 
            "Đã cập nhật số ODO mới."
          );
        }, 300);
      },
      onError: (err: any) => {
        showError(err.message || "Không thể cập nhật ODO.");
      },
  });
  

  // SAVE HISTORY
  const saveHistoryMutation = useMutation({
    mutationFn: saveMaintenanceRecordApi,

    onSuccess: () => {
      setShowDoneModal(false);

      queryClient.invalidateQueries({
        queryKey: ['maintenance-alerts', selectedVehicle?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['maintenance-history', selectedVehicle?.id],
      });

      setTimeout(() => {
        showSuccess(
          "Hoàn tất bảo dưỡng",
          "Đã lưu vào nhật ký bảo dưỡng."
        );
      }, 300);
    },

    onError: (err: any) => {
      showError(err?.message || "Không thể lưu nhật ký bảo dưỡng.");
    },
  });

  useFocusEffect(
    useCallback(() => {
      refetchVehicles();
      if (selectedVehicle) refetchAlerts();
    }, [selectedVehicle, refetchVehicles, refetchAlerts])
  );

  const onRefresh = async () => {
    await Promise.all([refetchVehicles(), refetchAlerts()]);
  };

  const handleUpdateOdo = () => {
    if (!selectedVehicle || !newOdo) return;
    const newOdoNum = parseInt(newOdo.replace(/\D/g, ''));
    
    const currentOdo = selectedVehicle?.current_odo || 0;
    if (newOdoNum < currentOdo) {
      showError("ODO mới không được nhỏ hơn ODO cũ.");
      return;
    }
    updateOdoMutation.mutate({ vehicleId: selectedVehicle.id, newOdo: newOdoNum });
  };

  const handleOdoUpdated = () => {
    console.log("ODO Updated -> Refreshing Vehicle Data...");
    refetchVehicles(); 
  };

  const handleSaveHistory = async () => {
    if (!selectedVehicle) return;
    const { data: { user } } = await supabase.auth.getUser();
    saveHistoryMutation.mutate({
      user_id: user?.id,
      vehicle_id: selectedVehicle.id,
      service_rule_id: selectedAlert.rule_id,
      performed_at_odo: selectedVehicle.current_odo,
      cost: parseInt(cost.replace(/\D/g, '')) || 0,
      notes: notes
    });
  };

  const handleOpenDoneModal = (alertItem: any) => {
    setSelectedAlert(alertItem);
    setCost('');
    setNotes('');
    setShowDoneModal(true);
  };

  const handleAddVehicle = () => router.push('/onboarding');

  const currentAlerts = alertsData || [];

  if (isLoadingVehicles) {
    return <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  if (!vehiclesData || vehiclesData.length === 0) {
    return <EmptyState onAddPress={handleAddVehicle} />;
  }

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar style="dark" />

      {/* HEADER */}
      <SafeAreaView edges={['top']} className="bg-[#F8FAFC] z-20">
        <View className="px-6 pt-2 pb-4 flex-row justify-between items-center">
          <TouchableOpacity activeOpacity={0.7} onPress={() => setShowVehicleSelector(true)} className="flex-row items-center">
            <View>
              <View className="flex-row items-center gap-2">
                <MaterialIcons name="two-wheeler" size={28} color={COLORS.primary} />
                <Text className="text-[#0F172A] text-xl font-bold">{selectedVehicle?.model || 'Đang tải...'}</Text>
                <MaterialIcons name="keyboard-arrow-down" size={24} color="#64748B" />
              </View>
              <Text className="text-slate-500 text-sm font-medium mt-0.5 ml-9">{selectedVehicle?.plate_number || '---'}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/notifications')} className="relative p-2 rounded-full bg-white border border-slate-100">
            <MaterialIcons name="notifications-none" size={24} color="#334155" />
            {currentAlerts.length > 0 && <View className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white" />}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoadingAlerts} onRefresh={onRefresh} />}
      >
        <View className="pb-32">
          {/* ODO SECTION */}
          <View className="px-5 mb-6 mt-2">
            <View className="bg-white rounded-2xl p-1.5 shadow-sm border border-slate-100">           
              <View className="bg-[#0F172A] rounded-xl p-6 relative overflow-hidden">                  
                  <View className="absolute -right-6 -bottom-6 opacity-[0.08]">
                      <MaterialIcons name="speed" size={160} color="white" />
                  </View>

                  {/* HEADER NHỎ & NÚT SỬA */}
                  <View className="flex-row justify-between items-start">
                      <View>
                          <View className="flex-row items-center gap-1.5 mb-1">
                              <MaterialIcons name="place" size={14} color="#94A3B8" />
                              <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                                  Tổng quãng đường
                              </Text>
                          </View>
                          <View className="h-1 w-12 bg-teal-500 rounded-full" />
                      </View>

                      <TouchableOpacity 
                          onPress={() => { 
                              setNewOdo(selectedVehicle?.current_odo?.toString() || ''); 
                              setShowOdoModal(true); 
                          }} 
                          className="bg-white/10 p-2.5 rounded-full border border-white/5 active:bg-white/20"
                      >
                          <MaterialIcons name="edit" size={16} color="white" />
                      </TouchableOpacity>
                  </View>

                  {/* SỐ ODO TO */}
                  <View className="mt-5 flex-row items-baseline">
                      <Text className="text-white text-5xl font-black font-mono tracking-tighter shadow-lg">
                          {selectedVehicle?.current_odo 
                              ? parseInt(selectedVehicle.current_odo).toLocaleString('vi-VN') 
                              : '0'}
                      </Text>
                      <Text className="text-slate-500 text-xl font-medium ml-2 font-sans">km</Text>
                  </View>
              </View>
            </View>
          </View>

          {/* ALERTS */}
          {currentAlerts.length > 0 && (
            <View className="px-6 py-4">
               <View className="flex-row items-center gap-2 mb-3">
                  <Text className="text-[#0F172A] text-lg font-bold">Cần xử lý ngay</Text>
                  <View className="bg-red-100 px-2 py-0.5 rounded-full"><Text className="text-red-600 text-[10px] font-bold">{currentAlerts.length}</Text></View>
               </View>
               <View className="gap-3">
                  {currentAlerts.map((item, index) => (
                    <View key={index} className={`flex-row items-start gap-3 p-4 ${item.bg} border-l-4 ${item.border} rounded-r-xl shadow-sm`}>
                       <View className="p-2 bg-white rounded-full"><MaterialIcons name={item.icon} size={20} color={item.color} /></View>
                       <View className="flex-1">
                          <Text className="text-slate-800 font-bold text-base">{item.name}</Text>
                          <Text className={`text-sm mt-0.5 ${item.isOverdue ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{item.message}</Text>
                          <TouchableOpacity onPress={() => handleOpenDoneModal(item)} className="mt-3 bg-white px-3 py-1.5 rounded-md self-start border border-slate-100 shadow-sm active:bg-slate-50">
                             <Text className="text-xs font-bold text-slate-700">Đánh dấu đã làm</Text>
                          </TouchableOpacity>
                       </View>
                    </View>
                  ))}
               </View>
            </View>
          )}
          
          {/* QUICK ACCESS */}
          <View className="px-6 py-2">
            <Text className="text-[#0F172A] text-lg font-bold mb-3">Truy cập nhanh</Text>
            <View className="flex-row flex-wrap justify-between">
              {[
                { 
                  icon: 'bar-chart', 
                  bg: 'bg-indigo-50', 
                  label: 'Thống kê', 
                  type: 'link',
                  route: '/stats',
                  iconColor: '#4F46E5'
                },
                { 
                  icon: 'local-offer', 
                  bg: 'bg-teal-50', 
                  label: 'Tra cứu giá', 
                  type: 'link',
                  route: '/MarketPriceScreen',
                  iconColor: '#0D9488'    
                },
                { 
                  icon: 'map',            
                  bg: 'bg-red-50',        
                  label: 'Tìm tiệm sửa', 
                  type: 'action',
                  onPress: openNearbyRepairShops, 
                  iconColor: '#DC2626'    
                },
                { 
                  icon: 'person', 
                  bg: 'bg-blue-50',       
                  label: 'Cá nhân', 
                  type: 'link',
                  route: '/(tabs)/profile',
                  iconColor: '#2563EB'    
                },
              ].map((item, index) => (
                <TouchableOpacity 
                  key={index} 
                  onPress={() => {
                      if (item.type === 'link') {
                          router.push(item.route as any);
                      } else if (item.type === 'action' && item.onPress) {
                          item.onPress();
                      }
                  }} 
                  className="w-[48%] bg-white p-4 rounded-xl shadow-sm border border-slate-100 items-center justify-center gap-2 mb-4" 
                  style={{ aspectRatio: 4 / 3 }}
                >
                  <View className={`p-3 rounded-full ${item.bg}`}>
                      <MaterialIcons name={item.icon as any} size={24} color={item.iconColor} />
                  </View>
                  <Text className="text-sm font-semibold text-slate-700">{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </View>
      </ScrollView>

      {/* FAB ADD */}
      <View className="absolute bottom-6 right-6 z-50">
         <TouchableOpacity onPress={handleAddVehicle} className="w-14 h-14 bg-[#0F172A] rounded-full items-center justify-center shadow-lg shadow-slate-400">
             <MaterialIcons name="add" size={32} color="white" />
         </TouchableOpacity>
      </View>

      {/* MODALS */}
      {/* 1. Select Vehicle */}
      <Modal visible={showVehicleSelector} transparent animationType="slide">
        <TouchableOpacity className="flex-1 bg-black/50 justify-end" activeOpacity={1} onPress={() => setShowVehicleSelector(false)}>
           <View className="bg-white rounded-t-3xl p-6 h-[50%]">
              <Text className="text-xl font-bold text-center mb-6 text-slate-900">Chọn xe của bạn</Text>
              <FlatList 
                 data={vehiclesData || []} 
                 keyExtractor={item => item.id}
                 renderItem={({ item }) => (
                    <TouchableOpacity 
                       onPress={async () => {
                          setSelectedVehicle(item);
                          setShowVehicleSelector(false);
                          await AsyncStorage.setItem('last_selected_vehicle_id', item.id);
                       }}
                       className={`flex-row items-center p-4 rounded-xl mb-3 border ${selectedVehicle?.id === item.id ? 'bg-teal-50 border-teal-500' : 'bg-white border-slate-100'}`}
                    >
                       <MaterialIcons name="two-wheeler" size={32} color={selectedVehicle?.id === item.id ? COLORS.primary : '#94A3B8'} />
                       <View className="ml-4">
                          <Text className={`font-bold text-lg ${selectedVehicle?.id === item.id ? 'text-teal-700' : 'text-slate-700'}`}>{item.model}</Text>
                          <Text className="text-slate-500">{item.plate_number}</Text>
                       </View>
                       {selectedVehicle?.id === item.id && <MaterialIcons name="check" size={24} color={COLORS.primary} style={{ marginLeft: 'auto' }} />}
                    </TouchableOpacity>
                 )}
              />
           </View>
        </TouchableOpacity>
      </Modal>

      {/* 2. Done Modal */}
      <Modal visible={showDoneModal} transparent animationType="fade">
        <View className="flex-1 bg-black/60 items-center justify-center px-6">
           <View className="bg-white w-full rounded-2xl p-6">
              <Text className="text-xl font-bold text-slate-900 text-center mb-4">Hoàn thành bảo dưỡng</Text>
              <TextInput className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-slate-900 font-bold mb-4" keyboardType="numeric" placeholder="Chi phí (VNĐ)" value={cost} onChangeText={setCost} />
              <TextInput className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-24 text-slate-900 text-base mb-6 pt-3" multiline placeholder="Ghi chú" value={notes} onChangeText={setNotes} textAlignVertical="top" />
              <View className="flex-row gap-3">
                 <TouchableOpacity onPress={() => setShowDoneModal(false)} className="flex-1 h-12 items-center justify-center bg-slate-100 rounded-xl"><Text className="font-bold text-slate-600">Hủy</Text></TouchableOpacity>
                 <TouchableOpacity onPress={handleSaveHistory} className="flex-1 h-12 items-center justify-center bg-brand-navy rounded-xl" disabled={saveHistoryMutation.isPending}>
                    {saveHistoryMutation.isPending ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white">Lưu</Text>}
                 </TouchableOpacity>
              </View>
           </View>
        </View>
      </Modal>

      {/* 3. ODO Modal */}
      <Modal visible={showOdoModal} transparent animationType="fade">
        <View className="flex-1 bg-black/60 items-center justify-center px-6">
           <View className="bg-white w-full rounded-2xl p-6">
              <Text className="text-xl font-bold text-slate-900 mb-6 text-center">Cập nhật ODO</Text>
              <TextInput className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-slate-900 font-bold mb-6 text-lg" keyboardType="numeric" placeholder="Số km mới" value={newOdo} onChangeText={setNewOdo} autoFocus />
              <View className="flex-row gap-3">
                 <TouchableOpacity onPress={() => setShowOdoModal(false)} className="flex-1 h-12 items-center justify-center bg-slate-100 rounded-xl"><Text className="font-bold text-slate-600">Hủy</Text></TouchableOpacity>
                 <TouchableOpacity onPress={handleUpdateOdo} className="flex-1 h-12 items-center justify-center bg-brand-navy rounded-xl" disabled={updateOdoMutation.isPending}>
                    {updateOdoMutation.isPending ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white">Cập nhật</Text>}
                 </TouchableOpacity>
              </View>
           </View>
        </View>
      </Modal>

      {selectedVehicle && (
        <DailyOdoModal 
          vehicleId={selectedVehicle.id} // Dùng ID của xe đang chọn
          onUpdateSuccess={handleOdoUpdated} 
        />
      )}

    </View>
  );
}
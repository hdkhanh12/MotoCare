import { MaterialIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/Colors';
import { useGlobalModal } from '../contexts/ModalContext';
import { supabase } from '../services/supabase';

// Lấy lịch sử bảo dưỡng
async function fetchServiceHistoryApi({ vehicleId, ruleId, personalId }: { vehicleId: string, ruleId?: string, personalId?: number }) {
  let query = supabase
    .from('maintenance_history')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false });

  // Lọc theo Rule ID (nếu là template) HOẶC Personal Schedule ID (nếu là custom)
  if (ruleId) {
     query = query.eq('service_rule_id', ruleId);
  } else if (personalId) {
     query = query.eq('personal_schedule_id', personalId);
  } else {
     return [];
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

// Ghi nhật ký mới
async function addServiceLogApi(payload: any) {
  const { error } = await supabase.from('maintenance_history').insert([payload]);
  if (error) throw new Error(error.message);
  return true;
}

// Cập nhật cấu hình
async function updateServiceConfigApi({ vehicleId, ruleId, newName, newInterval }: any) {
  const { data: vehicle, error: fetchError } = await supabase
    .from('user_vehicles')
    .select('custom_settings')
    .eq('id', vehicleId)
    .single();
    
  if (fetchError) throw new Error(fetchError.message);

  const currentSettings = vehicle.custom_settings || {};
  currentSettings[ruleId] = {
      part_name: newName,
      interval_km: newInterval
  };

  const { error: updateError } = await supabase
    .from('user_vehicles')
    .update({ custom_settings: currentSettings })
    .eq('id', vehicleId);

  if (updateError) throw new Error(updateError.message);
  return { ruleId, newName, newInterval };
}


export default function ServiceDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useGlobalModal();
  
  const initialItem = params.item ? JSON.parse(params.item as string) : null;
  const vehicleId = params.vehicleId as string;

  const [item, setItem] = useState<any>(initialItem);
  
  const [showLogModal, setShowLogModal] = useState(false);
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(item?.part_name || '');
  const [editInterval, setEditInterval] = useState(item?.interval_km?.toString() || '');

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['service-history', vehicleId, item?.id],
    queryFn: () => fetchServiceHistoryApi({ 
        vehicleId, 
        ruleId: item?.type === 'template' ? item.id : undefined,
        personalId: item?.type === 'personal' ? item.id : undefined
    }),
    enabled: !!item && !!vehicleId,
  });

  const logMutation = useMutation({
    mutationFn: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Vui lòng đăng nhập lại");
        if (!cost) throw new Error("Vui lòng nhập chi phí");

        await addServiceLogApi({
            user_id: user.id,
            vehicle_id: vehicleId,
            service_rule_id: item.type === 'template' ? item.id : null,
            personal_schedule_id: item.type === 'personal' ? item.id : null,
            performed_at_odo: item.currentOdo || 0,
            cost: parseInt(cost.replace(/\D/g, '') || '0'),
            notes: notes
        });
    },
    onSuccess: () => {
      setShowLogModal(false);
      setCost('');
      setNotes('');
      
      queryClient.invalidateQueries({ queryKey: ['service-history'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-schedule-full'] });

      setTimeout(() => showSuccess("Thành công", "Đã thêm nhật ký mới!"), 300);
    },
    onError: (err: any) => showError(err.message),
  });

  const configMutation = useMutation({
    mutationFn: async () => {
        if (!editInterval) throw new Error("Vui lòng nhập chu kỳ");
        return await updateServiceConfigApi({
            vehicleId,
            ruleId: item.id,
            newName: editName,
            newInterval: parseInt(editInterval)
        });
    },
    onSuccess: (data) => {
      setShowEditModal(false);
      
      setItem((prev: any) => ({
          ...prev,
          part_name: data.newName,
          interval_km: data.newInterval
      }));

      queryClient.invalidateQueries({ queryKey: ['vehicle-schedule-full'] });
      setTimeout(() => showSuccess("Thành công", "Đã cập nhật cấu hình!"), 300);
    },
    onError: (err: any) => showError(err.message),
  });

  const handleOpenEdit = () => {
      setEditName(item.part_name);
      setEditInterval(item.interval_km.toString());
      setShowEditModal(true);
  };

  if (!item) return <View className="flex-1 bg-white" />;

  const healthPercent = Math.max(0, 100 - (item.progressPercent || 0));
  let statusColor = 'text-teal-600', statusBg = 'bg-teal-100', statusText = 'Tốt';
  
  if (item.interval_km < 100000) {
      if (item.progressPercent >= 100) {
          statusColor = 'text-red-600'; statusBg = 'bg-red-100'; statusText = 'Quá hạn';
      } else if (item.progressPercent >= 75) {
          statusColor = 'text-amber-600'; statusBg = 'bg-amber-100'; statusText = 'Sắp đến hạn';
      }
  } else {
      statusText = 'Theo thời gian'; statusColor = 'text-slate-500'; statusBg = 'bg-slate-100';
  }

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar style="dark" />
      
      {/* HEADER */}
      <SafeAreaView edges={['top']} className="bg-white z-50 border-b border-slate-100">
         <View className="px-4 py-3 flex-row items-center justify-between">
             <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center rounded-full bg-slate-50 border border-slate-100">
                <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
             </TouchableOpacity>
             <Text className="text-[#0F172A] text-lg font-bold flex-1 text-center mr-10">Chi tiết bảo dưỡng</Text>
         </View>
      </SafeAreaView>

      {/* BODY */}
      <ScrollView className="flex-1 px-4 pt-6" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
         {/* MAIN CARD */}
         <View className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
            <View className="flex-row items-start gap-5 mb-6">
                <View className="w-16 h-16 rounded-2xl bg-teal-50 items-center justify-center">
                    <MaterialIcons name={item.iconName || 'build'} size={36} color="#0D9488" />
                </View>
                <View className="flex-1">
                    <Text className="text-[#0F172A] text-2xl font-bold mb-2">{item.part_name}</Text>
                    <View className={`self-start px-3 py-1 rounded-lg ${statusBg}`}>
                        <Text className={`${statusColor} text-xs font-bold`}>{statusText}</Text>
                    </View>
                </View>
            </View>

            {/* Health Bar */}
            <View className="mb-6">
                <View className="flex-row justify-between items-end mb-2">
                    <Text className="text-sm font-medium text-slate-500">Độ bền còn lại</Text>
                    <Text className="text-teal-600 font-bold text-lg">{healthPercent.toFixed(0)}%</Text>
                </View>
                <View className="w-full bg-slate-100 rounded-full h-4 mb-2 overflow-hidden">
                    <View className="bg-teal-500 h-4 rounded-full" style={{ width: `${healthPercent}%` }} />
                </View>
                <View className="flex-row justify-between">
                    <Text className="text-slate-400 text-xs">Thay thế khi về 0%</Text>
                    <Text className="text-slate-400 text-xs">Đã đi {(item.progressPercent * item.interval_km / 100).toLocaleString()} km</Text>
                </View>
            </View>

            {/* Info Grid */}
            <View className="flex-row border-t border-slate-100 pt-4">
                <View className="flex-1">
                    <Text className="text-xs text-slate-400 uppercase font-bold mb-1">Chu kỳ chuẩn</Text>
                    <Text className="text-slate-900 font-bold text-base">{item.interval_km.toLocaleString()} km</Text>
                </View>
                <View className="flex-1 items-end">
                    <Text className="text-xs text-slate-400 uppercase font-bold mb-1">Hạn kế tiếp</Text>
                    <Text className="text-teal-600 font-bold text-base">{item.nextDueOdo.toLocaleString()} km</Text>
                </View>
            </View>
         </View>

         {/* ABOUT SECTION */}
         <View className="px-2 mb-6">
            <Text className="text-[#0F172A] text-lg font-bold mb-2">Thông tin</Text>
            <Text className="text-slate-500 text-sm leading-relaxed">
                {item.note || item.description || "Bảo dưỡng định kỳ giúp xe vận hành êm ái và an toàn hơn."}
            </Text>
         </View>

         {/* HISTORY LIST */}
         <View className="px-2 pb-10">
            <Text className="text-[#0F172A] text-lg font-bold mb-3">Lịch sử thực hiện</Text>
            {loadingHistory ? (
                <ActivityIndicator color={COLORS.primary} />
            ) : history.length === 0 ? (
                <View className="p-4 bg-slate-50 rounded-xl border border-slate-100 border-dashed items-center">
                    <Text className="text-slate-400 text-sm">Chưa có lịch sử nào</Text>
                </View>
            ) : (
                <View className="gap-3">
                    {history.map((h: any) => (
                        <View key={h.id} className="bg-white p-4 rounded-xl border border-slate-100 flex-row items-center justify-between shadow-sm">
                            <View className="flex-row items-center gap-3">
                                <View className="w-10 h-10 rounded-full bg-slate-50 items-center justify-center">
                                    <MaterialIcons name="check-circle" size={20} color="#94A3B8" />
                                </View>
                                <View>
                                    <Text className="text-slate-900 font-bold text-sm">{new Date(h.created_at).toLocaleDateString('vi-VN')}</Text>
                                    <Text className="text-xs text-slate-400 mt-0.5">{h.performed_at_odo.toLocaleString()} km</Text>
                                </View>
                            </View>
                            <Text className="text-slate-900 font-semibold text-sm">{h.cost ? h.cost.toLocaleString() : 0} đ</Text>
                        </View>
                    ))}
                </View>
            )}
         </View>
      </ScrollView>

      {/* BOTTOM ACTION BAR */}
      <View className="absolute bottom-0 left-0 right-0 px-4 py-4 bg-white border-t border-slate-100 flex-row gap-3">
          <TouchableOpacity 
            className="flex-1 bg-white border border-slate-200 py-3.5 rounded-xl flex-row items-center justify-center gap-2 shadow-sm"
            onPress={handleOpenEdit} 
            disabled={configMutation.isPending}
          >
              <MaterialIcons name="edit" size={20} color="#0F172A" />
              <Text className="font-bold text-slate-900">Chỉnh sửa</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="flex-[1.5] bg-[#0F172A] py-3.5 rounded-xl flex-row items-center justify-center gap-2 shadow-lg shadow-teal-900/20"
            onPress={() => setShowLogModal(true)}
            disabled={logMutation.isPending}
          >
              <MaterialIcons name="add-task" size={20} color="white" />
              <Text className="font-bold text-white">Ghi nhật ký mới</Text>
          </TouchableOpacity>
      </View>

      {/* LOG NEW */}
      <Modal visible={showLogModal} transparent animationType="slide">
         <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
             <TouchableOpacity 
                className="flex-1 justify-end bg-black/50" 
                activeOpacity={1} 
                onPress={() => setShowLogModal(false)}
             >
                <View className="bg-white rounded-t-3xl p-6 shadow-2xl border-t border-slate-100" onStartShouldSetResponder={() => true}>
                    <View className="w-12 h-1 bg-slate-200 rounded-full self-center mb-6" />
                    <Text className="text-xl font-bold text-center mb-6 text-slate-900">Ghi nhật ký: {item.part_name}</Text>
                    
                    <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Chi phí (VNĐ)</Text>
                    <TextInput 
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-slate-900 font-bold mb-4" 
                        keyboardType="numeric" 
                        placeholder="0" 
                        value={cost} 
                        onChangeText={setCost} 
                    />
                    
                    <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Ghi chú</Text>
                    <TextInput 
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-24 text-slate-900 text-base mb-6 pt-3" 
                        multiline 
                        placeholder="Ghi chú thêm..." 
                        value={notes} 
                        onChangeText={setNotes} 
                        textAlignVertical="top" 
                    />

                    <TouchableOpacity 
                        onPress={() => logMutation.mutate()} 
                        disabled={logMutation.isPending}
                        className={`w-full h-12 rounded-xl items-center justify-center mb-2 ${logMutation.isPending ? 'bg-slate-300' : 'bg-[#0F172A]'}`}
                    >
                        {logMutation.isPending ? <ActivityIndicator color="white"/> : <Text className="text-white font-bold">Lưu lại</Text>}
                    </TouchableOpacity>
                </View>
             </TouchableOpacity>
         </KeyboardAvoidingView>
      </Modal>

      {/* EDIT CONFIG */}
      <Modal visible={showEditModal} transparent animationType="slide">
         <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
             <TouchableOpacity 
                className="flex-1 justify-end bg-black/50" 
                activeOpacity={1} 
                onPress={() => setShowEditModal(false)}
             >
                <View className="bg-white rounded-t-3xl p-6 shadow-2xl border-t border-slate-100" onStartShouldSetResponder={() => true}>
                    <View className="w-12 h-1 bg-slate-200 rounded-full self-center mb-6" />
                    <Text className="text-xl font-bold text-center mb-2 text-slate-900">Chỉnh sửa cấu hình</Text>
                    <Text className="text-xs text-center text-slate-500 mb-6 px-4">Thay đổi này chỉ áp dụng cho xe này.</Text>
                    
                    <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Tên hiển thị</Text>
                    <TextInput 
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-slate-900 font-bold mb-4" 
                        value={editName} 
                        onChangeText={setEditName} 
                    />
                    
                    <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Chu kỳ bảo dưỡng (km)</Text>
                    <TextInput 
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-slate-900 font-bold mb-6" 
                        keyboardType="numeric" 
                        value={editInterval} 
                        onChangeText={setEditInterval} 
                    />

                    <TouchableOpacity 
                        onPress={() => configMutation.mutate()} 
                        disabled={configMutation.isPending}
                        className={`w-full h-12 rounded-xl items-center justify-center mb-2 ${configMutation.isPending ? 'bg-slate-300' : 'bg-[#0F172A]'}`}
                    >
                        {configMutation.isPending ? <ActivityIndicator color="white"/> : <Text className="text-white font-bold">Lưu thay đổi</Text>}
                    </TouchableOpacity>
                </View>
             </TouchableOpacity>
         </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
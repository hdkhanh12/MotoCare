import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
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
import { useGlobalModal } from '../contexts/ModalContext';
import { supabase } from '../services/supabase';

async function fetchTemplateItems(vehicleId: string | null) {
  if (!vehicleId) return [];
  const { data: vehicle } = await supabase.from('user_vehicles').select('template_id').eq('id', vehicleId).single();
  if (vehicle?.template_id) {
      const { data: template } = await supabase.from('maintenance_templates').select('items').eq('id', vehicle.template_id).single();
      return template?.items || [];
  }
  return [];
}

async function saveMaintenanceLogApi(payload: any) {
  // Nếu có ID -> Update, không có -> Insert
  if (payload.id) {
      const { error } = await supabase.from('maintenance_history').update(payload).eq('id', payload.id);
      if (error) throw new Error(error.message);
  } else {
      const { id, ...insertPayload } = payload;
      const { error } = await supabase.from('maintenance_history').insert([insertPayload]);
      if (error) throw new Error(error.message);
  }
  return true;
}

// Helper lấy icon
const getIconName = (name: string) => {
    const n = name ? name.toLowerCase() : '';
    if (n.includes('dầu')) return 'water-drop';
    if (n.includes('phanh')) return 'build';
    if (n.includes('lốp')) return 'two-wheeler';
    return 'check-circle';
};

export default function AddServiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useGlobalModal();

  const isEditMode = params.mode === 'edit';
  
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [date] = useState(new Date());
  
  const [odo, setOdo] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedPart, setSelectedPart] = useState<any>(null);
  
  const [showPartPicker, setShowPartPicker] = useState(false);

  useEffect(() => {
    const loadInit = async () => {
        const vId = await AsyncStorage.getItem('last_selected_vehicle_id');
        setVehicleId(vId);

        // Nếu là chế độ Edit -> Fill dữ liệu cũ vào
        if (isEditMode) {
            setOdo(params.initialOdo as string || '');
            setCost(params.initialCost ? parseInt(params.initialCost as string).toLocaleString('vi-VN') : '');
            setNotes(params.initialNotes as string || '');
        } else {
             // Nếu là Add mới -> Lấy ODO hiện tại của xe để gợi ý
             if (vId) {
                 const { data } = await supabase.from('user_vehicles').select('current_odo').eq('id', vId).single();
                 if (data) setOdo(data.current_odo.toString());
             }
        }
    };
    loadInit();
  }, [isEditMode, params]);

  const { data: templateItems = [], isLoading: loadingTemplates } = useQuery({
      queryKey: ['template-items', vehicleId],
      queryFn: () => fetchTemplateItems(vehicleId),
      enabled: !!vehicleId,
  });

  const mutation = useMutation({
      mutationFn: saveMaintenanceLogApi,
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['maintenance-history'] });
          queryClient.invalidateQueries({ queryKey: ['vehicle-schedule-full'] });
          showSuccess("Thành công", isEditMode ? "Đã cập nhật phiếu dịch vụ." : "Đã thêm phiếu dịch vụ mới.");
          router.back();
      },
      onError: (err: any) => showError(err.message)
  });

  const handleSave = async () => {
      if (!odo) return showError("Vui lòng nhập số ODO");
      if (!cost) return showError("Vui lòng nhập chi phí");
      if (!selectedPart && !isEditMode) return showError("Vui lòng chọn loại dịch vụ");

      const { data: { user } } = await supabase.auth.getUser();
      
      const payload = {
          id: isEditMode ? params.id : undefined,
          user_id: user?.id,
          vehicle_id: vehicleId,
          service_rule_id: selectedPart?.id || null,
          performed_at_odo: parseInt(odo.replace(/\D/g, '')),
          cost: parseInt(cost.replace(/\D/g, '')),
          notes: notes,
          // created_at mặc định
      };

      mutation.mutate(payload);
  };

  // Format tiền tệ khi nhập
  const handleCostChange = (text: string) => {
      const number = parseInt(text.replace(/\D/g, '')) || 0;
      setCost(number.toLocaleString('vi-VN'));
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar style="dark" />
      
      {/* HEADER */}
      <SafeAreaView edges={['top']} className="bg-white z-10">
        <View className="px-4 py-3 flex-row items-center border-b border-slate-100">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center rounded-full bg-slate-50 border border-slate-100">
                <MaterialIcons name="arrow-back-ios" size={20} color="#0F172A" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
            <Text className="flex-1 text-center text-lg font-bold text-[#0F172A] mr-10">
                {isEditMode ? 'Cập nhật dịch vụ' : 'Thêm dịch vụ'}
            </Text>
        </View>
      </SafeAreaView>

      {/* BODY */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView 
            className="flex-1 px-4 py-6" 
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
        >
            
            {/* BASIC INFO */}
            <View className="mb-6">
                <View className="flex-row items-center gap-2 mb-3">
                    <MaterialIcons name="event-note" size={20} color="#14B8A6" />
                    <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">Thông tin cơ bản</Text>
                </View>

                {/* Date */}
                <View className="mb-4">
                    <Text className="text-sm font-medium text-slate-700 mb-2 ml-1">Ngày thực hiện</Text>
                    <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl h-14 px-4 shadow-sm">
                        <Text className="flex-1 text-base font-semibold text-slate-500">
                            {date.toLocaleDateString('vi-VN')}
                        </Text>
                        <MaterialIcons name="calendar-today" size={20} color="#94A3B8" />
                    </View>
                </View>

                {/* ODO */}
                <View>
                    <Text className="text-sm font-medium text-slate-700 mb-2 ml-1">Số ODO (km)</Text>
                    <View className="flex-row items-center bg-white border border-slate-200 rounded-xl h-14 px-4 shadow-sm focus:border-teal-500">
                        <TextInput 
                            className="flex-1 text-base font-semibold text-[#0F172A] h-full"
                            value={odo} 
                            onChangeText={setOdo}
                            keyboardType="numeric"
                            placeholder="Nhập số km..."
                        />
                        <View className="flex-row items-center gap-1">
                            <Text className="text-sm font-medium text-slate-400">km</Text>
                            <MaterialIcons name="speed" size={20} color="#94A3B8" />
                        </View>
                    </View>
                </View>
            </View>

            <View className="h-[1px] bg-slate-200 w-full mb-6" />

            {/* SERVICE DETAILS */}
            <View className="mb-24">
                <View className="flex-row items-center gap-2 mb-3">
                    <MaterialIcons name="build-circle" size={20} color="#14B8A6" />
                    <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">Chi tiết dịch vụ</Text>
                </View>

                {/* Service Type Picker */}
                <View className="mb-4">
                    <Text className="text-sm font-medium text-slate-700 mb-2 ml-1">Loại dịch vụ / Phụ tùng</Text>
                    <TouchableOpacity 
                        onPress={() => setShowPartPicker(true)}
                        className="flex-row items-center bg-white border border-slate-200 rounded-xl h-14 px-4 shadow-sm"
                        disabled={loadingTemplates}
                    >
                        {selectedPart ? (
                            <Text className="flex-1 text-base font-semibold text-[#0F172A]">{selectedPart.part_name}</Text>
                        ) : (
                            <Text className="flex-1 text-base font-medium text-slate-400">
                                {loadingTemplates ? "Đang tải danh sách..." : (isEditMode ? "(Giữ nguyên hoặc chọn mới)" : "Chọn dịch vụ...")}
                            </Text>
                        )}
                        <MaterialIcons name="expand-more" size={24} color="#94A3B8" />
                    </TouchableOpacity>
                </View>

                {/* Cost */}
                <View className="mb-4">
                    <Text className="text-sm font-medium text-slate-700 mb-2 ml-1">Tổng chi phí</Text>
                    <View className="flex-row items-center bg-white border border-slate-200 rounded-xl h-14 px-4 shadow-sm">
                        <TextInput 
                            className="flex-1 text-base font-semibold text-[#0F172A] h-full"
                            value={cost}
                            onChangeText={handleCostChange}
                            keyboardType="numeric"
                            placeholder="0"
                        />
                        <View className="flex-row items-center gap-1">
                            <Text className="text-sm font-medium text-slate-500">VNĐ</Text>
                            <MaterialIcons name="payments" size={20} color="#94A3B8" />
                        </View>
                    </View>
                </View>

                {/* Notes */}
                <View className="mb-4">
                    <Text className="text-sm font-medium text-slate-700 mb-2 ml-1">Ghi chú & Mô tả</Text>
                    <View className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm h-32">
                        <TextInput 
                            className="flex-1 text-base text-[#0F172A] h-full"
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                            textAlignVertical="top"
                            placeholder="Ghi chú thêm về thợ sửa, tình trạng phụ tùng cũ..."
                        />
                    </View>
                </View>
            </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FOOTER BUTTON */}
      <View className="p-4 bg-white border-t border-slate-100 pb-8">
          <TouchableOpacity 
              onPress={handleSave}
              disabled={mutation.isPending}
              className={`w-full h-14 rounded-xl flex-row items-center justify-center gap-2 shadow-lg shadow-teal-900/20 ${mutation.isPending ? 'bg-slate-300' : 'bg-[#0F172A]'}`}
          >
              <MaterialIcons name="save" size={24} color="white" />
              <Text className="text-white font-bold text-lg">
                  {mutation.isPending ? 'Đang lưu...' : (isEditMode ? 'Cập Nhật Hồ Sơ' : 'Lưu Hồ Sơ')}
              </Text>
          </TouchableOpacity>
      </View>

      {/* MODAL: SELECT SERVICE TYPE */}
      <Modal visible={showPartPicker} animationType="slide" transparent>
          <View className="flex-1 bg-black/50 justify-end">
              <View className="bg-white rounded-t-3xl h-[70%]">
                  <View className="p-4 border-b border-slate-100 flex-row justify-between items-center">
                      <Text className="text-lg font-bold text-[#0F172A]">Chọn loại dịch vụ</Text>
                      <TouchableOpacity onPress={() => setShowPartPicker(false)}>
                          <MaterialIcons name="close" size={24} color="#64748B" />
                      </TouchableOpacity>
                  </View>
                  
                  <FlatList 
                      data={templateItems}
                      keyExtractor={(item) => item.id.toString()}
                      contentContainerStyle={{ padding: 16 }}
                      renderItem={({ item }) => (
                          <TouchableOpacity 
                              onPress={() => {
                                  setSelectedPart(item);
                                  setShowPartPicker(false);
                              }}
                              className="flex-row items-center p-4 border-b border-slate-50 active:bg-slate-50"
                          >
                              <View className="w-10 h-10 rounded-full bg-teal-50 items-center justify-center mr-3">
                                  <MaterialIcons name={getIconName(item.part_name) as any} size={20} color="#0D9488" />
                              </View>
                              <View className="flex-1">
                                  <Text className="text-[#0F172A] font-bold text-base">{item.part_name}</Text>
                                  <Text className="text-slate-400 text-xs">Chu kỳ: {item.schedule?.interval_km ? `${item.schedule.interval_km} km` : 'Theo thời gian'}</Text>
                              </View>
                              {selectedPart?.id === item.id && <MaterialIcons name="check" size={24} color="#0D9488" />}
                          </TouchableOpacity>
                      )}
                  />
              </View>
          </View>
      </Modal>
    </View>
  );
}
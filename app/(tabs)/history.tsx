import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    RefreshControl,
    SectionList,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { COLORS } from '../../constants/Colors';
import { useGlobalModal } from '../../contexts/ModalContext';
import { supabase } from '../../services/supabase';

// --- HELPER FUNCTIONS ---

const getStyleForPart = (name: string) => {
  const n = name ? name.toLowerCase() : '';
  if (n.includes('dầu') || n.includes('nhớt')) return { icon: 'water-drop', color: 'text-blue-600', bg: 'bg-blue-50', type: 'Định kỳ' };
  if (n.includes('phanh') || n.includes('thắng')) return { icon: 'build', color: 'text-orange-600', bg: 'bg-orange-50', type: 'Sửa chữa' };
  if (n.includes('đèn') || n.includes('lốp')) return { icon: 'two-wheeler', color: 'text-purple-600', bg: 'bg-purple-50', type: 'Nâng cấp' };
  return { icon: 'check-circle', color: 'text-teal-600', bg: 'bg-teal-50', type: 'Bảo dưỡng' };
};

async function fetchMaintenanceHistory(vehicleId: string | null) {
    if (!vehicleId) return [];
    
    // 1. Lấy thông tin xe để biết template_id
    const { data: vehicle } = await supabase.from('user_vehicles').select('template_id').eq('id', vehicleId).single();
    
    // 2. Lấy danh sách template items (để map tên phụ tùng từ ID)
    let templateItems: any[] = [];
    if (vehicle?.template_id) {
        const { data: template } = await supabase.from('maintenance_templates').select('items').eq('id', vehicle.template_id).single();
        if (template?.items) templateItems = template.items;
    }

    // 3. Lấy lịch sử
    const { data: historyData, error } = await supabase
        .from('maintenance_history')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    if (historyData) {
        return historyData.map((hItem: any) => {
            // Tìm tên phụ tùng dựa trên service_rule_id
            const ruleDetail = templateItems.find((t: any) => t.id === hItem.service_rule_id);
            // Nếu không tìm thấy, dùng tên mặc định hoặc logic khác
            const partName = ruleDetail ? ruleDetail.part_name : (hItem.notes || 'Bảo dưỡng khác');
            
            const style = getStyleForPart(partName);
            return { ...hItem, partName, style };
        });
    }
    return [];
}

async function deleteHistoryItemApi(id: number) {
    const { error } = await supabase.from('maintenance_history').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return id;
}


export default function HistoryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showConfirm, showSuccess, showError } = useGlobalModal();

  // State UI
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // --- QUERY DATA ---
  const [vehicleId, setVehicleId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
        AsyncStorage.getItem('last_selected_vehicle_id').then(setVehicleId);
    }, [])
  );

  const { data: rawData = [], isLoading, refetch } = useQuery({
      queryKey: ['maintenance-history', vehicleId],
      queryFn: () => fetchMaintenanceHistory(vehicleId), 
      enabled: !!vehicleId,
  });

  const deleteMutation = useMutation({
      mutationFn: deleteHistoryItemApi,
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['maintenance-history', vehicleId] });
          setShowActionModal(false);
          showSuccess("Đã xóa", "Dữ liệu đã được xóa khỏi hệ thống.");
      },
      onError: (err) => showError(err.message || "Không thể xóa mục này")
  });

  // --- DATA PROCESSING (MEMO) ---
  const stats = useMemo(() => {
      return {
          totalCount: rawData.length,
          lastDate: rawData.length > 0 ? new Date(rawData[0].created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: '2-digit' }) : 'Chưa có'
      };
  }, [rawData]);

  const availableMonths = useMemo(() => {
      const months = new Set<string>();
      rawData.forEach(item => {
          try {
             const date = new Date(item.created_at);
             months.add(`${date.getMonth() + 1}/${date.getFullYear()}`);
          } catch (e) {}
      });
      return Array.from(months);
  }, [rawData]);

  const sections = useMemo(() => {
      let filtered = rawData;
      if (selectedMonth !== 'all') {
          filtered = rawData.filter(item => {
              const date = new Date(item.created_at);
              return `${date.getMonth() + 1}/${date.getFullYear()}` === selectedMonth;
          });
      }
      const groups: { [key: string]: any[] } = {};
      filtered.forEach(item => {
        const date = new Date(item.created_at);
        const key = `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });
      return Object.keys(groups).map(key => ({ title: key, data: groups[key] }));
  }, [rawData, selectedMonth]);


  // --- HANDLERS ---
  const handleOpenAction = (item: any) => {
      setSelectedItem(item);
      setShowActionModal(true);
  };

  const handleEdit = () => {
      setShowActionModal(false);
      if (selectedItem) {
          router.push({
              pathname: '/add-service',
              params: { 
                  mode: 'edit',
                  id: selectedItem.id,
                  initialCost: selectedItem.cost?.toString(),
                  initialNotes: selectedItem.notes,
                  initialOdo: selectedItem.performed_at_odo?.toString(),
              }
          });
      }
  };

  const handleDelete = () => {
    setShowActionModal(false);
    if (!selectedItem) return;

    showConfirm(
        "Xóa lịch sử",
        "Bạn có chắc muốn xóa bản ghi này? Hành động này không thể hoàn tác.",
        () => deleteMutation.mutate(selectedItem.id)
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const dateStr = new Date(item.created_at).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' });
    const { icon, color, bg, type } = item.style;
    
    return (
      <TouchableOpacity 
          onPress={() => handleOpenAction(item)}
          activeOpacity={0.7} 
          className="bg-white p-4 rounded-2xl mb-3 border border-slate-100 shadow-sm mx-4"
      >
        <View className="flex-row justify-between items-start mb-3">
            <View className="flex-row items-center gap-3">
                <View className={`w-12 h-12 rounded-xl items-center justify-center ${bg}`}>
                    <MaterialIcons name={icon as any} size={24} className={color.replace('text-', '')} color={color === 'text-blue-600' ? '#2563EB' : (color === 'text-orange-600' ? '#EA580C' : '#0D9488')} />
                </View>
                <View>
                    <Text className="text-[#0F172A] text-base font-bold leading-tight">{item.partName}</Text>
                    <Text className="text-slate-400 text-xs font-normal mt-0.5">{dateStr}</Text>
                </View>
            </View>
            <View className="items-end">
                <Text className="text-[#0F172A] text-base font-bold">{item.cost ? item.cost.toLocaleString() : '0'} ₫</Text>
                <View className="flex-row items-center gap-1 mt-1">
                    <View className={`w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')}`} />
                    <Text className={`text-xs font-medium ${color}`}>{type}</Text>
                </View>
            </View>
        </View>
        <View className="h-[1px] w-full bg-slate-100 my-2" />
        <View className="flex-row justify-between items-center mt-1">
            <View className="flex-row items-center gap-1.5">
                <MaterialIcons name="speed" size={18} color="#64748B" />
                <Text className="text-sm font-medium text-slate-600 font-mono">{item.performed_at_odo?.toLocaleString()} km</Text>
            </View>
            <Text className="text-slate-400 text-sm" numberOfLines={1}>{item.notes || 'Không có ghi chú'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar style="dark" />

      {/* HEADER BAR */}
      <View className="bg-white/95 pt-12 pb-4 px-4 border-b border-slate-100 flex-row items-center justify-between z-10">
          <View className="w-10" />
          <Text className="text-[#0F172A] text-lg font-bold flex-1 text-center">Lịch sử dịch vụ</Text>
          <View className="w-10" />
      </View>

      {/* LIST CONTENT */}
      {isLoading && !rawData.length ? (
        <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <SectionList
            sections={sections}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            renderSectionHeader={({ section: { title } }) => (
                <View className="flex-row items-center gap-2 mt-2 mb-2 px-4 bg-[#F8FAFC]">
                    <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</Text>
                    <View className="h-[1px] bg-slate-200 flex-1" />
                </View>
            )}
            stickySectionHeadersEnabled={false}
            ListHeaderComponent={
                <View className="px-4 py-4 mb-2">
                    {/* Stats Cards */}
                    <View className="flex-row gap-3 mb-5">
                        <View className="flex-1 rounded-xl p-4 bg-white border border-slate-100 shadow-sm">
                            <View className="flex-row items-center gap-2 mb-1">
                                <MaterialIcons name="history" size={20} color="#14B8A6" />
                                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Tổng dịch vụ</Text>
                            </View>
                            <Text className="text-[#0F172A] text-2xl font-bold">{stats.totalCount}</Text>
                        </View>
                        <View className="flex-1 rounded-xl p-4 bg-white border border-slate-100 shadow-sm">
                            <View className="flex-row items-center gap-2 mb-1">
                                <MaterialIcons name="event-available" size={20} color="#14B8A6" />
                                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Lần cuối</Text>
                            </View>
                            <Text className="text-[#0F172A] text-xl font-bold">{stats.lastDate}</Text>
                        </View>
                    </View>

                    {/* Filter Bar */}
                    <View className="flex-row items-center justify-between">
                        <Text className="text-[#0F172A] text-base font-bold">Mốc thời gian</Text>
                        <TouchableOpacity 
                            onPress={() => setShowFilterModal(true)}
                            className="flex-row items-center bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm active:bg-slate-50"
                        >
                             <Text className="text-slate-600 text-xs font-bold mr-1">
                                {selectedMonth === 'all' ? 'Tất cả' : selectedMonth}
                             </Text>
                             <MaterialIcons name="keyboard-arrow-down" size={20} color="#64748B" />
                        </TouchableOpacity>
                    </View>
                </View>
            }
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />}
            ListEmptyComponent={
                <View className="items-center justify-center mt-20">
                    <MaterialIcons name="history" size={80} color="#E2E8F0" />
                    <Text className="text-slate-400 mt-4 font-medium">Không tìm thấy dữ liệu</Text>
                </View>
            }
        />
      )}

      {/* FAB */}
      <TouchableOpacity 
          onPress={() => router.push('/add-service')}
          activeOpacity={0.8}
          className="absolute bottom-6 right-6 z-40 w-14 h-14 bg-[#0F172A] rounded-full items-center justify-center shadow-lg shadow-slate-400"
      >
          <MaterialIcons name="add" size={32} color="white" />
      </TouchableOpacity>

      {/* FILTER MODAL */}
      <Modal visible={showFilterModal} transparent animationType="slide">
        <TouchableOpacity 
            className="flex-1 bg-black/50 justify-end"
            activeOpacity={1}
            onPress={() => setShowFilterModal(false)}
        >
            <View className="bg-white rounded-t-3xl h-[40%]">
                <View className="p-4 border-b border-slate-100 flex-row justify-between items-center">
                    <Text className="text-lg font-bold text-[#0F172A]">Lọc theo thời gian</Text>
                    <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                        <MaterialIcons name="close" size={24} color="#64748B" />
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={['all', ...availableMonths]}
                    keyExtractor={(item) => item.toString()}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            onPress={() => { setSelectedMonth(item); setShowFilterModal(false); }}
                            className={`p-4 border-b border-slate-50 flex-row justify-between items-center ${selectedMonth === item ? 'bg-teal-50' : ''}`}
                        >
                            <Text className={`font-medium ${selectedMonth === item ? 'text-teal-700 font-bold' : 'text-slate-700'}`}>
                                {item === 'all' ? 'Tất cả thời gian' : `Tháng ${item}`}
                            </Text>
                            {selectedMonth === item && <MaterialIcons name="check" size={24} color={COLORS.primary} />}
                        </TouchableOpacity>
                    )}
                />
            </View>
        </TouchableOpacity>
      </Modal>

      {/* ACTION MODAL (SỬA / XÓA) */}
      <Modal visible={showActionModal} transparent animationType="fade">
        <TouchableOpacity 
            className="flex-1 bg-black/60 justify-end"
            activeOpacity={1}
            onPress={() => setShowActionModal(false)}
        >
            <View className="bg-white m-4 rounded-2xl overflow-hidden mb-8" onStartShouldSetResponder={() => true}>
                {/* Header */}
                <View className="py-3 items-center border-b border-slate-100 bg-slate-50">
                    <Text className="text-slate-500 font-bold text-xs uppercase tracking-wider">Tùy chọn bản ghi</Text>
                    <Text className="text-slate-800 font-bold mt-1 px-4 text-center">{selectedItem?.partName}</Text>
                </View>

                {/* Nút Sửa */}
                <TouchableOpacity onPress={handleEdit} className="p-4 flex-row items-center justify-center border-b border-slate-100 active:bg-slate-50">
                    <MaterialIcons name="edit" size={22} color="#2563EB" />
                    <Text className="text-slate-700 font-bold text-base ml-2">Chỉnh sửa thông tin</Text>
                </TouchableOpacity>

                {/* Nút Xóa */}
                <TouchableOpacity onPress={handleDelete} className="p-4 flex-row items-center justify-center active:bg-red-50">
                    <MaterialIcons name="delete-outline" size={22} color="#EF4444" />
                    <Text className="text-red-600 font-bold text-base ml-2">Xóa bản ghi này</Text>
                </TouchableOpacity>
            </View>

            {/* Nút Hủy */}
            <TouchableOpacity onPress={() => setShowActionModal(false)} className="bg-white mx-4 mb-6 p-4 rounded-2xl items-center active:bg-slate-50">
                <Text className="text-slate-800 font-bold text-base">Hủy bỏ</Text>
            </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}
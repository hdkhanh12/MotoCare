import { MaterialIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'; // Import Hooks
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/Colors';
import { useGlobalModal } from '../contexts/ModalContext';
import { supabase } from '../services/supabase';

// Lấy danh sách thông báo từ Supabase
async function fetchNotifications() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập");

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }); // Mới nhất lên đầu

  if (error) throw error;
  return data || [];
}

// Xóa tất cả thông báo
async function deleteAllNotificationsApi() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);
  return true;
}

// Đánh dấu đã đọc
async function markReadApi(id: string) {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
    if (error) console.error("Lỗi mark read:", error);
}

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useGlobalModal();
  
  const { 
    data: notifications = [], 
    isLoading,
    refetch,
    isRefetching
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [])
  );

  // Xóa hết
  const deleteMutation = useMutation({
    mutationFn: deleteAllNotificationsApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      
      showSuccess(
          "Thành công", 
          "Đã xóa tất cả thông báo khỏi hệ thống."
      );
    },
    onError: (err: any) => {
      showError(err.message || "Không thể xóa thông báo.");
    }
  });

  // Đánh dấu đã đọc
  const readMutation = useMutation({
      mutationFn: markReadApi,
      onSuccess: () => {
        // Khi đánh dấu xong, refresh lại cache để UI cập nhật
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
  });

  const handleClearAll = () => {
    if (notifications.length === 0) return;

    showConfirm(
      "Xóa thông báo",
      "Bạn có chắc muốn xóa tất cả thông báo không? Hành động này không thể hoàn tác.",
      () => {
         deleteMutation.mutate();
      }
    );
  };

  const handlePressItem = (item: any) => {
      if (!item.is_read) {
          readMutation.mutate(item.id);
      }
  };

  const renderItem = ({ item }: { item: any }) => {
    // Logic màu sắc icon dựa trên loại tin
    let iconName = 'notifications';
    let iconColor = 'bg-blue-100 text-blue-600';
    
    if (item.type === 'warning') { iconName = 'warning'; iconColor = 'bg-amber-100 text-amber-600'; }
    if (item.type === 'success') { iconName = 'check-circle'; iconColor = 'bg-teal-100 text-teal-600'; }
    if (item.type === 'maintenance') { iconName = 'build'; iconColor = 'bg-indigo-100 text-indigo-600'; }

    // Format time
    const timeStr = new Date(item.created_at).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    return (
        <TouchableOpacity 
            onPress={() => handlePressItem(item)}
            className={`flex-row p-4 border-b border-slate-50 ${item.is_read ? 'bg-white' : 'bg-blue-50/30'}`}
        >
            {/* Icon */}
            <View className={`w-12 h-12 rounded-full items-center justify-center mr-3 ${iconColor.split(' ')[0]}`}>
                <MaterialIcons 
                    name={iconName as any} 
                    size={24} 
                    color={iconColor.includes('amber') ? '#D97706' : (iconColor.includes('teal') ? '#0D9488' : (iconColor.includes('indigo') ? '#4F46E5' : '#2563EB'))} 
                />
            </View>
            
            {/* Nội dung text */}
            <View className="flex-1">
                <View className="flex-row justify-between mb-1">
                    <Text className={`text-base flex-1 mr-2 ${item.is_read ? 'font-semibold text-slate-700' : 'font-bold text-[#0F172A]'}`} numberOfLines={1}>
                        {item.title}
                    </Text>
                    <Text className="text-xs text-slate-400 mt-1">{timeStr}</Text>
                </View>
                <Text className="text-sm text-slate-500 leading-5" numberOfLines={2}>{item.message}</Text>
            </View>

            {/* Chấm đỏ báo chưa đọc */}
            {!item.is_read && <View className="w-2.5 h-2.5 bg-blue-600 rounded-full mt-2 ml-2" />}
        </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} className="flex-1">
        
        {/* HEADER BAR */}
        <View className="px-4 py-3 flex-row items-center border-b border-slate-100 bg-white">
            <TouchableOpacity 
                onPress={() => router.back()} 
                className="w-10 h-10 items-center justify-center rounded-full bg-slate-50"
            >
                <MaterialIcons name="arrow-back-ios" size={20} color="#0F172A" style={{ marginLeft: 6 }} />
            </TouchableOpacity>

            <Text className="flex-1 text-center text-lg font-bold text-[#0F172A]">Thông báo</Text>

            <TouchableOpacity 
                onPress={handleClearAll}
                disabled={deleteMutation.isPending || notifications.length === 0}
                className="w-10 h-10 items-center justify-center rounded-full active:bg-red-50"
            >
                {deleteMutation.isPending ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                    <MaterialIcons name="delete-outline" size={24} color={notifications.length > 0 ? "#EF4444" : "#CBD5E1"} />
                )}
            </TouchableOpacity>
        </View>

        {/* LIST */}
        {isLoading && !isRefetching ? (
             <View className="flex-1 items-center justify-center"><ActivityIndicator color={COLORS.primary} /></View>
        ) : (
            <FlatList 
                data={notifications}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: 20 }}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[COLORS.primary]} />
                }
                ListEmptyComponent={
                    <View className="items-center justify-center mt-20 px-10">
                        <View className="w-20 h-20 bg-slate-50 rounded-full items-center justify-center mb-4">
                            <MaterialIcons name="notifications-none" size={40} color="#CBD5E1" />
                        </View>
                        <Text className="text-slate-900 font-bold text-lg mb-1">Không có thông báo</Text>
                        <Text className="text-slate-400 text-center">Bạn đã đọc hết các thông báo quan trọng.</Text>
                    </View>
                }
            />
        )}
      </SafeAreaView>
    </View>
  );
}
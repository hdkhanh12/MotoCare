import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query'; // 2. Import Hooks
import { Image } from 'expo-image'; // 1. Import Image từ expo-image
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants/Colors';
import { useGlobalModal } from '../../contexts/ModalContext';
import { supabase } from '../../services/supabase';

// Hàm lấy thông tin User & Profile
async function fetchUserProfile() {
  // Lấy user hiện tại từ Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập");

  // Query bảng 'profiles'
  const { data: profileData, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') { // Bỏ qua lỗi nếu chưa có profile row
     console.error("Error fetching profile:", error);
  }

  // Xử lý logic hiển thị tên
  const fullName = profileData?.full_name 
      || user.user_metadata?.full_name 
      || user.email?.split('@')[0];
  
  const joinedYear = new Date(user.created_at).getFullYear();

  // Trả về object dữ liệu đã xử lý
  return {
    name: fullName,
    email: user.email,
    joinedAt: `Thành viên từ ${joinedYear}`,
    avatar_url: profileData?.avatar_url 
      ? `${profileData.avatar_url}?t=${new Date().getTime()}` 
      : null,
  };
}

// Hàm lấy danh sách xe
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

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [isDarkMode, setIsDarkMode] = useState(false); 

  const { showConfirm, showSuccess, showError } = useGlobalModal();

  const { 
    data: userInfo, 
    isLoading: isProfileLoading, 
    refetch: refetchProfile 
  } = useQuery({
    queryKey: ['user-profile'],
    queryFn: fetchUserProfile,
    // Giá trị mặc định ban đầu để tránh crash UI
    initialData: { name: 'Đang tải...', email: '', joinedAt: '', avatar_url: null } 
  });

  const { 
    data: vehicles, 
    isLoading: isVehiclesLoading, 
    refetch: refetchVehicles 
  } = useQuery({
    queryKey: ['user-vehicles'], // Dùng chung key với HomeScreen để tận dụng cache
    queryFn: fetchUserVehicles,
    initialData: []
  });

  // Refetch khi màn hình được focus (quay lại từ trang edit)
  useFocusEffect(
    useCallback(() => {
        refetchProfile();
        refetchVehicles();
    }, [refetchProfile, refetchVehicles])
  );

  const onRefresh = async () => {
    await Promise.all([refetchProfile(), refetchVehicles()]);
  };

  const handleLogout = () => {
      showConfirm(
          "Đăng xuất",
          "Bạn có chắc chắn muốn đăng xuất?",
          async () => {
              try {
                  await supabase.auth.signOut();
                  await AsyncStorage.clear();
                  queryClient.clear();
                  router.replace('/auth');
              } catch (error) {
                  console.error("Lỗi đăng xuất:", error);
              }
          },
          "Đăng xuất"
      );
  };

  const isLoading = isProfileLoading || isVehiclesLoading;

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      {/* HEADER BAR */}
      <View className="bg-white/95 pt-12 pb-4 px-4 border-b border-slate-100 flex-row items-center justify-between z-10">
          <View className="w-10" />
          <Text className="text-[#0F172A] text-lg font-bold flex-1 text-center">
              Hồ sơ cá nhân
          </Text>
          <View className="w-10" /> 
      </View>

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
      >
          
          {/* PROFILE HEADER */}
          <View className="items-center py-8">
              <View className="relative">
                  <View className="w-28 h-28 rounded-full bg-slate-200 border-4 border-white shadow-md items-center justify-center overflow-hidden">
            
                        {userInfo?.avatar_url ? (
                            <Image 
                                source={{ uri: userInfo.avatar_url }} 
                                className="w-full h-full" 
                                contentFit="cover"
                                cachePolicy="memory-disk"
                                transition={500}
                            />
                        ) : (
                            <Text className="text-4xl font-bold text-slate-400">
                                {userInfo?.name?.charAt(0).toUpperCase() || "U"}
                            </Text>
                        )}

                    </View>
                  <TouchableOpacity 
                      onPress={() => router.push('/edit-profile')} 
                      className="absolute bottom-0 right-0 bg-teal-500 w-8 h-8 rounded-full items-center justify-center border-2 border-white"
                  >
                      <MaterialIcons name="edit" size={14} color="white" />
                  </TouchableOpacity>
              </View>
              <Text className="text-xl font-bold text-[#0F172A] mt-4">{userInfo?.name}</Text>
              <Text className="text-slate-500 text-sm font-medium mt-1">{userInfo?.joinedAt}</Text>
          </View>

          {/* MY GARAGE SECTION */}
          <View className="px-5 mb-6">
              <Text className="text-lg font-bold text-[#0F172A] mb-3">Gara của tôi</Text>
              
              <View className="gap-3">
                  {/* Danh sách xe từ React Query Data */}
                    {vehicles && vehicles.map((v: any) => (
                        <TouchableOpacity 
                            key={v.id} 
                            onPress={() => router.push({ pathname: '/edit-vehicle', params: { id: v.id } })}
                            activeOpacity={0.7}
                            className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex-row items-center gap-4"
                        >
                            <View className="w-20 h-20 bg-slate-100 rounded-lg items-center justify-center overflow-hidden">
                                {v.image_url ? (
                                    <Image 
                                        source={{ uri: v.image_url }} 
                                        className="w-full h-full" 
                                        contentFit="cover"
                                        cachePolicy="memory-disk"
                                        transition={500}
                                    />
                                ) : (
                                    <MaterialIcons name="two-wheeler" size={40} color="#CBD5E1" />
                                )}
                            </View>
                            <View className="flex-1">
                                <Text className="font-bold text-[#0F172A] text-base">{v.model}</Text>
                                <Text className="text-slate-500 text-sm mb-2 font-medium uppercase">
                                    {v.plate_number || 'Chưa cập nhật biển'}
                                </Text>
                                <View className="flex-row items-center gap-1">
                                    <View className="w-2 h-2 rounded-full bg-teal-500" />
                                    <Text className="text-teal-600 text-xs font-bold uppercase">Hoạt động tốt</Text>
                                </View>
                            </View>
                            
                            <View className="w-8 h-8 items-center justify-center rounded-full bg-slate-50">
                                <MaterialIcons name="chevron-right" size={24} color="#94A3B8" />
                            </View>
                        </TouchableOpacity>
                    ))}

                  {/* Nút thêm xe */}
                  <TouchableOpacity 
                    onPress={() => router.push('/onboarding')}
                    className="w-full h-12 rounded-xl border-2 border-dashed border-teal-500/30 bg-teal-50/50 flex-row items-center justify-center gap-2 active:bg-teal-50"
                  >
                      <MaterialIcons name="add-circle-outline" size={20} color={COLORS.primary} />
                      <Text className="text-teal-700 font-bold text-sm">Thêm xe mới</Text>
                  </TouchableOpacity>
              </View>
          </View>

          {/* GENERAL SETTINGS */}
          <View className="px-5 mb-6">
              <Text className="text-lg font-bold text-[#0F172A] mb-3">Cài đặt chung</Text>
              <View className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  
                  <TouchableOpacity 
                      onPress={() => router.push('/edit-profile')}
                      className="flex-row items-center p-4 border-b border-slate-50 active:bg-slate-50"
                  >
                      <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-3">
                          <MaterialIcons name="person" size={20} color="#2563EB" />
                      </View>
                      <Text className="flex-1 font-semibold text-[#0F172A] text-sm">Thông tin tài khoản</Text>
                      <MaterialIcons name="chevron-right" size={24} color="#94A3B8" />
                  </TouchableOpacity>

                  <TouchableOpacity 
                      onPress={() => router.push('/notifications')}
                      className="flex-row items-center p-4 border-b border-slate-50 active:bg-slate-50"
                  >
                      <View className="w-10 h-10 rounded-full bg-purple-50 items-center justify-center mr-3">
                          <MaterialIcons name="notifications" size={20} color="#9333EA" />
                      </View>
                      <Text className="flex-1 font-semibold text-[#0F172A] text-sm">Thông báo</Text>
                      <MaterialIcons name="chevron-right" size={24} color="#94A3B8" />
                  </TouchableOpacity>

                  <View className="flex-row items-center p-4 active:bg-slate-50">
                        <View className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center mr-3">
                            <MaterialIcons name="dark-mode" size={20} color="#FACC15" />
                        </View>
                        
                        <View className="flex-1">
                            <Text className="font-semibold text-[#0F172A] text-sm">Chế độ tối</Text>
                            <Text className="text-xs text-slate-400">Sắp ra mắt</Text>
                        </View>

                        <Switch 
                            value={false}
                            onValueChange={() => {
                                showSuccess(
                                    "Thông báo", 
                                    "Tính năng Chế độ tối (Dark Mode) đang được phát triển và sẽ sớm cập nhật!"
                                );
                            }}
                            trackColor={{ false: "#E2E8F0", true: "#0F172A" }}
                            thumbColor={"#fff"}
                        />
                    </View>
              </View>
          </View>

          {/* SUPPORT & LEGAL */}
          <View className="px-5 mb-8">
              <Text className="text-lg font-bold text-[#0F172A] mb-3">Hỗ trợ</Text>
              <View className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                
                  {/* Nút Trung tâm trợ giúp */}
                  <TouchableOpacity 
                      onPress={() => showSuccess(
                          "Sắp ra mắt", 
                          "Tính năng Trung tâm trợ giúp đang được phát triển và sẽ sớm có mặt trong bản cập nhật tới!"
                      )}
                      className="flex-row items-center p-4 border-b border-slate-50 active:bg-slate-50"
                  >
                      <View className="w-10 h-10 rounded-full bg-orange-50 items-center justify-center mr-3">
                          <MaterialIcons name="help" size={20} color="#EA580C" />
                      </View>
                      <Text className="flex-1 font-semibold text-[#0F172A] text-sm">Trung tâm trợ giúp</Text>
                      <MaterialIcons name="chevron-right" size={24} color="#94A3B8" />
                  </TouchableOpacity>
                
                  {/* Nút Điều khoản sử dụng */}
                  <TouchableOpacity 
                      onPress={() => showSuccess(
                          "Sắp ra mắt", 
                          "Chúng tôi đang soạn thảo các điều khoản để bảo vệ quyền lợi của bạn. Quay lại sau nhé!"
                      )}
                      className="flex-row items-center p-4 active:bg-slate-50"
                  >
                      <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center mr-3">
                          <MaterialIcons name="description" size={20} color="#475569" />
                      </View>
                      <Text className="flex-1 font-semibold text-[#0F172A] text-sm">Điều khoản sử dụng</Text>
                      <MaterialIcons name="chevron-right" size={24} color="#94A3B8" />
                  </TouchableOpacity>
              </View>
          </View>

          {/* LOGOUT */}
          <View className="px-5 mb-10">
              <TouchableOpacity 
                onPress={handleLogout}
                className="w-full h-14 rounded-xl bg-red-50 flex-row items-center justify-center gap-2 active:bg-red-100"
              >
                  <MaterialIcons name="logout" size={20} color="#EF4444" />
                  <Text className="text-red-600 font-bold text-sm">Đăng xuất</Text>
              </TouchableOpacity>
          </View>

      </ScrollView>
    </View>
  );
}
import { MaterialIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

// Lấy thông tin Profile
async function fetchUserProfileApi() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập");

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return {
    id: user.id,
    email: user.email,
    full_name: profile?.full_name || user.user_metadata?.full_name || '',
    phone: profile?.phone || user.user_metadata?.phone || '',
    avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || null,
  };
}

// Upload Avatar
async function uploadAvatarApi({ userId, base64Data }: { userId: string, base64Data: string }) {
  const fileName = `${userId}/${Date.now()}.jpg`;
  
  const { error } = await supabase.storage
    .from('avatars')
    .upload(fileName, decode(base64Data), {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
  return data.publicUrl;
}

// Cập nhật Profile
async function updateProfileApi(payload: { id: string, full_name: string, phone: string, avatar_url: string | null }) {
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
        id: payload.id,
        full_name: payload.full_name,
        avatar_url: payload.avatar_url,
        phone: payload.phone,
        updated_at: new Date(),
    });

  if (profileError) throw new Error(profileError.message);

  const { error: authError } = await supabase.auth.updateUser({
    data: {
      full_name: payload.full_name,
      avatar_url: payload.avatar_url,
      phone: payload.phone
    }
  });

  if (authError) throw new Error(authError.message);
  return true;
}


export default function EditProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const { showSuccess, showError } = useGlobalModal();

  const { data: userProfile, isLoading: isFetching } = useQuery({
    queryKey: ['user-profile-edit'],
    queryFn: fetchUserProfileApi,
  });

  useEffect(() => {
    if (userProfile) {
      setEmail(userProfile.email || '');
      setFullName(userProfile.full_name);
      setPhone(userProfile.phone);
      setAvatarUrl(userProfile.avatar_url);
    }
  }, [userProfile]);

  const uploadMutation = useMutation({
    mutationFn: uploadAvatarApi,
    onSuccess: (newUrl) => {
      setAvatarUrl(newUrl);
    },
    onError: (err) => showError(err.message || "Lỗi Upload"),
  });

  const saveMutation = useMutation({
    mutationFn: updateProfileApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      showSuccess(
        "Cập nhật thành công!",
        `Hồ sơ của bạn đã được lưu.\nTên hiển thị: ${fullName}`,
        () => { router.back(); }
      );
    },
    onError: (err: any) => showError(err.message || "Lỗi lưu thông tin"),
  });


  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      showError("Vui lòng cấp quyền truy cập thư viện ảnh.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true, 
    });

    if (!result.canceled && result.assets[0].base64 && userProfile?.id) {
       uploadMutation.mutate({ 
         userId: userProfile.id, 
         base64Data: result.assets[0].base64 
       });
    }
  };

  const handleSave = () => {
    if (!userProfile?.id) return;
    saveMutation.mutate({
      id: userProfile.id,
      full_name: fullName,
      phone: phone,
      avatar_url: avatarUrl
    });
  };

  const isLoading = isFetching || uploadMutation.isPending || saveMutation.isPending;

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar style="dark" />
      
      {/* HEADER */}
      <SafeAreaView edges={['top']} className="bg-white z-10">
        <View className="px-4 py-3 flex-row items-center border-b border-slate-100">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center rounded-full bg-slate-50 border border-slate-100">
                <MaterialIcons name="arrow-back-ios" size={20} color="#0F172A" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
            <Text className="flex-1 text-center text-lg font-bold text-[#0F172A] mr-10">Chỉnh sửa hồ sơ</Text>
        </View>
      </SafeAreaView>

      {/* BODY */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        className="flex-1"
        keyboardVerticalOffset={100}
      >
        <ScrollView 
            className="flex-1 px-5 pt-6" 
            contentContainerStyle={{ paddingBottom: 150 }} 
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
        >
              
              {/* AVATAR SECTION */}
              <View className="items-center mb-8">
                  <View className="relative group">
                      <View className="w-32 h-32 rounded-full bg-slate-200 border-4 border-white shadow-md items-center justify-center overflow-hidden">
                           {avatarUrl ? (
                               <Image 
                                  source={{ uri: avatarUrl }} 
                                  className="w-full h-full" 
                                  contentFit="cover"
                                  cachePolicy="memory-disk"
                                  transition={300}
                               />
                           ) : (
                               <Text className="text-5xl font-bold text-slate-400">{fullName?.charAt(0).toUpperCase() || 'U'}</Text>
                           )}
                           
                           {uploadMutation.isPending && (
                             <View className="absolute inset-0 bg-black/40 items-center justify-center">
                               <ActivityIndicator color="white" size="small"/>
                             </View>
                           )}
                      </View>
                      
                      <TouchableOpacity 
                        onPress={handlePickImage}
                        disabled={uploadMutation.isPending}
                        className="absolute bottom-1 right-1 bg-teal-500 p-2.5 rounded-full border-4 border-[#F8FAFC] shadow-sm active:bg-teal-600"
                      >
                          <MaterialIcons name="photo-camera" size={20} color="white" />
                      </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={handlePickImage} className="mt-4">
                      <Text className="text-teal-600 font-semibold text-sm">Đổi ảnh đại diện</Text>
                  </TouchableOpacity>
              </View>

              {/* FORM */}
              <View className="gap-6">
                  {/* Full Name */}
                  <View>
                      <Text className="text-sm font-bold text-slate-700 mb-2 ml-1">Họ và tên</Text>
                      <View className="relative">
                          <View className="absolute inset-y-0 left-0 pl-4 justify-center pointer-events-none z-10">
                              <MaterialIcons name="person" size={24} color="#94A3B8" />
                          </View>
                          <TextInput 
                              className="w-full h-14 pl-12 pr-4 rounded-xl border border-slate-200 bg-white text-[#0F172A] font-medium shadow-sm focus:border-teal-500"
                              placeholder="Nhập họ tên"
                              value={fullName}
                              onChangeText={setFullName}
                              editable={!isLoading}
                          />
                      </View>
                  </View>

                  {/* Email */}
                  <View>
                      <Text className="text-sm font-bold text-slate-700 mb-2 ml-1">Email</Text>
                      <View className="relative">
                          <View className="absolute inset-y-0 left-0 pl-4 justify-center pointer-events-none z-10">
                              <MaterialIcons name="mail" size={24} color="#94A3B8" />
                          </View>
                          <TextInput 
                              className="w-full h-14 pl-12 pr-4 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-medium shadow-sm"
                              value={email}
                              editable={false}
                          />
                      </View>
                  </View>

                  {/* Phone */}
                  <View>
                      <Text className="text-sm font-bold text-slate-700 mb-2 ml-1">Số điện thoại</Text>
                      <View className="relative">
                          <View className="absolute inset-y-0 left-0 pl-4 justify-center pointer-events-none z-10">
                              <MaterialIcons name="call" size={24} color="#94A3B8" />
                          </View>
                          <TextInput 
                              className="w-full h-14 pl-12 pr-4 rounded-xl border border-slate-200 bg-white text-[#0F172A] font-medium shadow-sm focus:border-teal-500"
                              placeholder="+84 ..."
                              value={phone}
                              onChangeText={setPhone}
                              keyboardType="phone-pad"
                              editable={!isLoading}
                          />
                      </View>
                  </View>
              </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* BOTTOM SAVE BUTTON */}
      <View className="p-5 bg-white/90 border-t border-slate-100 absolute bottom-0 left-0 right-0 pb-8">
          <TouchableOpacity 
              onPress={handleSave}
              disabled={isLoading}
              className={`w-full h-14 rounded-xl items-center justify-center shadow-lg shadow-teal-500/30 ${isLoading ? 'bg-slate-300' : 'bg-teal-500'}`}
          >
              {isLoading ? (
                  <Text className="text-white font-bold text-base">Đang xử lý...</Text>
              ) : (
                  <View className="flex-row items-center gap-2">
                      <MaterialIcons name="save" size={24} color="white" />
                      <Text className="text-white font-bold text-base">Lưu Thay Đổi</Text>
                  </View>
              )}
          </TouchableOpacity>
      </View>

    </View>
  );
}
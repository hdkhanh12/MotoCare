import { MaterialIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
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

async function fetchVehicleById(vehicleId: string) {
  const { data, error } = await supabase
    .from('user_vehicles')
    .select('*')
    .eq('id', vehicleId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function uploadVehicleImageApi({ userId, base64Data }: { userId: string, base64Data: string }) {
  const fileName = `${userId}/${Date.now()}_vehicle.jpg`;
  const { error } = await supabase.storage
    .from('vehicle_images')
    .upload(fileName, decode(base64Data), { contentType: 'image/jpeg', upsert: true });

  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('vehicle_images').getPublicUrl(fileName);
  return data.publicUrl;
}

async function updateVehicleApi(payload: any) {
  const { id, ...updates } = payload;
  const { error } = await supabase
    .from('user_vehicles')
    .update(updates)
    .eq('id', id);

  if (error) throw new Error(error.message);
  return true;
}

async function deleteVehicleApi(vehicleId: string) {
  await supabase.from('maintenance_history').delete().eq('vehicle_id', vehicleId);
  const { error } = await supabase.from('user_vehicles').delete().eq('id', vehicleId);
  if (error) throw new Error(error.message);
  return true;
}

export default function EditVehicleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const queryClient = useQueryClient();
  const vehicleId = params.id as string;

  const [model, setModel] = useState('');
  const [brand, setBrand] = useState('');
  const [year, setYear] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [odo, setOdo] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const { showSuccess, showError } = useGlobalModal();
  
  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['vehicle-detail', vehicleId],
    queryFn: () => fetchVehicleById(vehicleId),
    enabled: !!vehicleId,
  });

  useEffect(() => {
    if (vehicle) {
        setModel(vehicle.model);
        setBrand(vehicle.brand || '');
        setYear(vehicle.year ? vehicle.year.toString() : '');
        setPlateNumber(vehicle.plate_number || '');
        setOdo(vehicle.current_odo ? vehicle.current_odo.toString() : '');
        setImageUrl(vehicle.image_url);
    }
  }, [vehicle]);

  // --- MUTATIONS ---
  const uploadMutation = useMutation({
    mutationFn: uploadVehicleImageApi,
    onSuccess: (newUrl) => {
        setImageUrl(newUrl);
    },
    onError: (err) => showError(err.message || "Lỗi Upload"),
  });

  const updateMutation = useMutation({
    mutationFn: updateVehicleApi,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['user-vehicles'] });
        queryClient.invalidateQueries({ queryKey: ['vehicle-detail', vehicleId] });
        showSuccess(
            "Cập nhật thành công!",
            `Thông tin xe ${model} đã được lưu.`,
            () => { router.back(); }
        );
    },
    onError: (err) => showError(err.message || "Lỗi cập nhật"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVehicleApi,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['user-vehicles'] });
        router.back();
    },
    onError: (err) => showError(err.message || "Lỗi xóa xe"),
  });

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Cần quyền', 'Vui lòng cấp quyền truy cập ảnh.');

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [4, 3], quality: 0.5, base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            uploadMutation.mutate({ userId: user.id, base64Data: result.assets[0].base64 });
        }
    }
  };

  const handleSave = () => {
    updateMutation.mutate({
        id: vehicleId,
        model: model,
        brand: brand,
        year: parseInt(year) || null,
        plate_number: plateNumber.toUpperCase(),
        current_odo: parseInt(odo.replace(/\D/g, '')),
        image_url: imageUrl
    });
  };

  const handleDelete = () => {
    Alert.alert("Xóa xe", "Bạn có chắc chắn muốn xóa xe này? Dữ liệu bảo dưỡng liên quan cũng sẽ bị xóa.", [
        { text: "Hủy", style: "cancel" },
        { 
            text: "Xóa vĩnh viễn", style: "destructive", 
            onPress: () => deleteMutation.mutate(vehicleId)
        }
    ]);
  };

  const isProcessing = updateMutation.isPending || deleteMutation.isPending;

  if (isLoading) return <View className="flex-1 items-center justify-center"><ActivityIndicator color={COLORS.primary}/></View>;

  return (
    <View className="flex-1 bg-[#F6F7F8]">
      <StatusBar style="dark" />
      
      {/* HEADER */}
      <SafeAreaView edges={['top']} className="bg-white/80 z-10">
        <View className="px-4 py-3 flex-row items-center border-b border-slate-200">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center rounded-full bg-slate-100">
                <MaterialIcons name="arrow-back-ios" size={18} color="#0F172A" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
            <Text className="flex-1 text-center text-lg font-bold text-[#0F172A] mr-10">Sửa thông tin xe</Text>
        </View>
      </SafeAreaView>

      {/* BODY SCROLL */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView 
            className="flex-1" 
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
        >
            {/* HEADER IMAGE */}
            <View className="items-center py-6">
                <View className="relative group">
                    <View className="w-28 h-28 rounded-full border-4 border-white shadow-md bg-slate-200 items-center justify-center overflow-hidden">
                        {imageUrl ? (
                            <Image 
                                source={{ uri: imageUrl }} 
                                className="w-full h-full" 
                                contentFit="cover"
                                cachePolicy="memory-disk"
                                transition={300}
                            />
                        ) : (
                            <MaterialIcons name="two-wheeler" size={48} color="#94A3B8" />
                        )}
                        
                        {uploadMutation.isPending && (
                            <View className="absolute inset-0 bg-black/40 items-center justify-center">
                                <ActivityIndicator color="white" size="small" />
                            </View>
                        )}
                    </View>
                    <TouchableOpacity 
                        onPress={handlePickImage}
                        disabled={uploadMutation.isPending}
                        className="absolute bottom-0 right-0 bg-[#0F172A] p-2 rounded-full border-2 border-white shadow-sm active:bg-slate-700"
                    >
                        <MaterialIcons name="photo-camera" size={18} color="white" />
                    </TouchableOpacity>
                </View>
                <View className="mt-4 items-center">
                    <Text className="text-xl font-bold text-[#0F172A]">{model}</Text>
                    <Text className="text-slate-500 text-sm font-medium">Đang chỉnh sửa</Text>
                </View>
            </View>

            {/* FORM INPUTS */}
            <View className="px-4 gap-6 pb-20">
                {/* SECTION: IDENTITY */}
                <View className="mt-2">
                    <Text className="text-[#0F172A] text-base font-bold mb-4 px-1">Thông tin chung</Text>
                    <View className="bg-white rounded-xl shadow-sm p-4 gap-4 border border-slate-100">
                        {/* Brand */}
                        <View>
                            <View className="flex-row items-center gap-2 mb-2">
                                <MaterialIcons name="two-wheeler" size={20} color="#14B8A6" />
                                <Text className="text-slate-900 text-sm font-semibold">Hãng xe</Text>
                            </View>
                            <TextInput 
                                className="w-full h-12 bg-slate-50 rounded-lg px-4 border border-slate-200 text-slate-900"
                                value={brand}
                                onChangeText={setBrand}
                                placeholder="Honda, Yamaha..."
                                editable={!isProcessing}
                            />
                        </View>
                        {/* Model */}
                        <View>
                            <View className="flex-row items-center gap-2 mb-2">
                                <MaterialIcons name="label" size={20} color="#14B8A6" />
                                <Text className="text-slate-900 text-sm font-semibold">Tên dòng xe</Text>
                            </View>
                            <TextInput 
                                className="w-full h-12 bg-slate-50 rounded-lg px-4 border border-slate-200 text-slate-900 font-medium"
                                value={model}
                                onChangeText={setModel}
                                editable={!isProcessing}
                            />
                        </View>
                        {/* Year */}
                        <View>
                            <View className="flex-row items-center gap-2 mb-2">
                                <MaterialIcons name="calendar-today" size={20} color="#14B8A6" />
                                <Text className="text-slate-900 text-sm font-semibold">Năm sản xuất</Text>
                            </View>
                            <TextInput 
                                className="w-full h-12 bg-slate-50 rounded-lg px-4 border border-slate-200 text-slate-900"
                                value={year}
                                onChangeText={setYear}
                                keyboardType="numeric"
                                placeholder="VD: 2020"
                                editable={!isProcessing}
                            />
                        </View>
                    </View>
                </View>

                {/* SECTION: REGISTRATION */}
                <View className="mt-2">
                    <Text className="text-[#0F172A] text-base font-bold mb-4 px-1">Đăng ký & Sử dụng</Text>
                    <View className="bg-white rounded-xl shadow-sm p-4 gap-4 border border-slate-100">
                        {/* Plate */}
                        <View>
                            <View className="flex-row items-center gap-2 mb-2">
                                <MaterialIcons name="confirmation-number" size={20} color="#14B8A6" />
                                <Text className="text-slate-900 text-sm font-semibold">Biển số xe</Text>
                            </View>
                            <View className="relative">
                                <TextInput 
                                    className="w-full h-12 bg-slate-50 rounded-lg pl-4 pr-10 border border-slate-200 text-slate-900 font-bold uppercase"
                                    value={plateNumber}
                                    onChangeText={setPlateNumber}
                                    placeholder="29X1-12345"
                                    editable={!isProcessing}
                                />
                                <View className="absolute right-3 top-3">
                                    <MaterialIcons name="check-circle" size={20} color="#22C55E" />
                                </View>
                            </View>
                        </View>
                        {/* Odometer */}
                        <View>
                            <View className="flex-row items-center gap-2 mb-2">
                                <MaterialIcons name="speed" size={20} color="#14B8A6" />
                                <Text className="text-slate-900 text-sm font-semibold">Số ODO hiện tại</Text>
                            </View>
                            <View className="relative">
                                <TextInput 
                                    className="w-full h-12 bg-slate-50 rounded-lg pl-4 pr-12 border border-slate-200 text-slate-900 font-bold"
                                    value={odo}
                                    onChangeText={setOdo}
                                    keyboardType="numeric"
                                    editable={!isProcessing}
                                />
                                <View className="absolute right-4 top-3.5">
                                    <Text className="text-slate-500 font-medium text-xs">km</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* ACTIONS BUTTONS */}
                <View className="pt-4 flex-row gap-3">
                    
                    {/* BUTTON XÓA */}
                    <TouchableOpacity 
                        onPress={handleDelete}
                        disabled={isProcessing}
                        className="flex-1 h-12 rounded-xl bg-red-50 border border-red-200 active:bg-red-100 justify-center items-center"
                    >
                        {deleteMutation.isPending ? (
                            <ActivityIndicator color="#EF4444" size="small" />
                        ) : (
                            <View className="flex-row items-center justify-center gap-2">
                                <MaterialIcons name="delete" size={20} color="#EF4444" />
                                <Text className="text-red-600 font-bold text-base">Xóa xe</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* BUTTON LƯU */}
                    <TouchableOpacity 
                        onPress={handleSave}
                        disabled={isProcessing}
                        className={`flex-1 h-12 rounded-xl justify-center items-center shadow-lg shadow-teal-900/20 ${isProcessing ? 'bg-slate-300' : 'bg-[#0F172A]'}`}
                    >
                        {isProcessing && !deleteMutation.isPending ? (
                            <ActivityIndicator color="white"/> 
                        ) : (
                            <View className="flex-row items-center justify-center gap-2">
                                <MaterialIcons name="save" size={20} color="white" />
                                <Text className="text-white font-bold text-base">Lưu lại</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                </View>
            </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
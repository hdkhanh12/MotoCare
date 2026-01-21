import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useGlobalModal } from '../../contexts/ModalContext'; // Đảm bảo bạn đã bọc ModalProvider ở _layout
import { supabase } from '../../services/supabase';

const STORAGE_KEY = 'LAST_ODO_CHECK_DATE';

export const DailyOdoModal = ({ vehicleId, onUpdateSuccess }: { vehicleId: number, onUpdateSuccess?: () => void }) => {
  const [visible, setVisible] = useState(false);
  const [odoInput, setOdoInput] = useState('');
  const [loading, setLoading] = useState(false);

  const { showSuccess, showError } = useGlobalModal();

  useEffect(() => {
    checkShouldShowModal();
  }, [vehicleId]);

  const checkShouldShowModal = async () => {
    try {
      const today = new Date().toDateString();
      const lastDate = await AsyncStorage.getItem(STORAGE_KEY);
      
      console.log(`Kiểm tra ngày: Hôm nay=${today}, Lần cuối=${lastDate}`);

      if (lastDate !== today) {
        console.log("=> Cần nhập ODO. Hiện Modal!");
        setVisible(true);
      } else {
        console.log("=> Hôm nay nhập rồi. Ẩn Modal.");
      }
    } catch (error) {
      console.error("Lỗi check storage:", error);
    }
  };

  const handleSubmit = async () => {
    if (!odoInput) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('user_vehicles')
        .update({ current_odo: parseInt(odoInput) })
        .eq('id', vehicleId);

      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
          await supabase.from('notifications').insert({
              user_id: user.id,
              title: 'Cập nhật ODO',
              message: `Đã cập nhật ODO mới: ${parseInt(odoInput).toLocaleString('vi-VN')} km`,
              type: 'success', 
              is_read: false,
          });
      }

      const today = new Date().toDateString();
      await AsyncStorage.setItem(STORAGE_KEY, today);
      
      setVisible(false);
      setTimeout(() => {
          showSuccess("Thành công", "Đã cập nhật chỉ số ODO mới.", () => {
              if (onUpdateSuccess) onUpdateSuccess();
          });
      }, 300);

    } catch (error: any) {
      setVisible(false);
      setTimeout(() => {
          showError(error.message);
      }, 300);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    setVisible(false);
    // Nếu muốn nhắc lại lần sau mở app trong ngày thì KHÔNG lưu storage
    AsyncStorage.setItem(STORAGE_KEY, new Date().toDateString());
  };

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View className="flex-1 bg-black/50 items-center justify-center px-6">
        <View className="bg-white w-full rounded-2xl p-6 shadow-xl">
          
          <View className="items-center mb-4">
            <View className="w-12 h-12 bg-indigo-100 rounded-full items-center justify-center mb-2">
               <MaterialIcons name="speed" size={24} color="#4F46E5" />
            </View>
            <Text className="text-lg font-bold text-slate-800">Cập nhật ODO</Text>
            <Text className="text-sm text-slate-500 text-center mt-1">
              Nhập số km hiện tại để nhắc bảo dưỡng nhé!
            </Text>
          </View>

          <TextInput
            className="border border-slate-300 rounded-xl px-4 h-12 text-lg font-semibold text-center mb-6 focus:border-indigo-500"
            keyboardType="number-pad"
            placeholder="Nhập số km..."
            value={odoInput}
            onChangeText={setOdoInput}
          />

          <View className="flex-row gap-3">
            <TouchableOpacity onPress={handleSkip} className="flex-1 py-3 bg-slate-100 rounded-xl items-center">
              <Text className="font-semibold text-slate-600">Để sau</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleSubmit}
              disabled={loading || !odoInput}
              className={`flex-1 py-3 rounded-xl items-center ${loading || !odoInput ? 'bg-indigo-300' : 'bg-indigo-600'}`}
            >
              {loading ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white">Lưu</Text>}
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
};
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

interface ErrorModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
}

export const ErrorModal = ({ visible, title = "Đã có lỗi xảy ra", message, onClose }: ErrorModalProps) => {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View className="flex-1 bg-black/50 items-center justify-center px-6">
        <View className="bg-white w-[80%] rounded-2xl p-6 items-center shadow-xl border border-red-50">
          
          <View className="w-16 h-16 bg-red-50 rounded-full items-center justify-center mb-4">
            <MaterialIcons name="error-outline" size={40} color="#EF4444" />
          </View>

          <Text className="text-xl font-bold text-slate-800 mb-2 text-center">
            {title}
          </Text>

          {message && (
            <Text className="text-slate-500 text-center mb-6 leading-5">
              {message}
            </Text>
          )}

          <TouchableOpacity 
            onPress={onClose}
            className="w-full py-3 bg-red-500 rounded-xl items-center active:bg-red-600"
          >
            <Text className="text-white font-bold text-base">Đóng</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
};
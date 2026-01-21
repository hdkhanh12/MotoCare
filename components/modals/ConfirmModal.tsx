import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

interface ConfirmModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
}

export const ConfirmModal = ({ 
  visible, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = "Xóa"
}: ConfirmModalProps) => {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View className="flex-1 bg-black/50 items-center justify-center px-6">
        <View className="bg-white w-[85%] rounded-2xl p-6 items-center shadow-xl">
          <View className="w-16 h-16 bg-orange-50 rounded-full items-center justify-center mb-4">
            <MaterialIcons name="help-outline" size={40} color="#F97316" />
          </View>

          <Text className="text-xl font-bold text-slate-800 mb-2 text-center">
            {title}
          </Text>

          {message && (
            <Text className="text-slate-500 text-center mb-6 leading-5">
              {message}
            </Text>
          )}

          <View className="flex-row gap-3 w-full">
            <TouchableOpacity 
              onPress={onCancel}
              className="flex-1 py-3 bg-slate-100 rounded-xl items-center active:bg-slate-200"
            >
              <Text className="text-slate-600 font-bold text-base">Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={onConfirm}
              className="flex-1 py-3 bg-red-500 rounded-xl items-center active:bg-red-600"
            >
              <Text className="text-white font-bold">{confirmText}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
};
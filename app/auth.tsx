import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';

import { useGlobalModal } from '../contexts/ModalContext';
import { supabase } from '../services/supabase';

export default function AuthScreen() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  // State quản lý ẩn/hiện mật khẩu
  const [showPassword, setShowPassword] = useState(false); 

  const { showSuccess, showError } = useGlobalModal();

  const handleAuth = async () => {
    setLoading(true);
    try {
      if (isLogin) {
        // --- ĐĂNG NHẬP ---
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        router.replace('/(tabs)');
      } else {
        // --- ĐĂNG KÝ ---
        if (!fullName.trim()) {
          showError("Vui lòng nhập họ và tên đầy đủ.");
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        showSuccess(
          "Đăng ký thành công!",
          "Vui lòng kiểm tra email của bạn để xác thực tài khoản trước khi đăng nhập.",
          () => {
            setIsLogin(true);
          }
        );
      }
    } catch (error: any) {
      showError(error.message || "Đã có lỗi xảy ra trong quá trình xác thực.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} 
          showsVerticalScrollIndicator={false}
          className="bg-[#F8FAFC]"
        >
          <View className="px-6 py-10">
            <StatusBar style="dark" />

            {/* LOGO SECTION */}
            <View className="items-center mb-10">
              <Image
                source={require('../assets/images/icon.png')}
                className="w-24 h-24 rounded-3xl mb-4 transform rotate-3"
                resizeMode="contain"
              />
              <Text className="text-3xl font-bold text-slate-900">MotoCare</Text>
              <Text className="text-slate-500 mt-2">Sổ bảo dưỡng điện tử</Text>
            </View>

            {/* FORM SECTION */}
            <View className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <Text className="text-xl font-bold text-slate-800 mb-6 text-center">
                {isLogin ? 'Đăng nhập' : 'Tạo tài khoản mới'}
              </Text>

              {/* Ô NHẬP HỌ TÊN (Chỉ hiện khi Đăng ký) */}
              {!isLogin && (
                <View className="mb-4">
                  <Text className="text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Họ và tên</Text>
                  <TextInput
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-slate-900"
                    placeholder="Nguyễn Văn A"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>
              )}

              {/* Ô NHẬP EMAIL */}
              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Email</Text>
                <TextInput
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-slate-900"
                  placeholder="email@example.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                />
              </View>

              {/* Ô NHẬP MẬT KHẨU */}
              <View className="mb-6">
                <Text className="text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Mật khẩu</Text>
                
                <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4 h-12">
                  <TextInput
                    className="flex-1 text-slate-900 h-full"
                    placeholder="******"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2">
                    <MaterialIcons 
                        name={showPassword ? "visibility" : "visibility-off"} 
                        size={20} 
                        color="#64748B" 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* BUTTON SUBMIT */}
              <TouchableOpacity
                onPress={handleAuth}
                disabled={loading}
                className={`h-12 rounded-xl items-center justify-center ${loading ? 'bg-slate-300' : 'bg-[#0F172A]'}`}
              >
                {loading ? <ActivityIndicator color="white" /> : (
                  <Text className="text-white font-bold text-lg">{isLogin ? 'Vào Gara' : 'Đăng Ký'}</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* SWITCH LOGIN/SIGNUP */}
            <View className="flex-row justify-center mt-6">
              <Text className="text-slate-500">{isLogin ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}</Text>
              <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                <Text className="text-teal-600 font-bold">{isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import '../global.css';
import { supabase } from '../services/supabase';

import { ModalProvider } from '../contexts/ModalContext';
// ------------------------------

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, 
      retry: 2, 
      gcTime: 1000 * 60 * 60 * 24, 
    },
  },
});

export default function RootLayout() {
  const [session, setSession] = useState<any>(null);
  const [initialized, setInitialized] = useState(false);
  
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Kiểm tra session khi mở app
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setInitialized(true);
    };
    checkSession();

    // Lắng nghe thay đổi (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = (segments[0] as string) === '(auth)' || segments[0] === 'auth';
    
    if (session && inAuthGroup) {
      router.replace('/(tabs)');
    } else if (!session && !inAuthGroup) {
      router.replace('/auth'); 
    }
  }, [session, initialized, segments]);

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#14b8a5" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ModalProvider>
        
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="auth" /> 
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="stats" options={{ presentation: 'modal', title: 'Thống kê' }} />
          <Stack.Screen name="MarketPriceScreen" options={{ title: 'Tra cứu giá' }} />
        </Stack>

      </ModalProvider>
      {/* ----------------------------------- */}

    </QueryClientProvider>
  );
}
import { Alert, Linking, Platform } from 'react-native';

export const openNearbyRepairShops = async () => {
  // Từ khóa tìm kiếm
  const query = "tiệm sửa xe"; 
  const encodedQuery = encodeURIComponent(query);

  let url = "";

  if (Platform.OS === 'ios') {
    url = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
  } else {
    // Trên Android: Dùng scheme 'geo' để mở app bản đồ mặc định
    url = `geo:0,0?q=${encodedQuery}`;
  }

  // Fallback: Dùng link web universal của Google nếu 'geo' lỗi
  const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;

  try {
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    } else {
      // Nếu không mở được app, mở bằng trình duyệt
      await Linking.openURL(fallbackUrl);
    }
  } catch (error) {
    Alert.alert("Lỗi", "Không thể mở ứng dụng bản đồ.");
    console.error("An error occurred", error);
  }
};
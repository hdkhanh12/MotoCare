# 🛵 MotoCare - Trợ lý quản lý bảo dưỡng xe máy cá nhân

**MotoCare** là ứng dụng di động đa nền tảng giúp người dùng cá nhân số hóa quy trình chăm sóc xe gắn máy. Từ việc ghi chép nhật ký sửa chữa, theo dõi chi phí đến nhắc nhở bảo dưỡng định kỳ dựa trên ODO thực tế.

---

## 🌟 Tính năng nổi bật

* **🚀 Onboarding thông minh:** Quy trình thêm xe 3 bước với dữ liệu gợi ý từ hàng trăm dòng xe phổ biến (Honda, Yamaha, VinFast...).
* **📝 Nhật ký điện tử:** Ghi lại lịch sử sửa chữa, thay thế phụ tùng, chi phí và địa điểm.
* **⏰ Nhắc nhở tự động:** Tính toán lịch bảo dưỡng dựa trên ODO thực tế hoặc thời gian sử dụng (Ví dụ: Thay dầu mỗi 2000km).
* **📊 Thống kê trực quan:** Biểu đồ phân tích chi phí "nuôi" xe theo tháng/năm.
* **💰 Tra cứu giá:** Tham khảo giá sửa chữa các dòng xe hiện có trên thị trường.

---

## 🛠️ Công nghệ sử dụng

Dự án áp dụng kiến trúc **Clean Architecture** và các công nghệ hiện đại nhất trong hệ sinh thái React Native:

### Mobile App (Client)
* **Framework:** React Native (Expo SDK 50).
* **Language:** TypeScript.
* **Routing:** Expo Router (File-based routing).
* **State Management:**
    * Server State: TanStack Query (React Query).
    * Client State: React Context API.
* **Styling:** NativeWind (TailwindCSS).
* **UX:** KeyboardSafeView, Global Modal System.

### Backend & Database
* **Platform:** Supabase (BaaS).
* **Database:** PostgreSQL.
* **Auth:** Supabase Auth (Email/Password, Social).
* **Security:** Row Level Security (RLS).

### Data Engineering (Automation)
* **Language:** Python 3.
* **Libraries:** BeautifulSoup4, Requests.
* **Role:** Crawl dữ liệu xe từ web -> Làm sạch & Gán nhãn -> Đồng bộ vào Database.

---

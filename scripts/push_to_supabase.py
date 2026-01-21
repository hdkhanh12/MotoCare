import json
from supabase import create_client, Client

# --- CẤU HÌNH ---
SUPABASE_URL = "https://fbevaistemtqmghbfkud.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZXZhaXN0ZW10cW1naGJma3VkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjMzOTk4NywiZXhwIjoyMDgxOTE1OTg3fQ.KneT1TTdXy2gSpz6lVf30-sCQayslfgf5YtJ7crA04Y"

# Khởi tạo kết nối
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def push_templates():
    print("1️⃣ Đang đẩy Maintenance Templates...")
    try:
        with open("maintenance_templates.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # Supabase yêu cầu map đúng tên cột. 
        formatted_data = []
        for item in data:
            formatted_data.append({
                "id": item["template_id"],
                "name": item["template_name"],
                "description": item.get("description", ""),
                "items": item["maintenance_items"] # JSONB
            })
            
        # Ghi vào DB (upsert = insert hoặc update nếu đã tồn tại)
        response = supabase.table("maintenance_templates").upsert(formatted_data).execute()
        print(f"✅ Thành công! Đã đẩy {len(formatted_data)} templates.")
        
    except Exception as e:
        print(f"❌ Lỗi đẩy Templates: {e}")

def push_vehicles():
    print("2️⃣ Đang đẩy Vehicles...")
    try:
        with open("vehicles_complete.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            
        formatted_data = []
        for car in data:
            formatted_data.append({
                "id": car["id"],
                "name": car["name"],
                "brand": car["brand"],
                "type": car["type"],
                "template_id": car["template_id"],
                "tags": car["tags"],
                "detail_url": car.get("detail_url", ""),
                "versions": car["versions"],
                "specs": car["specs"] # JSONB
            })
            
        # Chia nhỏ ra để đẩy
        chunk_size = 100
        for i in range(0, len(formatted_data), chunk_size):
            chunk = formatted_data[i:i + chunk_size]
            supabase.table("vehicles").upsert(chunk).execute()
            print(f"   --> Đã đẩy lô {i} - {i+len(chunk)}")
            
        print(f"✅ Thành công! Đã đẩy toàn bộ xe.")
        
    except Exception as e:
        print(f"❌ Lỗi đẩy Vehicles: {e}")

if __name__ == "__main__":
    push_templates()
    print("-" * 30)
    push_vehicles()
from bs4 import BeautifulSoup
import json
import os

# --- CẤU HÌNH ---
# Tên file bạn vừa lưu từ trình duyệt về
LOCAL_FILE = "banggia.html" 
BASE_URL = "https://vnexpress.net"

def crawl_from_local_file():
    print(f"📂 Đang mở file '{LOCAL_FILE}' trên máy của bạn...")
    
    # Kiểm tra file có tồn tại không
    if not os.path.exists(LOCAL_FILE):
        print("❌ Lỗi: Không tìm thấy file. Bạn đã lưu file 'banggia.html' vào cùng thư mục chứa code chưa?")
        return

    # Đọc file HTML
    with open(LOCAL_FILE, "r", encoding="utf-8") as f:
        html_content = f.read()
    
    soup = BeautifulSoup(html_content, "html.parser")
    
    # Tìm các dòng trong bảng giá (class 'banggiaxe-item')
    # Lưu ý: Khi lưu về máy, trình duyệt có thể render cấu trúc hơi khác, ta tìm class chính xác
    rows = soup.find_all("tr", class_="banggiaxe-item")
    
    if len(rows) == 0:
        print("⚠️ Vẫn chưa tìm thấy dòng nào. Hãy thử mở file HTML lên xem bảng giá có trong đó không.")
        # Fallback: Thử tìm theo class init-banggia (như bạn cung cấp)
        rows = soup.find_all("tr", class_="init-banggia")
        
    print(f"📊 Tìm thấy {len(rows)} dòng xe trong file!")
    
    unique_vehicles = {} 
    
    for row in rows:
        cols = row.find_all("td")
        if len(cols) < 5: continue
        
        # Lấy thông tin cơ bản
        # Cần try-catch vì cấu trúc HTML lưu về máy có thể có rác
        try:
            brand = cols[0].text.strip()
            # Tìm thẻ a trong cột thứ 2 (Tên xe)
            link_tag = cols[1].find("a")
            model_name = link_tag.text.strip() if link_tag else cols[1].text.strip()
            
            version = cols[2].text.strip()
            v_type = cols[3].text.strip() # "Xe số", "Xe tay ga"...
            
            # Lấy Link chi tiết (QUAN TRỌNG)
            if link_tag:
                raw_link = link_tag.get("href")
                clean_link = raw_link.split("#")[0]
                if not clean_link.startswith("http"):
                    clean_link = BASE_URL + clean_link
                
                v_id = clean_link.split("/")[-1]
                
                # Logic Map Template (Giữ nguyên như cũ)
                template_id = "under_350cc"
                tags = []
                if "tay ga" in v_type.lower(): tags.append("scooter")
                elif "số" in v_type.lower(): tags.append("manual")
                elif "côn" in v_type.lower(): tags.append("manual"); tags.append("chain_drive")
                elif "điện" in v_type.lower(): template_id = "electric"; tags.append("ev")

                # Lưu vào dict
                if v_id not in unique_vehicles:
                    unique_vehicles[v_id] = {
                        "id": v_id,
                        "name": model_name,
                        "brand": brand,
                        "type": v_type,
                        "template_id": template_id,
                        "tags": tags,
                        "detail_url": clean_link,
                        "versions": [version],
                        "specs": {} # Sẽ lấy ở bước sau (online)
                    }
                else:
                    if version not in unique_vehicles[v_id]["versions"]:
                        unique_vehicles[v_id]["versions"].append(version)
        except Exception as e:
            continue # Bỏ qua dòng lỗi
            
    # Xuất ra JSON
    if unique_vehicles:
        final_list = list(unique_vehicles.values())
        print(f"✨ Tổng hợp được: {len(final_list)} dòng xe duy nhất.")
        
        with open("vehicles_from_local.json", "w", encoding="utf-8") as f:
            json.dump(final_list, f, ensure_ascii=False, indent=2)
        print("✅ Đã tạo file 'vehicles_from_local.json'. Hãy mở ra kiểm tra!")
    else:
        print("❌ Không lấy được dữ liệu nào.")

if __name__ == "__main__":
    crawl_from_local_file()
# Website Betagon Edu + trang quản trị

Website Betagon chạy trên Node.js, có trang quản trị (admin) để sửa nội dung mà không cần đụng vào code.

## Trang quản trị làm được gì

- **Bài viết:** viết, sửa, xóa bài; trình soạn thảo có tiêu đề, in đậm, danh sách, trích dẫn, link, chèn ảnh và video YouTube. Bài để "Bản nháp" sẽ không hiện trên web. Mỗi bài có trang riêng tại `/bai-viet/<đường-dẫn>`.
- **Khóa học, Lịch khai giảng, Đồ án học viên, Feedback, Thư viện, Hỏi đáp:** thêm, sửa, xóa, đổi thứ tự, tải ảnh lên. Lớp đã qua ngày khai giảng tự ẩn khỏi web.
- **Đăng ký học viên:** xem các đăng ký gửi từ form trên web, đánh dấu trạng thái (Mới, Đã liên hệ, Đã nhập học, Không học), ghi chú nội bộ, tải file CSV mở bằng Excel.
- **Cài đặt website:** tên, slogan, tiêu đề đầu trang, số liệu, phần "Về Betagon", địa chỉ, hotline, email, link mạng xã hội, link Zalo/Messenger cho chatbot, màu nhấn, bật/tắt từng mục trên trang chủ.
- **Tài khoản:** đổi mật khẩu admin.

## Cài đặt và chạy

Cần Node.js 18 trở lên (tải tại nodejs.org).

```bash
cd betagon-app
npm install
ADMIN_PASSWORD="mat-khau-ban-dau-it-nhat-8-ky-tu" npm start
```

Trên Windows (PowerShell):

```powershell
cd betagon-app
npm install
$env:ADMIN_PASSWORD="mat-khau-ban-dau"; npm start
```

Mở website tại http://localhost:3000 và trang quản trị tại http://localhost:3000/admin

- Tên đăng nhập: `admin`
- Mật khẩu lần đầu: giá trị `ADMIN_PASSWORD` bạn đặt ở trên. Nếu không đặt, máy chủ tự tạo một mật khẩu ngẫu nhiên và in ra màn hình **một lần duy nhất** khi chạy lần đầu.
- Lần đăng nhập đầu tiên, hệ thống bắt buộc đổi sang mật khẩu riêng.

## Dữ liệu nằm ở đâu

| Thư mục / file | Nội dung |
|---|---|
| `data/content.json` | Toàn bộ nội dung web (tạo từ `data/seed.json` ở lần chạy đầu) |
| `data/content.json.bak` | Bản sao lưu ngay trước lần lưu gần nhất |
| `data/users.json` | Tài khoản admin (mật khẩu đã mã hóa bcrypt) |
| `uploads/` | Ảnh tải lên từ trang quản trị |

Sao lưu định kỳ 2 thư mục `data/` và `uploads/` là đủ để khôi phục toàn bộ website.

**Quên mật khẩu admin:** dừng máy chủ, xóa file `data/users.json`, chạy lại với `ADMIN_PASSWORD` mới. Nội dung web không bị ảnh hưởng.

## Dữ liệu chuyển từ web cũ betagon.vn

Bản này đã có sẵn 8 khóa học, 4 bài viết lộ trình và 197 đồ án học viên lấy từ web cũ. Ảnh vẫn đang nằm trên web cũ, nên mỗi lần khởi động web sẽ tự làm việc sau trong nền:

1. Đọc các trang tác phẩm cũ (trường "Trang gốc trên web cũ" của từng đồ án) để lấy bộ ảnh, tối đa 8 ảnh mỗi đồ án.
2. Tải mọi ảnh còn trỏ về `betagon.vn/Uploads/...` vào `uploads/`, thu nhỏ còn tối đa 1600px để tiết kiệm ổ đĩa, rồi đổi đường dẫn sang bản trên máy chủ mới.

Xem tiến độ trong nhật ký (log) của máy chủ: dòng "Đã chép .../... ảnh từ web cũ". Ảnh lỗi sẽ được thử lại ở lần khởi động sau.

**Quan trọng:** chạy web mới online và đợi chép xong **trước khi** đổi tên miền betagon.vn sang máy chủ mới. Đổi tên miền rồi thì web cũ không còn truy cập được để lấy ảnh.

## Đưa lên mạng

**Cách khuyên dùng, miễn phí:** chạy trên Cloudflare. Xem từng bước trong [CLOUDFLARE.md](CLOUDFLARE.md).


**Cách 1, máy chủ VPS (khuyên dùng):**

```bash
npm install --omit=dev
npm install -g pm2
PORT=3000 COOKIE_SECURE=1 TRUST_PROXY=1 NODE_ENV=production pm2 start server.js --name betagon
```

Đặt Nginx phía trước làm HTTPS (Let's Encrypt) và chuyển tiếp về cổng 3000. `COOKIE_SECURE=1` chỉ bật khi web đã chạy HTTPS.

**Cách 2, dịch vụ như Render hoặc Railway:** chọn "Node", lệnh chạy `npm start`, gắn một ổ đĩa lưu trữ lâu dài (persistent disk) rồi đặt biến môi trường `DATA_DIR` và `UPLOAD_DIR` trỏ vào ổ đó. Không có ổ lưu trữ lâu dài thì nội dung sửa sẽ mất khi dịch vụ khởi động lại.

Lưu ý: hosting tĩnh (GitHub Pages, Netlify bản tĩnh...) **không** chạy được trang quản trị vì cần máy chủ Node.

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3000` | Cổng chạy web |
| `ADMIN_USER` | `admin` | Tên đăng nhập của tài khoản đầu tiên |
| `ADMIN_PASSWORD` | ngẫu nhiên | Mật khẩu lần đầu (chỉ dùng khi chưa có `data/users.json`) |
| `COOKIE_SECURE` | tắt | Đặt `1` khi chạy HTTPS |
| `TRUST_PROXY` | tắt | Đặt `1` khi chạy sau Nginx hoặc proxy của hosting |
| `DATA_DIR` | `./data` | Nơi lưu nội dung và tài khoản |
| `UPLOAD_DIR` | `./uploads` | Nơi lưu ảnh tải lên |
| `OLD_SITE_HOSTS` | `betagon.vn,www.betagon.vn` | Tên miền web cũ để chép ảnh về |
| `SKIP_IMAGE_IMPORT` | tắt | Đặt `1` để tắt việc tự chép ảnh từ web cũ |

## Bảo mật đã có sẵn

- Mật khẩu mã hóa bcrypt; phiên đăng nhập 12 giờ bằng cookie HttpOnly.
- Khóa đăng nhập 15 phút sau 8 lần sai liên tiếp.
- Chống giả mạo yêu cầu (CSRF) cho mọi thao tác admin.
- Nội dung bài viết được lọc HTML trước khi lưu và trước khi hiển thị.
- Chỉ nhận ảnh PNG, JPG, WEBP, GIF dưới 5MB, kiểm tra theo nội dung file.
- Form đăng ký có trường bẫy bot và giới hạn 5 lần gửi trong 10 phút mỗi địa chỉ.

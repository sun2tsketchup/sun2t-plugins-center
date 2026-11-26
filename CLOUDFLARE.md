# Đưa web Betagon lên Cloudflare (miễn phí)

Web chạy trên **Cloudflare Workers**. Nội dung, tài khoản admin và đăng ký học viên lưu trong **D1** (cơ sở dữ liệu). Ảnh lưu trong **R2** (kho ảnh). Gói miễn phí đủ dùng: R2 cho 10 GB ảnh, D1 cho 5 GB dữ liệu, mỗi ngày 100.000 lượt xem trang.

Cloudflare tự tạo D1 và R2 ở lần đưa lên đầu tiên, nên bạn không cần tạo bằng tay.

## Bước 1: Tạo tài khoản và bật R2

1. Đăng ký tài khoản miễn phí ở https://dash.cloudflare.com/sign-up
2. Ở menu trái, chọn **R2 Object Storage** rồi bấm **Enable R2** (hoặc **Purchase R2 Plan**, gói 0 USD). Cloudflare sẽ yêu cầu thêm thẻ thanh toán. Thẻ chỉ để xác minh, bạn không bị trừ tiền khi dùng dưới 10 GB.

## Bước 2: Nối GitHub và đưa web lên

1. Ở menu trái, chọn **Workers & Pages**, bấm **Create**, rồi chọn **Import a repository** (hoặc Connect to Git).
2. Đăng nhập GitHub và cho Cloudflare quyền đọc repo **Betagon-Web**.
3. Chọn repo **Betagon-Web**. Ở phần cấu hình:
   - **Project name:** `betagon-web` (phải đúng tên này)
   - **Build command:** để trống
   - **Deploy command:** `npx wrangler deploy` (thường đã điền sẵn)
4. Bấm **Deploy** và đợi 2 đến 3 phút. Xong sẽ có địa chỉ dạng `https://betagon-web.<tên-tài-khoản>.workers.dev`.

## Bước 3: Đặt mật khẩu admin

1. Mở Worker **betagon-web**, vào **Settings → Variables and Secrets**, bấm **Add**.
2. Type chọn **Secret**, Name nhập `ADMIN_PASSWORD`, Value là mật khẩu admin (ít nhất 8 ký tự). Bấm **Deploy**.
3. Vào `https://betagon-web.<tên-tài-khoản>.workers.dev/admin` và đăng nhập bằng tên `admin` cùng mật khẩu vừa đặt. Lần đầu, web sẽ bắt bạn đổi sang mật khẩu riêng.

Quên mật khẩu: đổi Secret `ADMIN_PASSWORD` sang mật khẩu mới, rồi vào **Storage & Databases → D1 → betagon-db → Console** và chạy `DELETE FROM kv WHERE k = 'users';`. Lần đăng nhập sau sẽ dùng mật khẩu mới. Nội dung web không bị ảnh hưởng.

## Bước 4: Đợi chép ảnh từ web cũ

Cứ 2 phút một lần, web tự đọc các trang tác phẩm trên betagon.vn và chép ảnh về R2. Tiến độ hiện ở trang **Tổng quan** của admin, trong thẻ "Đang chép ảnh từ web cũ". Bấm **Chép tiếp ngay** nếu muốn nhanh hơn. Toàn bộ mất khoảng 30 đến 60 phút. Khi chép xong, thẻ đó tự biến mất.

**Chỉ làm Bước 5 sau khi đã chép xong.** Đổi tên miền rồi thì không còn lấy được ảnh từ web cũ.

## Bước 5: Gắn tên miền betagon.vn

Tên miền phải được quản lý DNS bởi Cloudflare.

1. Trên Cloudflare, bấm **Add a domain** (hoặc Add a site) rồi nhập `betagon.vn` và chọn gói **Free**. Cloudflare sẽ tự sao chép các bản ghi DNS hiện có từ ZoneDNS. Hãy kiểm tra lại các bản ghi **MX**, nếu bạn đang dùng email @betagon.vn.
2. Cloudflare sẽ cho 2 địa chỉ nameserver, dạng `xxx.ns.cloudflare.com`. Đăng nhập trang quản lý tên miền ở **Nhân Hòa**, tìm mục **Đổi DNS / Nameserver** của betagon.vn, thay bằng 2 nameserver đó rồi lưu. Có thể mất từ vài giờ đến 24 giờ để có hiệu lực. Cloudflare sẽ gửi email báo khi xong.
3. Khi tên miền đã ở trạng thái **Active** trên Cloudflare, vào **DNS → Records** và xóa bản ghi **A betagon.vn**, bản ghi **A \*** và bản ghi **CNAME www** (đang trỏ về web cũ).
4. Mở Worker **betagon-web**, vào **Settings → Domains & Routes → Add → Custom domain**. Thêm `betagon.vn`, rồi thêm tiếp `www.betagon.vn`.

Sau vài phút, https://betagon.vn sẽ mở web mới và Cloudflare tự cấp HTTPS.

## Nếu bước đưa lên báo lỗi

- **Lỗi liên quan R2 / bucket:** bạn chưa bật R2 (Bước 1). Bật xong rồi bấm **Retry deployment**.
- **Lỗi liên quan D1 / database_id:** tự tạo bằng tay. Vào **Storage & Databases → D1 → Create**, đặt tên `betagon-db`, rồi chép mã **Database ID**. Trên GitHub, mở file `wrangler.jsonc`, bấm biểu tượng bút chì và sửa dòng D1 thành `"d1_databases": [{ "binding": "DB", "database_name": "betagon-db", "database_id": "<mã vừa chép>" }],` rồi bấm **Commit changes**. Cloudflare sẽ tự đưa lên lại. Với R2 cũng làm tương tự: tạo bucket tên `betagon-images`.
- Chụp màn hình phần Build log gửi cho người hỗ trợ.

## Cập nhật code về sau

Mỗi khi đưa file mới lên repo GitHub, Cloudflare tự đưa lên lại sau khoảng 2 phút. Nội dung đã sửa trong admin vẫn được giữ nguyên.

## Chạy thử trên máy (không bắt buộc)

```
npm install
echo ADMIN_PASSWORD=matkhau123 > .dev.vars
npm run cf:dev
```

Sau đó mở http://localhost:8787. Lệnh `npm start` vẫn chạy được bản Node.js cũ, dùng ổ đĩa thay cho D1 và R2.

// Field definitions for each editable collection. The server uses them to clean
// incoming data; the admin UI uses them to build its forms.
const S = {
  courses: {
    label: 'Khóa học', key: 'id', title: 'name', sub: '{price}đ · {weeks} tuần · {id}',
    fields: [
      { k: 'id', t: 'slug', l: 'Mã khóa học', req: true, help: 'Viết liền không dấu, ví dụ: autocad. Lịch khai giảng dùng mã này.' },
      { k: 'name', t: 'text', l: 'Tên khóa học', req: true },
      { k: 'cat', t: 'select', l: 'Nhóm', opts: [['draw', 'Triển khai 2D'], ['model', 'Thiết kế 3D'], ['render', 'Render & hậu kỳ'], ['combo', 'Combo']] },
      { k: 'desc', t: 'textarea', l: 'Mô tả ngắn' },
      { k: 'level', t: 'text', l: 'Trình độ', ph: 'Cơ bản' },
      { k: 'weeks', t: 'number', l: 'Số tuần' },
      { k: 'sessions', t: 'number', l: 'Số buổi' },
      { k: 'price', t: 'text', l: 'Học phí (đ)', ph: '3.500.000', help: 'Để trống sẽ hiện "Liên hệ".' },
      { k: 'old', t: 'text', l: 'Giá gốc (đ, gạch ngang)' },
      { k: 'hot', t: 'text', l: 'Nhãn nổi bật', ph: 'Bán chạy' },
      { k: 'details', t: 'lines', l: 'Quyền lợi trong khóa (mỗi dòng một ý)', help: 'Để trống sẽ dùng danh sách mặc định.' },
      { k: 'keywords', t: 'text', l: 'Từ khóa cho chatbot (cách nhau dấu phẩy)', ph: 'autocad, cad' },
      { k: 'image', t: 'image', l: 'Ảnh bìa', help: 'Không có ảnh sẽ dùng nền màu bên dưới.' },
      { k: 'g', t: 'text', l: 'Ký hiệu trên bìa', ph: 'Ac', max: 4 },
      { k: 'c1', t: 'color', l: 'Màu bìa 1' },
      { k: 'c2', t: 'color', l: 'Màu bìa 2' },
    ],
  },
  schedule: {
    label: 'Lịch khai giảng', key: 'uid', title: '{date}', sub: '{course} · {time} · {hour}',
    fields: [
      { k: 'course', t: 'course', l: 'Khóa học', req: true },
      { k: 'date', t: 'date', l: 'Ngày khai giảng', req: true },
      { k: 'time', t: 'text', l: 'Lịch học', ph: 'T2 · T4 · T6' },
      { k: 'hour', t: 'text', l: 'Giờ học', ph: '18:30 – 20:30' },
      { k: 'mode', t: 'select', l: 'Hình thức', opts: [['Tại lớp + Online', 'Tại lớp + Online'], ['Tại lớp', 'Tại lớp'], ['Online', 'Online']] },
      { k: 'status', t: 'select', l: 'Trạng thái', opts: [['auto', 'Tự động (trong 7 ngày là "Sắp khai giảng")'], ['open', 'Đang nhận đăng ký'], ['soon', 'Sắp khai giảng'], ['full', 'Đã đủ học viên']] },
    ],
    help: 'Lớp đã qua ngày khai giảng sẽ tự ẩn khỏi website.',
  },
  works: {
    label: 'Sản phẩm khóa học', key: 'uid', title: 'name', sub: '{st} · {course}',
    fields: [
      { k: 'name', t: 'text', l: 'Tên sản phẩm', req: true },
      { k: 'desc', t: 'textarea', l: 'Mô tả' },
      { k: 'st', t: 'text', l: 'Học viên' },
      { k: 'course', t: 'text', l: 'Khóa học' },
      { k: 'k', t: 'select', l: 'Loại', opts: [['model', 'Dựng hình 3D'], ['render', 'Render & hậu kỳ'], ['draw', 'Triển khai 2D & BIM']] },
      { k: 'sw', t: 'text', l: 'Phần mềm dùng (cách nhau dấu phẩy)' },
      { k: 'image', t: 'image', l: 'Ảnh sản phẩm' },
      { k: 'gallery', t: 'lines', l: 'Bộ ảnh thêm (mỗi dòng một đường dẫn ảnh)', help: 'Hiện khi khách bấm vào sản phẩm. Có thể dán link ảnh /uploads/... đã tải lên.' },
      { k: 'sources', t: 'lines', l: 'Trang gốc trên web cũ', help: 'Web tự lấy ảnh từ các trang này khi chưa có bộ ảnh. Có thể để trống.' },
      { k: 'big', t: 'bool', l: 'Hiển thị ô lớn' },
      { k: 'c1', t: 'color', l: 'Màu nền 1 (khi chưa có ảnh)' },
      { k: 'c2', t: 'color', l: 'Màu nền 2' },
    ],
  },
  banners: {
    label: 'Ảnh trình chiếu', key: 'uid', title: 'title', sub: '{link}',
    help: 'Các ảnh chạy lần lượt ở đầu trang chủ. Nên dùng ảnh ngang khoảng 1920×720 (ví dụ ảnh lịch khai giảng, ảnh lớp học, ưu đãi). Chưa có ảnh nào thì web tự hiện slide giới thiệu và lịch khai giảng.',
    fields: [
      { k: 'image', t: 'image', l: 'Ảnh', req: true },
      { k: 'title', t: 'text', l: 'Tên ảnh (để quản lý, không bắt buộc hiện)', ph: 'Lịch khai giảng tháng 12' },
      { k: 'caption', t: 'text', l: 'Chữ hiện trên ảnh (để trống nếu ảnh đã có chữ)' },
      { k: 'link', t: 'text', l: 'Bấm vào ảnh thì mở link', ph: '/lich-khai-giang', help: 'Có thể là link trong web (/khoa-hoc/autocad) hoặc link ngoài (https://...).' },
    ],
  },
  testimonials: {
    label: 'Feedback', key: 'uid', title: 'n', sub: '{r}',
    fields: [
      { k: 'n', t: 'text', l: 'Tên học viên', req: true },
      { k: 'r', t: 'text', l: 'Vai trò · khóa học' },
      { k: 'q', t: 'textarea', l: 'Nội dung feedback', req: true },
      { k: 'out', t: 'text', l: 'Kết quả sau khóa học' },
      { k: 'stars', t: 'number', l: 'Số sao (1 – 5)', min: 1, max: 5 },
      { k: 'c', t: 'color', l: 'Màu ảnh đại diện' },
    ],
  },
  library: {
    label: 'Thư viện', key: 'uid', title: 'name', sub: '{meta}',
    fields: [
      { k: 'name', t: 'text', l: 'Tên tài nguyên', req: true },
      { k: 'desc', t: 'textarea', l: 'Mô tả' },
      { k: 't', t: 'select', l: 'Loại', opts: [['ebook', 'Ebook'], ['video', 'Video'], ['model', 'File mẫu & đề bài'], ['cheat', 'Phím tắt']] },
      { k: 'meta', t: 'text', l: 'Thông tin thêm', ph: 'PDF · 96 trang' },
      { k: 'link', t: 'url', l: 'Link tải (https://...)', help: 'Có link thì thẻ sẽ bấm được để tải.' },
      { k: 'ico', t: 'text', l: 'Nhãn biểu tượng', ph: 'PDF', max: 4 },
      { k: 'c', t: 'color', l: 'Màu biểu tượng' },
    ],
  },
  faqs: {
    label: 'Hỏi đáp', key: 'uid', title: 'q',
    fields: [
      { k: 'q', t: 'text', l: 'Câu hỏi', req: true },
      { k: 'a', t: 'textarea', l: 'Trả lời', req: true },
    ],
  },
  posts: {
    label: 'Bài viết', key: 'uid', title: 'title', sub: '{tag} · {date}', flag: 'published',
    fields: [
      { k: 'title', t: 'text', l: 'Tiêu đề', req: true },
      { k: 'slug', t: 'slug', l: 'Đường dẫn', help: 'Để trống sẽ tự tạo từ tiêu đề.' },
      { k: 'tag', t: 'text', l: 'Chủ đề', ph: 'Tư duy' },
      { k: 'excerpt', t: 'textarea', l: 'Tóm tắt' },
      { k: 'date', t: 'date', l: 'Ngày đăng' },
      { k: 'readMins', t: 'number', l: 'Phút đọc' },
      { k: 'published', t: 'bool', l: 'Hiển thị trên website' },
      { k: 'cover', t: 'image', l: 'Ảnh bìa' },
      { k: 'c1', t: 'color', l: 'Màu bìa 1 (khi chưa có ảnh)' },
      { k: 'c2', t: 'color', l: 'Màu bìa 2' },
      { k: 'content', t: 'html', l: 'Nội dung bài viết' },
    ],
  },
};

const { HOME_SETTINGS } = require('./sections');
const SETTINGS = [
  { group: 'Thông tin chung', fields: [
    { k: 'siteName', t: 'text', l: 'Tên thương hiệu' },
    { k: 'metaDescription', t: 'textarea', l: 'Mô tả website (hiện trên Google, Facebook)' },
    { k: 'footerText', t: 'textarea', l: 'Giới thiệu ngắn ở chân trang' },
    { k: 'accent', t: 'color', l: 'Màu nhấn chính' },
  ]},
  { group: 'Liên hệ', fields: [
    { k: 'address', t: 'text', l: 'Địa chỉ' },
    { k: 'hotline', t: 'text', l: 'Hotline' },
    { k: 'email', t: 'text', l: 'Email' },
    { k: 'hours', t: 'text', l: 'Giờ làm việc' },
    { k: 'footerPhones', t: 'textarea', l: 'Số điện thoại ở chân trang (mỗi dòng một số)', ph: '0378 423 797 - Ms Trang', help: 'Để trống sẽ dùng Hotline.' },
    { k: 'communityLinks', t: 'textarea', l: 'Link cộng đồng ở chân trang (mỗi dòng: Tên | link)', ph: 'Nhóm Facebook Betagon | https://facebook.com/groups/...' },
  ]},
  { group: 'Mạng xã hội & chat', fields: [
    { k: 'facebook', t: 'url', l: 'Facebook' },
    { k: 'youtube', t: 'url', l: 'YouTube' },
    { k: 'tiktok', t: 'url', l: 'TikTok' },
    { k: 'zalo', t: 'url', l: 'Zalo' },
    { k: 'chatZalo', t: 'url', l: 'Link chat Zalo OA (trong khung chatbot)' },
    { k: 'chatMessenger', t: 'url', l: 'Link Messenger (trong khung chatbot)' },
  ]},
  { group: 'Bật / tắt các mục trên toàn website', fields: [{ k: 'sections', t: 'sections', l: 'Mục nào tắt ở đây sẽ ẩn khỏi menu, trang riêng và trang chủ' }] },
  ...HOME_SETTINGS,
];
const SECTIONS = [['schedule', 'Lịch khai giảng'], ['courses', 'Khóa học'], ['products', 'Sản phẩm khóa học'], ['feedback', 'Feedback'], ['library', 'Thư viện'], ['blog', 'Bài viết'], ['faq', 'Hỏi đáp'], ['chatbot', 'Chatbot tư vấn']];

module.exports = { S, SETTINGS, SECTIONS };

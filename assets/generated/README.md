# Generated asset workspace

Thư mục này dành cho asset nguyên bản được tạo hoặc chỉnh bằng `imagegen`,
`canvas-design` hoặc công cụ đồ họa được duyệt. Asset không tự động trở thành
runtime asset chỉ vì nằm trong thư mục này; code phải import rõ ràng.

## Cấu trúc khi có asset

```text
assets/generated/
  concepts/<feature>/       # concept để review, không import vào app
  production/<feature>/     # file đã duyệt và được phép import
  prompts/<feature>/        # brief/prompt/provenance dạng Markdown
```

Chỉ tạo subfolder khi có asset thật. Không commit output thử hàng loạt, PSD/cache,
ảnh tham chiếu không có quyền sử dụng hoặc file được tải lại từ Riot CDN.

## Quy trình

1. Copy [`ASSET_BRIEF_TEMPLATE.md`](ASSET_BRIEF_TEMPLATE.md) vào
   `prompts/<feature>/<asset>.md` và điền mục đích, kích thước, nền, safe area,
   visual direction và tiêu chí duyệt.
2. Dùng `imagegen` cho bitmap/texture/illustration hoặc `canvas-design` cho static
   composition. Icon/logo đơn giản nên dùng vector/code-native hiện có.
3. Lưu concept vào `concepts/`; review crop, alpha, contrast và readability ở kích
   thước render thật. Không đánh giá chỉ bằng ảnh phóng lớn.
4. Promote duy nhất bản được duyệt vào `production/`, giữ sidecar brief/provenance
   và tên ổn định: `<feature>-<role>-<variant>@<scale>.<ext>`.
5. Import bằng `require()`/module rõ ràng, khai báo trước width/height và kiểm tra
   Android + web fallback nếu route hỗ trợ web.
6. Chạy `pnpm run check`, Android export budget và device screenshot trước khi
   bàn giao.

## Ràng buộc

- Tạo thiết kế nguyên bản; không bắt chước artist còn sống hoặc sao chép artwork.
- Không nhúng token, Riot cookie, PUUID, tài khoản thật hoặc dữ liệu người dùng.
- Không tự tái tạo logo/skin/agent Valorant để thay cho asset upstream hợp lệ.
- Splash/icon native cần cập nhật từ `app.json` và tăng native version khi phát
  hành; OTA không thay được binary/native launcher asset.
- Ghi license/provenance và công cụ tạo trong brief. Nếu không chứng minh được
  quyền sử dụng, asset không được promote.

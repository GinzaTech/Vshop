/**
 * ICurrency – Thông tin một loại tiền tệ (dùng cho quy đổi/hiển thị giá).
 * code: mã ISO (VD: "VND"); symbol: ký hiệu (VD: "₫");
 * minimum: bước giá nhỏ nhất; zeroDecimal: true nếu tiền tệ không có số lẻ.
 */
interface ICurrency {
  code: string;
  symbol: string;
  minimum: number;
  zeroDecimal: boolean;
}

// ===== CurrencyIcon.tsx =====
// Component hiển thị icon tiền tệ của Valorant: VP (Valorant Points), RAD (Radianite), KC (Kingdom Credits).
import { Image, View } from "react-native";

import { StyleProp, ImageStyle } from "react-native";

// Interface định nghĩa props cho CurrencyIcon
// icon: loại tiền tệ - "vp" | "rad" | "kc"
// paper: nếu true, render icon trong khung hình vuông lớn hơn (dùng cho chế độ giấy/ticket)
// style: style tùy chỉnh cho Image (chỉ dùng khi paper=false)
interface props {
  icon: "vp" | "rad" | "kc";
  paper?: boolean;
  style?: StyleProp<ImageStyle>;
}

// CurrencyIcon: Component chính
// Dựa vào props.icon để chọn ảnh tương ứng (vp.png, rad.png, kc.png)
// Nếu paper=true: bọc trong View 40x40, ảnh 22x22, dùng cho chế độ hiển thị lớn
// Nếu paper=false: ảnh 15x15, có thể tùy chỉnh style, dùng cho chế độ nhỏ (trong card, badge)
export default function CurrencyIcon(props: props) {
  return (
    <>
      {props.paper ? (
        // Chế độ paper: khung 40x40, icon 22x22, căn giữa
        // marginRight: 15 để tạo khoảng cách
        <View
          style={{
            margin: 8,
            height: 40,
            width: 40,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            style={{ width: 22, height: 22, marginRight: 15 }}
            source={
              props.icon === "vp"
                ? require("~/assets/images/vp.png")
                : (props.icon === "rad"
                  ? require("~/assets/images/rad.png")
                  : require("~/assets/images/kc.png")
                )
            }
            {...props}
          />
        </View>
      ) : (
        // Chế độ thường: ảnh 15x15, có thể truyền style từ ngoài vào
        <Image
          style={[{ width: 15, height: 15 }, props.style]}
          source={
            props.icon === "vp"
              ? require("~/assets/images/vp.png")
              : props.icon === "rad"
                ? require("~/assets/images/rad.png")
                : require("~/assets/images/kc.png")
          }
          {...props}
        />
      )}
    </>
  );
}

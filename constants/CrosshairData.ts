// ===== CrosshairData.ts – Dữ liệu crosshair mẫu (pro player, content, fun) =====

// CrosshairType: các kiểu crosshair có thể vẽ
export type CrosshairType = "cross" | "dot" | "box" | "circle";

// CrosshairData: cấu trúc dữ liệu cho một crosshair
export interface CrosshairData {
  name: string;           // Tên người dùng
  team: string;           // Team/CLB
  code: string;           // Mã crosshair
  tags: string[];         // Tag mô tả
  category: "Pro" | "Content" | "Fun"; // Thể loại
  style: { type: CrosshairType; color: string; thickness?: number; gap?: number; };
}

// CROSSHAIR_DB: danh sách crosshair mẫu từ các pro player, content creator, vui
export const CROSSHAIR_DB: CrosshairData[] = [
  { name: "TenZ", team: "SEN", category: "Pro", code: "0;s;1;P;c;5;h;0;m;1;0l;4;0o;2;0a;1;0f;0;1b;0;S;c;4;o;1", tags: ["Cyan", "Standard"], style: { type: "cross", color: "#00FFFF", thickness: 2, gap: 2 } },
  { name: "Yay", team: "BLD", category: "Pro", code: "0;P;h;0;f;0;0l;4;0o;0;0a;1;0f;0;1b;0", tags: ["White", "Cross"], style: { type: "cross", color: "#FFFFFF", thickness: 2, gap: 0 } },
  { name: "ScreaM", team: "KC", category: "Pro", code: "0;P;c;5;o;1;d;1;z;3;f;0;0t;6;0l;0;0a;1;0f;0;1b;0", tags: ["Cyan", "Dot"], style: { type: "dot", color: "#00FFFF", thickness: 4 } },
  { name: "Boaster", team: "FNC", category: "Pro", code: "0;s;1;P;c;1;o;1;d;1;0l;0;0o;2;0a;1;0f;0;1t;0;1l;0;1o;0;1a;0;S;c;1;o;1", tags: ["Green", "Box"], style: { type: "box", color: "#00FF00", thickness: 2 } },
  { name: "Demon1", team: "NRG", category: "Pro", code: "0;s;1;P;o;1;d;1;m;1;0b;0;1b;0", tags: ["White", "Dot"], style: { type: "dot", color: "#FFFFFF", thickness: 3 } },
  { name: "Aspas", team: "LEV", category: "Pro", code: "0;P;c;5;o;1;d;1;z;3;f;0;0b;0;1b;0", tags: ["Cyan", "Small"], style: { type: "cross", color: "#00FFFF", thickness: 1, gap: 0 } },
  { name: "Grim", team: "CONTENT", category: "Content", code: "0;p;0;s;1;P;c;5;u;000000FF;h;0;f;0;0l;4;0v;4;0g;1;0o;2;0a;1;0f;0;1b;0", tags: ["Grim Wall", "Line"], style: { type: "cross", color: "#FF0000", thickness: 1, gap: 4 } },
  { name: "Smiley", team: "FUN", category: "Fun", code: "0;P;c;8;u;FF0000FF;h;0;d;1;b;1;z;3;0t;10;0l;2;0v;0;0g;1;0o;4;0a;1;0f;0;1t;1;1l;0;1v;4;1g;1;1o;0;1a;1;1m;0;1f;0", tags: ["Troll", "Face"], style: { type: "circle", color: "#FFA500" } },
];

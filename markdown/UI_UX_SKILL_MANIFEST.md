# UI/UX skill manifest

Snapshot cài đặt ngày **2026-09-22** cho user scope
`C:\Users\kona\.codex\skills`. Các SHA dưới đây là commit `main` đã tải khi cài;
không phải dependency runtime của APK và không được bundle vào VShop.

| Skill | Repository/path | Commit |
|---|---|---|
| `frontend-design` | `anthropics/skills:skills/frontend-design` | `34040c9c568585f6929bedeaad110ad08f079624` |
| `canvas-design` | `anthropics/skills:skills/canvas-design` | `34040c9c568585f6929bedeaad110ad08f079624` |
| `animations` | `software-mansion-labs/skills:skills/react-native-best-practices/references/animations` | `e3f00cdb34942cee8b788abe10fe0d78a7f2b4e9` |
| `gestures` | `software-mansion-labs/skills:skills/react-native-best-practices/references/gestures` | `e3f00cdb34942cee8b788abe10fe0d78a7f2b4e9` |
| `ui-ux-pro-max` | `nextlevelbuilder/ui-ux-pro-max-skill:.claude/skills/ui-ux-pro-max` | `dcc40ff5133ef78276117db0cc34e7b83cc8aeba` |
| `mobile-accessibility` | `community-access/accessibility-agents:codex-skills/mobile-accessibility` | `161c60c7493ad657f371ad8f91253d33c3b12044` |
| `brainstorming` | `obra/superpowers:skills/brainstorming` | `5bf4e78011075bcfc0dc295f0724994cd123ee71` |
| `writing-plans` | `obra/superpowers:skills/writing-plans` | `5bf4e78011075bcfc0dc295f0724994cd123ee71` |
| `executing-plans` | `obra/superpowers:skills/executing-plans` | `5bf4e78011075bcfc0dc295f0724994cd123ee71` |

`imagegen` là system skill có sẵn của Codex và `react-native-best-practices` đã
tồn tại trước snapshot này. Chúng được dùng trong workflow nhưng không được tính
là chín skill mới ở bảng trên.

## Verification tại thời điểm cài

- `skills list -g --json` nhận đủ chín tên với `scope=global`, agent `Codex`.
- Mọi package có `SKILL.md`; không có symlink/reparse point trong các thư mục mới.
- `ui-ux-pro-max/scripts/validate_data.py` PASS: 12 domain, 22 stack và
  `ui-reasoning.csv` hợp lệ.
- Python support scripts compile; Node helper/server của visual companion pass
  syntax check. Visual companion chưa được chạy và không tự khởi động.

Khi update skill, đọc diff upstream, chạy lại các kiểm tra trên và cập nhật SHA
trong file này. Không dùng `skills update -g` mù rồi coi thay đổi là trusted.

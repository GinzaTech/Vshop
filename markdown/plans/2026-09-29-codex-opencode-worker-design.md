# Codex–OpenCode GLM Worker — Design

**Ngày:** 2026-09-29

**Trạng thái:** approved — người dùng duyệt bản spec bằng tin nhắn `duyệt`

**Workspace chính:** `C:\Users\kona\Desktop\Project\Vshop`

**Coordinator và reviewer cuối:** Codex trong chat hiện tại

**Implementation worker:** OpenCode CLI dùng đúng model GLM 5.3 đã được xác minh từ model registry của OpenCode

## 1. Mục tiêu

Thiết lập một workflow cục bộ để Codex có thể giao phần implementation đã được
đóng phạm vi cho OpenCode, trong khi Codex vẫn chịu trách nhiệm về plan, quyền
ghi file, kiểm tra diff, test, review và quyết định cuối cùng.

Kết quả cần đạt:

1. Codex tạo plan hoặc task packet có objective, acceptance criteria, file
   ownership và lệnh verification cụ thể.
2. Codex tạo một worktree riêng cho task và chỉ định đường dẫn đó cho runner.
3. Runner gọi OpenCode CLI ở chế độ non-interactive bằng custom agent
   `codex-worker` và model GLM 5.3 chính xác.
4. OpenCode chỉ được sửa các path đã allowlist, không được commit, push, release,
   đổi credential hoặc thao tác phá hủy Git.
5. Runner chờ write window ổn định, kiểm tra path scope và lưu evidence đã
   sanitize ở ngoài repository.
6. Codex đọc toàn bộ diff, chạy quality gates phù hợp và đưa finding cụ thể trở
   lại OpenCode khi cần sửa.
7. Chỉ Codex mới được kết luận task hoàn tất hoặc đưa patch đã duyệt về checkout
   chính.

Workflow này không biến OpenCode thành agent tự trị toàn quyền và không làm
OpenCode trở thành nguồn chuẩn cho plan, acceptance criteria hoặc trạng thái
release.

## 2. Hiện trạng có bằng chứng

- OpenCode Desktop `1.18.32` đang được cài tại
  `C:\Users\kona\AppData\Local\Programs\@opencode-aidesktop\OpenCode.exe`.
- Updater Desktop đã tải `1.18.33` nhưng bản đang chạy/được cài vẫn là
  `1.18.32` tại thời điểm thiết kế.
- Máy chưa có executable `opencode` trong `PATH`; Desktop và CLI là hai surface
  riêng.
- Node `22.19.0`, npm `11.19.0` và pnpm `11.24.0` đã sẵn sàng.
- `C:\Users\kona\.config\opencode\opencode.jsonc` hiện chỉ cấu hình
  `shell: powershell`.
- `opencode.json` của VShop hiện chỉ nạp plugin `ecc-universal`.
- Local OpenCode state có model string `glm-5.2`; chưa có bằng chứng local cho
  model ID GLM 5.3.
- Checkout chính đang có thay đổi chưa commit trong:
  - `components/ui/AppRefreshControl.web.tsx`;
  - `components/ui/AppViewport.tsx`.
- Lịch sử vận hành trước đây cho thấy OpenCode có thể tiếp tục ghi sau lần
  validation đầu tiên. Vì vậy process exit đơn lẻ không đủ làm bằng chứng cho
  một write window ổn định.

## 3. Quyết định kiến trúc

Chế độ mặc định là **isolated worktree per task**:

```text
User request
     |
     v
Codex: clarify -> plan -> task packet -> create isolated worktree
     |
     v
guarded runner -> OpenCode CLI -> GLM 5.3 codex-worker
     |                              |
     |                              +-> edits allowlisted paths only
     |                              +-> targeted tests only
     |                              +-> no commit/push/release
     v
stable-write + scope audit + sanitized evidence
     |
     v
Codex: full diff review -> verification gates -> findings
     |                                      |
     |<---------- bounded repair round -----+
     |
     v
approved patch/commit or explicit NOT VERIFIED report
```

OpenCode không chạy trực tiếp trong checkout chính theo mặc định. Một task chỉ
được chạy trong checkout chính nếu người dùng yêu cầu rõ và Codex truyền cờ
override có chủ đích sau khi đã snapshot toàn bộ dirty state. Bản đầu tiên không
cần hỗ trợ override này; YAGNI ưu tiên worktree-only.

Worktree là boundary bảo vệ chính. Permission của OpenCode và post-run audit là
hai lớp bổ sung, không thay thế isolation.

## 4. Các lựa chọn đã cân nhắc

### 4.1 Worktree riêng — được chọn

- Cô lập edit khỏi checkout chính và các file người dùng đang sửa.
- Cho phép giữ toàn bộ patch lỗi để review mà không cần auto-revert.
- Có thể archive worktree sau khi patch được duyệt hoặc bỏ.
- Tốn thêm checkout và có thể cần cài/link dependency trong worktree mới.

### 4.2 Chạy trực tiếp trong checkout chính

- Ít chi phí setup hơn và dùng ngay dependency/cache hiện có.
- Rủi ro đè dirty state, khó phân biệt writer và khó rollback chính xác nếu
  agent chạm path ngoài scope.
- Không dùng làm mặc định.

### 4.3 Điều khiển OpenCode Desktop bằng UI automation

- Tận dụng trực tiếp session Desktop nhưng phụ thuộc focus, timing và trạng thái
  cửa sổ.
- Khó capture machine-readable result, timeout và exit status.
- Không phù hợp cho orchestration lặp lại; Desktop vẫn có thể dùng thủ công.

## 5. Artifact và ownership

| Artifact | Trách nhiệm | Boundary |
|---|---|---|
| `skills/codex-opencode-handoff/SKILL.md` | Workflow chuẩn cho Codex: plan, worktree, task packet, run, review, repair, handoff | Canonical skills-first surface; không chứa credential hoặc model fallback |
| `.opencode/agents/codex-worker.md` | Prompt và permission baseline của implementation worker | Không tự lập lại scope; không commit/push/release |
| `scripts/run-opencode-worker.cjs` | Validate input, gọi CLI, timeout, capture evidence, stable-write và scope audit | Không tạo/merge/delete worktree; không auto-revert |
| `scripts/lib/opencode-worker-policy.cjs` | Pure validation cho task packet, path, command và result classification | Không spawn process hoặc ghi Git state |
| `scripts/lib/opencode-worker-runtime.cjs` | Git/worktree inspection, child-process lifecycle, stable-write fingerprint và evidence store | Mọi side effect phải inject được trong test |
| `__tests__/opencode-worker-policy.test.js` | Unit/contract tests cho policy và hostile inputs | Không gọi model/provider thật |
| `__tests__/opencode-worker-runtime.test.js` | Unit tests cho Git/process/stable-write/evidence lifecycle | Dùng dependency injection, không gọi model thật |
| `__tests__/opencode-worker-runner.test.js` | Orchestration tests cho preflight, worker result và scope failure | Dùng fake CLI/runtime |
| `package.json` | Script nội bộ để gọi runner bằng pnpm | Không thêm OpenCode vào dependency của app |
| `%LOCALAPPDATA%\CodexOpenCode\Vshop\runs\<run-id>` | Sanitized transcript, metadata, pre/post status, review evidence | Nằm ngoài Git; không chứa API key/auth file |

OpenCode CLI được cài global bằng pnpm và không được thêm vào
`dependencies`/`devDependencies` của VShop. App runtime, Expo bundle và release
artifact không phụ thuộc CLI hoặc workflow này.

## 6. Cài CLI và version compatibility

Implementation phải:

1. Đọc version OpenCode Desktop đang cài.
2. Kiểm tra package version tương ứng có tồn tại trong registry.
3. Cài OpenCode CLI bằng pnpm global, ưu tiên cùng version với Desktop đang cài
   để tránh accidental config/database migration giữa hai version khác nhau.
4. Chạy `opencode --version` và xác nhận executable trong `PATH`.
5. Chạy `opencode auth list`; chỉ ghi tên provider/status, không đọc hoặc in nội
   dung `auth.json`.
6. Chạy `opencode models --refresh` rồi lấy exact model ID theo format
   `provider/model`.

Nếu CLI cùng version không tồn tại hoặc CLI muốn migration shared state, dừng và
báo trước khi tiếp tục. Không nâng Desktop, không sửa database và không thay đổi
credential như một side effect của setup.

## 7. Model resolution và credential boundary

GLM 5.3 là hard requirement cho worker ban đầu:

- Không hard-code model ID dựa trên tên marketing.
- Model chỉ được chọn sau khi xuất hiện trong kết quả
  `opencode models --refresh` của provider đã authenticate.
- Runner nhận exact `provider/model` qua task packet hoặc config đã xác minh.
- Nếu chỉ có GLM 5.2, runner trả `MODEL_NOT_AVAILABLE`; không tự fallback.
- Nếu provider chưa authenticate, setup dừng ở `PROVIDER_AUTH_REQUIRED`.

Credential không được gửi qua chat, command-line argument, task packet, log hoặc
Git. Nếu cần login mới, người dùng nhập key trực tiếp vào OpenCode auth flow;
Codex chỉ xác minh provider/status sau đó.

## 8. Task packet contract

Runner nhận một JSON file do Codex tạo ở thư mục tạm ngoài repository:

```json
{
  "schemaVersion": 1,
  "taskId": "short-kebab-id",
  "title": "Human-readable task title",
  "objective": "Concrete implementation outcome",
  "workspace": "C:\\absolute\\managed-worktree",
  "model": "verified-provider/verified-glm-5.3-id",
  "planPath": "markdown/plans/YYYY-MM-DD-task.md",
  "allowedPaths": ["services/example/**", "__tests__/example.test.ts"],
  "protectedPaths": [],
  "acceptanceCriteria": ["Observable criterion"],
  "targetedCommands": [
    {
      "executable": "pnpm",
      "args": ["exec", "jest", "__tests__/example.test.ts", "--runInBand"]
    }
  ],
  "timeoutMinutes": 45,
  "maxRepairRounds": 2
}
```

Validation fail-closed:

- `workspace` phải là absolute path, resolve thành root của một Git worktree và
  khác checkout VShop chính.
- Worktree phải sạch trước lượt đầu, trừ artifact runner đã allowlist rõ.
- `allowedPaths`, `protectedPaths` và `planPath` phải là relative path chuẩn hóa;
  cấm absolute path, `..`, drive prefix, UNC và path thoát root.
- Allowed và protected path không được overlap.
- `targetedCommands` chỉ nhận object `{ executable, args }`; executable và từng
  argument phải khớp command policy. Không nhận raw shell string, shell
  separator, redirection, encoded PowerShell hoặc executable tùy ý.
- Timeout mặc định 45 phút, hard cap 120 phút.
- Repair round hard cap 2; vượt cap phải trả quyền xử lý về Codex.

Task packet không chứa source diff, token, cookie, environment dump hoặc raw
credential. Prompt có thể tham chiếu plan trong worktree và yêu cầu worker đọc
file bằng tool bình thường.

## 9. OpenCode agent contract

`codex-worker` là primary implementation agent chuyên thực thi plan đã có:

- Bắt buộc đọc `AGENTS.md`, plan và các file trực tiếp liên quan trước khi sửa.
- Làm RED → GREEN → refactor cho bug fix/feature có testable behavior.
- Chỉ sửa path đã được task packet cho phép.
- Không sửa test để hợp thức hóa implementation sai.
- Không tự mở rộng scope, đổi dependency, đổi architecture hoặc tạo release.
- Không đọc `.env`, OpenCode auth state, signing material, cookie/token/log chứa
  credential hoặc path ngoài worktree.
- Không chạy subagent khác trong lượt worker đầu tiên.
- Không commit, push, merge, rebase, checkout, reset, clean, stash hoặc tag.
- Không chạy EAS publish/build, package publish, ADB mutation hoặc endpoint Riot
  có side effect.
- Kết thúc bằng structured summary: file sửa, test đã chạy, kết quả, giới hạn và
  mục còn `NOT VERIFIED`.

Static agent permission chặn hành vi luôn cấm. Runner bổ sung permission theo
task để edit chỉ match `allowedPaths`. Shell chỉ cho phép Git read-only,
search/inspection và exact targeted test commands. Dù permission báo thành
công, post-run scope audit vẫn bắt buộc.

## 10. Runner lifecycle

### 10.1 Preflight

1. Parse và schema-validate task packet.
2. Resolve/verify Git worktree root và current commit.
3. Yêu cầu baseline clean; lưu `HEAD`, `git status --porcelain=v1` và timestamp.
4. Xác minh CLI version, authenticated provider và exact model.
5. Tạo run directory ngoài repository với ACL mặc định của user hiện tại.
6. Tạo permission JSON trong process environment; không ghi credential.

### 10.2 Execute

Runner spawn OpenCode trực tiếp, không qua shell string interpolation:

```text
opencode run
  --dir <verified-worktree>
  --model <verified-provider/model>
  --agent codex-worker
  --format json
  --title <task-id>
  --auto
  <generated-bounded-prompt>
```

Arguments được truyền bằng array cho `child_process.spawn`. Prompt chỉ được tạo
từ field đã validate; không nối thành PowerShell/cmd command line. `--auto` chỉ
auto-approve rule chưa bị deny; destructive và out-of-scope rule vẫn deny.

Runner stream output để Codex theo dõi, đồng thời capture session/run ID. Khi
timeout, runner chấm dứt đúng process tree do nó tạo và trả `TIMEOUT`; không kill
mọi process tên OpenCode trên máy.

### 10.3 Stable-write window

Sau khi CLI exit:

1. Poll Git status và mtime của changed paths.
2. Chỉ coi ổn định khi fingerprint không đổi liên tục ít nhất 10 giây.
3. Tổng thời gian chờ ổn định tối đa 60 giây.
4. Nếu còn thay đổi, trả `WRITE_WINDOW_UNSTABLE`; không chạy final gate, merge,
   commit hoặc archive worktree.

### 10.4 Post-run audit

- Liệt kê toàn bộ tracked/untracked path thay đổi so với baseline.
- Reject path ngoài `allowedPaths` hoặc bên trong `protectedPaths`.
- Chạy `git diff --check`.
- Chạy secret/artifact guard cho `.env`, key, APK, build/cache/log.
- Lưu pre/post status, changed path list, exit code và sanitized OpenCode export.
- Không auto-revert violation; worktree bị giữ nguyên để Codex điều tra.

Result status:

```text
PASS_TO_REVIEW
MODEL_NOT_AVAILABLE
PROVIDER_AUTH_REQUIRED
INVALID_TASK_PACKET
DIRTY_BASELINE
PERMISSION_DENIED
TIMEOUT
WRITE_WINDOW_UNSTABLE
SCOPE_VIOLATION
NO_CHANGES
WORKER_FAILED
```

`PASS_TO_REVIEW` chỉ có nghĩa patch sẵn sàng cho Codex review, không có nghĩa
implementation đúng hoặc task hoàn tất.

`NO_CHANGES` được dùng khi worker exit thành công nhưng không tạo diff/untracked
artifact trong allowlist; trạng thái này không được nâng thành `PASS_TO_REVIEW`.

## 11. Codex review và repair loop

Codex phải review độc lập sau mỗi worker run:

1. Đọc toàn bộ diff, không chỉ worker summary.
2. Đối chiếu từng acceptance criterion và project architecture.
3. Kiểm tra correctness, stale/race behavior, error handling, input boundary,
   security, accessibility và performance tùy phạm vi.
4. Chạy targeted tests độc lập.
5. Chạy `pnpm run check` trước handoff code.
6. Chạy Android Expo export theo `AGENTS.md` khi task có code/runtime impact.
7. Ghi rõ phần source/build/runtime nào PASS và phần nào `NOT VERIFIED`.

Finding cần sửa được gửi lại bằng repair packet chứa:

- exact finding và severity;
- file/line hoặc failing test;
- expected behavior;
- allowed paths không rộng hơn lượt đầu nếu không có approval mới.

Tối đa hai repair round cho cùng task. Sau đó Codex tự sửa phần còn lại hoặc báo
blocker; không tạo loop agent vô hạn.

## 12. Worktree lifecycle và đưa patch về checkout chính

- Codex tạo/reuse managed worktree bằng lifecycle tool hiện có; runner không tự
  quản lý Git worktree.
- Worktree được tạo từ base/ref mà Codex đã xác minh cho task.
- Dirty state của checkout chính không được copy ngầm.
- Nếu task phụ thuộc vào code chưa commit ở checkout chính, Codex phải dừng và
  thiết kế cách mang đúng dependency sang worktree; không tự stash/reset.
- Sau review PASS, Codex tạo commit rõ phạm vi trong worktree hoặc áp dụng patch
  bằng phương thức recoverable đã xác minh.
- Không push hoặc merge remote nếu người dùng chưa yêu cầu.
- Worktree chỉ được archive khi không còn process sử dụng và patch/evidence đã
  được account đầy đủ.

## 13. Security và failure boundaries

| Rủi ro | Guardrail |
|---|---|
| Model sửa file ngoài scope | Isolated worktree + dynamic edit permission + post-run path audit |
| Shell bypass edit permission | Exact command allowlist; deny arbitrary PowerShell/cmd and shell separators |
| Credential leak | Deny `.env`/auth paths; no key in prompt/env logs; sanitized export only |
| Destructive Git | Deny commit/push/reset/clean/checkout/rebase/merge/stash/tag |
| Agent tự release | Deny EAS/package publish và network mutation commands |
| Background writer sau exit | Stable-write fingerprint window; no merge before stable |
| Infinite repair loop | Hard cap hai repair rounds |
| Wrong model silently used | Exact refreshed model ID; no fallback |
| Checkout chính bị đè | Worktree-only default; main dirty files outside worker workspace |
| Worker summary sai | Codex reads complete diff and reruns verification independently |
| Logs/artifacts vào Git | Evidence outside repo + secret/artifact guard |

Runner không được sửa OpenCode database trực tiếp. Nếu database/config lỗi, phải
backup và dùng quy trình chẩn đoán riêng; orchestration setup không tự repair
shared state.

## 14. Testing strategy

TDD áp dụng cho runner policy và process boundary.

### 14.1 Unit tests

- Accept task packet hợp lệ.
- Reject absolute/traversal/UNC/mixed-separator path và symlink escape.
- Reject allowed/protected overlap.
- Reject main checkout và dirty worktree.
- Reject unknown model format và timeout/repair round vượt giới hạn.
- Reject shell separator, redirection, encoded command và destructive Git/EAS.
- Classify changed path đúng với allowlist glob.
- Redact representative token/cookie/authorization strings khỏi evidence.

### 14.2 Integration tests với fake CLI

- Fake executable nhận đúng argument array và cwd.
- PASS output tạo `PASS_TO_REVIEW` sau stable-write window.
- Non-zero exit tạo `WORKER_FAILED` và giữ evidence.
- Timeout chỉ kill spawned process tree.
- Late file writer tạo `WRITE_WINDOW_UNSTABLE`.
- Out-of-scope file tạo `SCOPE_VIOLATION` và không auto-revert.
- Raw secret canary không xuất hiện trong artifact sanitized.

Integration test không gọi GLM/provider thật và không dùng credential thật.

### 14.3 Live setup smoke test

Sau unit/integration PASS:

1. Xác minh CLI/version/auth/model listing.
2. Tạo disposable worktree sạch.
3. Giao một task documentation-only trong một path test allowlist.
4. Xác minh OpenCode chỉ sửa path đó và runner capture evidence.
5. Codex review patch, sau đó archive disposable worktree.

Nếu GLM 5.3 chưa có trong registry/provider của tài khoản, live worker run phải
ghi `NOT VERIFIED`; unit/integration fake CLI vẫn có thể PASS nhưng không được
gọi là model runtime proof.

## 15. Acceptance criteria

- [ ] `opencode` CLI được cài global, version compatibility đã xác minh và không
  thêm dependency vào VShop app.
- [ ] Auth status được kiểm tra mà không lộ/copy/sửa credential.
- [ ] Exact GLM 5.3 provider/model ID được xác minh bằng refreshed model list;
  nếu không có thì setup fail-closed, không fallback.
- [ ] `codex-worker` đọc project rules, chỉ implement plan đã giao và bị chặn
  commit/push/release/destructive Git.
- [ ] Runner từ chối checkout chính và dirty/non-worktree input theo mặc định.
- [ ] Task packet schema chặn path traversal, command injection và scope mơ hồ.
- [ ] Edit permission được thu hẹp theo allowlist và post-run audit phát hiện mọi
  changed path ngoài scope.
- [ ] Process timeout, stable-write window và repair cap có automated tests.
- [ ] Transcript/evidence được sanitize và nằm ngoài repository.
- [ ] Codex có thể đọc toàn bộ diff, chạy gates và phát repair packet tối đa hai
  vòng.
- [ ] Live disposable-worktree smoke test PASS với GLM 5.3, hoặc được ghi rõ
  `NOT VERIFIED` cùng lý do model/provider chưa sẵn sàng.
- [ ] `pnpm run check`, Android Expo export và `git diff --check` PASS cho phần
  implementation setup.
- [ ] Hai file UI dirty ban đầu không bị setup, test hoặc smoke task thay đổi.

## 16. Rollback

- Gỡ package CLI global bằng đúng package manager đã dùng, không chạy OpenCode
  uninstall có thể xóa shared config/data.
- Xóa script, policy helper, tests, skill và custom agent bằng commit revert có
  phạm vi rõ.
- Không xóa `~/.local/share/opencode`, OpenCode Desktop state hoặc credential.
- Disposable worktree được archive bằng worktree lifecycle tool sau khi xác minh
  không còn process và không còn patch cần giữ.
- Vì app runtime không phụ thuộc workflow, rollback không cần migration dữ liệu,
  Expo rebuild hoặc release mới.

## 17. Điều kiện dừng

Setup hoặc worker run phải dừng và báo người dùng khi:

- Không tìm thấy exact GLM 5.3 trong refreshed model list.
- CLI/Desktop version mismatch yêu cầu database/config migration chưa được duyệt.
- Provider yêu cầu key mới hoặc credential rotation.
- Worktree không sạch, base/ref không rõ hoặc task phụ thuộc dirty main checkout.
- Task không thể mô tả bằng allowed paths và acceptance criteria hữu hạn.
- Worker chạm path ngoài scope, còn ghi sau stable-write timeout hoặc cố chạy
  command bị deny.
- Full verification phát hiện failure mà repair round không xử lý được.
- Cần push, merge, release, publish hoặc thao tác external state chưa được người
  dùng yêu cầu rõ.

## 18. Ngoài phạm vi

- Không thay Codex bằng OpenCode làm planner/reviewer cuối.
- Không cho OpenCode tự nhận mọi user request hoặc chạy nền thường trực.
- Không expose OpenCode server ra LAN/Internet.
- Không tự động commit/push/merge/release.
- Không tự chọn GLM 5.2 hay model khác khi GLM 5.3 thiếu.
- Không chia sẻ OpenCode credential giữa máy hoặc đưa credential vào repository.
- Không sửa OpenCode Desktop database/state nếu setup CLI bình thường không đủ.
- Không hứa device/runtime verification nếu không thực sự quan sát thiết bị.

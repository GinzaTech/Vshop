const fs = require('fs');
const path = require('path');
const https = require('https');

// 1. Tìm và đọc file lockfile của Riot Client
const lockfilePath = path.join(process.env.LOCALAPPDATA, 'Riot Games', 'Riot Client', 'Config', 'lockfile');

if (!fs.existsSync(lockfilePath)) {
    console.error("Không tìm thấy Riot Client đang chạy! Vui lòng bật Valorant hoặc Riot Client lên trước.");
    process.exit(1);
}

const lockfile = fs.readFileSync(lockfilePath, 'utf8');
// lockfile có định dạng: name:PID:port:password:protocol
const [name, pid, port, password, protocol] = lockfile.split(':');

const auth = Buffer.from(`riot:${password}`).toString('base64');

// Cấu hình HTTPS client bỏ qua lỗi chứng chỉ (vì Riot Local API dùng self-signed cert)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Hàm gọi Local API của Riot Client
function riotLocalApi(method, endpoint, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '127.0.0.1',
            port: port,
            path: endpoint,
            method: method,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            agent: httpsAgent
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(data ? JSON.parse(data) : null);
                } catch (e) {
                    resolve(data);
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

// 2. Chạy bot
async function runBot() {
    console.log("Đã kết nối với Riot Client (Port:", port, ")");

    try {
        // Lấy danh sách bạn bè hiện tại
        const friends = await riotLocalApi('GET', '/chat/v4/friends');
        console.log(`Đã tìm thấy ${friends.length} bạn bè trong danh sách.`);

        // Tìm một người bạn đang online để test (nhớ đổi tên này thành tên bạn của bạn trong Valorant)
        // const targetFriend = friends.find(f => f.gameName === "TÊN_BẠN_TRONG_GAME");
        
        console.log("\n--- Thông tin một số bạn bè đang Online ---");
        const onlineFriends = friends.filter(f => f.productName === "valorant" || f.availability === "chat");
        onlineFriends.slice(0, 5).forEach(f => {
            console.log(`- ${f.gameName}#${f.gameTag} (Trạng thái: ${f.availability})`);
        });

        /*
        // 3. CODE GỬI TIN NHẮN (Bỏ comment để dùng)
        // Nếu muốn gửi tin nhắn, cần lấy được "pid" (Player ID) của người đó.
        if (targetFriend) {
            const messagePayload = {
                message: "Xin chào! Tin nhắn này được gửi tự động từ Bot XMPP test.",
                type: "chat"
            };
            
            await riotLocalApi('POST', `/chat/v5/messages`, {
                pid: targetFriend.pid,
                message: "Xin chào! Bot test."
            });
            console.log("Đã gửi tin nhắn thành công!");
        }
        */

    } catch (err) {
        console.error("Lỗi khi kết nối API:", err.message);
    }
}

runBot();

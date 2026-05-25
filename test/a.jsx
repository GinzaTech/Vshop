// npm install axios

const axios = require("axios");
const fs = require("fs");
const path = require("path");

/**
 * Lấy Riot Client Config
 * và lưu response ra file JSON
 *
 * @param {string} authToken
 * @param {string} entitlementToken
 */
async function getRiotClientConfig(authToken, entitlementToken) {
    try {
        const response = await axios.get(
            "https://clientconfig.rpg.riotgames.com/api/v1/config/player?app=Riot%20Client",
            {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    "X-Riot-Entitlements-JWT": entitlementToken,
                },
            }
        );

        console.log("Request success!");
        console.log("Status:", response.status);

        // Đường dẫn file output
        const outputPath = path.join(__dirname, "riot_client_config.json");

        // Ghi file JSON đẹp
        fs.writeFileSync(
            outputPath,
            JSON.stringify(response.data, null, 2),
            "utf8"
        );

        console.log("Saved response to:", outputPath);

        return response.data;
    } catch (error) {
        console.error(
            "Request failed:",
            error.response?.data || error.message
        );

        // Lưu lỗi ra file
        const errorPath = path.join(__dirname, "riot_error.json");

        fs.writeFileSync(
            errorPath,
            JSON.stringify(
                {
                    message: error.message,
                    status: error.response?.status,
                    data: error.response?.data,
                },
                null,
                2
            ),
            "utf8"
        );

        console.log("Saved error response to:", errorPath);
    }
}

// Ví dụ dùng:
const AUTH_TOKEN = "eyJraWQiOiJyc28tcHJvZC0yMDI0LTExIiwiYWxnIjoiUlMyNTYifQ.eyJwcCI6eyJjIjoiYXMifSwic3ViIjoiOTkxYWRmMTEtY2Q0YS01NWQyLTkzN2YtNGVjMjE1MjFmZDI2Iiwic2NwIjpbImFjY291bnQiLCJvcGVuaWQiXSwiY2xtIjpbInJnbl9WTjIiLCIhUDFzbEFKQUIiXSwiYW1yIjpbInBhc3N3b3JkIl0sImlzcyI6Imh0dHBzOi8vYXV0aC5yaW90Z2FtZXMuY29tIiwiYWNyIjoidXJuOnJpb3Q6YnJvbnplIiwiZGF0Ijp7InIiOiJWTjIiLCJjIjoiYXMxIiwidSI6MzExMjI0MDc2OTcxMzkyMCwibGlkIjoiTkRPOUZGbnUzYTdlem0wVnV0MHd0ZyJ9LCJwbHQiOnsiZGV2IjoidW5rbm93biIsImlkIjoid2ViIn0sImV4cCI6MTc3OTYwNTA4NywiaWF0IjoxNzc5NjAxNDg3LCJqdGkiOiJlbjFMSFM3cUs1RSIsImNpZCI6InBsYXktdmFsb3JhbnQtd2ViLXByb2QifQ.vGvMw4cJXvpZ1MNCXFZE1KvjT2-IRyuPSM9EBbE3dzmXkLGWLtDJBkRKBuJVBybOc5SnxSgA4wU39tHURr2-t-PPefAgt89gZQWJ2JzrM8pwK77XVJH3P7BuzKTzOarAmQQSaRf30DGI5sX7iKAJrNxX3meUg9Vi0-bODauTPq2JNuVQN715qoXLZsa6zlP8oSU3zlog9RPkoiDTNt_a8qrj7Gh8SN9n34LJr3eRKSmW01IhExJ-s3AdmRii2irhF6eX68PcZVX-rV4QzOCMQrDvIPUsoUxAByXR0uMtcyc2929QFy28UndrAnB8PoH_TJZn4DxrE2gKQBoDLeTT8A";
const ENTITLEMENT_TOKEN = "eyJraWQiOiJrMSIsImFsZyI6IlJTMjU2In0.eyJlbnRpdGxlbWVudHMiOltdLCJhdF9oYXNoIjoianB6bXI0SlAtdXNYRjJYUHotdXJxZyIsInN1YiI6Ijk5MWFkZjExLWNkNGEtNTVkMi05MzdmLTRlYzIxNTIxZmQyNiIsImlzcyI6Imh0dHBzOi8vZW50aXRsZW1lbnRzLmF1dGgucmlvdGdhbWVzLmNvbSIsImlhdCI6MTc3OTYwMTc5MSwianRpIjoiZW4xTEhTN3FLNUUifQ.MgkswrsAXPOvapuVfuXosUOtCtUJ6KoWAf3HlA200amEGRsd-qvO6FpkDKnlM_159of1dyMAeGjbyJk02SNHTNvRIEcziowbdDfvKlQReRIc_wisFb0locubRwt6U-E5ZXWCxDnkABsV10qfX1J-zstKY_HBh9k93qe0_wwjyIHPdfg5vyzFMLz9EpooKL6XemdkO4c4eU29deXRQRA2nzWTwns4xWQIxsUZJ0Otu1EXqVNFoL9-jnhuPzOA5dMi2cN_y5mQXKfuNK7lfEQ5BsN-g5ftXTn1PEViBYjGCAOcXC2iZFZJmK8MhcbmuXKob_zxDURgrmgDGNB7oHOhkA";

getRiotClientConfig(AUTH_TOKEN, ENTITLEMENT_TOKEN);
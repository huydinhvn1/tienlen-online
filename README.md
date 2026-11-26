# Bài Tiến Lên

Tiến Lên Miền Nam trên web: giao diện tiếng Việt, chơi với máy, phòng online thời gian thực, và đăng nhập Google.

## Chạy local

Yêu cầu Node.js 22 trở lên.

```bash
npm install
npm run dev
```

Mở [http://127.0.0.1:47221](http://127.0.0.1:47221).

Nếu chưa có `GOOGLE_CLIENT_ID`, bấm **Chơi thử (Khách)** để vào ngay. Điểm của khách được lưu trong SQLite tại thư mục `data/`.

```bash
npm test          # luật chơi
npm run typecheck
npm run build
npm start         # phục vụ bản build, cổng 47221
```

## Biến môi trường

Sao chép `.env.example` thành `.env`.

| Biến | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Không | Mã OAuth Web client. Bỏ trống thì chỉ có chế độ khách. |
| `SESSION_SECRET` | Nên có khi deploy | Chuỗi bí mật ký cookie phiên. Dev tự tạo file `data/session.secret` nếu thiếu. |
| `PORT` | Không | Cổng HTTP, mặc định `47221`. |
| `DATA_DIR` | Không | Thư mục SQLite, mặc định `./data`. |

Cookie phiên là HTTP-only. Ở production (`NODE_ENV=production`) cookie thêm cờ `Secure`.

## Bật đăng nhập Google

1. Vào [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → tạo **OAuth client ID** loại **Web application**.
2. Cấu hình màn hình đồng ý OAuth. Nếu app đang ở chế độ Testing, thêm tài khoản Gmail vào danh sách test users.
3. **Authorized JavaScript origins** phải khớp đúng URL người chơi mở, gồm scheme và cổng, không có đường dẫn:
   - Local: `http://localhost:47221` và `http://127.0.0.1:47221`
   - Production: `https://ten-mien-cua-ban`
4. Luồng này dùng Google Identity Services và kiểm tra ID token ở server. Không cần Authorized redirect URI.
5. Dán Client ID vào `GOOGLE_CLIENT_ID`, rồi khởi động lại server.

Server xác minh token bằng `google-auth-library` (`verifyIdToken`, audience là `GOOGLE_CLIENT_ID`). Hồ sơ lưu `sub`, tên, email, ảnh. Thống kê gồm số ván, số trận thắng, điểm và chuỗi thắng.

## Luật đang dùng

- 52 lá, 2–4 người, mỗi người 13 lá. Bài còn lại không chia khi ít hơn 4 người.
- Nước: `3 < 4 < … < 10 < J < Q < K < A < 2`.
- Chất: Bích ♠ < Chuồn ♣ < Rô ♦ < Cơ ♥.
- Bộ: lẻ, đôi, sám cô, sảnh (≥ 3, không có 2), tứ quý, 3 đôi thông, 4 đôi thông.
- Chặt: 3 đôi thông chặt 2 lẻ; tứ quý chặt 2 lẻ, đôi 2 và 3 đôi thông; 4 đôi thông chặt thêm cả tứ quý. Có thể bật chặt 4 đôi thông không cần vòng.
- Ván đầu phải mở bằng lá `3♠` (hoặc lá nhỏ nhất nếu `3♠` không được chia). Người về nhất đi trước ở ván sau.
- Bỏ lượt thì mất quyền đến hết vòng. Tới trắng: sảnh rồng, tứ quý 2, 6 đôi, 5 đôi thông, 4 sám cô.
- Điểm 4 người: Nhất +3, Nhì +1, Ba −1, Bét −3 lần cược, cộng thối heo / tứ quý / đôi thông còn trên tay Bét.

## Online

Socket.IO đồng bộ lượt, đánh bài, bỏ lượt, hết vòng và xếp hạng. Tạo phòng nhận mã 6 ký tự, hoặc vào bằng mã. Chủ phòng thêm máy vào ghế trống và bắt đầu khi có 2–4 người, mọi người đã bấm Sẵn sàng. Làm mới trang trong ít giây sẽ nối lại đúng ghế. Hết 12 giây không thấy người đang đến lượt, máy đánh giúp vòng đó.

## Triển khai

Một tiến trình Node phục vụ cả giao diện tĩnh và WebSocket. Server lắng nghe `0.0.0.0` và `PORT` (mặc định 47221), bật `trust proxy` để cookie `Secure` đúng sau HTTPS của Render, và tự tạo thư mục `DATA_DIR` nếu chưa có.

```bash
npm ci
npm run build
npm start
```

`render.yaml` khai báo web service Node miễn phí: `npm install && npm run build`, rồi `npm start`, Node 22. Đặt `GOOGLE_CLIENT_ID` và origin production trong Google Cloud Console. `SESSION_SECRET` nên là chuỗi ngẫu nhiên dài. Ổ đĩa Render miễn phí không giữ SQLite sau khi dịch vụ ngủ hoặc deploy lại.

WebSocket cần tiến trình sống lâu (Render, Fly, Railway, VPS). Netlify Functions không giữ kết nối phòng chơi.

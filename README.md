# 🎲 Board Game Hội Bạn

Board game tiếng Việt để cả hội **ngồi chung một phòng, mỗi người chơi trên điện thoại riêng**. Mở link là chơi được, không cần cài app, không cần đăng ký.

## Danh sách game

| Game | Số người | Mã phòng bắt đầu bằng |
|---|---|---|
| 🃏 Tiến Lên miền Nam | 2–4 | `T` |
| ♟️ Cờ tướng (có người xem, xin đi lại) | 2 + người xem | `X` |
| 🐴 Cờ cá ngựa | 2–4 | `N` |
| 🌈 Sắc Bài | 2–10 | `S` |
| 💣 Bom Xịt | 2–5 | `B` |
| 🐺 Ma Sói (máy làm quản trò) | 5–16 | `M` |
| 🏙️ Cờ Tỷ Phú | 2–6 | `P` |
| 🤠 Loạn Đả Viễn Tây | 4–8 | `W` |

Luật chi tiết và các quyết định thiết kế nằm trong [docs/THIET-KE.md](docs/THIET-KE.md).

## Cách chơi

1. Một người mở game, bấm **Tạo phòng** và trở thành **chủ bàn**.
2. Những người khác quét **mã QR**, mở link, hoặc nhập **mã phòng 5 ký tự** ở trang chủ.
3. Chủ bàn bấm **Bắt đầu**. Bảng điểm đếm số ván thắng của từng người trong suốt buổi chơi.

Một số lưu ý:
- Máy chủ bàn chạy luật chơi cho cả bàn, nên cần **để màn hình sáng và mở trang game ở phía trước**.
- Ai rớt mạng thì mở lại trang là vào lại đúng ghế cũ.
- Chủ bàn có nút **Bỏ lượt hộ** cho người đang offline, và nút **Huỷ ván** khi cần dừng ván.

## Kiến trúc

- Web tĩnh gồm HTML, CSS và JavaScript thuần. Không dùng framework, không có bước build, không có server riêng.
- Các máy kết nối P2P qua [PeerJS](https://peerjs.com/) (WebRTC), dùng broker miễn phí `0.peerjs.com` để tìm thấy nhau.
- **Máy chủ bàn là nguồn sự thật:** giữ trạng thái ván, chạy engine luật, gửi cho mỗi máy đúng phần thông tin máy đó được biết. Bài trên tay, vai Ma Sói và thứ tự chồng bài không bao giờ được gửi cho người khác.

```
index.html          trang chủ
shared/             phần dùng chung
  net.js            phòng P2P: tạo/vào phòng, heartbeat, tự nối lại
  lobby.js          biệt danh, phòng chờ, mã QR
  table.js          vòng lặp chủ bàn: gửi góc nhìn, bảng điểm, hẹn giờ, bỏ lượt hộ
  ui.css, cards.css giao diện chung
<game>/engine.js    luật thuần (không DOM, không mạng), có test
<game>/main.js      vẽ bàn chơi
tests/              test engine bằng node:test
```

## Chạy trên máy

Cần Python (để chạy web server tĩnh) và Node 18 trở lên (để chạy test).

```bash
python -m http.server 8080
```

Mở `http://localhost:8080`. Điện thoại dùng chung Wi-Fi thì mở `http://<IP-máy-tính>:8080`.

Chạy test:

```bash
npm test
```

## Đưa lên GitHub Pages

Vào **Settings → Pages**, chọn **Deploy from a branch**, branch `main`, thư mục `/ (root)`. Trang sẽ chạy ở địa chỉ `https://<tên-tài-khoản>.github.io/board-game/`.

Gói GitHub Free miễn phí khi repo để public.

## Giới hạn đã biết

- Máy chủ bàn giữ toàn bộ dữ liệu ván, nên người cầm máy đó về kỹ thuật vẫn xem được tất cả.
- Broker miễn phí của PeerJS không cam kết lúc nào cũng chạy ổn định. Một số mạng Wi-Fi chặn kết nối giữa các máy với nhau.
- Chưa thử nghiệm đầy đủ trên điện thoại thật.

---

Dự án cá nhân làm cho hội bạn chơi vui, phi thương mại, không cá cược tiền thật. Không liên kết với bất kỳ trang board game hay nhà phát hành game nào khác.

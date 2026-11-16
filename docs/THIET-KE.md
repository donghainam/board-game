# Thiết kế Board Game Hội Bạn

Tài liệu gộp các quyết định thiết kế của dự án, theo thứ tự các đợt làm. Phần ghi *(em tự quyết)* là quyết định của người viết code, chưa được chủ dự án nêu rõ.

## Mục lục

1. Thiết kế đợt 1: Trang chủ + lớp mạng + Tiến Lên
2. Thiết kế đợt 2: Cờ tướng + Cờ cá ngựa
3. Thiết kế đợt 3 – phần 1: Sắc Bài + Bom Xịt
4. Thiết kế đợt 3 – phần 2: Ma Sói

## Thiết kế đợt 1: Trang chủ + lớp mạng + Tiến Lên
### 1. Mục đích

ANam muốn một trang board game tiếng Việt của riêng mình, theo kiểu boardgamevui.com, để **chơi với hội bạn khi ngồi chung một phòng, mỗi người dùng điện thoại riêng**. Mở link là chơi được: không cần đăng nhập, không cần cài app.

Toàn dự án gồm 8 game, chia thành 4 đợt:
1. **Đợt 1 (tài liệu này):** trang chủ, lớp mạng dùng chung, Tiến Lên miền Nam.
2. Cờ tướng, Cờ cá ngựa.
3. Sắc Bài, Bom Xịt, Ma Sói.
4. Loạn Đả Viễn Tây, Cờ Tỷ Phú.

Mục tiêu của đợt 1: hội bạn chơi trọn một buổi Tiến Lên mà không gặp lỗi. Phần mạng và phần giao diện làm ở đợt này phải dùng lại được cho các đợt sau.

### 2. Mục tiêu / Không làm / Thất bại nếu

**Mục tiêu**
- Một người tạo phòng, những người khác vào bằng mã 5 ký tự, quét QR hoặc mở link.
- Chơi Tiến Lên 2–4 người, đúng luật miền Nam phổ biến (mục 5).
- Đếm số ván thắng của từng người trong suốt buổi chơi.
- Ai rớt mạng thì mở lại trang là vào đúng chỗ cũ.

**Không làm (đã chốt với ANam)**
- Bot.
- Đăng nhập, tài khoản, lưu lịch sử lên server.
- Chip ảo, tiền cược, tính điểm phạt.
- Màn hình chung (TV/laptop).
- Code lấy từ repo gốc `mangomint1805/bgvn`. Toàn bộ viết lại từ đầu.
- Các game ở đợt 2–4 (trang chủ chỉ hiện chúng ở dạng "Sắp có").

**Thất bại nếu** (dù về kỹ thuật vẫn chạy)
- Người chơi nhìn được bài của người khác, kể cả khi mở DevTools hoặc đọc network. Bài chỉ được gửi tới đúng máy người cầm bài đó.
- Vào phòng mất hơn khoảng 30 giây hoặc phải thao tác rối.
- Đang chơi mà một người rớt mạng thì cả ván hỏng.
- Trên điện thoại dọc, bài bị tràn màn hình hoặc nút quá nhỏ, khó bấm.

### 3. Ràng buộc

- **Hosting:** GitHub Pages, chỉ có file tĩnh, không có server riêng.
- **Mạng:** PeerJS (WebRTC P2P). Dùng broker miễn phí mặc định của PeerJS (`0.peerjs.com`) để các máy tìm thấy nhau.
- **Thiết bị:** điện thoại, màn hình dọc, Chrome/Safari bản mới. Máy tính chỉ cần dùng được, không cần đẹp.
- **Ngôn ngữ giao diện:** tiếng Việt.

### 4. Kiến trúc đã chốt

#### 4.1 Mô hình "chủ bàn"
- Người tạo phòng là **chủ bàn (host)**, đồng thời là một người chơi bình thường.
- Máy chủ bàn giữ toàn bộ trạng thái ván và chạy engine luật. Các máy khác chỉ gửi **ý định** (ví dụ "đánh các lá X, Y" hoặc "bỏ lượt"). Chủ bàn kiểm tra hợp lệ rồi gửi lại trạng thái.
- Mỗi máy chỉ nhận **góc nhìn của riêng mình**: bài trên tay mình, số lá còn lại của người khác, các lá đã đánh trên bàn.
- Chủ bàn bị rớt mạng hoặc đóng trang thì cả phòng dừng. Không làm cơ chế chuyển chủ bàn sang máy khác. Khi chủ bàn mở lại trang thì phòng tiếp tục (xem 4.3).

#### 4.2 Vào phòng
- Lần đầu mở trang, người chơi nhập **biệt danh**. Biệt danh lưu trong `localStorage`.
- Chủ bàn bấm "Tạo phòng" và nhận **mã 5 ký tự** (chữ in hoa và số, bỏ các ký tự dễ nhầm như 0/O, 1/I). Mã này cũng chính là PeerJS id của chủ bàn, có thêm tiền tố riêng của dự án.
- Màn chờ của chủ bàn hiện mã phòng, **mã QR** và nút copy link `…/tienlen/?phong=ABCDE`.
- Người khác vào phòng bằng một trong ba cách: nhập mã, quét QR hoặc mở link.
- Chủ bàn bấm "Bắt đầu" khi có 2–4 người.

#### 4.3 Rớt mạng và vào lại
- Mỗi máy có một `playerId` ngẫu nhiên lưu trong `localStorage`. Khi vào lại phòng với cùng `playerId` thì người đó ngồi lại đúng ghế cũ và nhận lại đúng bài.
- Đến lượt một người đang rớt mạng thì cả bàn **chờ**. Chủ bàn có nút "Bỏ lượt hộ" để ván không bị kẹt.
- Chủ bàn lưu trạng thái ván vào `localStorage` sau mỗi nước đi. Nếu chủ bàn tải lại trang thì phòng mở lại với cùng mã và các máy khác tự kết nối lại.

#### 4.4 Giữ màn hình sáng
- Trong lúc chơi, trang dùng Screen Wake Lock API trên mọi máy. Trình duyệt không hỗ trợ thì bỏ qua, không báo lỗi.

#### 4.5 Cấu trúc thư mục (dự kiến)
```
index.html            trang chủ
shared/net.js         lớp mạng: tạo/vào phòng, gửi/nhận, vào lại
shared/ui.css         design token, nút, thẻ, bố cục điện thoại
shared/lobby.js       màn nhập tên, tạo/vào phòng, màn chờ, QR
tienlen/index.html
tienlen/engine.js     luật thuần (không DOM, không mạng), chạy được bằng Node
tienlen/main.js       giao diện + nối engine với net
tests/tienlen.test.js test engine bằng node:test
```
`net.js` và `lobby.js` **không biết gì về Tiến Lên**. Mỗi game chỉ cung cấp engine và giao diện riêng, phần mạng dùng chung.

### 5. Luật Tiến Lên (đã chốt: "luật chung")

- 52 lá, mỗi người 13 lá. Thứ tự từ nhỏ đến lớn: 3 < 4 < … < K < A < 2. Chất: ♠ < ♣ < ♦ < ♥.
- Ván đầu, ai có 3♠ thì đánh trước, và lượt đầu bắt buộc có lá 3♠. Từ ván sau, người thắng ván trước đánh trước, đánh gì cũng được.
- **Bộ đánh được:** rác, đôi, sám (bộ ba), sảnh (từ 3 lá liên tiếp, không chứa 2), đôi thông (từ 3 đôi liên tiếp), tứ quý.
- **Chặn bộ:** phải cùng loại, cùng số lá và lớn hơn. So sánh theo lá cao nhất (số trước, chất sau).
- **Bỏ lượt:** đã bỏ thì mất quyền đánh tiếp trong vòng đó. Khi mọi người còn lại đều bỏ, người đánh cuối cùng được mở vòng mới.
- **Chặt:**
  - 3 đôi thông chặt được 1 heo.
  - Tứ quý chặt được 1 heo, đôi heo và 3 đôi thông.
  - 4 đôi thông chặt được 1 heo, đôi heo, 3 đôi thông và tứ quý.
  - Đôi thông hoặc tứ quý lớn hơn chặt lại được bộ cùng loại nhỏ hơn.
- **Tới trắng** (thắng ngay khi vừa chia bài): sảnh rồng 3 đến A, tứ quý 2, 6 đôi bất kỳ, 5 đôi thông.
- **Kết thúc ván:** người đầu tiên đánh hết bài là người thắng, ván kết thúc ngay.

### 6. Tính điểm (đã chốt: "tính điểm thắng thôi")

- Mỗi ván, người thắng được **+1 ván thắng**. Không có điểm âm.
- Bảng điểm hiện suốt buổi, xếp theo số ván thắng. Bảng thuộc về phòng: đóng phòng thì mất.
- Cóng và thối heo **chỉ hiện thông báo vui** ở cuối ván, không trừ điểm. *(Em tự quyết: vì ANam chỉ đếm ván thắng.)*

### 7. Trang chủ

- Có đủ 8 thẻ game: tên, mô tả một dòng, số người chơi. Riêng Tiến Lên bấm vào được. 7 game còn lại hiện nhãn "Sắp có".
- Có ô "Vào phòng bằng mã". Nhập mã thì chuyển thẳng tới đúng game của phòng đó, dựa vào ký tự đầu của mã (xem mục 8).
- Không làm: sảnh chung, chat, thống kê online, thử thách hằng ngày.

### 8. Những phần em tự quyết (ANam xem lại)

- HTML/CSS/JS thuần, không framework, không bước build. PeerJS và thư viện QR nạp từ CDN, ghi rõ phiên bản.
- Không đặt giới hạn thời gian cho mỗi lượt (vì ngồi chung phòng, giục nhau trực tiếp được).
- **Mã phòng:** 5 ký tự, ký tự đầu là mã game (`T` = Tiến Lên). Nhờ vậy trang chủ biết phải chuyển tới game nào mà không cần hỏi mạng.
- **2–3 người:** vẫn chia mỗi người 13 lá, phần bài thừa bỏ ra ngoài. Nếu không ai có 3♠ thì người cầm lá nhỏ nhất đánh trước, và lượt đầu phải có lá đó.
- **Chặt:** chỉ được chặt đúng lượt của mình. Người đã bỏ lượt thì không chặt được trong vòng đó.
- **Nhiều người cùng tới trắng:** người ngồi gần chủ bàn nhất, tính theo chiều đánh, được thắng.
- **Vào phòng giữa ván:** người mới chỉ được ngồi vào từ ván sau. Phòng đủ 4 người thì từ chối người thứ 5.
- **Rời phòng hẳn:** chủ bàn có nút "Mời ra" giữa hai ván để giải phóng ghế.
- Cóng và thối heo chỉ hiện thông báo, không ảnh hưởng điểm.
- Engine Tiến Lên có bộ test bằng `node:test`, không cần cài gì thêm.

### 9. Để builder tự quyết

- Bố cục chi tiết của bàn chơi và cách chọn lá (chạm để nhấc lá, nút Đánh / Bỏ lượt).
- Màu sắc, font, hiệu ứng, âm thanh (có thể không có).
- Định dạng message giữa các máy.
- Cách lưu trạng thái của chủ bàn.

### 10. Rủi ro đã biết

- **Broker miễn phí của PeerJS** có thể chậm hoặc chập chờn, và không có cam kết chất lượng dịch vụ. Nếu hay lỗi, có thể tự host PeerServer, nhưng việc đó cần một server và nằm ngoài đợt này.
- **Mạng Wi-Fi có cách ly máy (client isolation) hoặc NAT chặt** có thể làm WebRTC không kết nối được nếu không có TURN server. Ngồi chung một Wi-Fi nhà thì thường không gặp. Chưa kiểm chứng.

---

## Thiết kế đợt 2: Cờ tướng + Cờ cá ngựa
### 1. Mục đích

Thêm 2 game vào trang cho hội bạn (ngồi chung phòng, mỗi người một điện thoại). Hạ tầng giữ nguyên như đợt 1: GitHub Pages, PeerJS, máy chủ bàn giữ luật, không bot, bảng điểm chỉ đếm số ván thắng.

### 2. Mục tiêu / Không làm / Thất bại nếu

**Mục tiêu**
- Cờ tướng: 2 người đánh, những người khác trong phòng vào xem. Có nút "Xin đi lại".
- Cờ cá ngựa: 2–4 người, 1 xúc xắc, luật như mục 5.
- **Tách phần "chủ bàn" dùng chung** từ Tiến Lên ra `shared/table.js`, để 3 game không phải chép lại cùng một đoạn code. Tiến Lên phải chạy y như cũ sau khi tách.

**Không làm (đã chốt)**
- Bot hoặc AI chơi cùng.
- Nút xin hòa, đầu hàng, đồng hồ đếm giờ (ANam chỉ chọn "Xin đi lại").
- Luật chiếu dai hoặc đuổi dai.
- Bàn 3D, hiệu ứng nặng.

**Thất bại nếu**
- Có nước đi sai luật mà máy vẫn chấp nhận, kể cả khi client bị sửa code.
- Client tự gieo xúc xắc. Xúc xắc chỉ được gieo trên máy chủ bàn.
- Người xem đi được quân cờ tướng.
- Sau khi tách code dùng chung, Tiến Lên bị lỗi.

### 3. Phần dùng chung `shared/table.js` (tách từ `tienlen/main.js`)

Phần này lo mọi việc không phụ thuộc luật game:
- host gửi góc nhìn riêng cho từng người;
- lưu trạng thái vào `localStorage`;
- bảng điểm số ván thắng;
- màn giữa các ván: phòng, QR, kết quả, nút "Ván mới" và "Đóng phòng";
- màn "Chờ ván sau";
- chống bấm 2 lần;
- nút "Bỏ lượt hộ" khi người đang tới lượt bị offline, nếu game đó có hỗ trợ.

Mỗi game cung cấp một **engine** thuần (không DOM, không mạng) gồm:
- `start(ids, ctx)`: tạo ván mới. `ctx` gồm `{lastWinner, round}`.
- `apply(state, id, action)`: trả `{ok, state}` hoặc `{ok:false, error}`.
- `viewFor(state, id)`: góc nhìn của một người. Trả `null` thì người đó thấy màn "Chờ ván sau".
- `forceSkip(state)`: không bắt buộc, dùng cho nút "Bỏ lượt hộ".

Mỗi game cũng cung cấp hàm **vẽ bàn chơi** từ `view`.

Mỗi `view` có các field chung: `turn` (id người đang tới lượt), `winner`, cùng phần mô tả kết quả. Các field còn lại do từng game tự quyết.

### 4. Cờ tướng

- **Luật:** cờ tướng chuẩn.
  - Đủ 7 loại quân với nước đi đúng luật, gồm cả cản mã, cản tượng, tượng không qua sông, sĩ và tướng chỉ đi trong cung, tốt qua sông được đi ngang, pháo phải có ngòi khi ăn quân.
  - Không được để hai tướng đối mặt trên cùng cột mà không có quân nào ở giữa.
  - Không được đi nước khiến tướng mình bị chiếu.
- **Kết thúc ván:** bên đến lượt mà không còn nước đi hợp lệ thì **thua**, dù đang bị chiếu (chiếu bí) hay không (hết nước).
- **Ai được đánh:** 2 người đầu tiên đang online trong danh sách phòng là người đánh, những người còn lại là người xem. Phòng tối đa 10 người. *(em tự quyết)*
- **Màu quân:** ván đầu, người ở ghế đầu (chủ bàn) cầm Đỏ. Sau mỗi ván hai bên đổi màu. Đỏ đi trước. *(em tự quyết)*
- **Xin đi lại:** chỉ người vừa đi nước cuối mới được xin. Đối thủ chọn đồng ý (bàn cờ trở về như trước nước đó) hoặc từ chối. Xin xong mà đối thủ chưa trả lời thì chưa ai đi tiếp được. Ván đã kết thúc thì không xin được.
- **Giao diện:**
  - Quân cờ hiện **chữ Hán**: Đỏ 帥 仕 相 傌 俥 炮 兵, Đen 將 士 象 馬 車 砲 卒.
  - Bàn cờ vẽ bằng SVG, có sông và cung. Mỗi người thấy quân của mình ở phía dưới; người xem thấy quân Đỏ ở dưới.
  - Đánh dấu nước vừa đi. Chạm quân thì hiện các ô đi được.
  - Báo "Chiếu!" khi tướng đang bị chiếu.

### 5. Cờ cá ngựa

- 2–4 người, mỗi người 4 ngựa, dùng 1 xúc xắc. Xúc xắc **do chủ bàn gieo**.
- **Bàn cờ:** hình chữ thập 15×15 kiểu thường gặp, đường chạy 52 ô *(em tự quyết; trước đó em nói 48 ô, nay đổi sang 52 để vẽ được bàn hình chữ thập)*.
  - Mỗi màu có ô xuất phát riêng, cách nhau 13 ô.
  - **Cửa chuồng** là ô thứ 51 tính từ ô xuất phát (ô cuối ở đầu cánh của mình).
  - Mỗi màu có 6 bậc chuồng.
  - Chơi 2 người thì dùng 2 màu đối diện nhau. *(em tự quyết)*
- **Lượt chơi:** bấm "Gieo" để gieo xúc xắc, rồi chọn ngựa để đi. Nếu không có nước hợp lệ thì tự chuyển lượt.
- **Xuất chuồng:** chỉ khi gieo ra 6. Ngựa ra đứng ở ô xuất phát. Ô đó có ngựa địch thì đá về chuồng; có ngựa mình thì không ra được.
- **Ra 6:** đi xong được gieo thêm. Kể cả khi không có nước đi nào cũng vẫn được gieo thêm. *(em tự quyết)*
- **Đi trên đường:**
  - Đi đúng số ô bằng số vừa gieo.
  - Ngựa bất kỳ (của mình hay của địch) đứng ở các ô giữa đường thì **cản**, không đi được.
  - Ô đích có ngựa địch thì đá về chuồng. Ô đích có ngựa mình thì không đi được.
  - Không được đi vượt quá cửa chuồng. Phải gieo đúng số để dừng tại cửa chuồng. *(em tự quyết)*
- **Leo chuồng:**
  - Từ cửa chuồng, gieo ra *n* thì vào thẳng bậc *n*. Các bậc từ 1 đến *n* phải trống, vì trong chuồng cũng bị cản. *(em tự quyết)*
  - Từ bậc *b*, chỉ khi gieo ra *b+1* hoặc ra 1 thì lên bậc *b+1*, và bậc đó phải trống. Gieo số khác thì không đi được.
- **Thắng:** người đầu tiên đưa đủ 4 ngựa vào chuồng (đứng ở các bậc).
- **Người đi trước:** ván đầu là chủ bàn, các ván sau là người thắng ván trước. *(em tự quyết)*
- **Có "Bỏ lượt hộ":** khi người đang tới lượt bị offline.

### 6. Trang chủ

Thẻ Cờ tướng và Cờ cá ngựa bấm vào được, bỏ nhãn "Sắp có". Thêm ký tự đầu của mã phòng cho mỗi game: `X` là Cờ tướng, `N` là Cờ cá ngựa.

### 7. Để builder tự quyết

- Bố cục chi tiết, màu sắc, hoạt ảnh xúc xắc (có thể không có).
- Định dạng state nội bộ của từng engine.
- Cách vẽ bàn cá ngựa, miễn là trên điện thoại dọc nhìn rõ và bấm được ngựa.

### 8. Rủi ro

- Việc tách `shared/table.js` có thể làm hỏng Tiến Lên. Biện pháp: giữ nguyên toàn bộ test engine và chơi lại một ván Tiến Lên sau khi tách.
- Luật cờ tướng có nhiều trường hợp hiếm. Biện pháp: viết test cho từng quân, cho luật lộ mặt tướng và cho chiếu bí.

---

## Thiết kế đợt 3 – phần 1: Sắc Bài + Bom Xịt
### 1. Mục đích và phạm vi

Thêm 2 game bài cho hội bạn (ngồi chung phòng, mỗi người một điện thoại). Mọi luật đều do máy chủ bàn xử lý. Không có bot. Bảng điểm chỉ đếm số ván thắng.

Hai game có **tên, hình lá bài và giao diện riêng**, không dùng tên, nhân vật hay hình ảnh của game thương mại nào. Luật chơi thuộc thể loại game bài phổ biến.

**Không làm:** bot, chip hoặc tiền ảo, hiệu ứng nặng.

**Thất bại nếu:**
- Có người thấy bài trên tay người khác, hoặc thấy thứ tự chồng bài. Riêng người vừa đánh lá **Soi** được thấy 3 lá trên cùng.
- Client tự trộn bài hoặc tự bốc bài. Việc trộn và bốc bài chỉ xảy ra trên máy chủ bàn.
- Có nước đi sai luật mà máy vẫn chấp nhận.

### 2. Thay đổi ở phần dùng chung `shared/table.js`

- **Hẹn giờ:** engine được thêm 2 hàm không bắt buộc:
  - `nextTimer(state) -> ms tuyệt đối | null`
  - `onTimer(state, now) -> state`

  Host tự đặt `setTimeout` theo `nextTimer`, đến giờ thì gọi `onTimer` rồi gửi lại góc nhìn cho mọi người.
  - Dùng cho: cửa sổ phản ứng 3 giây của lá **Chặn** trong Bom Xịt.
  - Phần 2 (Ma Sói) sẽ dùng cùng cơ chế này cho đồng hồ thảo luận.
  - Host tải lại trang thì đặt lại hẹn giờ từ state đã lưu.
- Tiến Lên, Cờ tướng, Cờ cá ngựa không bị ảnh hưởng, vì engine của chúng không có `nextTimer`.

### 3. 🌈 Sắc Bài (2–10 người), mã phòng bắt đầu bằng `S`

**Bộ bài** (96 lá):
- Mỗi màu (Đỏ, Vàng, Lục, Lam) có:
  - số 1–9, mỗi số 2 lá;
  - **Phạt +2** × 2;
  - **Chặn** × 2.
- Lá đen: **Đổi màu** × 4 và **Phạt +4** × 4. Phạt +4 kèm chọn màu.

**Chia bài:** mỗi người 6 lá. Lật 1 lá làm lá mở đầu. Nếu lá lật ra không phải lá số thì lật lại cho tới khi được lá số. *(em tự quyết)*

**Đánh:**
- Được đánh lá **cùng màu**, hoặc **cùng số / cùng loại lá đặc biệt** với lá trên cùng.
- Lá đen đánh lúc nào cũng được, trừ lúc đang bị phạt (xem phần cộng dồn bên dưới). Đánh lá đen thì chọn màu mới.
- Mỗi lượt chỉ được đánh 1 lá. Không có luật xả nhiều lá cùng lúc.

**Phạt cộng dồn:**
- Đang bị phạt từ một lá +2: được chặn bằng +2 (bất kỳ màu nào) hoặc +4.
- Đang bị phạt từ một lá +4: chỉ chặn được bằng +4.
- Không chặn được thì phải bốc **tổng số lá phạt** đang dồn lại và mất lượt.

**Chặn:** người kế tiếp mất lượt. Khi chỉ có 2 người thì người đánh lá Chặn được đi tiếp.

**Bốc bài:**
- Khi không đánh, người chơi bốc 1 lá. Có lá đánh được mà vẫn muốn bốc cũng được. *(em tự quyết)*
- Lá vừa bốc đánh được thì có thể đánh luôn; không thì bấm "Qua".
- Chồng bài hết thì trộn lại phần bài đã đánh, chừa lá trên cùng.

**BÁO:**
- Đánh xong mà còn đúng 1 lá thì người đó có nút **BÁO**.
- Những người khác có nút **Bắt**, bấm được cho tới khi người đó báo hoặc người kế tiếp đi nước tiếp theo.
- Bị Bắt trước khi kịp báo thì phải bốc 2 lá. *(em tự quyết)*

**Thắng:** người đầu tiên đánh hết bài.

### 4. 💣 Bom Xịt (2–5 người), mã phòng bắt đầu bằng `B`

**Bộ bài:**
- Bài chức năng: **Soi** × 8, **Né** × 8, **Chặn** × 8.
- Chia mỗi người 4 lá bài chức năng và **1 lá Kéo**.
- Sau khi chia, thêm vào chồng bài **1 lá Kéo** và **(số người − 1) quả Bom**, rồi trộn lại. *(số lượng từng loại: em tự quyết)*

**Lượt chơi:**
- Trong lượt của mình, người chơi đánh bao nhiêu lá chức năng cũng được.
- Kết thúc lượt bằng cách **bốc 1 lá**, trừ khi đã đánh Né.

**Lá chức năng:**
- **Soi:** xem riêng 3 lá trên cùng của chồng bài.
- **Né:** kết thúc lượt mà không phải bốc.
- **Chặn:** hủy lá chức năng vừa được đánh.
  - Được đánh trong **cửa sổ 3 giây** sau mỗi lá chức năng. Ai cũng đánh được, không cần tới lượt.
  - Chặn một lá Chặn khác thì lá bị hủy được phục hồi tác dụng, và cửa sổ 3 giây được tính lại.
  - Chặn **không** hủy được Bom và Kéo.
  - Trong cửa sổ 3 giây, người đang tới lượt phải chờ, chưa đánh tiếp hay bốc được. Hết 3 giây thì lá được thi hành (hoặc bị hủy).

**Bốc trúng Bom:**
- Có Kéo trên tay: tự động dùng Kéo để gỡ. Quả bom được máy **xáo vào vị trí ngẫu nhiên** trong chồng bài, sau đó hết lượt.
- Không có Kéo: **nổ ngay**, người đó bị loại và bài trên tay bị bỏ đi.

**Thắng:** người cuối cùng còn sống.

**Bỏ lượt hộ** (người đang tới lượt bị offline): tính như người đó bốc 1 lá. *(em tự quyết: nếu chỉ cho bỏ qua mà không bốc thì người offline sẽ không bao giờ bị loại)*

### 5. Giao diện

Hai game dùng chung kiểu lá bài vẽ bằng CSS: thẻ bo góc, màu nền, ký hiệu ở giữa. Không dùng hình hay kiểu dáng của game thương mại nào.
- **Sắc Bài:** hiện lá trên cùng, màu đang hiệu lực, số lá phạt đang dồn, các nút BÁO / Bắt, số lá còn lại của từng người. Chọn màu bằng 4 nút màu.
- **Bom Xịt:** hiện số lá còn trong chồng bài, người đang tới lượt, người đã bị loại.
  - Khi có lá chức năng vừa được đánh: hiện thanh đếm 3 giây và nút Chặn.
  - Khi mình đánh Soi: hiện 3 lá trên cùng, chỉ máy mình thấy.

### 6. Đã chốt cho phần 2 (Ma Sói), chưa làm ở phần này

- **Các vai:** Sói, Dân làng, Tiên tri, Bảo vệ, Phù thủy, Thợ săn, Cupid, **Sói nguyền**, **Sói gây mê**.
  - Sói nguyền: một lần trong cả ván, thay vì cắn chết thì biến nạn nhân thành Sói từ đêm sau.
  - Sói gây mê: mỗi đêm chọn 1 người; ngày hôm sau người đó không được bỏ phiếu.
- **Chia vai:** chủ bàn chọn số Sói và bật/tắt từng vai.
- **Già làng:** do dân bầu vào sáng ngày đầu. Khi hòa phiếu, già làng chọn người bị treo. Già làng chết thì chỉ định người kế nhiệm.
- **Đồng hồ thảo luận:** chủ bàn chọn độ dài mỗi ván. Có nút "Bỏ phiếu luôn" để vào bỏ phiếu sớm.

### 7. Để builder tự quyết

Bố cục và màu sắc cụ thể, định dạng state, hoạt ảnh (có thể không có).

### 8. Rủi ro

- **Cửa sổ Chặn 3 giây phụ thuộc mạng:** máy nào mạng chậm có thể không kịp bấm Chặn. Chấp nhận được, vì cả hội ngồi chung một Wi-Fi.
- **Thay đổi `table.js` có thể ảnh hưởng 3 game cũ.** Biện pháp: chạy lại toàn bộ test và chơi thử lại một game cũ.

---

## Thiết kế đợt 3 – phần 2: Ma Sói
### 1. Mục đích

Hội bạn ngồi chung một phòng, mỗi người dùng điện thoại riêng. **Máy làm quản trò**: chia vai, gọi từng vai dậy ban đêm, đếm giờ thảo luận, đếm phiếu. Ban đêm mọi người thao tác lặng lẽ trên máy của mình, ban ngày thì nói chuyện trực tiếp với nhau.

**Thất bại nếu:**
- Có người xem được vai, lựa chọn ban đêm, hay kết quả soi của người khác mà theo luật họ không được biết. Kiểm tra cả ở mức dữ liệu gửi qua mạng, không chỉ ở giao diện.
- Một người rớt mạng làm cả ván bị kẹt.
- Màn hình làm lộ việc ai đang có hành động ban đêm. Ví dụ chỉ điện thoại của Sói hiện nút bấm, nhìn qua là biết ai là Sói.

### 2. Vai chơi (đã chốt)

| Vai | Phe | Khả năng |
|---|---|---|
| Sói | Sói | Mỗi đêm các Sói cùng chọn 1 người để cắn. Phải **thống nhất** cùng một người. |
| Sói nguyền | Sói | Là Sói. **Một lần trong cả ván**: biến người bị cắn đêm đó thành Sói thay vì giết. Người bị nguyền được báo riêng là mình đã thành Sói. |
| Sói gây mê | Sói | Là Sói. Mỗi đêm chọn thêm 1 người; ngày hôm sau người đó **không được bỏ phiếu**. Việc này được công bố cho cả làng. |
| Dân làng | Dân | Không có khả năng đặc biệt. |
| Tiên tri | Dân | Mỗi đêm soi 1 người, biết người đó có phải phe Sói không. Người đã bị nguyền thành Sói cũng soi ra là Sói. |
| Bảo vệ | Dân | Mỗi đêm che 1 người khỏi bị Sói cắn, được che chính mình. Không che cùng một người 2 đêm liền. Không chặn được bình độc. |
| Phù thủy | Dân | Biết ai bị cắn đêm đó. Có 1 bình cứu và 1 bình độc, mỗi bình dùng 1 lần trong cả ván. **Được tự cứu và được dùng cả 2 bình trong cùng một đêm.** |
| Thợ săn | Dân | Khi chết vì bất kỳ lý do nào thì được bắn kéo theo 1 người. Có thể chọn không bắn. |
| Cupid | Dân | Đêm đầu ghép đôi 2 người (có thể gồm chính mình). Hai người đó biết nhau. Một người chết thì người kia chết theo. Nếu cặp đôi **khác phe** thì họ thành **phe thứ 3**. |

**Chia vai:** chủ bàn chọn số Sói thường và bật/tắt từng vai đặc biệt (một vai bật thì có đúng 1 người). Những người còn lại là Dân làng.
- Điều kiện hợp lệ: tổng số Sói (gồm Sói thường, Sói nguyền, Sói gây mê) phải lớn hơn hoặc bằng 1 và **nhỏ hơn nửa số người**; tổng số vai không vượt quá số người. *(em tự quyết)*
- Các Sói biết nhau ngay từ đầu.

### 3. Diễn biến một ván

**Đêm:**
- Mọi người cùng thao tác một lúc, mỗi người trên máy mình. Phù thủy phải chờ Sói chọn xong mới biết ai bị cắn.
- **Màn hình ban đêm của mọi người trông giống nhau.** Người không có vai ban đêm cũng thấy danh sách người chơi và phải bấm "Tôi đã sẵn sàng". Nhờ vậy người ngồi cạnh không đoán được vai qua việc ai đang bấm.
- Đêm kết thúc khi tất cả đã chọn xong. Thứ tự xử lý:
  1. Ghép đôi của Cupid (chỉ đêm 1).
  2. Sói cắn. Người bị cắn không chết nếu được Bảo vệ che hoặc được Phù thủy cứu.
  3. Nếu Sói nguyền dùng quyền nguyền: người bị cắn thành Sói, không chết. Bị che hoặc được cứu thì việc nguyền không có tác dụng, nhưng quyền nguyền vẫn bị tính là đã dùng. *(em tự quyết)*
  4. Bình độc của Phù thủy.
  5. Người yêu chết theo.
  6. Thợ săn bắn.

**Ngày:**
1. Công bố những người chết trong đêm. **Không lật vai.** Công bố cả người bị gây mê.
2. **Sáng ngày 1:** cả làng bầu **Già làng**. Già làng vẫn giữ vai bí mật của mình. Nếu hòa phiếu thì máy chọn ngẫu nhiên trong số những người hòa. *(em tự quyết)*
3. **Thảo luận:** có đồng hồ đếm ngược, chủ bàn chọn 2, 3 hoặc 5 phút lúc bắt đầu ván. Chủ bàn có nút "Bỏ phiếu luôn".
4. **Bỏ phiếu treo cổ:**
   - Người còn sống và không bị gây mê được bỏ phiếu cho 1 người, hoặc chọn "Không treo ai".
   - Người nhiều phiếu nhất bị treo.
   - **Hòa phiếu** thì Già làng chọn 1 người trong số những người hòa.
   - Không ai có phiếu thì không ai bị treo.
5. Xử lý người chết như ban đêm: người yêu chết theo, Thợ săn bắn. **Già làng chết** thì chỉ định người kế nhiệm trong số người còn sống.
6. Kiểm tra thắng thua. Chưa ai thắng thì sang đêm tiếp theo.

**Thắng:**
- **Cặp đôi khác phe** thắng khi chỉ còn 2 người họ sống sót. Điều kiện này được xét trước.
- **Dân** thắng khi không còn Sói nào sống.
- **Sói** thắng khi số Sói còn sống lớn hơn hoặc bằng số người còn lại.
- Mọi người trong phe thắng đều được +1 ván thắng, kể cả người đã chết. *(em tự quyết)*

**Người đã chết:** thấy vai của mọi người (để xem cho vui), không còn thao tác gì. Ngoài đời thì người chết nên im lặng, không gợi ý cho người còn sống.

**Người rớt mạng:** chủ bàn có nút "Bỏ qua người đang offline". Hành động còn thiếu của họ được tính là không làm gì:
- Sói không thống nhất được thì đêm đó không ai bị cắn.
- Phiếu còn thiếu tính là không bỏ phiếu.
- Thợ săn thì không bắn.
- Già làng chưa chọn người kế nhiệm thì máy chọn ngẫu nhiên.

### 4. Thay đổi ở `shared/table.js`

- **Phe thắng nhiều người:** `state.winner` có thể là một mảng id. Mỗi người trong mảng được +1. `resultOf` được trả thêm `title`, ví dụ "🐺 Phe Sói thắng!".
- **Cài đặt trước ván:** `runTable({setup})`. Host thấy bảng cài đặt ở màn chờ. Cài đặt được lưu lại và truyền vào `start(ids, {config})`. Nếu `engine.validate(ids, config)` trả về câu lỗi thì không bắt đầu ván, và hiện câu lỗi đó.
- **Chờ nhiều người:** view có thể có `waitingOn: [ids]`. Nếu một người trong danh sách đó offline thì host thấy nút "Bỏ qua người đang offline", bấm thì gọi `engine.forceSkip`.
- **Đồng hồ:** gói tin gửi cho từng máy có thêm `now` (giờ của host), để client tính thời gian còn lại mà không bị lệch giờ giữa các điện thoại.

### 5. Không làm

Giọng đọc quản trò, chat, các vai ngoài bảng trên.

---

## Thiết kế đợt 4 – phần 1: Cờ Tỷ Phú

Mã phòng bắt đầu bằng `P` · 2–6 người · tiền ảo kiểu VNĐ

### Mục đích
Game mua đất, xây nhà, thu tiền thuê trên bàn cờ 40 ô mang tên các tỉnh thành Việt Nam. Luật theo kiểu cờ tỷ phú phổ biến ở Việt Nam: 3 nhà + Công trình, Mua lại, Lễ hội, Độc quyền.

**Không làm (đã chốt):** đấu giá, giao dịch đất giữa người chơi, gom tiền ở ô nghỉ, bot.

**Thất bại nếu:** client tự gieo xúc xắc hoặc tự rút thẻ sự kiện (chỉ chủ bàn làm việc này); có người bị trừ tiền sai; ván kẹt vì một người nợ tiền mà không có lối ra (phải luôn có lối ra: bán nhà, thế chấp hoặc phá sản).

### Bàn cờ (40 ô)
- **4 góc:** 0 *Xuất phát*, 10 *Nhà tù*, 20 *Lễ hội*, 30 *Vào tù*. *(em tự quyết: Lễ hội đặt ở góc, thay cho ô Bãi đậu xe)*
- **22 ô đất, chia thành 8 nhóm màu** (giá tăng dần theo nhóm):
  - Nhóm 1 (2 ô): Hà Giang, Cao Bằng
  - Nhóm 2 (3 ô): Lạng Sơn, Điện Biên, Sơn La
  - Nhóm 3 (3 ô): Thanh Hoá, Nghệ An, Hà Tĩnh
  - Nhóm 4 (3 ô): Huế, Quảng Nam, Quảng Ngãi
  - Nhóm 5 (3 ô): Bình Định, Khánh Hoà, Lâm Đồng
  - Nhóm 6 (3 ô): An Giang, Kiên Giang, Cần Thơ
  - Nhóm 7 (3 ô): Quảng Ninh, Hải Phòng, Bình Dương
  - Nhóm 8 (2 ô): Hà Nội, TP. Hồ Chí Minh
- **4 sân bay:** Nội Bài, Đà Nẵng, Cam Ranh, Tân Sơn Nhất
- **2 ô tiện ích:** Điện lực, Cấp nước
- **6 ô Sự kiện ngẫu nhiên**
- **2 ô Thuế:** thuế thu nhập 2.000.000đ, thuế xa xỉ 1.000.000đ

*(Danh sách tỉnh, cách chia nhóm và mọi mức giá: em tự quyết)*

### Tiền
- Mỗi người bắt đầu với **15.000.000đ**.
- Đi qua hoặc dừng ở ô Xuất phát được nhận **2.000.000đ**.
- Giá đất từ 600.000đ đến 4.000.000đ, tăng dần theo nhóm.

### Lượt chơi
1. Gieo 2 xúc xắc rồi đi tới. Gieo ra **đôi** thì được gieo thêm lượt; 3 lần đôi liên tiếp thì vào tù.
2. Dừng ở **ô đất / sân bay / tiện ích chưa có chủ**: được mua hoặc bỏ qua.
3. Dừng ở **đất của người khác**: trả tiền thuê. Sau đó được **Mua lại** ô đó với giá **gấp đôi giá trị ô** (đất + nhà). Người chủ cũ nhận số tiền này. Ô đã có Công trình thì không mua lại được.
4. Dừng ở **đất của mình**: được xây thêm, nhiều cấp một lúc nếu đủ tiền.
   - Thứ tự: nhà 1 → nhà 2 → nhà 3 → **Công trình**.
   - Mỗi nhà giá 50% giá đất; Công trình giá bằng giá đất.
   - Không cần đủ bộ màu mới được xây.

### Tiền thuê
- Tính theo giá đất P: chưa có nhà 10% P; 1 nhà 50% P; 2 nhà 150% P; 3 nhà 300% P; có Công trình 500% P.
- Sở hữu **đủ cả nhóm màu** thì tiền thuê đất trống được ×2.
- **Sân bay:** chủ có 1/2/3/4 sân bay thì thu 250k / 500k / 1tr / 2tr.
- **Tiện ích:** tổng xúc xắc × 40.000đ; chủ có cả 2 ô tiện ích thì × 100.000đ.
- **Lễ hội ×2** (xem bên dưới).
- **Ô đang thế chấp** không thu tiền thuê.

### Lễ hội (góc 20)
- Dừng ở ô này thì chọn 1 ô đất của mình để tổ chức lễ hội: tiền thuê ô đó **×2**.
- Cả bàn chỉ có **1 lễ hội** tại một thời điểm. Lễ hội mới thay thế lễ hội cũ. *(em tự quyết)*

### Sự kiện ngẫu nhiên
- Một chồng **16 thẻ**, nội dung do em tự viết. Ví dụ:
  - trúng vé số;
  - bão lũ phải sửa nhà (trả theo số nhà và Công trình);
  - đi du lịch tới một sân bay;
  - vào tù;
  - thẻ "được tại ngoại";
  - lùi 3 ô;
  - nhận hoặc trả tiền cho mỗi người chơi.
- Thẻ được rút lần lượt; hết chồng thì trộn lại.

### Nhà tù
- Vào tù khi: dừng ở ô *Vào tù*, gieo đôi 3 lần liên tiếp, hoặc rút trúng thẻ sự kiện vào tù.
- Ra tù bằng một trong các cách:
  - gieo ra đôi (tối đa 3 lượt);
  - trả **500.000đ**;
  - dùng thẻ "được tại ngoại".
- Hết 3 lượt mà vẫn chưa ra thì bắt buộc trả tiền rồi đi. Lượt ngồi tù vẫn thu tiền thuê bình thường.

### Thế chấp, nợ, phá sản
- **Thế chấp:** trong lượt của mình, hoặc khi đang nợ, được thế chấp một ô và nhận 50% giá đất. Chuộc lại thì trả 55%. Ô có nhà phải bán nhà trước; nhà bán lại cho ngân hàng được 50% giá xây.
- **Nợ:** khi phải trả nhiều hơn số tiền đang có, người chơi vào trạng thái **Nợ** và phải bán nhà hoặc thế chấp cho tới khi đủ tiền. Nếu không thể đủ thì bấm **Phá sản**.
- **Phá sản:** toàn bộ tài sản chuyển cho chủ nợ. Nếu chủ nợ là ngân hàng thì đất trở về trạng thái chưa có chủ.

### Thắng
- **Độc quyền:** thắng ngay khi sở hữu **3 nhóm màu trọn vẹn**, hoặc **trọn một cạnh bàn cờ** (mọi ô đất và sân bay trên cạnh đó), hoặc **cả 4 sân bay**.
- **Phá sản hết người khác:** người cuối cùng còn trụ lại thì thắng.
- **Hết giờ:** chủ bàn chọn 30 / 45 / 60 phút hoặc Không giới hạn. Hết giờ thì ai có **tổng tài sản** lớn nhất thắng. Tổng tài sản = tiền mặt + giá đất (ô đang thế chấp tính 50%) + giá nhà và Công trình đã xây.

### Người chơi offline
Chủ bàn có nút "Bỏ lượt hộ": tự gieo xúc xắc và đi cho người đó, không mua, không xây. Nếu người đó đang nợ thì tự bán nhà / thế chấp theo thứ tự; vẫn không đủ thì phá sản. *(em tự quyết)*

### Giao diện
- Bàn cờ 11×11 ô (vòng 40 ô quanh viền), tên ô viết tắt.
- Chạm vào một ô để xem chi tiết: giá, chủ, số nhà, tiền thuê.
- Quân cờ là chấm tròn mang màu của từng người.
- Phía dưới bàn cờ: tiền của mọi người, đồng hồ đếm ngược nếu có giới hạn thời gian, các nút hành động của lượt hiện tại.

---

## Thiết kế đợt 4 – phần 2: Loạn Đả Viễn Tây

Mã phòng bắt đầu bằng `W` · 4–8 người · có vai trò bí mật + chức năng (nhân vật) công khai

### Vai trò
| Số người | Cảnh sát trưởng | Phó cảnh sát | Băng cướp | Kẻ phản bội |
|---|---|---|---|---|
| 4 | 1 | 1 | 2 | 0 |
| 5 | 1 | 1 | 2 | 1 |
| 6 | 1 | 1 | 3 | 1 |
| 7 | 1 | 2 | 3 | 1 |
| 8 | 1 | 2 | 3 | 2 |

- Bảng trên là **mặc định**. Ở sảnh chờ cả bàn thấy số lượng từng vai; **chủ phòng bấm +/− để chỉnh** Phó / Băng cướp / Kẻ phản bội (Cảnh sát trưởng luôn đúng 1). Tổng số vai phải bằng số người mới bắt đầu được; có nút "Về mặc định".
- Tối đa 8 người vì có 16 chức năng, mỗi người được chia 2 để chọn.

- **Cảnh sát trưởng** lộ mặt ngay từ đầu và đi trước. Các vai khác được giữ bí mật; ai chết thì lật vai.
- **Máu:** theo chức năng (3 hoặc 4), Cảnh sát trưởng +1. Máu cũng là số lá tối đa được giữ trên tay khi kết thúc lượt.
- **Thắng:**
  - **Phe Luật** (Cảnh sát trưởng và Phó) thắng khi toàn bộ Băng cướp và Kẻ phản bội đã chết.
  - **Băng cướp** thắng khi Cảnh sát trưởng chết, trừ trường hợp Kẻ phản bội là người duy nhất còn sống.
  - **Kẻ phản bội** thắng khi chỉ còn một mình mình sống.
- **Không có thưởng/phạt** khi hạ gục người khác (đã chốt).

### Chức năng (cập nhật theo yêu cầu ANam)
- Đầu ván mỗi người được chia **2 lá chức năng** ngẫu nhiên (không trùng nhau), chọn bí mật giữ 1.
- Khi **cả bàn chọn xong** thì chức năng được công khai, rồi mới chia bài và bắt đầu lượt Cảnh sát trưởng.
- Người chưa chọn mà offline: chủ bàn bấm bỏ qua, máy chọn lá đầu.
- 6 kỹ năng do ANam chọn (đặt tên riêng) + 10 kỹ năng tự thiết kế:

| Chức năng | Máu | Kỹ năng |
|---|---|---|
| Gã gặp thời | 4 | Bốc đầu lượt: lật lá thứ 2 cho cả bàn xem, ra ♥/♦ thì bốc thêm 1 lá |
| Cô nàng hai súng | 4 | Dùng Bắn thay Né và Né thay Bắn |
| Kẻ móc túi | 4 | Lá bốc đầu tiên mỗi lượt được rút ngẫu nhiên từ tay một người tự chọn |
| Ông lang vườn | 4 | Bỏ 2 lá bất kỳ để hồi 1 máu, lúc nào cũng được (máy tự dùng khi sắp gục) |
| Tay súng thép | 4 | Muốn né Bắn của người này phải 2 lần Né (Thùng gỗ tính 1 lần) |
| Kẻ lang thang | 4 | Hết bài trên tay thì bốc ngay 1 lá |
| Tay súng lão luyện | 3 | Bắn không giới hạn những người ở khoảng cách 1 (người xa hơn vẫn 1 lần/lượt) |
| Kẻ liều mạng | 4 | Trong lượt mình: chịu mất 1 máu để bốc 2 lá, dùng được tới khi còn 1 máu |
| Thợ rèn súng | 4 | Tầm bắn +1 (cộng với súng) |
| Bác sĩ làng | 4 | Khi người khác hồi máu: bỏ 1 lá để hồi 1 máu theo (trong 3 giây) |
| Người có Trái tim | 4 | Sắp mất máu vì Bắn / Bắn loạt: lật 1 lá, ra ♥ thì không mất máu (không áp dụng Thuốc nổ, Đấu tay đôi, Phục kích) |
| Cao bồi nhanh tay | 4 | Bị người khác Phá/Cướp thì được bắn trả ngay 1 phát miễn phí vào người đó |
| Thám tử | 4 | Đầu lượt xem lá trên cùng, được đẩy xuống đáy chồng rồi mới bốc |
| Phu xe ngựa | 4 | Tiếp tế và Tiếp tế lớn bốc thêm 1 lá |
| Thầy bói | 4 | Lật bài kiểm tra (Nhà tù, Thùng gỗ, Trái tim): ♦ cũng tính như ♥ |
| Gã khổng lồ | 9 | Không dùng được lá Né (Thùng gỗ vẫn được); trên tay giữ tối đa 5 lá |

### Lượt chơi
1. **Đầu lượt:**
   - Nếu trước mặt đang có Thuốc nổ thì lật bài kiểm tra trước.
   - Sau đó, nếu đang bị Nhà tù thì lật bài kiểm tra tiếp.
2. **Bốc 2 lá.**
3. **Đánh bài** tùy ý. Mỗi lượt **chỉ được đánh 1 lá Bắn**, trừ khi đang cầm Súng liên thanh.
4. **Kết thúc lượt:** bỏ bớt bài cho tới khi số lá trên tay không vượt quá số máu đang có.

**Lật bài kiểm tra:** máy lật lá trên cùng của chồng bài, xem chất (♥ ♦ ♣ ♠). Mỗi lá bài có sẵn một chất. *(em tự quyết)*

### Khoảng cách
- Mọi người ngồi thành vòng tròn theo thứ tự trong phòng. Khoảng cách giữa hai người là số ghế ít nhất giữa họ, chỉ tính người còn sống.
- **Tầm bắn** mặc định là 1. Trang bị súng sẽ thay tầm bắn.
- **Ngựa** (trang bị): người khác nhìn mình xa thêm 1.
- **Ống nhòm** (trang bị): mình nhìn người khác gần lại 1.

### Bộ bài (126 lá; mọi loại ít nhất 3 lá; tên gọi: em tự quyết)
Viền nâu = lá đánh ngay, chỉ trong lượt mình (trừ **Né**, **Lách người**, **Băng bó** dùng được ngoài lượt).
Viền xanh dương = trang bị, đặt ra trước mặt rồi mới có tác dụng.

**Lá dùng ngay (viền nâu):**
| Lá | Số lượng | Tác dụng |
|---|---|---|
| Bắn | 22 | Bắn 1 người trong tầm. Người đó phải đánh **Né**, nếu không thì mất 1 máu. |
| Né | 12 | Chỉ đánh khi bị Bắn hoặc bị Bắn loạt. |
| Băng bó | 6 | Hồi 1 máu, **dùng bất kỳ lúc nào** (cả lượt người khác). |
| Rượu mừng | 3 | Trong lượt mình, chọn: mọi người còn sống hồi 1 máu, **hoặc** riêng mình hồi 1 máu. |
| Cướp | 4 | Lấy 1 lá của người ở khoảng cách 1: hoặc 1 lá ngẫu nhiên trên tay, hoặc 1 trang bị tự chọn. |
| Phá | 4 | Bỏ 1 lá của bất kỳ ai: hoặc 1 lá ngẫu nhiên trên tay, hoặc 1 trang bị tự chọn. |
| Đấu tay đôi | 3 | Thách 1 người bất kỳ. Hai bên lần lượt đánh Bắn, người đối thủ đánh trước. Ai không đánh được thì mất 1 máu. |
| Bắn loạt | 3 | Mọi người khác phải đánh Né, nếu không thì mất 1 máu. |
| Phục kích | 3 | Mọi người khác phải đánh Bắn, nếu không thì mất 1 máu. |
| Tiếp tế | 3 | Bốc thêm 2 lá. |
| Tiếp tế lớn | 3 | Bốc thêm 3 lá. |
| Chợ phiên | 3 | Lật số lá bằng số người còn sống. Lần lượt từ người đánh, mỗi người lấy 1 lá; người cuối nhận lá còn lại. |
| Đấm | 3 | Đánh 1 người ở khoảng cách 1: Né hoặc mất 1 máu. Không tính vào giới hạn Bắn. |
| Lách người | 3 | Dùng như Né, rồi bốc thêm 1 lá. |
| Rượu mạnh | 3 | Bỏ kèm 1 lá trên tay: 1 người tự chọn (kể cả mình) hồi 1 máu. |
| Ẩu đả | 3 | Bỏ kèm 1 lá trên tay: mỗi người khác mất ngẫu nhiên 1 lá trên tay. |

**Trang bị (viền xanh dương; mỗi loại chỉ đặt được 1 lá; có súng mới thì súng cũ bị bỏ):**
| Lá | Số lượng | Tác dụng |
|---|---|---|
| Súng ngắn / Súng trường / Súng săn / Súng xa | 3 mỗi loại | Tầm bắn lần lượt 2 / 3 / 4 / 5 |
| Súng liên thanh | 3 | Tầm bắn 1, mỗi lượt đánh Bắn không giới hạn |
| Ngựa | 3 | Người khác nhìn mình xa thêm 1 |
| Ống nhòm | 3 | Mình nhìn người khác gần lại 1 |
| Thùng gỗ | 3 | Khi bị Bắn, lật bài: ra ♥ thì coi như đã Né |
| Nhà tù | 3 | Đặt lên 1 người khác (trừ Cảnh sát trưởng). Đầu lượt người đó lật bài: ra ♥ thì thoát, ngược lại thì **mất lượt**. Lật xong thì bỏ lá Nhà tù. |
| Thuốc nổ | 3 | Đặt trước mặt mình. Đầu lượt của người đang giữ, lật bài: ra ♠ thì **nổ, mất 3 máu**; ngược lại thì chuyền sang người kế tiếp. |

**Trang bị dùng 1 lần (viền xanh dương; đặt ra rồi dùng được ngay, bỏ đi để kích hoạt; người khác Cướp/Phá được):**
| Lá | Số lượng | Tác dụng |
|---|---|---|
| Súng giấu | 3 | Bắn 1 người ở khoảng cách 1 (Né hoặc mất 1 máu), rồi bốc 1 lá. Không tính giới hạn Bắn. |
| Bình nước | 3 | Hồi 1 máu (trong lượt mình). |
| Mũ rộng vành | 3 | Khi bị Bắn / Bắn loạt / Đấm: bỏ đi để né 1 phát. |
| Xe thồ | 3 | Lấy 1 lá của bất kỳ ai, không kể khoảng cách. |
| Dao găm | 3 | Đánh 1 người trong tầm súng (Né hoặc mất 1 máu). Không tính giới hạn Bắn. |

### Phản ứng (khi bị Bắn, Bắn loạt, Phục kích, Đấu tay đôi)
- Máy chờ người bị nhắm bấm "Né", "Bắn" (khi Phục kích hoặc Đấu tay đôi) hoặc "Chịu".
- Nhiều người cùng bị nhắm thì máy hỏi lần lượt theo thứ tự ghế.
- Người bị nhắm mà offline thì chủ bàn bấm "Bỏ qua", tính là người đó chịu mất máu.

### Hết máu
- Máu về 0 mà trên tay còn **Băng bó** thì máy tự dùng để sống lại với 1 máu. Không áp dụng khi chỉ còn 2 người sống. *(em tự quyết)*
- Chết thì lật vai, toàn bộ bài trên tay và trang bị bị bỏ đi.

### Giao diện
- **Thẻ vai:** mặc định che, bấm mới hiện (như Ma Sói). Riêng Cảnh sát trưởng hiện công khai.
- **Danh sách người chơi** theo vòng ghế, mỗi người có: máu (❤️), số lá trên tay, trang bị đang đặt, và khoảng cách tính từ mình.
- **Bài trên tay:** chạm 1 lá → nếu lá đó cần chọn người thì chạm tiếp vào người. Ô người chơi nào đang ngoài tầm bắn thì bị làm mờ.
- **Khung phản ứng** hiện nổi lên khi mình đang bị nhắm.

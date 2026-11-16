// Tiện ích thuần dùng chung cho các engine (không DOM, chạy được trong Node để test).

// Trộn Fisher–Yates tại chỗ; rng nhận vào để test được.
export function shuffle(a, rng = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Kết quả từ chối một hành động, kèm câu báo lỗi hiện cho người chơi.
export const fail = (error) => ({ ok: false, error });

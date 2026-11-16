// Minh hoạ SVG tự vẽ cho bộ bài Loạn Đả Viễn Tây (viewBox 64×64, nét mực nâu) + ý nghĩa từng lá.
const S = 'stroke="#3b2a17" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';
const gun = (n) => `<path d="M4 28h44l6-4h6v8h-8l-2 4H28l-6 14h-8l3-14H4z" fill="#8d6e63" ${S}/><path d="M10 28v-4h30" ${S} fill="none"/><text x="40" y="58" font-size="16" font-weight="800" fill="#3b2a17" font-family="system-ui">${n}</text>`;
const ART = {
  ban: `<path d="M8 26h30l4-4h10v8H44l-2 4H30l-4 14h-8l2-14H8z" fill="#7a7a7a" ${S}/><circle cx="33" cy="30" r="3" fill="#3b2a17"/><path d="M52 22l6-3M52 26h7M52 30l6 3" ${S} fill="none"/>`,
  ne: `<path d="M32 10a22 22 0 1 0 22 22" fill="none" ${S}/><path d="M32 18a14 14 0 1 0 14 14" fill="none" ${S}/><path d="M32 26a6 6 0 1 0 6 6" fill="none" ${S}/><path d="M50 14l6 6-8 2" fill="#c9b48f" ${S}/>`,
  bangbo: `<rect x="10" y="24" width="44" height="16" rx="8" fill="#f2d6b3" ${S} transform="rotate(-30 32 32)"/><path d="M27 32h10M32 27v10" stroke="#c0392b" stroke-width="4" stroke-linecap="round" transform="rotate(-30 32 32)"/>`,
  ruou: `<rect x="16" y="18" width="24" height="34" rx="3" fill="#f0b429" ${S}/><path d="M16 22c0-8 24-8 24 0" fill="#fff" ${S}/><path d="M40 26h6a5 5 0 0 1 0 14h-6" fill="none" ${S}/><path d="M22 28v18M28 28v18M34 28v18" stroke="#c98a12" stroke-width="2"/>`,
  cuop: `<path d="M18 50V30a4 4 0 0 1 8 0v-8a4 4 0 0 1 8 0v4a4 4 0 0 1 8 0v4a4 4 0 0 1 8 0v14c0 8-6 12-14 12h-6c-6 0-12-4-12-6z" fill="#e9c49a" ${S}/><path d="M44 12l6 4-6 4" fill="none" ${S}/>`,
  pha: `<path d="M32 6l5 14 14-6-6 14 14 5-14 5 6 14-14-6-5 14-5-14-14 6 6-14-14-5 14-5-6-14 14 6z" fill="#f08c00" ${S}/><circle cx="32" cy="32" r="7" fill="#ffd43b" ${S}/>`,
  duel: `<path d="M12 52L44 20M44 20l6-8 2 2-8 6M14 44l6 6M52 52L20 20M20 20l-6-8-2 2 8 6M50 44l-6 6" fill="none" ${S}/>`,
  loat: `<g ${S} fill="#9e9e9e"><rect x="6" y="18" width="40" height="8" rx="2"/><rect x="6" y="30" width="40" height="8" rx="2"/><rect x="6" y="42" width="40" height="8" rx="2"/></g><path d="M50 22h8M50 34h10M50 46h8" ${S}/>`,
  phuckich: `<path d="M10 54L50 14" ${S}/><path d="M50 14l-10 2 8 8z" fill="#3b2a17"/><path d="M20 58L56 22" ${S} opacity=".6"/><path d="M8 40c6-10 14-10 20 0" fill="#7c9a5a" ${S}/>`,
  tiepte: `<rect x="10" y="22" width="44" height="30" rx="2" fill="#c98a4b" ${S}/><path d="M10 32h44M32 22v30M18 22l6-8h16l6 8" fill="none" ${S}/>`,
  tieptelon: `<rect x="8" y="24" width="34" height="20" rx="3" fill="#6d4c41" ${S}/><rect x="42" y="18" width="14" height="26" rx="2" fill="#6d4c41" ${S}/><circle cx="18" cy="48" r="5" fill="#3b2a17"/><circle cx="34" cy="48" r="5" fill="#3b2a17"/><circle cx="50" cy="48" r="5" fill="#3b2a17"/><path d="M14 24v-8h6v8" fill="#3b2a17"/>`,
  sung2: gun(2), sung3: gun(3), sung4: gun(4), sung5: gun(5),
  lienthanh: `<path d="M6 24h40v14H6z" fill="#9e9e9e" ${S}/><circle cx="18" cy="31" r="4" fill="#3b2a17"/><circle cx="30" cy="31" r="4" fill="#3b2a17"/><path d="M46 28h12M46 34h12M20 38l-4 14h8l4-14" ${S} fill="none"/>`,
  ngua: `<path d="M20 54V36c0-12 8-22 20-24l4 6 6 2-2 8-8 2-6 10v14z" fill="#a1683a" ${S}/><circle cx="42" cy="22" r="2" fill="#3b2a17"/><path d="M30 14c-4 2-8 8-8 14" ${S} fill="none"/>`,
  ongnhom: `<rect x="8" y="26" width="40" height="12" rx="3" fill="#c9a227" ${S} transform="rotate(-20 28 32)"/><circle cx="50" cy="22" r="7" fill="#90caf9" ${S}/><path d="M18 46l-4 10M26 44l2 12" ${S}/>`,
  thung: `<ellipse cx="32" cy="14" rx="16" ry="5" fill="#a1683a" ${S}/><path d="M16 14v36c0 3 7 5 16 5s16-2 16-5V14" fill="#8d5a2b" ${S}/><path d="M16 26c0 3 7 5 16 5s16-2 16-5M16 40c0 3 7 5 16 5s16-2 16-5" fill="none" ${S}/>`,
  tu: `<rect x="10" y="10" width="44" height="44" rx="3" fill="#cfd8dc" ${S}/><path d="M20 10v44M30 10v44M40 10v44M10 30h44" ${S}/>`,
  no: `<rect x="14" y="26" width="10" height="26" rx="2" fill="#c0392b" ${S}/><rect x="27" y="26" width="10" height="26" rx="2" fill="#c0392b" ${S}/><rect x="40" y="26" width="10" height="26" rx="2" fill="#c0392b" ${S}/><path d="M32 26c0-8 6-10 10-16" ${S} fill="none"/><path d="M42 10l4-4M42 10l5 1M42 10l-1-5" stroke="#f08c00" stroke-width="2.5" stroke-linecap="round"/>`,
};

export const CARD = {
  ban: ['Bắn', 'Bắn 1 người trong tầm. Họ phải Né hoặc mất 1 máu. Mỗi lượt 1 lần.'],
  ne: ['Né', 'Chỉ đánh khi bị bắn / bắn loạt: tránh được 1 phát.'],
  bangbo: ['Băng bó', 'Hồi 1 máu. Hết máu mà còn lá này thì tự dùng để sống.'],
  ruou: ['Rượu mừng', 'Mọi người còn sống hồi 1 máu.'],
  cuop: ['Cướp', 'Lấy 1 lá của người ở khoảng cách 1 (trên tay hoặc trang bị).'],
  pha: ['Phá', 'Bỏ 1 lá của bất kỳ ai (trên tay hoặc trang bị).'],
  duel: ['Đấu tay đôi', 'Thách 1 người: hai bên lần lượt đánh Bắn, ai hết thì mất 1 máu.'],
  loat: ['Bắn loạt', 'Mọi người khác phải Né hoặc mất 1 máu.'],
  phuckich: ['Phục kích', 'Mọi người khác phải đánh Bắn hoặc mất 1 máu.'],
  tiepte: ['Tiếp tế', 'Bốc thêm 2 lá.'],
  tieptelon: ['Tiếp tế lớn', 'Bốc thêm 3 lá.'],
  sung2: ['Súng ngắn', 'Trang bị: tầm bắn 2.'], sung3: ['Súng trường', 'Trang bị: tầm bắn 3.'],
  sung4: ['Súng săn', 'Trang bị: tầm bắn 4.'], sung5: ['Súng xa', 'Trang bị: tầm bắn 5.'],
  lienthanh: ['Liên thanh', 'Trang bị: tầm 1, bắn không giới hạn mỗi lượt.'],
  ngua: ['Ngựa', 'Trang bị: người khác nhìn bạn xa thêm 1.'],
  ongnhom: ['Ống nhòm', 'Trang bị: bạn nhìn người khác gần lại 1.'],
  thung: ['Thùng gỗ', 'Trang bị: bị bắn thì lật bài, ra ♥ là né được.'],
  tu: ['Nhà tù', 'Đặt lên người khác (trừ Cảnh sát trưởng): đầu lượt lật ra ♥ mới thoát, không thì mất lượt.'],
  no: ['Thuốc nổ', 'Đặt trước mặt: đầu lượt lật ra ♠ thì nổ mất 3 máu, không thì chuyền sang người kế.'],
};
export const EQUIP = new Set(['sung2', 'sung3', 'sung4', 'sung5', 'lienthanh', 'ngua', 'ongnhom', 'thung', 'tu', 'no']);

// Nút/khung SVG từ chuỗi tĩnh (không chứa dữ liệu người chơi).
export function art(t) {
  const span = document.createElement('span');
  span.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">${ART[t] || ''}</svg>`;
  return span.firstChild;
}

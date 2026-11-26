import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog.tsx';

const SECTIONS = [
  {
    title: 'Thứ tự bài',
    body: '3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2. Cùng nước thì chất tăng dần: Bích ♠, Chuồn ♣ (Tép), Rô ♦, Cơ ♥.',
  },
  {
    title: 'Bộ hợp lệ',
    body: 'Lẻ, đôi, sám cô, sảnh từ 3 lá trở lên (không có 2), tứ quý, 3 đôi thông và 4 đôi thông. Đôi thông là các đôi liên tiếp, không chứa 2. Sảnh khác số lá không chặt được nhau.',
  },
  {
    title: 'Chặt',
    body: '3 đôi thông chặt một con 2 hoặc 3 đôi thông nhỏ hơn. Tứ quý chặt một con 2, đôi 2, 3 đôi thông hoặc tứ quý nhỏ hơn. 4 đôi thông chặt một con 2, đôi 2, 3 đôi thông, tứ quý hoặc 4 đôi thông nhỏ hơn. Khi bật tùy chọn, 4 đôi thông được chặt ngay, không cần đợi đến lượt.',
  },
  {
    title: 'Lượt chơi',
    body: 'Ván đầu, người cầm 3♠ đi trước và phải đánh lá 3♠ trong bộ mở màn. Ván sau, người về nhất đi trước tự do. Bỏ lượt thì hết quyền trong vòng đó. Khi những người còn lại đều bỏ, người vừa đánh được mở vòng mới. Ai hết bài trước xếp Nhất, rồi Nhì, Ba và Bét.',
  },
  {
    title: 'Tới trắng',
    body: 'Có ngay khi chia bài: sảnh rồng (3 tới A), tứ quý 2, 6 đôi, 5 đôi thông, 4 sám cô. Người tới trắng thắng ván và nhận 5 lần cược từ mỗi người.',
  },
  {
    title: 'Điểm',
    body: '4 người: Nhất +3, Nhì +1, Ba −1, Bét −3 lần cược. 3 người: Nhất +2, Nhì hòa, Bét −2. 2 người: Nhất +2, Bét −2. Heo, tứ quý hoặc đôi thông còn lại trên tay Bét bị thối, cộng cho Nhất.',
  },
];

export function RulesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Luật Tiến Lên Miền Nam</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-relaxed text-white/85">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="font-bold text-gold">{section.title}</h3>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

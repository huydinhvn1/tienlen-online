import { BookOpen, LogOut, Spade, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { parseCard } from '../../shared/cards.ts';
import { placeLabel } from '../../shared/scoring.ts';
import type { PublicUser } from '../../shared/protocol.ts';
import { cn, formatDelta, formatPoints } from '../lib/utils.ts';
import { Avatar } from './Avatar.tsx';
import { CardView } from './CardView.tsx';
import { Button } from './ui/button.tsx';

interface HomeScreenProps {
  user: PublicUser | null;
  clientId: string | null;
  stake: number;
  instantChop: boolean;
  soundOn: boolean;
  busy: boolean;
  onStake: (stake: number) => void;
  onInstantChop: (value: boolean) => void;
  onGuest: () => void;
  onGoogle: (credential: string) => void;
  onGoogleUnavailable: () => void;
  onSolo: () => void;
  onOnline: () => void;
  onRules: () => void;
  onLogout: () => void;
  onToggleSound: () => void;
}

export function HomeScreen(props: HomeScreenProps) {
  return (
    <div className="felt min-h-dvh" data-screen="home">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-5 md:justify-center">
        <header className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-gold">
              <Spade className="h-5 w-5 fill-gold" />
              <h1 className="text-2xl font-extrabold tracking-tight">Bài Tiến Lên</h1>
            </div>
            <p className="text-sm text-white/75">Tiến Lên Miền Nam</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={props.onRules} aria-label="Luật chơi">
              <BookOpen className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={props.onToggleSound} aria-label={props.soundOn ? 'Tắt âm' : 'Bật âm'}>
              {props.soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
          </div>
        </header>

        <div className="relative mx-auto mt-4 h-32 w-56">
          <div className="absolute left-2 top-4 -rotate-12">
            <CardView card={parseCard('2H')} />
          </div>
          <div className="absolute left-[4.5rem] top-0">
            <CardView card={parseCard('AS')} />
          </div>
          <div className="absolute left-32 top-4 rotate-12">
            <CardView card={parseCard('QD')} />
          </div>
        </div>

        {props.user ? <PlayerHome {...props} user={props.user} /> : <GuestHome {...props} />}
      </div>
    </div>
  );
}

function GuestHome({ clientId, busy, onGuest, onGoogle, onGoogleUnavailable }: HomeScreenProps) {
  return (
    <div className="mt-2 space-y-3">
      <p className="text-center text-sm leading-relaxed text-white/80">
        Bốn người, 52 lá, chặt heo và tới trắng. Chơi ngay với máy hoặc mở phòng rủ bạn.
      </p>
      <GoogleButton clientId={clientId} disabled={busy} onCredential={onGoogle} onUnavailable={onGoogleUnavailable} />
      <Button className="h-12 w-full text-base" onClick={onGuest} disabled={busy} data-testid="guest-button">
        Chơi thử (Khách)
      </Button>
      {!clientId && (
        <p className="text-center text-xs leading-relaxed text-white/60">
          Nút Google hiện khi có biến <span className="font-semibold text-gold">GOOGLE_CLIENT_ID</span>. Xem README để thêm
          origin trong Google Cloud Console. Bạn vẫn vào bàn được bằng chế độ khách.
        </p>
      )}
    </div>
  );
}

function PlayerHome({
  user,
  stake,
  instantChop,
  onStake,
  onInstantChop,
  onSolo,
  onOnline,
  onLogout,
}: HomeScreenProps & { user: PublicUser }) {
  return (
    <div className="mt-2 space-y-3">
      <div className="flex items-center gap-3 rounded-2xl bg-black/25 p-3">
        <Avatar name={user.name} url={user.avatar} size={52} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold">{user.name}</div>
          <div className="text-sm text-gold">{formatPoints(user.chips)} điểm</div>
          <div className="text-xs text-white/65">
            {user.gamesPlayed} ván · {user.wins} thắng · chuỗi {user.winStreak}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Đăng xuất">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      <div>
        <div className="mb-1 text-xs font-semibold text-white/70">Cược mỗi ván</div>
        <div className="grid grid-cols-4 gap-2">
          {[10, 20, 50, 100].map((value) => (
            <Button key={value} size="sm" variant={stake === value ? 'default' : 'secondary'} onClick={() => onStake(value)}>
              {value}
            </Button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onInstantChop(!instantChop)}
        className="flex w-full items-center justify-between rounded-2xl bg-black/20 px-3 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-semibold">4 đôi thông chặt không cần vòng</span>
          <span className="block text-xs text-white/65">Chặt ngay khi đối thủ đánh heo, tứ quý hoặc đôi thông</span>
        </span>
        <span className={cn('rounded-full px-2 py-1 text-xs font-bold', instantChop ? 'bg-emerald-300 text-emerald-950' : 'bg-white/10')}>
          {instantChop ? 'Bật' : 'Tắt'}
        </span>
      </button>

      <Button className="h-12 w-full text-base" onClick={onSolo} data-testid="solo-button">
        Chơi với máy
      </Button>
      <Button className="h-12 w-full text-base" variant="secondary" onClick={onOnline} data-testid="online-button">
        Chơi Online
      </Button>

      <section>
        <h2 className="mb-2 text-sm font-bold text-gold">Ván gần đây</h2>
        {user.recent.length === 0 ? (
          <p className="rounded-2xl bg-black/20 px-3 py-3 text-sm text-white/70">Chưa có ván nào. Hãy đánh ván đầu tiên.</p>
        ) : (
          <ul className="space-y-2">
            {user.recent.map((match, index) => (
              <li key={`${match.createdAt}-${index}`} className="flex items-center justify-between rounded-2xl bg-black/20 px-3 py-2 text-sm">
                <span>
                  <span className="font-semibold">{match.place === 1 && match.instant ? 'Tới trắng' : placeLabel(match.place, match.playerCount)}</span>
                  <span className="text-white/60"> · {match.mode === 'solo' ? 'Với máy' : 'Online'}</span>
                </span>
                <span className={cn('font-bold', match.delta >= 0 ? 'text-emerald-200' : 'text-rose-200')}>{formatDelta(match.delta)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function GoogleButton({
  clientId,
  disabled,
  onCredential,
  onUnavailable,
}: {
  clientId: string | null;
  disabled: boolean;
  onCredential: (credential: string) => void;
  onUnavailable: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const callback = useRef(onCredential);
  callback.current = onCredential;

  useEffect(() => {
    if (!clientId || !host.current) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client?hl=vi';
    script.async = true;
    script.onload = () => {
      if (!window.google || !host.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => callback.current(response.credential),
      });
      window.google.accounts.id.renderButton(host.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        width: 280,
        locale: 'vi',
      });
      setReady(true);
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [clientId]);

  if (!clientId) {
    return (
      <Button variant="outline" className="h-12 w-full" disabled={disabled} onClick={onUnavailable}>
        Đăng nhập bằng Google
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={host} className="flex min-h-11 justify-center" data-testid="google-button" />
      {!ready && (
        <Button variant="outline" className="h-12 w-full" disabled>
          Đang tải nút Google...
        </Button>
      )}
    </div>
  );
}

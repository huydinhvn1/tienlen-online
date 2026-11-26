import { ArrowLeft, BookOpen, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cardLabel, parseCard, sortCards } from '../../shared/cards.ts';
import { identify } from '../../shared/combo.ts';
import { previewPlay } from '../../shared/game.ts';
import { placeLabel } from '../../shared/scoring.ts';
import type { SortMode } from '../../shared/cards.ts';
import type { TableView } from '../../shared/view.ts';
import { cn, formatDelta } from '../lib/utils.ts';
import { Avatar } from './Avatar.tsx';
import { CardView } from './CardView.tsx';
import { Button } from './ui/button.tsx';

interface GameTableProps {
  model: TableView;
  feed: string[];
  selected: string[];
  sortMode: SortMode;
  banner: string | null;
  soundOn: boolean;
  againLabel: string;
  exitLabel: string;
  onToggleCard: (id: string) => void;
  onPlay: () => void;
  onPass: () => void;
  onSort: () => void;
  onExit: () => void;
  onAgain: () => void;
  onToggleSound: () => void;
  onRules: () => void;
}

export function GameTable({
  model,
  feed,
  selected,
  sortMode,
  banner,
  soundOn,
  againLabel,
  exitLabel,
  onToggleCard,
  onPlay,
  onPass,
  onSort,
  onExit,
  onAgain,
  onToggleSound,
  onRules,
}: GameTableProps) {
  const opponents = model.seats.filter((seat) => seat.index !== model.you);
  const lastCombo = model.pile.length ? identify(model.pile) : null;
  const preview = previewPlay(model.yourHand, selected, {
    openingCardId: model.yourTurn ? model.openingCardId : null,
    lastCombo,
    yourTurn: model.yourTurn,
    canInstantChop: model.canInstantChop,
    phase: model.phase,
  });
  const pileName = model.pileSeat != null ? model.seats[model.pileSeat]?.name : null;
  const turnName = model.seats[model.currentTurn]?.name;
  const sortLabel = sortMode === 'rank' ? 'Theo nước' : sortMode === 'group' ? 'Theo bộ' : 'Theo chất';
  const latest = feed[feed.length - 1];

  useEffect(() => {
    if (!model.openingCardId || model.phase !== 'playing') return;
    const node = document.querySelector(`[data-testid="hand"] [data-card="${CSS.escape(model.openingCardId)}"]`);
    node?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [model.openingCardId, model.phase, model.turnSerial]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && preview.ok) onPlay();
      if (event.key === 'Backspace' && model.yourTurn && model.pile.length > 0) {
        event.preventDefault();
        onPass();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview.ok, model.yourTurn, model.pile.length, onPlay, onPass]);

  return (
    <div className="min-h-dvh bg-[#041910] md:p-4" data-screen="table" data-phase={model.phase} data-your-turn={model.yourTurn ? '1' : '0'}>
      <div className="felt wood-rail relative mx-auto flex min-h-dvh max-w-5xl flex-col md:min-h-[calc(100dvh-2rem)] md:rounded-[28px]">
        <header className="flex items-center gap-2 px-3 pb-1 pt-3">
          <Button variant="ghost" size="icon" onClick={onExit} aria-label={exitLabel}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-extrabold text-gold">Bài Tiến Lên</div>
            <div className="text-[11px] text-white/70">Cược {model.stake} · {model.playerCount} người</div>
          </div>
          <Button variant="ghost" size="icon" onClick={onRules} aria-label="Luật chơi">
            <BookOpen className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onToggleSound} aria-label={soundOn ? 'Tắt âm' : 'Bật âm'}>
            {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col [@media(max-height:520px)]:flex-row">
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              className={cn(
                'grid gap-2 px-3',
                opponents.length <= 1 && 'mx-auto w-full max-w-[11rem] grid-cols-1',
                opponents.length === 2 && 'grid-cols-2',
                opponents.length >= 3 && 'grid-cols-3',
              )}
            >
              {opponents.map((seat) => {
                const active = model.phase === 'playing' && model.currentTurn === seat.index;
                return (
                  <div
                    key={seat.index}
                    className={cn(
                      'rounded-2xl border px-2 py-2 text-center',
                      active ? 'border-gold bg-black/25 shadow-[0_0_18px_rgba(240,215,140,.25)]' : 'border-white/10 bg-black/20',
                      seat.passed && 'opacity-70',
                    )}
                  >
                    <div className="mx-auto w-fit">
                      <Avatar name={seat.name} url={seat.avatar} size={36} />
                    </div>
                    <div className="mt-1 truncate text-xs font-semibold">{seat.name}</div>
                    <div className="text-[11px] text-white/70">{seat.cardCount} lá</div>
                    {seat.place != null && (
                      <div className="text-xs font-bold text-gold">{placeLabel(seat.place, model.playerCount)}</div>
                    )}
                    {seat.passed && <div className="text-[11px] text-rose-200">Bỏ lượt</div>}
                    {seat.isBot && <div className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Máy</div>}
                    {!seat.connected && !seat.isBot && <div className="text-[11px] text-amber-200">Mất kết nối</div>}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-1 flex-col items-center justify-center px-3 py-3">
              {model.pile.length === 0 ? (
                <div className="text-center">
                  <div className="text-sm font-semibold text-white/90">
                    {model.openingCardId ? `Lượt đầu phải có ${cardLabel(parseCard(model.openingCardId))}` : 'Vòng mới'}
                  </div>
                  <div className="mt-1 text-xs text-white/65">{turnName ? `${turnName} đi trước` : 'Chờ đánh'}</div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-xs font-semibold text-gold">
                    {pileName} · {model.pileLabel}
                  </div>
                  <div className="mt-2 flex items-center justify-center">
                    {model.pile.map((card, index) => (
                      <div key={card.id} className="pile-card" style={{ marginLeft: index === 0 ? 0 : model.pile.length > 6 ? -28 : -16 }}>
                        <CardView card={card} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {model.phase === 'playing' && (
                <div className="mt-3 w-full max-w-xs">
                  <div className="mb-1 text-center text-xs font-semibold">
                    {model.yourTurn ? 'Đến lượt bạn' : model.canInstantChop ? 'Bạn có thể chặt ngay' : `${turnName ?? 'Đối thủ'} đang đánh`}
                  </div>
                  <TurnBar serial={model.turnSerial} msLeft={model.turnMsLeft} budget={model.turnBudgetMs} />
                </div>
              )}
            </div>
          </div>

          <div className="[@media(max-height:520px)]:flex [@media(max-height:520px)]:w-[58%] [@media(max-height:520px)]:flex-col [@media(max-height:520px)]:justify-end">
            <div className="px-3 text-center text-xs text-white/75">{latest}</div>
            <div className="mt-2 flex items-center gap-2 px-3">
              <Button variant="secondary" className="h-12 px-3" onClick={onPass} disabled={!model.yourTurn || model.pile.length === 0} data-testid="pass-button">
                Bỏ lượt
              </Button>
              <Button className="h-12 flex-1 text-base" onClick={onPlay} disabled={!preview.ok} data-testid="play-button">
                {!model.yourTurn && preview.ok ? 'Chặt ngay' : 'Đánh bài'}
              </Button>
              <Button variant="secondary" className="h-12 px-3" onClick={onSort} data-testid="sort-button">
                <span className="flex flex-col leading-tight">
                  <span>Xếp bài</span>
                  <span className="text-[10px] font-medium text-white/60">{sortLabel}</span>
                </span>
              </Button>
            </div>
            <div className={cn('px-3 pb-1 pt-2 text-center text-xs font-semibold', preview.ok ? 'text-emerald-200' : 'text-white/70')}>
              {preview.text}
              {selected.length > 0 ? ` · ${selected.length} lá` : ''}
            </div>
            <div
              className="hand-scroll flex items-end gap-0 overflow-x-auto px-3 pb-[max(0.8rem,env(safe-area-inset-bottom))] pt-6"
              style={{ justifyContent: 'safe center' }}
              data-testid="hand"
            >
              {model.yourHand.map((card, index) => (
                <div key={card.id} style={{ marginLeft: index === 0 ? 0 : -22 }} className="shrink-0">
                  <CardView
                    card={card}
                    size="md"
                    selected={selected.includes(card.id)}
                    opening={card.id === model.openingCardId}
                    onClick={() => onToggleCard(card.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {banner && (
          <div className="toast-banner pointer-events-none absolute left-1/2 top-[28%] z-30 rounded-full bg-gradient-to-b from-[#fff6d2] to-gold px-5 py-2 text-lg font-extrabold text-[#3a2a08] shadow-xl">
            {banner}
          </div>
        )}
        {model.phase === 'ended' && model.result && (
          <ResultOverlay model={model} againLabel={againLabel} exitLabel={exitLabel} onAgain={onAgain} onExit={onExit} />
        )}
      </div>
    </div>
  );
}

function TurnBar({ serial, msLeft, budget }: { serial: number; msLeft: number; budget: number }) {
  const [left, setLeft] = useState(msLeft);
  useEffect(() => {
    const end = Date.now() + msLeft;
    setLeft(msLeft);
    const timer = window.setInterval(() => setLeft(Math.max(0, end - Date.now())), 200);
    return () => window.clearInterval(timer);
  }, [serial, msLeft]);
  const pct = Math.max(0, Math.min(100, (left / Math.max(budget, 1)) * 100));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-black/35" aria-hidden>
      <div className="h-full rounded-full bg-gold transition-[width] duration-200" style={{ width: `${pct}%` }} />
      <span className="sr-only">{Math.ceil(left / 1000)} giây</span>
    </div>
  );
}

function ResultOverlay({
  model,
  againLabel,
  exitLabel,
  onAgain,
  onExit,
}: {
  model: TableView;
  againLabel: string;
  exitLabel: string;
  onAgain: () => void;
  onExit: () => void;
}) {
  const result = model.result!;
  const mine = result.scores.find((line) => line.seat === model.you);
  const rows = useMemo(
    () => result.scores.slice().sort((a, b) => a.place - b.place || a.seat - b.seat),
    [result.scores],
  );
  const celebrate = !!result.instant || mine?.place === 1;
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/55 p-3 sm:items-center" data-testid="result">
      {celebrate && <Confetti />}
      <div className="relative max-h-[92%] w-full max-w-md overflow-y-auto rounded-3xl border border-gold/40 bg-[#10261c]/95 p-4 shadow-2xl">
        <div className="text-center">
          <div className="text-2xl font-extrabold text-gold">{result.instant ? 'Tới Trắng!' : mine ? `Bạn về ${mine.label}` : 'Kết thúc ván'}</div>
          {result.instant && <div className="mt-1 text-sm text-white/80">{result.instant.label}</div>}
          {mine && (
            <div className={cn('mt-1 text-lg font-bold', mine.delta >= 0 ? 'text-emerald-200' : 'text-rose-200')}>
              {formatDelta(mine.delta)} điểm
            </div>
          )}
        </div>
        <ul className="mt-4 space-y-2">
          {rows.map((line) => {
            const seat = model.seats[line.seat];
            const cards = sortCards(result.revealHands[line.seat] ?? []);
            return (
              <li key={line.seat} className="rounded-2xl bg-black/25 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Avatar name={seat?.name ?? 'Người chơi'} url={seat?.avatar} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{seat?.name}</div>
                    <div className="text-[11px] text-white/60">{line.notes.join(' · ')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gold">{line.label}</div>
                    <div className={cn('text-xs font-semibold', line.delta >= 0 ? 'text-emerald-200' : 'text-rose-200')}>
                      {formatDelta(line.delta)}
                    </div>
                  </div>
                </div>
                {cards.length > 0 && (
                  <div className="mt-2 flex gap-1 overflow-x-auto">
                    {cards.map((card) => (
                      <CardView key={card.id} card={card} size="sm" />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onExit}>
            {exitLabel}
          </Button>
          <Button onClick={onAgain} data-testid="again-button">
            {againLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  const bits = Array.from({ length: 22 }, (_, index) => index);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((bit) => (
        <span
          key={bit}
          className="confetti-bit"
          style={{
            left: `${(bit * 17) % 100}%`,
            background: bit % 2 ? '#f0d78c' : '#fffaf0',
            animationDelay: `${bit * 0.05}s`,
          }}
        />
      ))}
    </div>
  );
}

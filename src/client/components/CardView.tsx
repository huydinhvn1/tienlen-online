import { cardSpeech, isRedSuit, RANK_LABEL, SUIT_SYMBOL } from '../../shared/cards.ts';
import type { Card } from '../../shared/types.ts';
import { cn } from '../lib/utils.ts';

const PIPS: Record<number, Array<[number, number, boolean?]>> = {
  1: [[50, 54]],
  2: [[50, 30], [50, 74, true]],
  3: [[50, 26], [50, 50], [50, 76, true]],
  4: [[32, 28], [68, 28], [32, 74, true], [68, 74, true]],
  5: [[32, 26], [68, 26], [50, 50], [32, 76, true], [68, 76, true]],
  6: [[32, 24], [68, 24], [32, 50], [68, 50], [32, 76, true], [68, 76, true]],
  7: [[32, 22], [68, 22], [32, 40], [68, 40], [50, 50], [32, 78, true], [68, 78, true]],
  8: [[32, 20], [68, 20], [50, 34], [32, 48], [68, 48], [50, 64, true], [32, 80, true], [68, 80, true]],
  9: [[32, 18], [68, 18], [32, 36], [68, 36], [50, 50], [32, 64, true], [68, 64, true], [32, 82, true], [68, 82, true]],
  10: [[32, 16], [68, 16], [50, 30], [32, 38], [68, 38], [32, 62, true], [68, 62, true], [50, 70, true], [32, 84, true], [68, 84, true]],
};

interface CardViewProps {
  card?: Card;
  selected?: boolean;
  opening?: boolean;
  size?: 'sm' | 'md';
  faceDown?: boolean;
  onClick?: () => void;
}

export function CardView({ card, selected, opening, size = 'md', faceDown, onClick }: CardViewProps) {
  const box = size === 'sm' ? 'h-16 w-11 rounded-md' : 'h-[92px] w-16 rounded-lg';
  if (faceDown || !card) {
    return (
      <div className={cn('card-back relative shrink-0', box)} aria-hidden>
        <span className="absolute inset-[3px] rounded-[5px] border border-gold/70" />
        <span className="absolute inset-0 grid place-items-center text-[10px] font-black tracking-wide text-gold">TL</span>
      </div>
    );
  }

  const red = isRedSuit(card.suit);
  const rank = RANK_LABEL[card.rank];
  const suit = SUIT_SYMBOL[card.suit];
  const kind = card.rank === 14 ? 'ace' : card.rank >= 11 && card.rank <= 13 ? 'court' : card.rank === 15 ? 2 : card.rank;
  const pips = kind === 'ace' || kind === 'court' ? [] : (PIPS[kind] ?? []);
  const className = cn(
    'pcard relative shrink-0 select-none border border-black/10 bg-gradient-to-b from-white to-[#f3efe6] text-left shadow-card touch-manipulation',
    box,
    red ? 'text-[#c4162a]' : 'text-[#1c1917]',
    selected && 'z-20 -translate-y-3 ring-2 ring-gold',
    opening && !selected && 'ring-2 ring-emerald-400',
    onClick && 'cursor-pointer',
  );
  const body = (
    <>
      <span className={cn('absolute left-1 top-0.5 flex flex-col items-center font-extrabold leading-none', size === 'sm' ? 'text-[9px]' : 'text-xs')}>
        <span>{rank}</span>
        <span>{suit}</span>
      </span>
      <span className={cn('absolute bottom-0.5 right-1 flex rotate-180 flex-col items-center font-extrabold leading-none', size === 'sm' ? 'text-[9px]' : 'text-xs')}>
        <span>{rank}</span>
        <span>{suit}</span>
      </span>
      {kind === 'ace' && (
        <span className={cn('absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-black', size === 'sm' ? 'text-2xl' : 'text-4xl')}>
          {suit}
        </span>
      )}
      {kind === 'court' && (
        <span className="absolute inset-0 grid place-items-center">
          <span className={cn('font-black leading-none', size === 'sm' ? 'text-xl' : 'text-3xl')}>{rank}</span>
        </span>
      )}
      {pips.map(([x, y, flip], index) => (
        <span
          key={`${x}-${y}-${index}`}
          className={cn('absolute -translate-x-1/2 -translate-y-1/2 font-bold', size === 'sm' ? 'text-[9px]' : 'text-sm', flip && 'rotate-180')}
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          {suit}
        </span>
      ))}
    </>
  );

  if (!onClick) {
    return (
      <div className={className} data-card={card.id} aria-hidden>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      data-card={card.id}
      data-selected={selected ? '1' : '0'}
      aria-pressed={!!selected}
      aria-label={cardSpeech(card)}
    >
      {body}
    </button>
  );
}

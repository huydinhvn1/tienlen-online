import { useCallback, useEffect, useState } from 'react';
import type { PublicUser } from '../shared/protocol.ts';
import { HomeScreen } from './components/HomeScreen.tsx';
import { RulesDialog } from './components/RulesDialog.tsx';
import { api } from './lib/api.ts';
import { playSound, setSoundEnabled, soundEnabled } from './lib/audio.ts';
import { disconnectSocket } from './online/socket.ts';
import { OnlineScreen } from './online/OnlineScreen.tsx';
import { SoloGame } from './solo/SoloGame.tsx';

type Screen = 'home' | 'solo' | 'online';

export function App() {
  const [boot, setBoot] = useState<'loading' | 'ready' | 'error'>('loading');
  const [clientId, setClientId] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [stake, setStake] = useState(20);
  const [instantChop, setInstantChop] = useState(true);
  const [soundOn, setSoundOn] = useState(soundEnabled);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => (current === message ? null : current)), 3200);
  };

  const load = useCallback(async () => {
    setBoot('loading');
    try {
      const [config, me] = await Promise.all([
        api<{ googleClientId: string | null }>('/api/config'),
        api<{ user: PublicUser | null }>('/api/auth/me'),
      ]);
      setClientId(config.googleClientId);
      setUser(me.user);
      setBoot('ready');
    } catch {
      setBoot('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api<{ user: PublicUser | null }>('/api/auth/me');
      setUser(me.user);
    } catch {
      /* keep the last profile if the refresh misses */
    }
  }, []);

  const onGoogle = useCallback(async (credential: string) => {
    setBusy(true);
    try {
      const data = await api<{ user: PublicUser }>('/api/auth/google', { credential });
      setUser(data.user);
      playSound('turn');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không đăng nhập được');
    } finally {
      setBusy(false);
    }
  }, []);

  if (boot === 'loading') {
    return (
      <div className="felt grid min-h-dvh place-items-center" data-screen="boot">
        <div className="text-center">
          <div className="text-2xl font-extrabold text-gold">Bài Tiến Lên</div>
          <p className="mt-2 text-sm text-white/70">Đang tải bàn bài...</p>
        </div>
      </div>
    );
  }

  if (boot === 'error') {
    return (
      <div className="felt grid min-h-dvh place-items-center px-6 text-center" data-screen="boot-error">
        <div>
          <p className="text-lg font-bold">Không tải được trò chơi</p>
          <button type="button" className="mt-4 rounded-xl bg-gold px-4 py-2 font-semibold text-[#241804]" onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {notice && (
        <div role="status" className="fixed left-1/2 top-3 z-[70] w-[min(100%-1.5rem,28rem)] -translate-x-1/2 rounded-2xl bg-[#3a2a08] px-4 py-3 text-center text-sm text-gold shadow-xl">
          {notice}
        </div>
      )}
      {screen === 'home' && (
        <HomeScreen
          user={user}
          clientId={clientId}
          stake={stake}
          instantChop={instantChop}
          soundOn={soundOn}
          busy={busy}
          onStake={setStake}
          onInstantChop={setInstantChop}
          onGuest={() => {
            setBusy(true);
            void api<{ user: PublicUser }>('/api/auth/guest', {})
              .then((data) => {
                setUser(data.user);
                playSound('turn');
              })
              .catch((error: unknown) => notify(error instanceof Error ? error.message : 'Không tạo được khách'))
              .finally(() => setBusy(false));
          }}
          onGoogle={(credential) => void onGoogle(credential)}
          onGoogleUnavailable={() =>
            notify('Chưa cấu hình GOOGLE_CLIENT_ID. Thêm mã OAuth và origin trong Google Cloud Console, rồi tải lại trang. Bạn vẫn chơi được bằng Chơi thử.')
          }
          onSolo={() => user && setScreen('solo')}
          onOnline={() => user && setScreen('online')}
          onRules={() => setRulesOpen(true)}
          onLogout={() => {
            disconnectSocket();
            void api('/api/auth/logout', {}).finally(() => {
              setUser(null);
              setScreen('home');
            });
          }}
          onToggleSound={() => {
            const next = !soundOn;
            setSoundOn(next);
            setSoundEnabled(next);
            if (next) playSound('turn');
          }}
        />
      )}
      {screen === 'solo' && user && (
        <SoloGame
          user={user}
          stake={stake}
          instantChop={instantChop}
          soundOn={soundOn}
          onToggleSound={() => {
            const next = !soundOn;
            setSoundOn(next);
            setSoundEnabled(next);
          }}
          onExit={() => setScreen('home')}
          onRules={() => setRulesOpen(true)}
          onFinished={(result) => {
            void api('/api/stats/solo', result)
              .then(() => refreshUser())
              .catch(() => notify('Chưa lưu được điểm ván này'));
          }}
        />
      )}
      {screen === 'online' && user && (
        <OnlineScreen
          user={user}
          stake={stake}
          instantChop={instantChop}
          soundOn={soundOn}
          onToggleSound={() => {
            const next = !soundOn;
            setSoundOn(next);
            setSoundEnabled(next);
          }}
          onExit={() => setScreen('home')}
          onRules={() => setRulesOpen(true)}
          onRefreshUser={() => void refreshUser()}
        />
      )}
      <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />
    </>
  );
}

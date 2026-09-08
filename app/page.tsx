'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine, type NoiseKind } from '@/lib/audio-engine';
import {
  deleteUserSound,
  getUserSounds,
  saveUserSound,
  type UserSound,
} from '@/lib/user-audio';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Heart,
  Headphones,
  Library,
  Music2,
  Gauge,
  Sparkles,
  Settings,
  Play,
  Pause,
  Trash2,
  Save,
  Plus,
  Moon,
  Sun,
  Monitor,
  Volume2,
  X,
} from 'lucide-react';

type Section =
  | 'sounds'
  | 'mixes'
  | 'metronome'
  | 'regulation'
  | 'favorites'
  | 'settings'
  | 'calm';
type Sound = {
  id: string;
  name: string;
  category: string;
  file?: string;
  noise?: NoiseKind;
  icon: string;
  customUrl?: string;
};
type Active = { id: string; volume: number };
type Mix = { id: string; name: string; tracks: Active[] };
type WebToolContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => Promise<object>;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
const SOUNDS: Sound[] = [
  {
    id: 'white',
    name: 'Белый шум',
    category: 'Шумы',
    noise: 'white',
    icon: '◌',
  },
  {
    id: 'pink',
    name: 'Розовый шум',
    category: 'Шумы',
    noise: 'pink',
    icon: '◉',
  },
  {
    id: 'brown',
    name: 'Коричневый шум',
    category: 'Шумы',
    noise: 'brown',
    icon: '●',
  },
  {
    id: 'rain',
    name: 'Дождь',
    category: 'Природа',
    file: '/audio/rain.mp3',
    icon: '♢',
  },
  {
    id: 'heavy-rain',
    name: 'Сильный дождь',
    category: 'Природа',
    file: '/audio/heavy-rain.mp3',
    icon: '≋',
  },
  {
    id: 'thunder',
    name: 'Гроза',
    category: 'Природа',
    file: '/audio/thunder.mp3',
    icon: 'ϟ',
  },
  {
    id: 'ocean',
    name: 'Океан',
    category: 'Природа',
    file: '/audio/ocean.mp3',
    icon: '≈',
  },
  {
    id: 'waves',
    name: 'Волны',
    category: 'Природа',
    file: '/audio/waves.mp3',
    icon: '∿',
  },
  {
    id: 'river',
    name: 'Река',
    category: 'Природа',
    file: '/audio/river.mp3',
    icon: '↝',
  },
  {
    id: 'waterfall',
    name: 'Водопад',
    category: 'Природа',
    file: '/audio/waterfall.mp3',
    icon: '⇣',
  },
  {
    id: 'forest',
    name: 'Лес',
    category: 'Природа',
    file: '/audio/forest.mp3',
    icon: '♧',
  },
  {
    id: 'wind',
    name: 'Ветер',
    category: 'Природа',
    file: '/audio/wind.mp3',
    icon: '〰',
  },
  {
    id: 'birds',
    name: 'Птицы',
    category: 'Природа',
    file: '/audio/birds.mp3',
    icon: '⌁',
  },
  {
    id: 'fan',
    name: 'Вентилятор',
    category: 'Окружение',
    file: '/audio/fan.mp3',
    icon: '✣',
  },
  {
    id: 'ac',
    name: 'Кондиционер',
    category: 'Окружение',
    file: '/audio/air-conditioner.mp3',
    icon: '❉',
  },
  {
    id: 'vacuum',
    name: 'Пылесос',
    category: 'Окружение',
    file: '/audio/vacuum.mp3',
    icon: '◍',
  },
  {
    id: 'train',
    name: 'Поезд',
    category: 'Окружение',
    file: '/audio/train.mp3',
    icon: '⇥',
  },
  {
    id: 'plane',
    name: 'Самолёт',
    category: 'Окружение',
    file: '/audio/airplane.mp3',
    icon: '⌁',
  },
  {
    id: 'cafe',
    name: 'Кофейня',
    category: 'Окружение',
    file: '/audio/cafe.mp3',
    icon: '◡',
  },
  {
    id: 'library',
    name: 'Библиотека',
    category: 'Окружение',
    file: '/audio/library.mp3',
    icon: '▤',
  },
  {
    id: 'room',
    name: 'Звуки комнаты',
    category: 'Окружение',
    file: '/audio/room.mp3',
    icon: '□',
  },
  {
    id: 'fire',
    name: 'Камин',
    category: 'Спокойные',
    file: '/audio/fireplace.mp3',
    icon: '♨',
  },
  {
    id: 'chimes',
    name: 'Мягкие колокольчики',
    category: 'Спокойные',
    file: '/audio/chimes.mp3',
    icon: '✧',
  },
  {
    id: 'bowl',
    name: 'Поющая чаша',
    category: 'Спокойные',
    file: '/audio/singing-bowl.mp3',
    icon: '⌒',
  },
];
const NAV = [
  ['sounds', 'Звуки', Library],
  ['mixes', 'Мои миксы', Music2],
  ['metronome', 'Метроном', Gauge],
  ['regulation', 'Саморегуляция', Sparkles],
  ['favorites', 'Избранное', Heart],
  ['settings', 'Настройки', Settings],
] as const;
const CATEGORIES = [
  'Все',
  'Недавние',
  'Шумы',
  'Природа',
  'Окружение',
  'Спокойные',
  'Свои',
];

export default function Home() {
  const engine = useRef<AudioEngine | null>(null);
  if (!engine.current) engine.current = new AudioEngine();
  const [section, setSection] = useState<Section>('sounds');
  const [category, setCategory] = useState('Все');
  const [active, setActive] = useState<Active[]>([]);
  const [master, setMaster] = useState(70);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [timer, setTimer] = useState(0);
  const [fade, setFade] = useState(1);
  const [timeLeft, setTimeLeft] = useState(0);
  const [saveOpen, setSaveOpen] = useState(false);
  const [mixName, setMixName] = useState('Мой вечер');
  const [notice, setNotice] = useState('');
  const [mixPending, setMixPending] = useState(false);
  const [userSounds, setUserSounds] = useState<(UserSound & { url: string })[]>(
    [],
  );
  const [bpm, setBpm] = useState(60);
  const [metroOn, setMetroOn] = useState(false);
  const metroRef = useRef<number | undefined>(undefined);
  const pendingMixRef = useRef<number | undefined>(undefined);
  const allSounds = useMemo(
    () => [
      ...SOUNDS,
      ...userSounds.map((s) => ({
        id: s.id,
        name: s.name,
        category: 'Свои',
        customUrl: s.url,
        icon: '♪',
      })),
    ],
    [userSounds],
  );
  useEffect(() => {
    try {
      const raw = localStorage.getItem('auto-state');
      if (raw) {
        const s = JSON.parse(raw);
        setFavorites(s.favorites || []);
        setRecent(s.recent || []);
        setMixes(s.mixes || []);
        setTheme(s.theme || 'light');
        setReduceMotion(!!s.reduceMotion);
        setMaster(s.master ?? 70);
      }
    } catch {}
    void getUserSounds()
      .then((items) =>
        setUserSounds(
          items.map((s) => ({ ...s, url: URL.createObjectURL(s.blob) })),
        ),
      )
      .catch(() => setNotice('Не удалось открыть личные звуки'));
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.register('/sw.js');
  }, []);
  useEffect(() => {
    localStorage.setItem(
      'auto-state',
      JSON.stringify({ favorites, recent, mixes, theme, reduceMotion, master }),
    );
    const root = document.documentElement,
      dark =
        theme === 'dark' ||
        (theme === 'system' &&
          matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', dark);
    root.classList.toggle('reduce-motion', reduceMotion);
    engine.current?.setMaster(master / 100);
  }, [favorites, recent, mixes, theme, reduceMotion, master]);
  useEffect(() => {
    if (!timer) return;
    setTimeLeft(timer * 60);
    const tick = window.setInterval(
      () =>
        setTimeLeft((v) => {
          if (v <= 1) {
            clearInterval(tick);
            if (pendingMixRef.current) {
              clearTimeout(pendingMixRef.current);
              pendingMixRef.current = undefined;
            }
            setMixPending(false);
            engine.current?.stopAll(fade * 60);
            setActive([]);
            setTimer(0);
            return 0;
          }
          return v - 1;
        }),
      1000,
    );
    return () => clearInterval(tick);
  }, [timer, fade]);
  useEffect(() => {
    if (!metroOn) {
      if (metroRef.current) clearInterval(metroRef.current);
      return;
    }
    const click = () => engine.current?.playClick();
    click();
    metroRef.current = window.setInterval(click, 60000 / bpm);
    return () => {
      if (metroRef.current) clearInterval(metroRef.current);
    };
  }, [metroOn, bpm]);
  const start = async (sound: Sound, volume = 45) => {
    try {
      const started = sound.noise
        ? engine.current?.playNoise(sound.id, sound.noise, volume / 100)
        : await engine.current?.playFile(
            sound.id,
            sound.customUrl || sound.file!,
            volume / 100,
          );
      if (!started) return;
      setActive((v) => [
        ...v.filter((a) => a.id !== sound.id),
        { id: sound.id, volume },
      ]);
      setRecent((v) =>
        [sound.id, ...v.filter((id) => id !== sound.id)].slice(0, 8),
      );
      setNotice(`${sound.name} добавлен в микс`);
    } catch {
      setNotice(`Не удалось открыть «${sound.name}». Проверьте аудиофайл.`);
    }
  };
  const stop = (id: string) => {
    engine.current?.stop(id);
    setActive((v) => v.filter((a) => a.id !== id));
  };
  const stopAll = (fadeSeconds = 0) => {
    if (pendingMixRef.current) {
      clearTimeout(pendingMixRef.current);
      pendingMixRef.current = undefined;
    }
    setMixPending(false);
    engine.current?.stopAll(fadeSeconds);
    setActive([]);
  };
  const toggle = (s: Sound) =>
    active.some((a) => a.id === s.id) ? stop(s.id) : void start(s);
  const volume = (id: string, value: number) => {
    engine.current?.setVolume(id, value / 100);
    setActive((v) => v.map((a) => (a.id === id ? { ...a, volume: value } : a)));
  };
  const runMix = (mix: Mix) => {
    stopAll(0.18);
    setMixPending(true);
    pendingMixRef.current = window.setTimeout(() => {
      pendingMixRef.current = undefined;
      setMixPending(false);
      void Promise.all(
        mix.tracks.map((t) => {
          const s = allSounds.find((x) => x.id === t.id);
          return s ? start(s, t.volume) : Promise.resolve();
        }),
      );
    }, 220);
  };
  const saveMix = () => {
    if (!mixName.trim() || !active.length) return;
    setMixes((v) => [
      ...v,
      { id: crypto.randomUUID(), name: mixName.trim(), tracks: active },
    ]);
    setSaveOpen(false);
    setNotice('Микс сохранён на этом устройстве');
  };
  const addFile = async (file: File | null) => {
    if (!file) return;
    const ok =
      [
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'audio/mp4',
        'audio/x-m4a',
      ].includes(file.type) || /\.(mp3|wav|ogg|m4a)$/i.test(file.name);
    if (!ok) {
      setNotice('Поддерживаются MP3, WAV, OGG и M4A');
      return;
    }
    const sound = {
      id: `user-${crypto.randomUUID()}`,
      name: file.name.replace(/\.[^.]+$/, ''),
      blob: file,
    };
    await saveUserSound(sound);
    setUserSounds((v) => [...v, { ...sound, url: URL.createObjectURL(file) }]);
    setCategory('Свои');
    setSection('sounds');
  };
  const filtered = allSounds.filter(
    (s) =>
      (category === 'Все' ||
        (category === 'Недавние' && recent.includes(s.id)) ||
        s.category === category) &&
      (section !== 'favorites' || favorites.includes(s.id)),
  );
  const removeCustom = async (id: string) => {
    stop(id);
    await deleteUserSound(id);
    setUserSounds((items) => {
      const target = items.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return items.filter((item) => item.id !== id);
    });
    setNotice('Личный звук удалён');
  };
  useEffect(() => {
    const context = (document as Document & { modelContext?: WebToolContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'start_comfort_sound',
          title: 'Включить комфортный звук',
          description:
            'Запускает выбранный встроенный звук и показывает его в видимом микшере.',
          inputSchema: {
            type: 'object',
            properties: { soundId: { type: 'string' } },
            required: ['soundId'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input) {
            const soundId =
              typeof input === 'object' && input !== null && 'soundId' in input
                ? (input as { soundId: unknown }).soundId
                : null;
            if (typeof soundId !== 'string') throw new Error('Нужен soundId.');
            const sound = allSounds.find((item) => item.id === soundId);
            if (!sound) throw new Error('Такой звук не найден.');
            await start(sound);
            return { status: 'playing', soundId, name: sound.name };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [allSounds]);
  return (
    <div className="min-h-screen p-3 pb-28 md:p-6 md:pb-8">
      <header className="glass mx-auto flex max-w-[1440px] items-center justify-between rounded-[28px] px-4 py-3 md:px-7">
        <button
          onClick={() => setSection('sounds')}
          className="rounded-xl"
          aria-label="На главный экран"
        >
          <img
            src="/assets/logo.png"
            alt="Ауто"
            className="brand-logo h-12 w-auto object-contain md:h-14"
          />
        </button>
        <button
          onClick={() => setSection('calm')}
          className="flex min-h-12 items-center gap-2 rounded-2xl bg-[#6d887f] px-4 font-semibold text-white shadow-sm transition hover:bg-[#58766c] md:px-6"
        >
          <Headphones size={20} />
          <span>Мне нужно успокоиться</span>
        </button>
      </header>
      <div className="mx-auto mt-5 grid max-w-[1440px] gap-5 md:grid-cols-[230px_minmax(0,1fr)_300px]">
        <aside className="glass hidden h-fit rounded-[28px] p-3 md:block">
          <nav aria-label="Основные разделы" className="space-y-1">
            {NAV.map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left font-medium transition ${section === id ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
              >
                <Icon size={20} />
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-5 rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Только для комфорта</p>
            <p className="mt-1">
              Это не медицинское приложение. Выбирайте то, что приятно именно
              вам.
            </p>
          </div>
        </aside>
        <main className="min-w-0">
          {section === 'sounds' || section === 'favorites' ? (
            <SoundLibrary
              title={section === 'favorites' ? 'Избранное' : 'Звуки'}
              filtered={filtered}
              category={category}
              setCategory={setCategory}
              active={active}
              favorites={favorites}
              toggle={toggle}
              setFavorites={setFavorites}
              addFile={addFile}
              removeCustom={removeCustom}
            />
          ) : section === 'mixes' ? (
            <Mixes
              mixes={mixes}
              allSounds={allSounds}
              runMix={runMix}
              setMixes={setMixes}
            />
          ) : section === 'metronome' ? (
            <Metronome
              bpm={bpm}
              setBpm={setBpm}
              on={metroOn}
              setOn={setMetroOn}
            />
          ) : section === 'regulation' ? (
            <Regulation />
          ) : section === 'settings' ? (
            <SettingsView
              theme={theme}
              setTheme={setTheme}
              reduce={reduceMotion}
              setReduce={setReduceMotion}
            />
          ) : (
            <Calm
              sounds={allSounds}
              mixes={mixes}
              start={start}
              stopAll={stopAll}
              runMix={runMix}
            />
          )}
        </main>
        <aside className="glass h-fit rounded-[28px] p-5 md:sticky md:top-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Сейчас играет</h2>
            <span className="rounded-full bg-secondary px-3 py-1 text-sm">
              {active.length}
            </span>
          </div>
          {active.length ? (
            <div className="mt-4 space-y-4">
              {active.map((a) => {
                const s = allSounds.find((x) => x.id === a.id)!;
                return (
                  <div
                    key={a.id}
                    className="rounded-2xl border bg-background/40 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{s?.name}</span>
                      <button
                        onClick={() => stop(a.id)}
                        className="rounded-lg p-2 hover:bg-secondary"
                        aria-label={`Убрать ${s?.name}`}
                      >
                        <X size={17} />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <Volume2 size={16} />
                      <Slider
                        className="mix-slider"
                        aria-label={`Громкость ${s?.name}`}
                        value={[a.volume]}
                        onValueChange={(v) =>
                          volume(a.id, Array.isArray(v) ? v[0] : v)
                        }
                      />
                      <span className="w-9 text-right text-sm">
                        {a.volume}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed p-5 text-center text-muted-foreground">
              <Headphones className="mx-auto mb-2" />
              Звуки не включены
            </div>
          )}
          <div className="mt-5">
            <div className="flex justify-between text-sm">
              <span>Общая громкость</span>
              <span>{master}%</span>
            </div>
            <Slider
              className="mix-slider mt-3"
              aria-label="Общая громкость"
              value={[master]}
              onValueChange={(v) =>
                setMaster(Array.isArray(v) ? v[0] : v)
              }
            />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              disabled={!active.length && !mixPending}
              onClick={() => setSaveOpen(true)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              <Save size={16} />
              Сохранить
            </button>
            <button
              disabled={!active.length}
              onClick={() => stopAll()}
              className="min-h-11 rounded-xl border px-3 text-sm font-medium disabled:opacity-40"
            >
              Тишина
            </button>
          </div>
          <div className="mt-5 border-t pt-4">
            <span className="text-sm font-medium">Таймер</span>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {[5, 10, 15, 20, 30, 60, 0].map((n) => (
                <button
                  key={n}
                  onClick={() => setTimer(n)}
                  className={`min-h-9 rounded-lg text-sm ${timer === n ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}
                >
                  {n || '∞'}
                </button>
              ))}
            </div>
            {timeLeft > 0 && (
              <p className="mt-2 text-sm">
                Осталось {Math.ceil(timeLeft / 60)} мин.
              </p>
            )}
            <label className="mt-3 block text-sm">
              Затухание{' '}
              <select
                value={fade}
                onChange={(e) => setFade(Number(e.target.value))}
                className="ml-1 rounded-lg border bg-background px-2 py-1"
              >
                <option value={0.5}>30 сек.</option>
                <option value={1}>1 мин.</option>
                <option value={5}>5 мин.</option>
              </select>
            </label>
          </div>
        </aside>
      </div>
      <nav
        className="glass fixed inset-x-3 bottom-3 z-40 grid grid-cols-6 rounded-[22px] p-1 md:hidden"
        aria-label="Мобильная навигация"
      >
        {NAV.map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`flex min-h-14 flex-col items-center justify-center rounded-xl text-[11px] ${section === id ? 'bg-primary text-primary-foreground' : ''}`}
          >
            <Icon size={19} />
            <span className="mt-1 max-w-full truncate">{label}</span>
          </button>
        ))}
      </nav>
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сохранить микс</DialogTitle>
            <DialogDescription>
              Название и уровни громкости сохранятся только на этом устройстве.
            </DialogDescription>
          </DialogHeader>
          <input
            value={mixName}
            onChange={(e) => setMixName(e.target.value)}
            className="min-h-11 rounded-xl border bg-background px-3"
            aria-label="Название микса"
          />
          <DialogFooter>
            <button
              onClick={saveMix}
              className="min-h-11 rounded-xl bg-primary px-5 font-semibold text-primary-foreground"
            >
              Сохранить
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div
        aria-live="polite"
        className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg transition md:bottom-6 ${notice ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onTransitionEnd={() => notice && setTimeout(() => setNotice(''), 1600)}
      >
        {notice}
      </div>
    </div>
  );
}

function SoundLibrary({
  title,
  filtered,
  category,
  setCategory,
  active,
  favorites,
  toggle,
  setFavorites,
  addFile,
  removeCustom,
}: {
  title: string;
  filtered: Sound[];
  category: string;
  setCategory: (v: string) => void;
  active: Active[];
  favorites: string[];
  toggle: (s: Sound) => void;
  setFavorites: React.Dispatch<React.SetStateAction<string[]>>;
  addFile: (f: File | null) => void;
  removeCustom: (id: string) => void;
}) {
  return (
    <section>
      <div className="glass rounded-[28px] p-5 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Создайте своё сочетание
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border bg-background/50 px-4 font-medium">
            <Plus size={18} />
            Добавить свой звук
            <input
              type="file"
              accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,.m4a"
              className="sr-only"
              onChange={(e) => addFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>
        <div className="quiet-scroll mt-6 flex gap-2 overflow-x-auto pb-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-medium ${category === c ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((s) => {
          const on = active.some((a) => a.id === s.id),
            fav = favorites.includes(s.id);
          return (
            <article
              key={s.id}
              className={`glass sound-card group min-h-44 rounded-[24px] p-4 transition ${on ? 'ring-2 ring-primary' : ''}`}
            >
              <div className="flex justify-between">
                <button
                  onClick={() => toggle(s)}
                  className={`grid size-12 place-items-center rounded-2xl text-2xl ${on ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}
                  aria-label={
                    on ? `Остановить ${s.name}` : `Включить ${s.name}`
                  }
                >
                  {on ? <Pause size={21} /> : s.icon}
                </button>
                <div className="flex">
                  <button
                    onClick={() =>
                      setFavorites((v) =>
                        fav ? v.filter((id) => id !== s.id) : [...v, s.id],
                      )
                    }
                    className="size-11 rounded-xl hover:bg-secondary"
                    aria-label={
                      fav
                        ? `Убрать ${s.name} из избранного`
                        : `Добавить ${s.name} в избранное`
                    }
                  >
                    <Heart
                      className="mx-auto"
                      size={20}
                      fill={fav ? 'currentColor' : 'none'}
                    />
                  </button>
                  {s.customUrl && (
                    <button
                      onClick={() => removeCustom(s.id)}
                      className="size-11 rounded-xl text-destructive hover:bg-secondary"
                      aria-label={`Удалить ${s.name}`}
                    >
                      <Trash2 className="mx-auto" size={18} />
                    </button>
                  )}
                </div>
              </div>
              <h2 className="mt-5 font-semibold">{s.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{s.category}</p>
            </article>
          );
        })}
        {!filtered.length && (
          <div className="glass col-span-full rounded-[24px] p-8 text-center text-muted-foreground">
            Здесь пока ничего нет.
          </div>
        )}
      </div>
    </section>
  );
}
function Mixes({
  mixes,
  allSounds,
  runMix,
  setMixes,
}: {
  mixes: Mix[];
  allSounds: Sound[];
  runMix: (m: Mix) => void;
  setMixes: React.Dispatch<React.SetStateAction<Mix[]>>;
}) {
  return (
    <section className="glass rounded-[28px] p-6 md:p-8">
      <p className="text-sm text-muted-foreground">Ваши сочетания</p>
      <h1 className="text-3xl font-semibold">Мои миксы</h1>
      {mixes.length ? (
        <div className="mt-6 grid gap-3">
          {mixes.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-background/35 p-4"
            >
              <div>
                <h2 className="font-semibold">{m.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {m.tracks
                    .map((t) => allSounds.find((s) => s.id === t.id)?.name)
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => runMix(m)}
                  className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-medium text-primary-foreground"
                >
                  <Play size={17} />
                  Запустить
                </button>
                <button
                  onClick={() => {
                    const name = prompt('Новое название', m.name);
                    if (name)
                      setMixes((v) =>
                        v.map((x) => (x.id === m.id ? { ...x, name } : x)),
                      );
                  }}
                  className="min-h-11 rounded-xl border px-3"
                >
                  Переименовать
                </button>
                <button
                  onClick={() =>
                    setMixes((v) => v.filter((x) => x.id !== m.id))
                  }
                  className="size-11 rounded-xl border text-destructive"
                  aria-label={`Удалить ${m.name}`}
                >
                  <Trash2 className="mx-auto" size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          Включите несколько звуков и нажмите «Сохранить».
        </div>
      )}
    </section>
  );
}
function Metronome({
  bpm,
  setBpm,
  on,
  setOn,
}: {
  bpm: number;
  setBpm: (n: number) => void;
  on: boolean;
  setOn: (v: boolean) => void;
}) {
  const safe = (n: number) => setBpm(Math.min(240, Math.max(20, n)));
  return (
    <section className="glass rounded-[28px] p-6 md:p-8">
      <p className="text-sm text-muted-foreground">
        Выберите комфортный темп самостоятельно
      </p>
      <h1 className="text-3xl font-semibold">Метроном</h1>
      <div className="mx-auto mt-10 max-w-xl text-center">
        <div className="mx-auto grid size-52 place-items-center rounded-full border-[14px] border-secondary bg-background/50">
          <div>
            <input
              type="number"
              min="20"
              max="240"
              value={bpm}
              onChange={(e) => safe(Number(e.target.value))}
              className="w-32 bg-transparent text-center text-6xl font-semibold outline-none"
              aria-label="Темп метронома"
            />
            <p className="mt-1 text-sm text-muted-foreground">
              ударов в минуту
            </p>
          </div>
        </div>
        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={() => safe(bpm - 1)}
            className="size-12 rounded-xl bg-secondary text-xl"
            aria-label="Уменьшить темп"
          >
            −
          </button>
          <Slider
            className="mix-slider"
            min={20}
            max={240}
            value={[bpm]}
            onValueChange={(v) => safe(Array.isArray(v) ? v[0] : v)}
            aria-label="Темп"
          />
          <button
            onClick={() => safe(bpm + 1)}
            className="size-12 rounded-xl bg-secondary text-xl"
            aria-label="Увеличить темп"
          >
            +
          </button>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {[40, 50, 60, 70, 80, 90, 100].map((n) => (
            <button
              key={n}
              onClick={() => setBpm(n)}
              aria-pressed={bpm === n}
              className={`min-h-10 rounded-full px-4 font-medium transition ${bpm === n ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/25' : 'bg-secondary hover:bg-accent'}`}
            >
              {n}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOn(!on)}
          aria-pressed={on}
          className={`mt-8 inline-flex min-h-14 min-w-48 items-center justify-center gap-2 rounded-2xl px-7 font-semibold transition ${on ? 'bg-[#b7d9ce] text-[#17352c] shadow-lg ring-4 ring-[#b7d9ce]/30' : 'bg-primary text-primary-foreground hover:brightness-95'}`}
        >
          {on ? <Pause /> : <Play />}
          {on ? 'Остановить' : 'Начать'}
        </button>
        <p className="mt-5 text-sm text-muted-foreground">
          Мягкий низкий щелчок. «Правильного» темпа нет.
        </p>
      </div>
    </section>
  );
}
const PRACTICES = [
  {
    title: 'Сенсорное заземление',
    intro: 'Можно заметить только то, что сейчас доступно.',
    steps: [
      'Что ты видишь вокруг?',
      'Какие звуки слышны?',
      'Что чувствует тело?',
      'К чему приятно прикоснуться?',
    ],
  },
  {
    title: '5–4–3–2–1',
    intro: 'Неспешная последовательность внимания.',
    steps: [
      'Назови 5 вещей, которые видишь.',
      'Заметь 4 телесных ощущения.',
      'Прислушайся к 3 звукам.',
      'Найди 2 знакомых запаха.',
      'Заметь 1 приятную вещь.',
    ],
  },
  {
    title: 'Расслабление тела',
    intro: 'Ничего не нужно делать идеально.',
    steps: [
      'Обрати внимание на лоб и челюсть.',
      'Заметь плечи и руки.',
      'Почувствуй опору под телом.',
      'Позволь дыханию быть таким, какое оно есть.',
    ],
  },
  {
    title: 'После общения',
    intro: 'Небольшая пауза после социальной нагрузки.',
    steps: [
      'Можно приглушить свет.',
      'Убрать лишние звуки.',
      'Включить комфортный фон.',
      'Дать себе время перед ответом другим.',
    ],
  },
];
function Regulation() {
  const [practice, setPractice] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const current = practice === null ? null : PRACTICES[practice];
  if (current)
    return (
      <section className="glass rounded-[28px] p-6 md:p-8">
        <button
          onClick={() => setPractice(null)}
          className="mb-6 rounded-xl bg-secondary px-4 py-2"
        >
          ← Все практики
        </button>
        <p className="text-sm text-muted-foreground">
          Шаг {step + 1} из {current.steps.length}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{current.title}</h1>
        <div className="my-10 rounded-[24px] bg-secondary/70 p-8 text-xl leading-relaxed">
          {current.steps[step]}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              step < current.steps.length - 1
                ? setStep(step + 1)
                : setPractice(null)
            }
            className="min-h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground"
          >
            {step < current.steps.length - 1 ? 'Продолжить' : 'Закончить'}
          </button>
          <button
            onClick={() =>
              step < current.steps.length - 1
                ? setStep(step + 1)
                : setPractice(null)
            }
            className="min-h-12 rounded-xl border px-6"
          >
            Пропустить
          </button>
          <button
            onClick={() => setPractice(null)}
            className="min-h-12 rounded-xl px-6 text-muted-foreground"
          >
            Закончить сейчас
          </button>
        </div>
      </section>
    );
  return (
    <section className="glass rounded-[28px] p-6 md:p-8">
      <p className="text-sm text-muted-foreground">Не лечение и не терапия</p>
      <h1 className="text-3xl font-semibold">Саморегуляция</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {PRACTICES.map((p, i) => (
          <button
            key={p.title}
            onClick={() => {
              setPractice(i);
              setStep(0);
            }}
            className="min-h-40 rounded-[24px] border bg-background/35 p-5 text-left hover:bg-secondary/60"
          >
            <Sparkles className="mb-5" />
            <h2 className="font-semibold">{p.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{p.intro}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
function SettingsView({
  theme,
  setTheme,
  reduce,
  setReduce,
}: {
  theme: string;
  setTheme: (v: 'light' | 'dark' | 'system') => void;
  reduce: boolean;
  setReduce: (v: boolean) => void;
}) {
  return (
    <section className="glass rounded-[28px] p-6 md:p-8">
      <h1 className="text-3xl font-semibold">Настройки</h1>
      <div className="mt-7 max-w-2xl space-y-4">
        <div className="rounded-2xl border bg-background/35 p-5">
          <h2 className="font-semibold">Тема</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(
              [
                ['light', 'Светлая', Sun],
                ['dark', 'Тёмная', Moon],
                ['system', 'Системная', Monitor],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTheme(id)}
                className={`flex min-h-16 flex-col items-center justify-center rounded-xl ${theme === id ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}
              >
                <Icon size={20} />
                <span className="mt-1 text-sm">{label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl border bg-background/35 p-5">
          <div>
            <h2 className="font-semibold">Уменьшить движение</h2>
            <p className="text-sm text-muted-foreground">
              Убирает необязательные переходы.
            </p>
          </div>
          <Switch
            checked={reduce}
            onCheckedChange={setReduce}
            aria-label="Уменьшить движение"
          />
        </div>
        <div className="rounded-2xl border bg-background/35 p-5">
          <h2 className="font-semibold">Конфиденциальность</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Настройки, миксы, избранное и ваши аудиофайлы хранятся только в
            браузере этого устройства. Регистрация не нужна.
          </p>
        </div>
      </div>
    </section>
  );
}
function Calm({
  sounds,
  mixes,
  start,
  stopAll,
  runMix,
}: {
  sounds: Sound[];
  mixes: Mix[];
  start: (s: Sound, v?: number) => Promise<void>;
  stopAll: () => void;
  runMix: (m: Mix) => void;
}) {
  const choices = [
    ['brown', 'Коричневый шум'],
    ['rain', 'Дождь'],
    ['ocean', 'Океан'],
    ['forest', 'Тихий лес'],
  ];
  return (
    <section className="glass rounded-[28px] p-6 md:p-10">
      <p className="text-sm text-muted-foreground">
        Звук включится только после нажатия
      </p>
      <h1 className="mt-1 text-3xl font-semibold">
        Что будет комфортнее сейчас?
      </h1>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {choices.map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              stopAll();
              const s = sounds.find((x) => x.id === id);
              if (s) void start(s, 35);
            }}
            className="flex min-h-24 items-center justify-between rounded-[22px] bg-secondary p-5 text-left text-lg font-semibold"
          >
            <span>{label}</span>
            <Play />
          </button>
        ))}
        {mixes[0] && (
          <button
            onClick={() => runMix(mixes[0])}
            className="flex min-h-24 items-center justify-between rounded-[22px] bg-secondary p-5 text-left text-lg font-semibold"
          >
            <span>Мой любимый микс</span>
            <Play />
          </button>
        )}
        <button
          onClick={() => stopAll()}
          className="flex min-h-24 items-center justify-between rounded-[22px] border p-5 text-left text-lg font-semibold"
        >
          <span>Тишина</span>
          <Pause />
        </button>
      </div>
      <p className="mt-8 max-w-xl text-muted-foreground">
        Можно выбрать один вариант, вернуться назад или просто ничего не
        включать. Здесь нет обязательных действий.
      </p>
    </section>
  );
}

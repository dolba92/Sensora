'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    id: 'storm-wind',
    name: 'Штормовой ветер',
    category: 'Природа',
    file: '/audio/storm-wind.mp3',
    icon: '≋',
  },
  {
    id: 'cat-purring',
    name: 'Мурчание кота',
    category: 'Спокойные',
    file: '/audio/cat-purring.mp3',
    icon: '♡',
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
    name: 'Костёр',
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
  {
    id: 'calm-piano',
    name: 'Спокойное пианино',
    category: 'Спокойные',
    file: '/audio/calm-piano.mp3',
    icon: '♫',
  },
  {
    id: 'gentle-violin',
    name: 'Нежная скрипка',
    category: 'Спокойные',
    file: '/audio/gentle-violin.mp3',
    icon: '♪',
  },
  {
    id: 'romantic-violin',
    name: 'Романтическая скрипка',
    category: 'Спокойные',
    file: '/audio/romantic-violin.mp3',
    icon: '♡',
  },
  {
    id: 'rain-window',
    name: 'Дождь по окну',
    category: 'Природа',
    file: '/audio/rain-window.mp3',
    icon: '⋰',
  },
  {
    id: 'night-crickets',
    name: 'Ночной лес',
    category: 'Природа',
    file: '/audio/night-crickets.mp3',
    icon: '☾',
  },
  {
    id: 'car-interior',
    name: 'Машина в дороге',
    category: 'Окружение',
    file: '/audio/car-interior.mp3',
    icon: '◇',
  },
  {
    id: 'hair-dryer',
    name: 'Фен',
    category: 'Окружение',
    file: '/audio/hair-dryer.mp3',
    icon: '〰',
  },
  {
    id: 'clock-ticking',
    name: 'Тиканье часов',
    category: 'Окружение',
    file: '/audio/clock-ticking.mp3',
    icon: '◷',
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
  const [soundVolumes, setSoundVolumes] = useState<Record<string, number>>({});
  const [pendingMixId, setPendingMixId] = useState<string | null>(null);
  const [userSounds, setUserSounds] = useState<(UserSound & { url: string })[]>(
    [],
  );
  const [bpm, setBpm] = useState(60);
  const [metroOn, setMetroOn] = useState(false);
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
        setSoundVolumes(s.soundVolumes || {});
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
      JSON.stringify({
        favorites,
        recent,
        mixes,
        theme,
        reduceMotion,
        master,
        soundVolumes,
      }),
    );
    const root = document.documentElement,
      dark =
        theme === 'dark' ||
        (theme === 'system' &&
          matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', dark);
    root.classList.toggle('reduce-motion', reduceMotion);
    engine.current?.setMaster(master / 100);
  }, [favorites, recent, mixes, theme, reduceMotion, master, soundVolumes]);
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
            setPendingMixId(null);
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
  const start = useCallback(
    async (sound: Sound, requestedVolume?: number) => {
      const soundVolume = requestedVolume ?? soundVolumes[sound.id] ?? 45;
      try {
        const started = await (sound.noise
          ? engine.current?.playNoise(sound.id, sound.noise, soundVolume / 100)
          : engine.current?.playFile(
              sound.id,
              sound.customUrl || sound.file!,
              soundVolume / 100,
            ));
        if (!started) return;
        setSoundVolumes((values) => ({ ...values, [sound.id]: soundVolume }));
        setActive((v) => [
          ...v.filter((a) => a.id !== sound.id),
          { id: sound.id, volume: soundVolume },
        ]);
        setRecent((v) =>
          [sound.id, ...v.filter((id) => id !== sound.id)].slice(0, 8),
        );
        setNotice(`${sound.name} добавлен в микс`);
      } catch {
        setNotice(`Не удалось открыть «${sound.name}». Проверьте аудиофайл.`);
      }
    },
    [soundVolumes],
  );
  const stop = (id: string) => {
    engine.current?.stop(id);
    setActive((v) => v.filter((a) => a.id !== id));
  };
  const stopAll = (fadeSeconds = 0) => {
    if (pendingMixRef.current) {
      clearTimeout(pendingMixRef.current);
      pendingMixRef.current = undefined;
    }
    setPendingMixId(null);
    engine.current?.stopAll(fadeSeconds);
    setActive([]);
  };
  const toggle = (s: Sound) =>
    active.some((a) => a.id === s.id) ? stop(s.id) : void start(s);
  const setSoundVolume = (id: string, value: number) => {
    setSoundVolumes((values) => ({ ...values, [id]: value }));
    engine.current?.setVolume(id, value / 100);
    setActive((v) => v.map((a) => (a.id === id ? { ...a, volume: value } : a)));
  };
  const runMix = (mix: Mix) => {
    if (pendingMixRef.current) {
      clearTimeout(pendingMixRef.current);
      pendingMixRef.current = undefined;
    }

    /*
     * Start the mix directly from the user's click.
     * Do not delay with setTimeout: on mobile browsers that delay can
     * lose the original user gesture and make media playback wait.
     */
    stopAll(0);
    setPendingMixId(mix.id);

    void Promise.all(
      mix.tracks.map((track) => {
        const sound = allSounds.find((item) => item.id === track.id);
        return sound
          ? start(sound, track.volume)
          : Promise.resolve();
      }),
    ).finally(() => {
      setPendingMixId(null);
    });
  };
  const stopMix = (mix: Mix) => {
    if (pendingMixId === mix.id) {
      stopAll();
      return;
    }
    mix.tracks.forEach((track) => stop(track.id));
  };
  const changeMetronome = async (next: boolean) => {
    if (!next) {
      engine.current?.stopMetronome();
      setMetroOn(false);
      return;
    }

    try {
      await engine.current?.startMetronome(bpm);
      setMetroOn(true);
    } catch {
      setMetroOn(false);
      setNotice('Не удалось запустить звук метронома');
    }
  };
  const changeMetronomeBpm = (next: number) => {
    const safeBpm = Math.min(240, Math.max(20, next));
    setBpm(safeBpm);
    engine.current?.setMetronomeBpm(safeBpm);
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
  }, [allSounds, start]);
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
            alt="Sensora"
            className="brand-logo h-12 w-auto object-contain md:h-14"
          />
        </button>
        <button
          onClick={() => setSection('calm')}
          className="flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-4 font-semibold text-primary-foreground shadow-sm transition hover:bg-[#68577f] md:px-6"
        >
          <Headphones size={20} />
          <span>Мне нужно успокоиться</span>
        </button>
      </header>
      <div className="mx-auto mt-5 grid max-w-[1440px] gap-5 md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)]">
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
              volumes={soundVolumes}
              setVolume={setSoundVolume}
              setFavorites={setFavorites}
              addFile={addFile}
              removeCustom={removeCustom}
              onSave={() => setSaveOpen(true)}
            />
          ) : section === 'mixes' ? (
            <Mixes
              mixes={mixes}
              allSounds={allSounds}
              active={active}
              pendingMixId={pendingMixId}
              runMix={runMix}
              stopMix={stopMix}
              setMixes={setMixes}
              setVolume={setSoundVolume}
            />
          ) : section === 'metronome' ? (
            <Metronome
              bpm={bpm}
              setBpm={changeMetronomeBpm}
              on={metroOn}
              setOn={(next) => void changeMetronome(next)}
            />
          ) : section === 'regulation' ? (
            <Regulation />
          ) : section === 'settings' ? (
            <SettingsView
              theme={theme}
              setTheme={setTheme}
              reduce={reduceMotion}
              setReduce={setReduceMotion}
              master={master}
              setMaster={setMaster}
              timer={timer}
              setTimer={setTimer}
              fade={fade}
              setFade={setFade}
              timeLeft={timeLeft}
            />
          ) : (
            <Calm
              sounds={allSounds}
              mixes={mixes}
              active={active}
              pendingMixId={pendingMixId}
              toggle={toggle}
              runMix={runMix}
              stopMix={stopMix}
            />
          )}
        </main>
      </div>
      <nav
        className="glass fixed inset-x-3 bottom-3 z-40 grid grid-cols-6 gap-1 rounded-[22px] p-1.5 md:hidden"
        aria-label="Мобильная навигация"
      >
        {NAV.map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            aria-label={label}
            title={label}
            aria-current={section === id ? 'page' : undefined}
            className={`grid min-h-12 place-items-center rounded-xl transition ${section === id ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-secondary'}`}
          >
            <Icon size={21} />
            <span className="sr-only">{label}</span>
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
  volumes,
  setVolume,
  setFavorites,
  addFile,
  removeCustom,
  onSave,
}: {
  title: string;
  filtered: Sound[];
  category: string;
  setCategory: (v: string) => void;
  active: Active[];
  favorites: string[];
  toggle: (s: Sound) => void;
  volumes: Record<string, number>;
  setVolume: (id: string, value: number) => void;
  setFavorites: React.Dispatch<React.SetStateAction<string[]>>;
  addFile: (f: File | null) => void;
  removeCustom: (id: string) => void;
  onSave: () => void;
}) {
  return (
    <section>
      <div className="glass sound-library-panel rounded-[28px] p-5 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Создайте своё сочетание
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
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
            <button
              disabled={!active.length}
              onClick={onSave}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-medium text-primary-foreground transition hover:bg-[#68577f] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save size={18} />
              Сохранить микс
            </button>
          </div>
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
            fav = favorites.includes(s.id),
            soundVolume = volumes[s.id] ?? 45;
          return (
            <article
              key={s.id}
              className={`sound-card group flex min-h-[248px] flex-col rounded-[24px] border p-4 transition ${on ? 'sound-card--playing' : ''}`}
            >
              <div className="flex justify-between">
                <span
                  className={`grid size-12 place-items-center rounded-2xl text-2xl ${on ? 'bg-primary text-primary-foreground' : 'bg-[#eeeaf7] dark:bg-secondary'}`}
                  aria-hidden="true"
                >
                  {s.icon}
                </span>
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
              <h2 className="mt-4 flex items-center gap-2 font-semibold">
                {s.name}
                {on && (
                  <span
                    className="size-2.5 shrink-0 rounded-full bg-primary shadow-[0_0_0_3px_rgba(117,101,143,.14)]"
                    aria-label="Сейчас играет"
                  />
                )}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{s.category}</p>
              <div className="mt-auto pt-4">
                <div className="flex min-w-0 items-center gap-2">
                  <Volume2 className="shrink-0 text-muted-foreground" size={16} />
                  <Slider
                    className="mix-slider min-w-0"
                    aria-label={`Громкость ${s.name}`}
                    value={[soundVolume]}
                    onValueChange={(value) =>
                      setVolume(
                        s.id,
                        Array.isArray(value) ? value[0] : value,
                      )
                    }
                  />
                  <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">
                    {soundVolume}%
                  </span>
                </div>
                <button
                  onClick={() => toggle(s)}
                  aria-pressed={on}
                  className={`mt-3 flex min-h-10 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-1 text-xs font-semibold transition md:gap-2 md:px-2 md:text-sm ${on ? 'bg-[#68577f] text-white hover:bg-[#5e4e75]' : 'bg-primary text-primary-foreground hover:bg-[#68577f]'}`}
                  aria-label={
                    on ? `Выключить ${s.name}` : `Включить ${s.name}`
                  }
                >
                  {on ? <Pause size={17} /> : <Play size={17} />}
                  {on ? 'Выключить звук' : 'Включить звук'}
                </button>
              </div>
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
  active,
  pendingMixId,
  runMix,
  stopMix,
  setMixes,
  setVolume,
}: {
  mixes: Mix[];
  allSounds: Sound[];
  active: Active[];
  pendingMixId: string | null;
  runMix: (m: Mix) => void;
  stopMix: (m: Mix) => void;
  setMixes: React.Dispatch<React.SetStateAction<Mix[]>>;
  setVolume: (id: string, value: number) => void;
}) {
  const changeTrackVolume = (
    mixId: string,
    trackId: string,
    value: number,
  ) => {
    setMixes((items) =>
      items.map((mix) =>
        mix.id === mixId
          ? {
              ...mix,
              tracks: mix.tracks.map((track) =>
                track.id === trackId
                  ? { ...track, volume: value }
                  : track,
              ),
            }
          : mix,
      ),
    );

    setVolume(trackId, value);
  };

  return (
    <section className="glass rounded-[28px] p-5 md:p-8">
      <p className="text-sm text-muted-foreground">Ваши сочетания</p>
      <h1 className="text-3xl font-semibold">Мои миксы</h1>

      {mixes.length ? (
        <div className="mt-6 grid gap-4">
          {mixes.map((m) => {
            const on =
              pendingMixId === m.id ||
              (m.tracks.length > 0 &&
                m.tracks.every((track) =>
                  active.some((item) => item.id === track.id),
                ));

            return (
              <div
                key={m.id}
                className={`rounded-2xl border p-4 md:p-5 ${
                  on ? 'bg-accent' : 'bg-background/35'
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="font-semibold">{m.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {m.tracks
                        .map(
                          (track) =>
                            allSounds.find(
                              (sound) => sound.id === track.id,
                            )?.name,
                        )
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => (on ? stopMix(m) : runMix(m))}
                      aria-pressed={on}
                      className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-medium text-primary-foreground"
                    >
                      {on ? <Pause size={17} /> : <Play size={17} />}
                      {on ? 'Выключить' : 'Запустить'}
                    </button>

                    <button
                      onClick={() => {
                        const name = prompt('Новое название', m.name);
                        if (name) {
                          setMixes((items) =>
                            items.map((mix) =>
                              mix.id === m.id
                                ? { ...mix, name }
                                : mix,
                            ),
                          );
                        }
                      }}
                      className="min-h-11 rounded-xl border px-3"
                    >
                      Переименовать
                    </button>

                    <button
                      onClick={() =>
                        setMixes((items) =>
                          items.filter((mix) => mix.id !== m.id),
                        )
                      }
                      className="size-11 shrink-0 rounded-xl border text-destructive"
                      aria-label={`Удалить ${m.name}`}
                    >
                      <Trash2 className="mx-auto" size={18} />
                    </button>
                  </div>
                </div>

                <div className="mt-5 space-y-3 border-t pt-4">
                  {m.tracks.map((track) => {
                    const sound = allSounds.find(
                      (item) => item.id === track.id,
                    );

                    if (!sound) return null;

                    const liveTrack = active.find(
                      (item) => item.id === track.id,
                    );

                    const volume =
                      liveTrack?.volume ?? track.volume ?? 45;

                    return (
                      <div
                        key={track.id}
                        className="rounded-xl bg-background/35 px-3 py-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-medium">
                            {sound.name}
                          </span>
                          <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
                            {volume}%
                          </span>
                        </div>

                        <div className="flex min-w-0 items-center gap-2">
                          <Volume2
                            className="shrink-0 text-muted-foreground"
                            size={16}
                          />
                          <Slider
                            className="mix-slider min-w-0 flex-1"
                            aria-label={`Громкость ${sound.name} в миксе ${m.name}`}
                            value={[volume]}
                            onValueChange={(value) =>
                              changeTrackVolume(
                                m.id,
                                track.id,
                                Array.isArray(value)
                                  ? value[0]
                                  : value,
                              )
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
          className={`mt-8 inline-flex min-h-14 min-w-48 items-center justify-center gap-2 rounded-2xl px-7 font-semibold transition ${on ? 'bg-[#68577f] text-white shadow-md ring-4 ring-[#d5cbea]/50' : 'bg-primary text-primary-foreground hover:bg-[#68577f]'}`}
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
  master,
  setMaster,
  timer,
  setTimer,
  fade,
  setFade,
  timeLeft,
}: {
  theme: string;
  setTheme: (v: 'light' | 'dark' | 'system') => void;
  reduce: boolean;
  setReduce: (v: boolean) => void;
  master: number;
  setMaster: (v: number) => void;
  timer: number;
  setTimer: (v: number) => void;
  fade: number;
  setFade: (v: number) => void;
  timeLeft: number;
}) {
  return (
    <section className="glass rounded-[28px] p-6 md:p-8">
      <h1 className="text-3xl font-semibold">Настройки</h1>
      <div className="mt-7 max-w-2xl space-y-4">
        <div className="rounded-2xl border bg-background/35 p-5">
          <h2 className="text-lg font-semibold">Звук</h2>
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <label className="font-medium" htmlFor="master-volume">
                Общая громкость
              </label>
              <span className="text-sm text-muted-foreground">{master}%</span>
            </div>
            <div className="mt-2 flex min-w-0 items-center gap-3">
              <Volume2 className="shrink-0 text-muted-foreground" size={18} />
              <Slider
                id="master-volume"
                className="mix-slider min-w-0"
                aria-label="Общая громкость"
                value={[master]}
                onValueChange={(value) =>
                  setMaster(Array.isArray(value) ? value[0] : value)
                }
              />
            </div>
          </div>
          <div className="mt-5 border-t pt-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium">Таймер</h3>
              {timeLeft > 0 && (
                <span className="text-sm text-muted-foreground">
                  Осталось {Math.ceil(timeLeft / 60)} мин.
                </span>
              )}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
              {[5, 10, 15, 20, 30, 60, 0].map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => setTimer(minutes)}
                  aria-pressed={timer === minutes}
                  className={`min-h-10 rounded-xl text-sm font-medium transition ${timer === minutes ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-accent'}`}
                >
                  {minutes || '∞'}
                </button>
              ))}
            </div>
            <label className="mt-4 flex flex-wrap items-center gap-2 text-sm font-medium">
              Затухание
              <select
                value={fade}
                onChange={(event) => setFade(Number(event.target.value))}
                className="min-h-10 rounded-xl border bg-secondary px-3"
              >
                <option value={0.5}>30 сек.</option>
                <option value={1}>1 мин.</option>
                <option value={5}>5 мин.</option>
              </select>
            </label>
          </div>
        </div>
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
  active,
  pendingMixId,
  toggle,
  runMix,
  stopMix,
}: {
  sounds: Sound[];
  mixes: Mix[];
  active: Active[];
  pendingMixId: string | null;
  toggle: (s: Sound) => void;
  runMix: (m: Mix) => void;
  stopMix: (m: Mix) => void;
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
        {choices.map(([id, label]) => {
          const sound = sounds.find((item) => item.id === id);
          if (!sound) return null;
          const on = active.some((item) => item.id === id);
          return (
            <button
              key={id}
              onClick={() => toggle(sound)}
              aria-pressed={on}
              className={`flex min-h-24 items-center justify-between rounded-[22px] border p-5 text-left transition ${on ? 'border-primary bg-accent' : 'bg-secondary'}`}
            >
              <span>
                <span className="block text-lg font-semibold">{label}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {on ? 'Выключить звук' : 'Включить звук'}
                </span>
              </span>
              {on ? <Pause /> : <Play />}
            </button>
          );
        })}
        {mixes[0] && (() => {
          const mix = mixes[0];
          const on =
            pendingMixId === mix.id ||
            mix.tracks.length > 0 &&
            mix.tracks.every((track) =>
              active.some((item) => item.id === track.id),
            );
          return (
            <button
              onClick={() => (on ? stopMix(mix) : runMix(mix))}
              aria-pressed={on}
              className={`flex min-h-24 items-center justify-between rounded-[22px] border p-5 text-left transition ${on ? 'border-primary bg-accent' : 'bg-secondary'}`}
            >
              <span>
                <span className="block text-lg font-semibold">
                  Мой любимый микс
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {on ? 'Выключить микс' : 'Включить микс'}
                </span>
              </span>
              {on ? <Pause /> : <Play />}
            </button>
          );
        })()}
      </div>
      <p className="mt-8 max-w-xl text-muted-foreground">
        Можно выбрать один вариант, вернуться назад или просто ничего не
        включать. Здесь нет обязательных действий.
      </p>
    </section>
  );
}
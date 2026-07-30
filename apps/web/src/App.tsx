import { FormEvent, KeyboardEvent, RefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  Captions,
  ChevronLeft,
  ChevronRight,
  Compass,
  FolderOpen,
  Heart,
  Library,
  ListMusic,
  LoaderCircle,
  LogOut,
  Pause,
  Play,
  Repeat2,
  Search,
  Settings2,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import {
  api,
  Detail,
  login,
  logout,
  restoreSession,
  Subtitle,
  Track,
  WishlistWork,
  Work,
} from "./api";

type DiscoveryWork = {
  id: string;
  title: string;
  voice: string;
  rjCode: string;
  cover: string;
  coverUrl?: string | null;
  sourceUrl?: string;
};
type DiscoveryOrder = "trend" | "release_d" | "subtitle";
const discoveryListingUrls: Record<DiscoveryOrder, string> = {
  trend: "https://www.dlsite.com/maniax/fsr/=/language/jp/sex_category[0]/male/ana_flg/all/order/trend/work_type_category[0]/audio/genre[0]/048/options_and_or/and/options[0]/JPN/options[1]/NM/lang_options[0]/%E6%97%A5%E6%9C%AC%E8%AA%9E/lang_options[1]/%E8%A8%80%E8%AA%9E%E4%B8%8D%E8%A6%81",
  release_d: "https://www.dlsite.com/maniax/fsr/=/language/jp/sex_category[0]/male/ana_flg/all/order/release_d/work_type_category[0]/audio/genre[0]/048/options_and_or/and/options[0]/JPN/options[1]/NM/lang_options[0]/%E6%97%A5%E6%9C%AC%E8%AA%9E/lang_options[1]/%E8%A8%80%E8%AA%9E%E4%B8%8D%E8%A6%81",
  subtitle: "https://www.dlsite.com/maniax/fsr/=/language/jp/sex_category%5B0%5D/male/keyword/%E5%8F%B0%E6%9C%AC/ana_flg/all/work_category%5B0%5D/doujin/work_category%5B1%5D/books/work_category%5B2%5D/pc/work_category%5B3%5D/app/order%5B0%5D/release_d/work_type_category%5B0%5D/audio/work_type_category_name%5B0%5D/%E9%9F%B3%E5%A3%B0%E3%83%BBASMR/genre%5B0%5D/048/genre_name%5B0%5D/%E5%AF%9D%E5%8F%96%E3%82%89%E3%82%8C/options_and_or/and/options%5B0%5D/JPN/options%5B1%5D/CHI/options%5B2%5D/CHI_HANS/options%5B3%5D/CHI_HANT/options%5B4%5D/NM/options_name%5B0%5D/%E6%97%A5%E8%AF%AD%E4%BD%9C%E5%93%81/options_name%5B1%5D/%E4%B8%AD%E6%96%87%E4%BD%9C%E5%93%81/options_name%5B2%5D/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87%E4%BD%9C%E5%93%81/options_name%5B3%5D/%E7%B9%81%E4%BD%93%E4%B8%AD%E6%96%87%E4%BD%9C%E5%93%81/options_name%5B4%5D/%E6%97%A0%E8%AF%AD%E8%A8%80%E9%99%90%E5%88%B6%E4%BD%9C%E5%93%81/per_page/30/page/2/show_type/3",
};

const trendingPreview: DiscoveryWork[] = [
  {
    id: "preview-01",
    title: "After the Rain",
    voice: "Mira Lane",
    rjCode: "RJ01113481",
    cover:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1600&q=88",
  },
  {
    id: "preview-02",
    title: "Soft Signal",
    voice: "Juniper",
    rjCode: "RJ01577647",
    cover:
      "https://images.unsplash.com/photo-1511379938547-c1f694198686?auto=format&fit=crop&w=1600&q=88",
  },
  {
    id: "preview-03",
    title: "City Afterglow",
    voice: "Slow Motion Club",
    rjCode: "RJ01974263",
    cover:
      "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1600&q=88",
  },
  {
    id: "preview-04",
    title: "Glass Horizon",
    voice: "Aster House",
    rjCode: "RJ02251849",
    cover:
      "https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=1600&q=88",
  },
  {
    id: "preview-05",
    title: "Parallel Lines",
    voice: "Luca S.",
    rjCode: "RJ02810362",
    cover:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=88",
  },
];

const recentPreview: DiscoveryWork[] = [
  {
    id: "preview-06",
    title: "Little Hours",
    voice: "Lena Vale",
    rjCode: "RJ03182451",
    cover:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=88",
  },
  {
    id: "preview-07",
    title: "Bloom in Blue",
    voice: "Nomi",
    rjCode: "RJ03490622",
    cover:
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1600&q=88",
  },
  {
    id: "preview-08",
    title: "A Quiet Room",
    voice: "Field Notes",
    rjCode: "RJ03877210",
    cover:
      "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=1600&q=88",
  },
  {
    id: "preview-09",
    title: "Neon Silence",
    voice: "Inward",
    rjCode: "RJ04159384",
    cover:
      "https://images.unsplash.com/photo-1507838153414-b4b713384a76?auto=format&fit=crop&w=1600&q=88",
  },
  {
    id: "preview-10",
    title: "Sunday Stereo",
    voice: "Sol Garden",
    rjCode: "RJ04420897",
    cover:
      "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1600&q=88",
  },
];

function FallbackArt({ label, tone = 0 }: { label: string; tone?: number }) {
  return (
    <div className={`fallback-art tone-${tone % 5}`}>
      <span>{label}</span>
      <i />
      <i />
    </div>
  );
}

function Cover({
  item,
  tone = 0,
  className = "",
}: {
  item: { rjCode?: string | null; id: number | string; cover?: string };
  tone?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const label =
    item.rjCode ?? (typeof item.id === "string" ? item.id : "LOCAL");
  if (!item.cover || broken) return <FallbackArt label={label} tone={tone} />;
  return (
    <img
      className={className}
      src={item.cover}
      alt=""
      onError={() => setBroken(true)}
    />
  );
}

function readSubtitleCues(value: string): Array<{ startMs: number; endMs: number; text: string }> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((cue): cue is { startMs: number; endMs: number; text: string } =>
      typeof cue === "object" && cue !== null &&
      typeof (cue as { startMs?: unknown }).startMs === "number" &&
      typeof (cue as { endMs?: unknown }).endMs === "number" &&
      typeof (cue as { text?: unknown }).text === "string",
    );
  } catch {
    return [];
  }
}

function Login({ ready }: { ready: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await login(password);
      ready();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败");
    }
  }
  return (
    <main className="auth">
      <form onSubmit={submit}>
        <AudioLines />
        <p>NO VOICE / PRIVATE LIBRARY</p>
        <h1>
          留住每一段
          <br />
          想再听一次的声音。
        </h1>
        <label>
          访问密码
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <b>{error}</b>}
        <button>进入资料库</button>
      </form>
    </main>
  );
}

function WishButton({ item, wished, toggle }: { item: DiscoveryWork; wished: boolean; toggle: (item: DiscoveryWork) => void }) {
  return <button
    className={`wish-button ${wished ? "is-wished" : ""}`}
    type="button"
    aria-label={wished ? `从想听清单移除 ${item.title}` : `加入想听清单：${item.title}`}
    aria-pressed={wished}
    title={wished ? "已加入想听" : "加入想听"}
    onClick={() => toggle(item)}
  ><Heart /></button>;
}

function DiscoveryShelf({
  title,
  detail,
  items,
  order,
  openRanking,
  wishedIds,
  toggleWish,
}: {
  title: string;
  detail: string;
  items: DiscoveryWork[];
  order: DiscoveryOrder;
  openRanking: (order: DiscoveryOrder) => void;
  wishedIds: Set<string>;
  toggleWish: (item: DiscoveryWork) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [remote, setRemote] = useState<DiscoveryWork[]>(items);
  const [status, setStatus] = useState("");
  useEffect(() => {
    let live = true;
    let retryTimer: number | undefined;
    const refresh = () => void api<{
      voiceActorsPending?: boolean;
      items: Array<{
        sourceId: string;
        title: string;
        voiceActors: string | null;
        coverUrl: string | null;
        sourceUrl: string;
      }>;
    }>(`/api/discovery?order=${order}&limit=20`)
      .then((data) => {
        if (live && data.items.length) {
          setRemote(data.items.map((item) => ({ id: item.sourceId, title: item.title, voice: item.voiceActors ?? "未标注", rjCode: item.sourceId, cover: item.coverUrl ? `/api/discovery/cover?url=${encodeURIComponent(item.coverUrl)}` : "", coverUrl: item.coverUrl, sourceUrl: item.sourceUrl })));
          setStatus(data.voiceActorsPending ? "正在补全官方声优信息…" : "");
          if (data.voiceActorsPending) retryTimer = window.setTimeout(refresh, 5000);
        }
      })
      .catch(() => { if (live) setStatus("发现源暂时不可用，显示预览。"); });
    refresh();
    return () => { live = false; if (retryTimer !== undefined) window.clearTimeout(retryTimer); };
  }, [order]);
  const slide = (direction: number) =>
    rail.current?.scrollBy({ left: direction * 470, behavior: "smooth" });
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      slide(1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      slide(-1);
    }
  };
  return (
    <section className="discovery-shelf">
      <header className="shelf-heading">
        <div>
          <a className="shelf-title-link" href={discoveryListingUrls[order]} target="_blank" rel="noopener noreferrer" title={`在 DLsite 打开${title}筛选`}><h2>{title}</h2></a>
          <p>{status || detail}</p>
        </div>
        <div className="rail-actions">
          <button className="ranking-link" type="button" onClick={() => openRanking(order)}>查看完整榜单</button>
          <button aria-label={`${title}上一张`} onClick={() => slide(-1)}>
            <ChevronLeft />
          </button>
          <button aria-label={`${title}下一张`} onClick={() => slide(1)}>
            <ChevronRight />
          </button>
        </div>
      </header>
      <div
        className="discovery-rail"
        ref={rail}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        {remote.map((item, index) => (
          <article className="discovery-card" key={item.id}>
            <div className="discovery-frame">
              <a className="discovery-cover-link" href={item.sourceUrl ?? `https://www.dlsite.com/maniax/work/=/product_id/${item.rjCode}.html`} target="_blank" rel="noopener noreferrer" aria-label={`在新标签页打开 ${item.title} 的 DLsite 页面`}>
                <Cover item={item} tone={index} className="discovery-cover" />
              </a>
              <div className="cover-shade" />
              <WishButton item={item} wished={wishedIds.has(item.rjCode)} toggle={toggleWish} />
              <div className="discovery-description">
                <b>{item.title}</b>
                <span>CV · {item.voice}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RankingPage({ order, goBack, wishedIds, toggleWish }: { order: DiscoveryOrder; goBack: () => void; wishedIds: Set<string>; toggleWish: (item: DiscoveryWork) => void }) {
  const [items, setItems] = useState<DiscoveryWork[]>([]);
  const [status, setStatus] = useState("正在加载 100 个作品…");
  const title = order === "trend" ? "人气作品完整榜单" : order === "release_d" ? "最新上架完整榜单" : "字幕榜完整榜单";
  const detail = order === "trend" ? "按 DLsite 人气排序" : order === "release_d" ? "按 DLsite 发布时间排序" : "按 DLsite 字幕作品排序";
  useEffect(() => {
    let live = true;
    void api<{ items: Array<{ sourceId: string; title: string; voiceActors: string | null; coverUrl: string | null; sourceUrl: string }> }>(`/api/discovery?order=${order}&limit=100`)
      .then((data) => {
        if (!live) return;
        setItems(data.items.map((item) => ({ id: item.sourceId, title: item.title, voice: item.voiceActors ?? "未标注", rjCode: item.sourceId, cover: item.coverUrl ? `/api/discovery/cover?url=${encodeURIComponent(item.coverUrl)}` : "", coverUrl: item.coverUrl, sourceUrl: item.sourceUrl })));
        setStatus(data.items.length ? `共 ${data.items.length} 个作品` : "暂时没有可用的榜单数据");
      })
      .catch(() => { if (live) setStatus("榜单暂时不可用，请稍后重试。"); });
    return () => { live = false; };
  }, [order]);
  return <section className="ranking-page">
    <header className="ranking-heading">
      <div>
        <button className="back-ranking" type="button" onClick={goBack}><ChevronLeft />返回资料库</button>
        <h1>{title}</h1>
        <p>{status || detail}</p>
      </div>
    </header>
    {items.length ? <div className="ranking-grid">{items.map((item, index) => <article className="ranking-card" key={item.id}>
      <div className="ranking-item">
        <span className="ranking-number">{String(index + 1).padStart(2, "0")}</span>
        <a className="ranking-cover-link" href={item.sourceUrl ?? `https://www.dlsite.com/maniax/work/=/product_id/${item.rjCode}.html`} target="_blank" rel="noopener noreferrer" aria-label={`在新标签页打开 ${item.title} 的 DLsite 页面`}><Cover item={item} tone={index} className="ranking-cover" /></a>
        <WishButton item={item} wished={wishedIds.has(item.rjCode)} toggle={toggleWish} />
        <b>{item.title}</b><span>CV · {item.voice}</span><small>{item.rjCode}</small>
      </div>
    </article>)}</div> : <div className="ranking-loading"><LoaderCircle className="spin" /><span>{status}</span></div>}
  </section>;
}

function LocalWorkCard({
  work,
  index,
  open,
}: {
  work: Work;
  index: number;
  open: (id: number) => void;
}) {
  return (
    <article className="local-card">
      <button onClick={() => open(work.id)}>
        <Cover
          item={{
            ...work,
            cover: work.coverPath || work.remoteCoverUrl ? `/api/works/${work.id}/cover` : undefined,
          }}
          tone={index}
          className="local-cover"
        />
        {work.subtitleSource && <span className="subtitle-badge">{work.subtitleSource === "official" ? "官方歌词" : "AI 歌词"}</span>}
        <b>{work.title}</b>
        <span>{work.voiceActors ? `CV · ${work.voiceActors}` : work.circle ?? work.rjCode ?? "本地归档"}</span>
      </button>
    </article>
  );
}

function Player({
  audio,
  track,
  work,
  cover,
  subtitles,
  queue,
  selectTrack,
  openCurrentWork,
  openLyricsForTrack,
  close,
}: {
  audio: RefObject<HTMLAudioElement>;
  track: Track | null;
  work: string;
  cover?: string;
  subtitles: Subtitle[];
  queue: Track[];
  selectTrack: (track: Track) => void;
  openCurrentWork: () => void;
  openLyricsForTrack: number | null;
  close: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [showLyrics, setShowLyrics] = useState(false);
  const [subtitleId, setSubtitleId] = useState<number | null>(null);
  const [volume, setVolume] = useState(0.8);
  const [duration, setDuration] = useState(0);
  const [looping, setLooping] = useState(false);
  const [muted, setMuted] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const subtitle = subtitles.find((item) => item.id === subtitleId) ?? subtitles[0];
  const cues = useMemo(() => subtitle ? readSubtitleCues(subtitle.cuesJson) : [], [subtitle]);
  const subtitleKey = subtitles.map((item) => item.id).join(",");
  useEffect(() => setSubtitleId(subtitles[0]?.id ?? null), [track?.id, subtitleKey]);
  useEffect(() => { if (track && openLyricsForTrack === track.id) setShowLyrics(true); }, [openLyricsForTrack, track]);
  useEffect(() => {
    if (audio.current) {
      audio.current.volume = volume;
      audio.current.muted = muted;
    }
  }, [volume, muted, track?.id]);
  useEffect(() => {
    if (!track) return;
    setPlaying(false);
    setPosition(0);
    setDuration(0);
    setPlayerError("");
  }, [track?.id]);
  const toggle = async () => {
    if (!track || !audio.current) return;
    if (audio.current.paused) {
      try { await audio.current.play(); setPlayerError(""); } catch { setPlaying(false); setPlayerError("浏览器阻止了自动播放，请再次点击播放。"); }
    } else audio.current.pause();
  };
  const move = (direction: -1 | 1) => {
    if (!track) return;
    const current = queue.findIndex((item) => item.id === track.id);
    const next = queue[current + direction];
    if (next) selectTrack(next);
  };
  const openDesktopLyrics = () => {
    if (!subtitle || !audio.current) return;
    const popup = window.open("", "no-voice-lyrics", "popup,width=520,height=420");
    if (!popup) return;
    popup.document.title = `${track?.title ?? ""} · 歌词`;
    const safeWork = work.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    popup.document.body.innerHTML = `<main><h1>${safeWork}</h1><p id="line">正在载入歌词…</p></main><style>body{margin:0;background:#101114;color:#fff;font:16px -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}main{padding:56px 44px}h1{font-size:15px;opacity:.5;font-weight:500}p{font-size:28px;line-height:1.5;font-weight:650}</style>`;
    const refresh = () => {
      if (popup.closed || !audio.current) return;
      const current = cues.find((cue) => audio.current!.currentTime * 1000 >= cue.startMs && audio.current!.currentTime * 1000 < cue.endMs);
      const element = popup.document.querySelector("#line");
      if (element) element.textContent = current?.text ?? "";
      window.setTimeout(refresh, 250);
    };
    refresh();
  };
  return (
    <>
      <audio
        ref={audio}
        preload="metadata"
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime * 1000)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration * 1000)}
        onPlay={() => setPlaying(true)}
        onPause={(event) => {
          setPlaying(false);
          if (track) void api(`/api/tracks/${track.id}/progress`, { method: "PUT", body: JSON.stringify({ positionMs: Math.round(event.currentTarget.currentTime * 1000) }) });
        }}
        onEnded={() => {
          setPlaying(false);
          if (track) void api(`/api/tracks/${track.id}/progress`, { method: "PUT", body: JSON.stringify({ positionMs: 0, completed: true }) });
        }}
        onError={() => { setPlaying(false); setPlayerError("音频无法加载，请确认资料库目录仍已启用且文件存在。"); }}
      />
      <footer className={`mini-player ${track ? "has-track" : ""}`} onClick={() => { if (track) openCurrentWork(); }}>
        <div className="player-controls" onClick={(event) => event.stopPropagation()}>
          <button type="button" disabled={queue.length < 2} aria-label="随机播放" onClick={() => selectTrack(queue[Math.floor(Math.random() * queue.length)]!)}>
            <Shuffle />
          </button>
          <button type="button" disabled={!track || queue.findIndex(item => item.id === track.id) < 1} aria-label="上一首" onClick={() => move(-1)}>
            <SkipBack fill="currentColor" />
          </button>
          <button
            className="player-toggle"
            type="button"
            disabled={!track}
            aria-label={playing ? "暂停" : "播放"}
            onClick={toggle}
          >
            {playing ? (
              <Pause fill="currentColor" />
            ) : (
              <Play fill="currentColor" />
            )}
          </button>
          <button type="button" disabled={!track || queue.findIndex(item => item.id === track.id) >= queue.length - 1} aria-label="下一首" onClick={() => move(1)}>
            <SkipForward fill="currentColor" />
          </button>
          <button type="button" disabled={!track} className={looping ? "is-active" : ""} aria-pressed={looping} aria-label="循环播放" onClick={() => { if (audio.current) { const next = !looping; audio.current.loop = next; setLooping(next); } }}>
            <Repeat2 />
          </button>
        </div>
        <button
          type="button"
          className="player-identity"
          aria-label={track ? `${work} · ${track.title}` : "no voice"}
          title={track ? "打开当前作品详情" : undefined}
          onClick={(event) => { event.stopPropagation(); openCurrentWork(); }}
          disabled={!track}
        >
          <span className="player-art">
            {cover ? <img src={cover} alt="" /> : <AudioLines />}
          </span>
          <span className="player-copy"><b>{track?.title ?? "no voice"}</b><small>{work || "本地资料库"}</small></span>
        </button>
        <div className="player-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button"
            disabled={!track}
            onClick={() => setShowLyrics((value) => !value)}
            aria-pressed={showLyrics}
            aria-label="字幕与歌词"
          >
            <Captions />
          </button>
          <button type="button" className={muted ? "is-active" : ""} disabled={!track} aria-pressed={muted} aria-label={muted ? "取消静音" : "静音"} onClick={() => setMuted((value) => !value)}>
            <Volume2 fill="currentColor" />
          </button>
          <input className="volume" aria-label="音量" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
          {track && (
            <button
              className="player-close" type="button"
              aria-label="关闭播放器"
              onClick={close}
            >
              <X />
            </button>
          )}
        </div>
        {track && <input className="player-progress" aria-label="播放进度" type="range" min="0" max={Math.max(duration, 1)} value={Math.min(position, Math.max(duration, 1))} onChange={(event) => { if (audio.current) audio.current.currentTime = Number(event.target.value) / 1000; }} onClick={(event) => event.stopPropagation()} />}
        {playerError && <span className="player-status" role="status">{playerError}</span>}
      </footer>
      {showLyrics && (
        <aside className="lyrics-panel">
          <header>
            <b>{track?.title} · 字幕</b>
            {subtitles.length > 1 && <select aria-label="字幕来源" value={subtitle?.id ?? ""} onChange={(event) => setSubtitleId(Number(event.target.value))}>{subtitles.map((item) => <option key={item.id} value={item.id}>{item.language ?? item.sourceType} · {item.relativePath.split("/").pop()}</option>)}</select>}
            <button type="button" disabled={!subtitle} onClick={openDesktopLyrics}>弹出歌词</button>
            <button type="button" onClick={() => setShowLyrics(false)}>
              <X />
            </button>
          </header>
          {!subtitle && <p className="lyrics-empty">当前音轨没有可用歌词。请将同名 .lrc / .vtt / .srt（也支持 `音轨.mp3.vtt`）放入音频目录后重新扫描。</p>}
          {cues.map((cue) => (
            <button
              className={
                position >= cue.startMs && position < cue.endMs ? "active" : ""
              }
              key={`${cue.startMs}-${cue.text}`}
              type="button" onClick={() => {
                if (audio.current) {
                  audio.current.currentTime = cue.startMs / 1000;
                  void audio.current.play();
                }
              }}
            >
              {cue.text}
            </button>
          ))}
        </aside>
      )}
    </>
  );
}

function TagEditor({
  detail,
  refresh,
}: {
  detail: Detail;
  refresh: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <div className="tag-editor">
      {detail.tags.map((tag) => (
        <button
          key={tag.id}
          onClick={() =>
            void api(`/api/works/${detail.id}/tags/${tag.id}`, {
              method: "DELETE",
            }).then(refresh)
          }
        >
          {tag.name} ×
        </button>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name)
            void api(`/api/works/${detail.id}/tags`, {
              method: "POST",
              body: JSON.stringify({ name }),
            }).then(() => {
              setName("");
              refresh();
            });
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="添加标签"
        />
        <button>+</button>
      </form>
    </div>
  );
}

function TitleEditor({ detail, refresh }: { detail: Detail; refresh: () => void }) {
  const [editing, setEditing] = useState(false); const [value, setValue] = useState(detail.displayTitle);
  if (!editing) return <button className="edit-title" onClick={() => setEditing(true)}>编辑标题</button>;
  return <form className="title-editor" onSubmit={event => { event.preventDefault(); void api(`/api/works/${detail.id}`, { method: 'PATCH', body: JSON.stringify({ manualTitle: value }) }).then(() => { setEditing(false); refresh(); }); }}><input value={value} onChange={event => setValue(event.target.value)} /><button>保存</button><button type="button" onClick={() => { setEditing(false); setValue(detail.displayTitle); }}>取消</button><button type="button" onClick={() => void api(`/api/works/${detail.id}`, { method: 'PATCH', body: JSON.stringify({ manualTitle: null }) }).then(() => { setEditing(false); refresh(); })}>恢复同步标题</button></form>;
}

function MetadataTools({ detail, refresh }: { detail: Detail; refresh: () => void }) {
  const [rjCode, setRjCode] = useState(detail.rjCode ?? "");
  const [status, setStatus] = useState("");
  const [syncing, setSyncing] = useState<"dlsite" | "asmr" | null>(null);
  const request = async (path: string, message: string) => {
    const source = path.endsWith("/dlsite") ? "dlsite" : "asmr";
    setSyncing(source);
    setStatus("同步中…");
    try { await api(path, { method: "POST" }); setStatus(message); refresh(); }
    catch (cause) { setStatus(cause instanceof Error ? cause.message : "同步失败，请重试。"); }
    finally { setSyncing(null); }
  };
  return <div className="metadata-tools">
    <form onSubmit={(event) => { event.preventDefault(); void api(`/api/works/${detail.id}`, { method: "PATCH", body: JSON.stringify({ rjCode: rjCode || null }) }).then(() => { setStatus("RJ 编号已保存。"); refresh(); }).catch((cause: unknown) => setStatus(cause instanceof Error ? cause.message : "保存失败")); }}>
      <input aria-label="RJ 编号" value={rjCode} onChange={(event) => setRjCode(event.target.value.toUpperCase())} placeholder="RJ01113481" />
      <button>保存 RJ</button>
    </form>
    <div className="drawer-actions">
      <button onClick={() => void request(`/api/works/${detail.id}/sync/dlsite`, "DLsite 信息、封面与中文标签已同步。")} disabled={!detail.rjCode || syncing !== null}>{syncing === "dlsite" ? "正在同步…" : "同步 DLsite 数据"}</button>
      <button onClick={() => void request(`/api/works/${detail.id}/sync/asmr-one`, "ASMR.ONE 中文标题已同步；CV 与标签以 DLsite 官方数据为准。")} disabled={!detail.rjCode || syncing !== null}>{syncing === "asmr" ? "正在同步…" : "同步 ASMR.ONE 标题"}</button>
    </div>
    <small>{status || [detail.dlsiteSyncedAt && `DLsite：${new Date(detail.dlsiteSyncedAt).toLocaleString()}`, detail.asmrOneSyncedAt && `中文标题：${new Date(detail.asmrOneSyncedAt).toLocaleString()}`].filter(Boolean).join(" · ") || "保存 RJ 编号后可手动同步公开元数据。"}</small>
  </div>;
}

function LibrarySync({ refresh }: { refresh: () => void }) {
  const [status, setStatus] = useState("");
  const [syncing, setSyncing] = useState(false);
  const syncAll = async () => {
    setSyncing(true); setStatus("正在同步 DLsite 信息、封面与中文标签…");
    try {
      const result = await api<{ total: number; synced: number; failed: number }>("/api/works/sync/dlsite", { method: "POST" });
      setStatus(`已同步 ${result.synced}/${result.total} 个作品${result.failed ? `，${result.failed} 个失败` : ""}。`);
      refresh();
    } catch (cause) { setStatus(cause instanceof Error ? cause.message : "同步失败，请重试。"); }
    finally { setSyncing(false); }
  };
  return <div className="library-sync"><button className="text-action" type="button" disabled={syncing} onClick={() => void syncAll()}><Sparkles />{syncing ? "正在同步…" : "一键同步 DLsite"}</button>{status && <small>{status}</small>}</div>;
}

function SubtitleTools({ detail, refresh }: { detail: Detail; refresh: () => void }) {
  const [status, setStatus] = useState("");
  if (!detail.subtitles.length) return null;
  return <div className="subtitle-sources">{detail.subtitles.map(subtitle => <div key={subtitle.id}>
    <select aria-label="字幕来源" value={subtitle.sourceType} onChange={(event) => void api(`/api/subtitles/${subtitle.id}`, { method: "PATCH", body: JSON.stringify({ sourceType: event.target.value }) }).then(() => { setStatus("字幕来源已更新。"); refresh(); }).catch((cause: unknown) => setStatus(cause instanceof Error ? cause.message : "更新失败"))}>
      <option value="unknown">未标注字幕</option><option value="official">官方歌词</option><option value="ai">AI 歌词</option>
    </select>
    <select aria-label="关联音轨" value={subtitle.trackId} onChange={(event) => void api(`/api/subtitles/${subtitle.id}`, { method: "PATCH", body: JSON.stringify({ trackId: Number(event.target.value) }) }).then(() => { setStatus("已重新关联音轨。"); refresh(); }).catch((cause: unknown) => setStatus(cause instanceof Error ? cause.message : "更新失败"))}>{detail.tracks.map(track => <option key={track.id} value={track.id}>{track.title}</option>)}</select>
  </div>)}{status && <small>{status}</small>}</div>;
}

function Sidebar({
  signOut,
  query,
  setQuery,
  page,
  setPage,
  tags,
  tagId,
  setTagId,
  wishlistCount,
}: {
  signOut: () => void;
  query: string;
  setQuery: (value: string) => void;
  page: string;
  setPage: (page: string) => void;
  tags: Array<{ id: number; name: string }>;
  tagId: number | null;
  setTagId: (id: number | null) => void;
  wishlistCount: number;
}) {
  const [showFilter, setShowFilter] = useState(false);
  return (
    <aside className="sidebar">
      <div className="brand">
        <span>
          <AudioLines />
        </span>
        <b>no voice</b>
      </div>
      <div className="sidebar-tools">
        <label className="sidebar-search">
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索"
            aria-label="搜索本地作品"
          />
        </label>
        <button
          className="sidebar-filter"
          aria-label="筛选本地作品"
          title="筛选本地作品"
          aria-expanded={showFilter}
          onClick={() => setShowFilter((value) => !value)}
        >
          <SlidersHorizontal />
        </button>
      </div>
      {showFilter && <div className="sidebar-tag-filter"><button className={!tagId ? "active" : ""} onClick={() => setTagId(null)}>全部标签</button>{tags.map(tag => <button className={tag.id === tagId ? "active" : ""} key={tag.id} onClick={() => setTagId(tag.id)}>{tag.name}</button>)}</div>}
      <nav>
        <p>资料库</p>
        <button
          className={page === "library" ? "active" : ""}
          onClick={() => setPage("library")}
        >
          <Library />
          现在浏览
        </button>
        <button
          className={page === "discover" ? "active" : ""}
          onClick={() => setPage("discover")}
        >
          <Compass />
          发现
        </button>
        <button
          className={page === "recent" ? "active" : ""}
          onClick={() => setPage("recent")}
        >
          <ListMusic />
          最近播放
        </button>
        <button
          className={page === "wishlist" ? "active" : ""}
          onClick={() => setPage("wishlist")}
        >
          <Heart />
          想听
          {wishlistCount > 0 && <small className="sidebar-count">{wishlistCount}</small>}
        </button>
        <p>管理</p>
        <button
          className={page === "roots" ? "active" : ""}
          onClick={() => setPage("roots")}
        >
          <FolderOpen />
          本地目录
        </button>
        <button
          className={page === "settings" ? "active" : ""}
          onClick={() => setPage("settings")}
        >
          <Settings2 />
          偏好设置
        </button>
      </nav>
      <button className="sidebar-logout" onClick={signOut}>
        <LogOut />
        退出资料库
      </button>
    </aside>
  );
}

function RootManager({
  roots,
  refresh,
}: {
  roots: Array<{ id: number; label: string; enabled: boolean }>;
  refresh: () => void;
}) {
  const [path, setPath] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const chooseFolder = async () => {
    setPicking(true);
    setError("");
    try {
      const selected = await api<{ path: string; label: string }>("/api/roots/pick", { method: "POST" });
      setPath(selected.path);
      if (!label) setLabel(selected.label);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "无法选择目录";
      if (message !== "已取消目录选择。") setError(message);
    } finally { setPicking(false); }
  };
  const add = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api("/api/roots", {
        method: "POST",
        body: JSON.stringify({ path, label: label || path.split("/").pop() }),
      });
      setPath("");
      setLabel("");
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "添加失败");
    }
  };
  return (
    <section className="manager">
      <h1>本地目录</h1>
      <p>{roots.length} 个本地目录</p>
      <form onSubmit={add}>
        <div className="directory-path">
          <input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="/Volumes/Audio Library"
            required
          />
          <button type="button" className="choose-folder" onClick={() => void chooseFolder()} disabled={picking}>{picking ? "正在打开…" : "选择文件夹"}</button>
        </div>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="目录名称（可选）"
        />
        <button>添加目录</button>
        {error && <b>{error}</b>}
      </form>
      {roots.map((root) => (
        <article key={root.id}>
          <b>{root.label}</b>
          <span>{root.enabled ? "已启用" : "已停用"}</span>
          <button
            onClick={() =>
              void api(`/api/roots/${root.id}/scan`, { method: "POST" }).then(
                refresh,
              )
            }
          >
            扫描
          </button>
          <button
            onClick={() =>
              void api(`/api/roots/${root.id}`, {
                method: "PATCH",
                body: JSON.stringify({ enabled: !root.enabled }),
              }).then(refresh)
            }
          >
            {root.enabled ? "停用" : "启用"}
          </button>
          <button
            onClick={() =>
              void api(`/api/roots/${root.id}`, { method: "DELETE" }).then(
                refresh,
              )
            }
          >
            移除
          </button>
        </article>
      ))}
    </section>
  );
}

function RecentPage({ open }: { open: (id: number) => void }) { const [items, setItems] = useState<Array<{ trackId: number; trackTitle: string; workId: number; workTitle: string }>>([]); useEffect(() => { void api<typeof items>('/api/recent').then(setItems); }, []); return <section className="manager"><h1>最近播放</h1><p>播放进度会自动保存在本机。</p>{items.length ? items.map(item => <article key={item.trackId}><b>{item.trackTitle}</b><span>{item.workTitle}</span><button onClick={() => open(item.workId)}>打开作品</button></article>) : <div className="empty-local"><ListMusic /><b>还没有播放记录</b></div>}</section>; }

function WishlistImporter({ refresh }: { refresh: () => void }) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const tokens = value.split(/[\s,，;；]+/).map(token => token.trim()).filter(Boolean);
    const invalid = tokens.filter(token => !/^RJ\d{8}$/i.test(token));
    const rjCodes = [...new Set(tokens.filter(token => /^RJ\d{8}$/i.test(token)).map(token => token.toUpperCase()))];
    if (!rjCodes.length) { setStatus("请输入至少一个有效的 RJ 编号。"); return; }
    if (invalid.length) { setStatus(`有 ${invalid.length} 个编号格式不正确，请使用 RJ + 8 位数字。`); return; }
    setSaving(true);
    setStatus("");
    try {
      const result = await api<{ added: number; existing: number; total: number }>("/api/wishlist/import", { method: "POST", body: JSON.stringify({ rjCodes }) });
      setValue("");
      setStatus(result.existing ? `已添加 ${result.added} 个，${result.existing} 个已在想听清单。` : `已添加 ${result.added} 个作品。`);
      refresh();
    } catch (cause) { setStatus(cause instanceof Error ? cause.message : "添加失败，请重试。"); }
    finally { setSaving(false); }
  };
  return <form className="wishlist-importer" onSubmit={(event) => void submit(event)}>
    <label>
      <span>直接添加 RJ 编号</span>
      <textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder={"RJ01663846\nRJ01664205\n支持换行、空格或逗号批量添加"} aria-label="输入想听作品的 RJ 编号" />
    </label>
    <div><small>{status || "最多一次添加 100 个。"}</small><button type="submit" disabled={saving}>{saving ? "正在添加…" : "添加到想听"}</button></div>
  </form>;
}

function WishlistPage({ items, toggleWish, refresh }: { items: WishlistWork[]; toggleWish: (item: DiscoveryWork) => void; refresh: () => void }) {
  return <section className="ranking-page wishlist-page">
    <header className="ranking-heading">
      <div>
        <h1>想听</h1>
        <p>{items.length ? `${items.length} 个已收藏作品，之后可以从这里继续找。` : "把人气作品或新作加入这里，方便日后查找。"}</p>
      </div>
    </header>
    <WishlistImporter refresh={refresh} />
    {items.length ? <div className="ranking-grid">{items.map((item, index) => {
      const discoveryItem: DiscoveryWork = {
        id: item.rjCode,
        title: item.title,
        voice: item.voiceActors ?? "未标注",
        rjCode: item.rjCode,
        cover: item.coverUrl ? `/api/discovery/cover?url=${encodeURIComponent(item.coverUrl)}` : "",
        coverUrl: item.coverUrl,
        sourceUrl: item.sourceUrl,
      };
      return <article className="ranking-card wishlist-card" key={item.rjCode}>
        <div className="ranking-item">
          <a className="ranking-cover-link" href={item.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`在新标签页打开 ${item.title} 的 DLsite 页面`}><Cover item={discoveryItem} tone={index} className="ranking-cover" /></a>
          <WishButton item={discoveryItem} wished toggle={toggleWish} />
          <b>{item.title}</b><span>CV · {item.voiceActors ?? "未标注"}</span><small>{item.rjCode}</small>
        </div>
      </article>;
    })}</div> : <div className="empty-local"><Heart /><b>想听清单还是空的</b><span>在人气作品或最新上架的封面右上角点一下爱心即可收藏。</span></div>}
  </section>;
}

function SettingsPage() { return <section className="manager"><h1>偏好设置</h1><p>本地资料库不会将目录、音频或登录信息发送给第三方。</p><article><b>字幕与歌词</b><span>浏览器歌词面板</span></article><article><b>桌面歌词</b><span>网页仅支持弹出歌词面板；系统置顶窗口需要桌面端容器。</span></article><article><b>安全模式</b><span>正式部署请移除 DISABLE_AUTH、设置 ACCESS_PASSWORD 并使用 HTTPS。</span></article></section>; }

export default function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [roots, setRoots] = useState<
    Array<{ id: number; label: string; enabled: boolean }>
  >([]);
  const [page, setPage] = useState("library");
  const [rankingOrder, setRankingOrder] = useState<DiscoveryOrder | null>(null);
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<Array<{ id: number; name: string }>>([]);
  const [tagId, setTagId] = useState<number | null>(null);
  const [wishlist, setWishlist] = useState<WishlistWork[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [playback, setPlayback] = useState<{ workId: number; workTitle: string; tracks: Track[]; subtitles: Subtitle[]; cover?: string } | null>(null);
  const [openLyricsForTrack, setOpenLyricsForTrack] = useState<number | null>(null);
  const audioEngine = useRef<HTMLAudioElement>(null);
  const load = async () => {
    const [nextWorks, nextRoots] = await Promise.all([
      api<Work[]>(`/api/works?q=${encodeURIComponent(query)}${tagId ? `&tagId=${tagId}` : ""}`),
      api<Array<{ id: number; label: string; enabled: boolean }>>("/api/roots"),
    ]);
    setWorks(nextWorks);
    setRoots(nextRoots);
    void api<Array<{ id: number; name: string }>>("/api/tags").then(setTags);
  };
  useEffect(() => {
    restoreSession()
      .then(() => setSignedIn(true))
      .catch(() => setSignedIn(false));
  }, []);
  const loadWishlist = () => void api<WishlistWork[]>("/api/wishlist").then(setWishlist).catch(() => undefined);
  useEffect(() => {
    if (signedIn) loadWishlist();
  }, [signedIn]);
  useEffect(() => {
    if (!signedIn) return;
    const timer = setTimeout(() => void load(), 120);
    return () => clearTimeout(timer);
  }, [signedIn, query, tagId]);
  const openWork = (id: number) =>
    void api<Detail>(`/api/works/${id}`).then(setDetail);
  const wishedIds = useMemo(() => new Set(wishlist.map((item) => item.rjCode)), [wishlist]);
  const toggleWish = (item: DiscoveryWork) => {
    const isWished = wishedIds.has(item.rjCode);
    if (isWished) {
      setWishlist((current) => current.filter((entry) => entry.rjCode !== item.rjCode));
      void api(`/api/wishlist/${item.rjCode}`, { method: "DELETE" }).catch(loadWishlist);
      return;
    }
    const saved: WishlistWork = {
      rjCode: item.rjCode,
      title: item.title,
      voiceActors: item.voice === "未标注" ? null : item.voice,
      coverUrl: item.coverUrl ?? null,
      sourceUrl: item.sourceUrl ?? `https://www.dlsite.com/maniax/work/=/product_id/${item.rjCode}.html`,
      addedAt: Date.now(),
    };
    setWishlist((current) => [saved, ...current]);
    void api<WishlistWork>("/api/wishlist", { method: "POST", body: JSON.stringify(saved) }).catch(loadWishlist);
  };
  const startAudio = (item: Track) => {
    const audio = audioEngine.current;
    if (!audio) return;
    audio.pause();
    audio.src = `/api/tracks/${item.id}/audio`;
    audio.load();
    // This remains in the originating click event, so it is treated as an
    // explicit user play request instead of a blocked post-render autoplay.
    void audio.play().catch(() => undefined);
  };
  const playTrack = (item: Track, work: Detail, openLyrics = false) => {
    setPlayback({ workId: work.id, workTitle: work.displayTitle, tracks: work.tracks, subtitles: work.subtitles, cover: work.coverPath || work.remoteCoverUrl ? `/api/works/${work.id}/cover` : undefined });
    setTrack(item);
    setOpenLyricsForTrack(openLyrics ? item.id : null);
    startAudio(item);
  };
  const signOut = () => void logout().then(() => setSignedIn(false));
  if (signedIn === null)
    return (
      <main className="auth">
        <LoaderCircle className="spin" />
      </main>
    );
  if (!signedIn) return <Login ready={() => setSignedIn(true)} />;
  const home = (
    <>
      <DiscoveryShelf
        title="人气作品"
        detail="来自 DLsite 的趋势排序"
        items={trendingPreview}
        order="trend"
        openRanking={setRankingOrder}
        wishedIds={wishedIds}
        toggleWish={toggleWish}
      />
      <DiscoveryShelf
        title="最新上架"
        detail="来自 DLsite 的发布时间排序"
        items={recentPreview}
        order="release_d"
        openRanking={setRankingOrder}
        wishedIds={wishedIds}
        toggleWish={toggleWish}
      />
      <DiscoveryShelf
        title="字幕榜"
        detail="来自 DLsite 的字幕作品排序"
        items={recentPreview}
        order="subtitle"
        openRanking={setRankingOrder}
        wishedIds={wishedIds}
        toggleWish={toggleWish}
      />
      <section className="local-library">
        <header className="shelf-heading">
          <div>
            <h2>本地资料库</h2>
            <p>
              {works.length
                ? `${works.length} 件已收录作品`
                : "扫描目录后将在这里出现"}
            </p>
          </div>
          <LibrarySync refresh={() => void load()} />
        </header>
        {works.length ? (
          <div className="local-grid">
            {works.map((work, index) => (
              <LocalWorkCard
                key={work.id}
                work={work}
                index={index}
                open={openWork}
              />
            ))}
          </div>
        ) : (
          <div className="empty-local">
            <FolderOpen />
            <b>还没有可展示的本地作品</b>
            <span>添加目录并扫描后，作品会出现在这里。</span>
          </div>
        )}
      </section>
    </>
  );
  return (
    <div className="library-app">
      <Sidebar
        signOut={signOut}
        query={query}
        setQuery={setQuery}
        page={page}
        setPage={(nextPage) => { setRankingOrder(null); setPage(nextPage); }}
        tags={tags}
        tagId={tagId}
        setTagId={setTagId}
        wishlistCount={wishlist.length}
      />
      <main className="content">
        {page === "roots" ? <RootManager roots={roots} refresh={() => void load()} /> : page === "recent" ? <RecentPage open={openWork} /> : page === "wishlist" ? <WishlistPage items={wishlist} toggleWish={toggleWish} refresh={loadWishlist} /> : page === "settings" ? <SettingsPage /> : rankingOrder ? <RankingPage order={rankingOrder} goBack={() => setRankingOrder(null)} wishedIds={wishedIds} toggleWish={toggleWish} /> : home}
      </main>
      {detail && (
        <>
        <aside className="work-drawer">
          <Cover item={{ ...detail, cover: detail.coverPath || detail.remoteCoverUrl ? `/api/works/${detail.id}/cover` : undefined }} className="drawer-cover" />
          <p>本地作品 · {detail.rjCode ?? "LOCAL"}</p>
          <h2>{detail.displayTitle}</h2>
          <TitleEditor detail={detail} refresh={() => openWork(detail.id)} />
          <MetadataTools detail={detail} refresh={() => openWork(detail.id)} />
          <span className="drawer-circle">{detail.circle ?? "未标记社团"}{detail.voiceActors ? ` · CV ${detail.voiceActors}` : ""}</span>
          <TagEditor detail={detail} refresh={() => openWork(detail.id)} />
          <SubtitleTools detail={detail} refresh={() => openWork(detail.id)} />
          <ol>
            {detail.tracks.map((item, index) => (
              <li key={item.id}>
                <button type="button" onClick={() => playTrack(item, detail)}>
                  <em>{String(index + 1).padStart(2, "0")}</em>
                  <span>{item.title}</span>
                  <Captions
                    className={
                      detail.subtitles.some(
                        (subtitle) => subtitle.trackId === item.id,
                      )
                        ? "has-subtitles"
                        : ""
                    }
                  />
                  <Play size={14} />
                </button>
                {detail.subtitles.some(subtitle => subtitle.trackId === item.id) && <button className="track-lyrics" type="button" aria-label={`查看 ${item.title} 的字幕`} onClick={() => playTrack(item, detail, true)}><Captions /></button>}
              </li>
            ))}
          </ol>
        </aside>
        <button
          className="drawer-close"
          aria-label="收起作品详情"
          title="收起详情"
          onClick={() => setDetail(null)}
        >
          <X />
        </button>
        </>
      )}
      <Player
        audio={audioEngine}
        track={track}
        work={playback?.workTitle ?? ""}
        cover={playback?.cover}
        queue={playback?.tracks ?? []}
        selectTrack={(item) => { setTrack(item); setOpenLyricsForTrack(null); startAudio(item); }}
        openCurrentWork={() => { if (playback) void openWork(playback.workId); }}
        openLyricsForTrack={openLyricsForTrack}
        subtitles={
          playback?.subtitles.filter(
            (subtitle) => subtitle.trackId === track?.id,
          ) ?? []
        }
        close={() => { audioEngine.current?.pause(); audioEngine.current?.removeAttribute("src"); audioEngine.current?.load(); setTrack(null); setPlayback(null); setOpenLyricsForTrack(null); }}
      />
    </div>
  );
}

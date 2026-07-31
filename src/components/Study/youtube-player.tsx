"use client";

import { forwardRef, useState, useCallback, type ReactNode } from "react";
import { useComposedRefs, useMediaInstance } from "@videojs/react";

// ── Constants ──────────────────────────────────────────────────────

const EMBED_BASE = "https://www.youtube-nocookie.com/embed";
const API_URL = "https://www.youtube.com/iframe_api";
const API_GLOBAL = "YT";
const API_GLOBAL_READY = "onYouTubeIframeAPIReady";
const MATCH_SRC =
  /(?:youtu\.be\/|youtube\.com\/(?:shorts\/|embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})/;

const DEFAULT_PROPS = {
  src: "",
  autoplay: false,
  defaultMuted: false,
  muted: false,
  loop: false,
  controls: false,
  playsInline: true,
  preload: "metadata" as string,
  poster: "",
};

// ── URL helpers ────────────────────────────────────────────────────

function parseVideoId(src: string): string | null {
  if (!src) return null;
  const m = src.match(MATCH_SRC);
  if (m?.[1]) return m[1];
  if (/^[\w-]{11}$/.test(src)) return src;
  return null;
}

function buildIframeSrc(src: string, props: Record<string, unknown>): string {
  const id = parseVideoId(src);
  if (!id) return "";
  const params: Record<string, string> = {
    enablejsapi: "1",
    rel: "0",
    controls: "0",
    disablekb: "1",
    fs: "1",
    hl: "en",
    cc_lang_pref: "en",
    iv_load_policy: "3",
    color: "red",
    modestbranding: "1",
    origin: "",
  };
  if (props.autoplay) params.autoplay = "1";
  else params.autoplay = "0";
  if (props.loop) params.loop = "1";
  if (props.defaultMuted || props.muted) params.mute = "1";
  else params.mute = "0";
  if (props.playsInline) params.playsinline = "1";
  if (typeof window !== "undefined") params.origin = window.location.origin;
  return `${EMBED_BASE}/${id}?${new URLSearchParams(params)}`;
}

// ── YouTube IFrame API loader ──────────────────────────────────────

let apiPromise: Promise<unknown> | null = null;

function loadAPI(): Promise<unknown> {
  if (apiPromise) return apiPromise;
  const g = globalThis as Record<string, unknown>;
  if (g[API_GLOBAL]) {
    apiPromise = Promise.resolve(g[API_GLOBAL]);
    return apiPromise;
  }
  apiPromise = new Promise((resolve) => {
    g[API_GLOBAL_READY] = () => resolve(g[API_GLOBAL]);
    const s = document.createElement("script");
    s.src = API_URL;
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}

// ── Helpers ────────────────────────────────────────────────────────

function defer(): Promise<void> & { resolve: () => void; reject: (r?: unknown) => void } {
  let resolve!: () => void;
  let reject!: (r?: unknown) => void;
  const p = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  }) as ReturnType<typeof defer>;
  p.resolve = resolve;
  p.reject = reject;
  return p;
}

// ── YouTubeMedia class ─────────────────────────────────────────────

export class YouTubeMedia extends EventTarget {
  _player: unknown = null;
  _target: HTMLIFrameElement | null = null;
  _ready = defer();
  _src = "";
  _autoplay = false;
  _loop = false;
  _controls = false;
  _playsInline = true;
  _preload = "metadata";
  _poster = "";
  _paused = true;
  _ended = false;
  _seeking = false;
  _currentTime = 0;
  _duration = NaN;
  _volume = 1;
  _muted = false;
  _playbackRate = 1;
  _readyState = 0;
  _progress = 0;
  _error: unknown = null;
  _videoWidth = NaN;
  _videoHeight = NaN;
  _timeTimer: ReturnType<typeof setInterval> | null = null;
  _progTimer: ReturnType<typeof setInterval> | null = null;
  _pipActive = false;

  get engine() {
    return this._player;
  }
  get target() {
    return this._target;
  }

  get src() {
    return this._src;
  }
  set src(v: string) {
    if (this._src === v) return;
    this._src = v;
    this.load();
  }
  get currentSrc() {
    return this._src ? buildIframeSrc(this._src, this._snap()) : "";
  }
  get readyState() {
    return this._readyState;
  }
  get paused() {
    return this._paused;
  }
  get ended() {
    return this._ended;
  }
  get seeking() {
    return this._seeking;
  }
  get currentTime() {
    return this._currentTime;
  }
  set currentTime(v: number) {
    this._currentTime = v;
    this.dispatchEvent(new Event("seeking"));
    this._afterReady((p: any) => p.seekTo(v, true));
  }
  get duration() {
    return this._duration;
  }
  get volume() {
    return this._volume;
  }
  set volume(v: number) {
    this._volume = v;
    this._afterReady((p: any) => p.setVolume(v * 100));
  }
  get muted() {
    return this._muted;
  }
  set muted(v: boolean) {
    this._muted = v;
    this._afterReady((p: any) => (v ? p.mute() : p.unMute()));
  }
  get playbackRate() {
    return this._playbackRate;
  }
  set playbackRate(v: number) {
    this._playbackRate = v;
    this._afterReady((p: any) => p.setPlaybackRate(v));
  }
  get autoplay() {
    return this._autoplay;
  }
  set autoplay(v: boolean) {
    this._autoplay = v;
  }
  get loop() {
    return this._loop;
  }
  set loop(v: boolean) {
    this._loop = v;
  }
  get controls() {
    return this._controls;
  }
  set controls(v: boolean) {
    this._controls = v;
  }
  get playsInline() {
    return this._playsInline;
  }
  set playsInline(v: boolean) {
    this._playsInline = v;
  }
  get preload() {
    return this._preload;
  }
  set preload(v: string) {
    this._preload = v;
  }
  get poster() {
    return this._poster;
  }
  set poster(v: string) {
    this._poster = v;
  }
  get buffered() {
    return this._progress > 0
      ? { length: 1, start: () => 0, end: () => this._progress }
      : { length: 0, start: () => 0, end: () => 0 };
  }
  get seekable() {
    return Number.isFinite(this._duration) && this._duration > 0
      ? { length: 1, start: () => 0, end: () => this._duration }
      : { length: 0, start: () => 0, end: () => 0 };
  }
  get error() {
    return this._error;
  }
  get videoWidth() {
    return this._videoWidth;
  }
  get videoHeight() {
    return this._videoHeight;
  }
  get played() {
    return { length: 0, start: () => 0, end: () => 0 };
  }
  get textTracks() {
    return {
      length: 0,
      getTrackById: () => null,
      [Symbol.iterator]() {
        return { next: () => ({ done: true, value: undefined } as const) };
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    };
  }

  _snap() {
    return {
      autoplay: this._autoplay,
      loop: this._loop,
      controls: this._controls,
      playsInline: this._playsInline,
      preload: this._preload,
    };
  }

  _afterReady(fn: (player: unknown) => void) {
    this._ready.then(
      () => {
        if (this._player) fn(this._player);
      },
      () => undefined,
    );
  }

  _reset() {
    this._currentTime = 0;
    this._duration = NaN;
    this._paused = !this._autoplay;
    this._ended = false;
    this._playbackRate = 1;
    this._progress = 0;
    this._readyState = 0;
    this._seeking = false;
    this._error = null;
    this._videoWidth = NaN;
    this._videoHeight = NaN;
  }

  _loading = false;

  _stopTimers() {
    if (this._timeTimer) clearInterval(this._timeTimer);
    this._timeTimer = null;
    if (this._progTimer) clearInterval(this._progTimer);
    this._progTimer = null;
  }

  attach(target: HTMLIFrameElement) {
    if (!target || this._target === target) return;
    if (this._target) this.detach();
    this._target = target;
    this._initPlayer("attach");
  }

  detach() {
    this._loading = false;
    this._stopTimers();
    if (this._player) {
      try {
        (this._player as any).destroy();
      } catch {
        /* ignore */
      }
    }
    this._player = null;
    this._target = null;
    this._reset();
  }

  destroy() {
    this.detach();
  }

  async load() {
    if (!this._src) return;
    const id = parseVideoId(this._src);
    if (!id) return;

    if (this._player) {
      this._reset();
      this._ready = defer();
      this.dispatchEvent(new Event("emptied"));
      this.dispatchEvent(new Event("loadstart"));
      (this._player as any).loadVideoById(id);
    } else if (this._target) {
      this._initPlayer("load");
    }
  }

  async _initPlayer(caller: "attach" | "load") {
    if (this._loading || this._player) return;
    if (!this._target || !this._src) return;
    this._loading = true;
    this._reset();
    this._ready = defer();
    if (caller === "load") {
      this.dispatchEvent(new Event("emptied"));
    }
    this.dispatchEvent(new Event("loadstart"));

    const YT = (await loadAPI()) as any;
    const id = parseVideoId(this._src);
    if (!id) { this._loading = false; return; }
    if (this._player) { this._loading = false; return; }

    this._player = new YT.Player(this._target, {
      events: {
        onReady: () => { this._loading = false; this._onReady(id); },
        onStateChange: (e: any) => this._onState(e),
        onPlaybackRateChange: (e: any) => this._onRate(e),
        onError: (e: any) => this._onErr(e),
      },
    });
  }



  _onReady(_id: string) {
    this._readyState = 4;
    this.dispatchEvent(new Event("loadedmetadata"));
    this.dispatchEvent(new Event("durationchange"));
    this.dispatchEvent(new Event("volumechange"));
    this.dispatchEvent(new Event("canplay"));
    this.dispatchEvent(new Event("canplaythrough"));
    this._ready.resolve();

    this._timeTimer = setInterval(() => {
      const p = this._player as any;
      if (!p) return;
      const t = p.getCurrentTime();
      if (t !== this._currentTime) {
        this._currentTime = t;
        this.dispatchEvent(new Event("timeupdate"));
      }
      const d = p.getDuration();
      if (Number.isFinite(d) && d !== this._duration) {
        this._duration = d;
        this.dispatchEvent(new Event("durationchange"));
      }
    }, 200);

    this._progTimer = setInterval(() => {
      const p = this._player as any;
      if (!p) return;
      const fraction = p.getVideoLoadedFraction();
      const loaded = (p.getDuration() || 0) * fraction;
      if (loaded !== this._progress) {
        this._progress = loaded;
        this.dispatchEvent(new Event("progress"));
      }
    }, 500);
  }

  _onState(e: any) {
    switch (e.data) {
      case -1:
      case 5:
        this._readyState = 4;
        this.dispatchEvent(new Event("canplay"));
        this.dispatchEvent(new Event("canplaythrough"));
        break;
      case 1:
        if (this._seeking) {
          this._seeking = false;
          this.dispatchEvent(new Event("seeked"));
        }
        if (this._paused) {
          this._paused = false;
          this.dispatchEvent(new Event("play"));
        }
        this._readyState = 4;
        this._paused = false;
        this._ended = false;
        this.dispatchEvent(new Event("playing"));
        break;
      case 2:
        this._paused = true;
        this.dispatchEvent(new Event("pause"));
        break;
      case 3:
        this.dispatchEvent(new Event("waiting"));
        break;
      case 0:
        this._paused = true;
        this._ended = true;
        this.dispatchEvent(new Event("pause"));
        this.dispatchEvent(new Event("ended"));
        break;
    }
  }

  _onRate(e: any) {
    this._playbackRate = e.data;
    this.dispatchEvent(new Event("ratechange"));
  }

  _onErr(e: any) {
    this._error = { code: e.data, message: `YouTube error ${e.data}` };
    this.dispatchEvent(new Event("error"));
  }

  get isPictureInPicture(): boolean {
    return this._pipActive;
  }

  async requestPictureInPicture(): Promise<void> {
    if (this._pipActive) return;
    this._pipActive = true;
    this.dispatchEvent(new Event("enterpictureinpicture"));
  }

  async exitPictureInPicture(): Promise<void> {
    if (!this._pipActive) return;
    this._pipActive = false;
    this.dispatchEvent(new Event("leavepictureinpicture"));
  }

  async play() {
    await this._ready;
    (this._player as any)?.playVideo();
    return new Promise<void>((resolve) => {
      const fn = () => {
        this.removeEventListener("playing", fn as any);
        resolve();
      };
      this.addEventListener("playing", fn as any);
      setTimeout(resolve, 1000);
    });
  }

  pause() {
    (this._player as any)?.pauseVideo();
  }
}

// ── React component ────────────────────────────────────────────────

export interface YoutubePlayerProps {
  src: string;
  style?: React.CSSProperties;
  className?: string;
  children?: ReactNode;
}

export const YoutubePlayer = forwardRef<HTMLIFrameElement, YoutubePlayerProps>(
  function YoutubePlayer({ children, ...rawProps }, ref) {
    const media = useMediaInstance(YouTubeMedia);
    const props: Record<string, unknown> = { ...rawProps };

    const attachRef = useCallback(
      (el: HTMLIFrameElement | null) => {
        if (el) media.attach(el);
        else media.detach();
        return () => media.detach();
      },
      [media],
    );

    const composedRef = useComposedRefs(attachRef, ref);

    const [initialSrc] = useState(() =>
      buildIframeSrc((props.src as string) ?? "", {
        ...DEFAULT_PROPS,
        ...props,
      }),
    );

    const rest: Record<string, unknown> = {};
    for (const key in props) {
      if (key in DEFAULT_PROPS) {
        const value = props[key] !== undefined ? props[key] : (DEFAULT_PROPS as any)[key];
        if ((media as any)[key] !== value) (media as any)[key] = value;
      } else if (key !== "children") {
        rest[key] = props[key];
      }
    }

    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <iframe
          className={`vds-youtube ${props.className || ""}`.trim()}
          tabIndex={-1}
          aria-hidden="true"
          data-no-controls=""
          title="YouTube video player"
          src={initialSrc}
          data-cross-origin-frame
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope"
          allowFullScreen
          frameBorder={0}
          width="100%"
          height="100%"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            pointerEvents: "none",
            ...((props.style as React.CSSProperties) || {}),
          }}
          {...(rest as any)}
          ref={composedRef}
        >
          {children}
        </iframe>

        {/* ── Secure Overlay: Blocks all direct iframe clicks & YouTube link escapes ── */}
        <div
          className="yt-overlay"
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            if (media.paused) media.play();
            else media.pause();
          }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            cursor: "pointer",
            zIndex: 2,
            pointerEvents: "auto",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        />
      </div>
    );
  },
);

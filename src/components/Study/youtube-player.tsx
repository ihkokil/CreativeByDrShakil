"use client";

import { forwardRef, useState, useCallback, type ReactNode } from "react";
import { useComposedRefs, useMediaInstance } from "@videojs/react";

// ── Constants ──────────────────────────────────────────────────────

const EMBED_BASE = "https://www.youtube.com/embed";
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
    modestbranding: "1",
    iv_load_policy: "3",
    cc_load_policy: "0",
    origin: "",
  };
  if (props.autoplay) params.autoplay = "1";
  if (props.loop) params.loop = "1";
  if (props.defaultMuted) params.mute = "1";
  if (props.playsInline) params.playsinline = "1";
  if (props.controls !== true) params.controls = "0";
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
  #player: unknown = null;
  #target: HTMLIFrameElement | null = null;
  #ready = defer();
  #src = "";
  #autoplay = false;
  #loop = false;
  #controls = false;
  #playsInline = true;
  #preload = "metadata";
  #poster = "";
  #paused = true;
  #ended = false;
  #seeking = false;
  #currentTime = 0;
  #duration = NaN;
  #volume = 1;
  #muted = false;
  #playbackRate = 1;
  #readyState = 0;
  #progress = 0;
  #error: unknown = null;
  #videoWidth = NaN;
  #videoHeight = NaN;
  #timeTimer: ReturnType<typeof setInterval> | null = null;
  #progTimer: ReturnType<typeof setInterval> | null = null;
  #pipActive = false;

  get engine() {
    return this.#player;
  }
  get target() {
    return this.#target;
  }

  get src() {
    return this.#src;
  }
  set src(v: string) {
    if (this.#src === v) return;
    this.#src = v;
    this.load();
  }
  get currentSrc() {
    return this.#src ? buildIframeSrc(this.#src, this.#snap()) : "";
  }
  get readyState() {
    return this.#readyState;
  }
  get paused() {
    return this.#paused;
  }
  get ended() {
    return this.#ended;
  }
  get seeking() {
    return this.#seeking;
  }
  get currentTime() {
    return this.#currentTime;
  }
  set currentTime(v: number) {
    this.#currentTime = v;
    this.dispatchEvent(new Event("seeking"));
    this.#afterReady((p: any) => p.seekTo(v, true));
  }
  get duration() {
    return this.#duration;
  }
  get volume() {
    return this.#volume;
  }
  set volume(v: number) {
    this.#volume = v;
    this.#afterReady((p: any) => p.setVolume(v * 100));
  }
  get muted() {
    return this.#muted;
  }
  set muted(v: boolean) {
    this.#muted = v;
    this.#afterReady((p: any) => (v ? p.mute() : p.unMute()));
  }
  get playbackRate() {
    return this.#playbackRate;
  }
  set playbackRate(v: number) {
    this.#playbackRate = v;
    this.#afterReady((p: any) => p.setPlaybackRate(v));
  }
  get autoplay() {
    return this.#autoplay;
  }
  set autoplay(v: boolean) {
    this.#autoplay = v;
  }
  get loop() {
    return this.#loop;
  }
  set loop(v: boolean) {
    this.#loop = v;
  }
  get controls() {
    return this.#controls;
  }
  set controls(v: boolean) {
    this.#controls = v;
  }
  get playsInline() {
    return this.#playsInline;
  }
  set playsInline(v: boolean) {
    this.#playsInline = v;
  }
  get preload() {
    return this.#preload;
  }
  set preload(v: string) {
    this.#preload = v;
  }
  get poster() {
    return this.#poster;
  }
  set poster(v: string) {
    this.#poster = v;
  }
  get buffered() {
    return this.#progress > 0
      ? { length: 1, start: () => 0, end: () => this.#progress }
      : { length: 0, start: () => 0, end: () => 0 };
  }
  get seekable() {
    return Number.isFinite(this.#duration) && this.#duration > 0
      ? { length: 1, start: () => 0, end: () => this.#duration }
      : { length: 0, start: () => 0, end: () => 0 };
  }
  get error() {
    return this.#error;
  }
  get videoWidth() {
    return this.#videoWidth;
  }
  get videoHeight() {
    return this.#videoHeight;
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

  #snap() {
    return {
      autoplay: this.#autoplay,
      loop: this.#loop,
      controls: this.#controls,
      playsInline: this.#playsInline,
      preload: this.#preload,
    };
  }

  #afterReady(fn: (player: unknown) => void) {
    this.#ready.then(
      () => {
        if (this.#player) fn(this.#player);
      },
      () => undefined,
    );
  }

  #reset() {
    this.#currentTime = 0;
    this.#duration = NaN;
    this.#paused = !this.#autoplay;
    this.#ended = false;
    this.#playbackRate = 1;
    this.#progress = 0;
    this.#readyState = 0;
    this.#seeking = false;
    this.#error = null;
    this.#videoWidth = NaN;
    this.#videoHeight = NaN;
  }

  #loading = false;

  #stopTimers() {
    if (this.#timeTimer) clearInterval(this.#timeTimer);
    this.#timeTimer = null;
    if (this.#progTimer) clearInterval(this.#progTimer);
    this.#progTimer = null;
  }

  attach(target: HTMLIFrameElement) {
    if (!target || this.#target === target) return;
    if (this.#target) this.detach();
    this.#target = target;
    this.#initPlayer("attach");
  }

  detach() {
    this.#loading = false;
    this.#stopTimers();
    if (this.#player) {
      try {
        (this.#player as any).destroy();
      } catch {
        /* ignore */
      }
    }
    this.#player = null;
    this.#target = null;
    this.#reset();
  }

  destroy() {
    this.detach();
  }

  async load() {
    if (!this.#src) return;
    const id = parseVideoId(this.#src);
    if (!id) return;

    if (this.#player) {
      this.#reset();
      this.#ready = defer();
      this.dispatchEvent(new Event("emptied"));
      this.dispatchEvent(new Event("loadstart"));
      (this.#player as any).loadVideoById(id);
    } else if (this.#target) {
      this.#initPlayer("load");
    }
  }

  async #initPlayer(caller: "attach" | "load") {
    if (this.#loading || this.#player) return;
    if (!this.#target || !this.#src) return;
    this.#loading = true;
    this.#reset();
    this.#ready = defer();
    if (caller === "load") {
      this.dispatchEvent(new Event("emptied"));
    }
    this.dispatchEvent(new Event("loadstart"));

    const YT = (await loadAPI()) as any;
    const id = parseVideoId(this.#src);
    if (!id) { this.#loading = false; return; }
    if (this.#player) { this.#loading = false; return; }

    this.#player = new YT.Player(this.#target, {
      events: {
        onReady: () => { this.#loading = false; this.#onReady(id); },
        onStateChange: (e: any) => this.#onState(e),
        onPlaybackRateChange: (e: any) => this.#onRate(e),
        onError: (e: any) => this.#onErr(e),
      },
    });
  }



  #onReady(_id: string) {
    this.#readyState = 1;
    this.dispatchEvent(new Event("loadedmetadata"));
    this.dispatchEvent(new Event("durationchange"));
    this.dispatchEvent(new Event("volumechange"));
    this.dispatchEvent(new Event("loadcomplete"));
    this.#ready.resolve();

    this.#timeTimer = setInterval(() => {
      const p = this.#player as any;
      if (!p) return;
      const t = p.getCurrentTime();
      if (t !== this.#currentTime) {
        this.#currentTime = t;
        this.dispatchEvent(new Event("timeupdate"));
      }
      const d = p.getDuration();
      if (Number.isFinite(d) && d !== this.#duration) {
        this.#duration = d;
        this.dispatchEvent(new Event("durationchange"));
      }
    }, 200);

    this.#progTimer = setInterval(() => {
      const p = this.#player as any;
      if (!p) return;
      const fraction = p.getVideoLoadedFraction();
      const loaded = (p.getDuration() || 0) * fraction;
      if (loaded !== this.#progress) {
        this.#progress = loaded;
        this.dispatchEvent(new Event("progress"));
      }
    }, 500);
  }

  #onState(e: any) {
    switch (e.data) {
      case 1:
        if (this.#seeking) {
          this.#seeking = false;
          this.dispatchEvent(new Event("seeked"));
        }
        if (this.#paused) {
          this.#paused = false;
          this.dispatchEvent(new Event("play"));
        }
        this.#readyState = 3;
        this.#paused = false;
        this.#ended = false;
        this.dispatchEvent(new Event("playing"));
        break;
      case 2:
        this.#paused = true;
        this.dispatchEvent(new Event("pause"));
        break;
      case 3:
        this.dispatchEvent(new Event("waiting"));
        break;
      case 0:
        this.#paused = true;
        this.#ended = true;
        this.dispatchEvent(new Event("pause"));
        this.dispatchEvent(new Event("ended"));
        break;
    }
  }

  #onRate(e: any) {
    this.#playbackRate = e.data;
    this.dispatchEvent(new Event("ratechange"));
  }

  #onErr(e: any) {
    this.#error = { code: e.data, message: `YouTube error ${e.data}` };
    this.dispatchEvent(new Event("error"));
  }

  get isPictureInPicture(): boolean {
    return this.#pipActive;
  }

  async requestPictureInPicture(): Promise<void> {
    if (this.#pipActive) return;
    this.#pipActive = true;
    this.dispatchEvent(new Event("enterpictureinpicture"));
  }

  async exitPictureInPicture(): Promise<void> {
    if (!this.#pipActive) return;
    this.#pipActive = false;
    this.dispatchEvent(new Event("leavepictureinpicture"));
  }

  async play() {
    await this.#ready;
    (this.#player as any)?.playVideo();
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
    (this.#player as any)?.pauseVideo();
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
      <iframe
        title="YouTube video player"
        src={initialSrc}
        data-cross-origin-frame
        allow="accelerometer; fullscreen; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        frameBorder={0}
        width="100%"
        height="100%"
        {...(rest as any)}
        ref={composedRef}
      >
        {children}
      </iframe>
    );
  },
);

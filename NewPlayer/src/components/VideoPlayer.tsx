'use client';

import { type CSSProperties, type ComponentProps, forwardRef, type ReactNode, isValidElement, useState, useEffect, useRef, useCallback, createElement } from 'react';
import { AirPlayEnterIcon, AirPlayExitIcon, CaptionsOffIcon, CaptionsOnIcon, CastEnterIcon, CastExitIcon, CheckIcon, ChevronIcon, FullscreenEnterIcon, FullscreenExitIcon, GearIcon, PauseIcon, PipEnterIcon, PipExitIcon, PlayIcon, QualityIcon, RestartIcon, SeekIcon, SpeechIcon, SpeedIcon, SpinnerIcon, VolumeHighIcon, VolumeLowIcon, VolumeOffIcon } from '@videojs/react/icons';
import { createPlayer, Poster, Container, usePlayer, AirPlayButton, useAudioTrackOptions, BufferingIndicator, useCaptionsOptions, CastButton, Controls, ErrorDialog, FullscreenButton, Gesture, Hotkey, Menu, MuteButton, PiPButton, PlayButton, usePlaybackRateOptions, Popover, useQualityOptions, SeekButton, SeekIndicator, Slider, StatusAnnouncer, StatusIndicator, Time, TimeSlider, Tooltip, VolumeIndicator, VolumeSlider, type RenderProp, useMediaAttach, useComposedRefs } from '@videojs/react';
import { Video, videoFeatures } from '@videojs/react/video';
import { VimeoVideo } from '@videojs/react/media/vimeo-video';
import 'video.js/dist/video-js.css';
import '../../player.css';
import FloatingTag from './FloatingTag';

const TOP_STATUS_ACTIONS = ['toggleSubtitles', 'toggleFullscreen', 'togglePictureInPicture'] as const;

const CENTER_STATUS_ACTIONS = ['togglePaused'] as const;

function MenuChevron({ flipped = false }: { flipped?: boolean }): ReactNode {
  return <ChevronIcon className={`media-icon media-menu__chevron ${flipped ? 'media-icon--flipped' : undefined}`} />;
}

function SettingsMenu(): ReactNode {
  const playbackRate = usePlaybackRateOptions();
  const quality = useQualityOptions();
  const audioTrack = useAudioTrackOptions();
  const captions = useCaptionsOptions();
  const hasPlaybackRate = playbackRate?.state.availability === 'available';
  const hasQuality = quality?.state.availability === 'available';
  const hasAudioTrack = audioTrack?.state.availability === 'available';
  const hasCaptions = captions?.state.availability === 'available';

  if (!hasPlaybackRate && !hasQuality && !hasAudioTrack && !hasCaptions) return null;

  return (
    <Menu.Root side="top" align="center">
      <Menu.Trigger aria-label="Settings" className="media-button--settings" render={<Button />}>
        <GearIcon className="media-icon media-icon--settings" />
      </Menu.Trigger>
      <Menu.Content className="media-surface media-popover media-menu media-menu--settings">
        <Menu.View className="media-menu__panel">
          <div className="media-menu__group">
            {hasQuality ? (
              <Menu.Root>
                <Menu.Trigger
                  type="quality"
                  className="media-menu__item media-menu__item--submenu"
                  render={(props: any) => (
                    <div {...props}>
                      <QualityIcon className="media-icon" />
                      <span>Quality</span>
                      <span className="media-menu__hint">
                        <Menu.ItemValue className="media-menu__hint-label" />
                        <MenuChevron />
                      </span>
                    </div>
                  )}
                />
                <Menu.Content className="media-menu__panel">
                  <Menu.Back className="media-menu__back">
                    <MenuChevron flipped />
                    Quality
                  </Menu.Back>
                  <Menu.Separator className="media-menu__separator" />
                  <Menu.RadioGroup
                    className="media-menu__group"
                    value={quality.value}
                    onValueChange={quality.setValue}
                    aria-label="Quality"
                  >
                    {quality.options.map((option: any) => (
                      <Menu.RadioItem
                        key={option.value}
                        className="media-menu__item"
                        value={option.value}
                        disabled={option.disabled}
                      >
                        <span>
                          {option.label}
                          {option.tier ? <sup className="media-menu__tier">{option.tier}</sup> : null}
                        </span>
                        {option.badge ? <span className="media-badge">{option.badge}</span> : null}
                        <Menu.ItemIndicator
                          checked={option.value === quality.value}
                          forceMount
                          className="media-menu__indicator"
                        >
                          <CheckIcon className="media-icon" />
                        </Menu.ItemIndicator>
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioGroup>
                </Menu.Content>
              </Menu.Root>
            ) : null}

            {hasAudioTrack ? (
              <Menu.Root>
                <Menu.Trigger
                  type="audio-track"
                  className="media-menu__item media-menu__item--submenu"
                  render={(props: any) => (
                    <div {...props}>
                      <SpeechIcon className="media-icon" />
                      <span>Audio</span>
                      <span className="media-menu__hint">
                        <Menu.ItemValue className="media-menu__hint-label" />
                        <MenuChevron />
                      </span>
                    </div>
                  )}
                />
                <Menu.Content className="media-menu__panel">
                  <Menu.Back className="media-menu__back">
                    <MenuChevron flipped />
                    Audio
                  </Menu.Back>
                  <Menu.Separator className="media-menu__separator" />
                  <Menu.RadioGroup
                    className="media-menu__group"
                    value={audioTrack.value}
                    onValueChange={audioTrack.setValue}
                    aria-label="Audio tracks"
                  >
                    {audioTrack.options.map((option: any) => (
                      <Menu.RadioItem
                        key={option.value}
                        className="media-menu__item"
                        value={option.value}
                        disabled={option.disabled}
                      >
                        <span>{option.label}</span>
                        <Menu.ItemIndicator
                          checked={option.value === audioTrack.value}
                          forceMount
                          className="media-menu__indicator"
                        >
                          <CheckIcon className="media-icon" />
                        </Menu.ItemIndicator>
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioGroup>
                </Menu.Content>
              </Menu.Root>
            ) : null}

            {hasPlaybackRate ? (
              <Menu.Root>
                <Menu.Trigger
                  type="playback-rate"
                  className="media-menu__item media-menu__item--submenu"
                  render={(props: any) => (
                    <div {...props}>
                      <SpeedIcon className="media-icon" />
                      <span>Speed</span>
                      <span className="media-menu__hint">
                        <Menu.ItemValue className="media-menu__hint-label" />
                        <MenuChevron />
                      </span>
                    </div>
                  )}
                />
                <Menu.Content className="media-menu__panel">
                  <Menu.Back className="media-menu__back">
                    <MenuChevron flipped />
                    Speed
                  </Menu.Back>
                  <Menu.Separator className="media-menu__separator" />
                  <Menu.RadioGroup
                    className="media-menu__group"
                    value={playbackRate.value}
                    onValueChange={playbackRate.setValue}
                    aria-label="Playback rate"
                  >
                    {playbackRate.options.map((option: any) => (
                      <Menu.RadioItem
                        key={option.value}
                        className="media-menu__item"
                        value={option.value}
                        disabled={option.disabled}
                      >
                        <span>{option.label}</span>
                        <Menu.ItemIndicator
                          checked={option.value === playbackRate.value}
                          forceMount
                          className="media-menu__indicator"
                        >
                          <CheckIcon className="media-icon" />
                        </Menu.ItemIndicator>
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioGroup>
                </Menu.Content>
              </Menu.Root>
            ) : null}

            {hasCaptions ? (
              <Menu.Root>
                <Menu.Trigger
                  type="captions"
                  className="media-menu__item media-menu__item--submenu"
                  render={(props: any) => (
                    <div {...props}>
                      <CaptionsOffIcon className="media-icon" />
                      <span>Captions</span>
                      <span className="media-menu__hint">
                        <Menu.ItemValue className="media-menu__hint-label" />
                        <MenuChevron />
                      </span>
                    </div>
                  )}
                />
                <Menu.Content className="media-menu__panel">
                  <Menu.Back className="media-menu__back">
                    <MenuChevron flipped />
                    Captions
                  </Menu.Back>
                  <Menu.Separator className="media-menu__separator" />
                  <Menu.RadioGroup
                    className="media-menu__group"
                    value={captions.value}
                    onValueChange={captions.setValue}
                    aria-label="Captions"
                  >
                    {captions.options.map((option: any) => (
                      <Menu.RadioItem
                        key={option.value}
                        className="media-menu__item"
                        value={option.value}
                        disabled={option.disabled}
                      >
                        <span>{option.label}</span>
                        <Menu.ItemIndicator
                          checked={option.value === captions.value}
                          forceMount
                          className="media-menu__indicator"
                        >
                          <CheckIcon className="media-icon" />
                        </Menu.ItemIndicator>
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioGroup>
                </Menu.Content>
              </Menu.Root>
            ) : null}
          </div>
        </Menu.View>
      </Menu.Content>
    </Menu.Root>
  );
}

// ================================================================
// Internal Custom Player
// ================================================================

const SEEK_TIME = 10;

function applyYoutubePolyfills(el: HTMLElement & { api?: { getPlayerState?: () => number }; duration?: number }) {
  if ((el as any).__youtubePolyfilled) return;
  (el as any).__youtubePolyfilled = true;

  const createTimeRanges = (start: number, end: number) => {
    const ranges = Object.create(null) as TimeRanges & { 0?: [number, number] };
    if (end > start) {
      (ranges as any)[0] = [start, end];
    }
    Object.defineProperties(ranges, {
      length: { value: end > start ? 1 : 0 },
      start: { value: (i: number) => (i === 0 && end > start ? start : 0) },
      end: { value: (i: number) => (i === 0 && end > start ? end : 0) },
    });
    return ranges;
  };

  const definePolyfill = (key: string, descriptor: PropertyDescriptor) => {
    try {
      Object.defineProperty(el, key, { configurable: true, ...descriptor });
    } catch { /* ignore non-configurable prototype properties */ }
  };

  definePolyfill('currentSrc', {
    get: () => el.getAttribute('src') ?? '',
  });

  definePolyfill('ended', {
    get: () => el.api?.getPlayerState?.() === 0,
  });

  definePolyfill('seekable', {
    get: () => {
      const duration = Number.isFinite(el.duration) ? el.duration! : 0;
      return duration > 0 ? createTimeRanges(0, duration) : createTimeRanges(0, 0);
    },
  });
}

export const Player = createPlayer({ features: videoFeatures });

export interface InternalPlayerProps {
  src: string;
  type?: string;
  style?: CSSProperties;
  className?: string;
  poster?: string | RenderProp<Poster.State> | undefined;
  placeholder?: string;
  children?: ReactNode; // Allow injecting children like FloatingTag
}

// Custom integration for YouTube into @videojs/react
const YoutubeVideo = forwardRef(function YoutubeVideo({ children, src, ...props }: any, ref: any) {
  const [isLoaded, setIsLoaded] = useState(false);
  const mediaAttach = useMediaAttach();
  const localRef = useRef<any>(null);
  const polyfillRef = useCallback((el: HTMLElement | null) => {
    if (el) applyYoutubePolyfills(el as any);
  }, []);
  const composedRef = useComposedRefs(ref, localRef, polyfillRef, mediaAttach);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (customElements.get('youtube-video')) {
        setIsLoaded(true);
      } else {
        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'https://cdn.jsdelivr.net/npm/youtube-video-element@latest/youtube-video-element.js';
        script.onload = () => {
          customElements.whenDefined('youtube-video').then(() => {
            setIsLoaded(true);
          });
        };
        document.head.appendChild(script);
      }
    }
  }, []);

  // Polyfill missing HTMLMediaElement properties so @videojs/core features attach.
  // youtube-video-element lacks currentSrc and ended, which prevents the playback
  // feature from syncing (poster never hides) and blocks time.seek() (slider clicks).
  useEffect(() => {
    if (!isLoaded || !localRef.current) return;
    const el = localRef.current;

    const createTimeRanges = (start: number, end: number) => {
      const ranges = Object.create(null) as TimeRanges & { 0?: [number, number] };
      if (end > start) {
        (ranges as any)[0] = [start, end];
      }
      Object.defineProperties(ranges, {
        length: { value: end > start ? 1 : 0 },
        start: { value: (i: number) => (i === 0 && end > start ? start : 0) },
        end: { value: (i: number) => (i === 0 && end > start ? end : 0) },
      });
      return ranges;
    };

    const definePolyfill = (key: string, descriptor: PropertyDescriptor) => {
      try {
        Object.defineProperty(el, key, { configurable: true, ...descriptor });
      } catch { /* ignore non-configurable prototype properties */ }
    };

    definePolyfill('currentSrc', {
      get: () => el.getAttribute('src') ?? '',
    });

    definePolyfill('ended', {
      get: () => el.api?.getPlayerState?.() === 0,
    });

    definePolyfill('seekable', {
      get: () => {
        const duration = Number.isFinite(el.duration) ? el.duration : 0;
        return duration > 0 ? createTimeRanges(0, duration) : createTimeRanges(0, 0);
      },
    });

    // @videojs/react's timeFeature.seek() sets currentTime then awaits a
    // 'seeked' event.  youtube-video-element doesn't emit it, so wrapping
    // the setter bridges the gap.
    const findDescriptor = (obj: any, prop: string) => {
      let proto = obj;
      while (proto) {
        const desc = Object.getOwnPropertyDescriptor(proto, prop);
        if (desc) return desc;
        proto = Object.getPrototypeOf(proto);
      }
      return undefined;
    };

    const timeDesc = findDescriptor(el, 'currentTime');
    const origGetter = timeDesc?.get;
    const origSetter = timeDesc?.set;
    if (origGetter || origSetter) {
      try {
        Object.defineProperty(el, 'currentTime', {
          configurable: true,
          get: origGetter ? () => origGetter.call(el) : undefined,
          set(value: number) {
            el.dispatchEvent(new Event('seeking'));
            if (origSetter) origSetter.call(el, value);
            setTimeout(() => {
              el.dispatchEvent(new Event('seeked'));
              el.dispatchEvent(new Event('timeupdate'));
            }, 200);
          },
        });
      } catch { /* ignore */ }
    }
  }, [isLoaded]);

  // Poll YouTube player state and dispatch events that playbackFeature /
  // timeFeature listen for (playing, pause, timeupdate, durationchange).
  // youtube-video-element doesn't fire these reliably.
  useEffect(() => {
    if (!isLoaded || !localRef.current) return;
    const el = localRef.current;

    let wasPlaying = false;
    let lastDuration = -1;

    const interval = setInterval(() => {
      if (!el.api) return;

      const state = el.api.getPlayerState?.();
      const isPlaying = state === 1;

      if (isPlaying && !wasPlaying) {
        el.dispatchEvent(new Event('play'));
        el.dispatchEvent(new Event('playing'));
      }
      if (!isPlaying && wasPlaying) {
        el.dispatchEvent(new Event('pause'));
      }
      wasPlaying = isPlaying;

      el.dispatchEvent(new Event('timeupdate'));

      const duration = Number.isFinite(el.duration) ? el.duration : 0;
      if (duration > 0 && duration !== lastDuration) {
        el.dispatchEvent(new Event('durationchange'));
        lastDuration = duration;
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isLoaded]);

  if (!isLoaded) {
    return null; // wait for script to load
  }

  return (
    <>
      <style>{`
        youtube-video {
          width: 100%;
          height: 100%;
          display: block;
          position: relative;
          transform: scale(1.6);
          transform-origin: center;
        }
      `}</style>
      {createElement(
        'youtube-video',
        {
          src: src,
          ref: composedRef,
          playsInline: true,
          ...props
        },
        children
      )}
    </>
  );
});

export function InternalPlayer({ src, type, className, poster, placeholder, style, children, ...rest }: InternalPlayerProps): ReactNode {
  const containerStyle = placeholder
    ? ({ '--media-poster-placeholder': `url(${placeholder})`, ...style } as CSSProperties)
    : style;

  return (
    <Player.Provider>
      <Container
        className={`media-default-skin media-default-skin--video ${className ?? ''}`}
        style={containerStyle}
        {...rest}
      >
        {type === 'vimeo' ? (
          <VimeoVideo src={src} playsInline />
        ) : type === 'youtube' ? (
          <YoutubeVideo src={src} />
        ) : (
          <Video src={src} playsInline />
        )}
        
        {children}

        {poster && (
          <Poster src={isString(poster) ? poster : undefined} render={isRenderProp(poster) ? poster : undefined} />
        )}

        <BufferingIndicator
          render={(props) => (
            <div {...props} className="media-buffering-indicator">
              <SpinnerIcon className="media-icon" />
            </div>
          )}
        />

        <ErrorDialog.Root>
          <ErrorDialog.Popup className="media-error">
            <div className="media-error__dialog media-surface">
              <div className="media-error__content">
                <ErrorDialog.Title className="media-error__title">Something went wrong.</ErrorDialog.Title>
                <ErrorDialog.Description className="media-error__description" />
              </div>
              <div className="media-error__actions">
                <ErrorDialog.Close className="media-button media-button--primary">OK</ErrorDialog.Close>
              </div>
            </div>
          </ErrorDialog.Popup>
        </ErrorDialog.Root>

        <Controls.Root className="media-surface media-controls">
          <Tooltip.Provider>
            <div className="media-button-group">
              <Tooltip.Root side="top">
                <Tooltip.Trigger
                  render={
                    <PlayButton className="media-button--play" render={<Button />}>
                      <RestartIcon className="media-icon media-icon--restart" />
                      <PlayIcon className="media-icon media-icon--play" />
                      <PauseIcon className="media-icon media-icon--pause" />
                    </PlayButton>
                  }
                />
                <Tooltip.Popup className="media-surface media-tooltip">
                  <Tooltip.Label />
                  <Tooltip.Shortcut className="media-tooltip__kbd" />
                </Tooltip.Popup>
              </Tooltip.Root>

              <Tooltip.Root side="top">
                <Tooltip.Trigger
                  render={
                    <SeekButton seconds={-SEEK_TIME} className="media-button--seek" render={<Button />}>
                      <span className="media-icon__container">
                        <SeekIcon className="media-icon media-icon--seek media-icon--flipped" />
                        <span className="media-icon__label">{SEEK_TIME}</span>
                      </span>
                    </SeekButton>
                  }
                />
                <Tooltip.Popup className="media-surface media-tooltip">
                  <Tooltip.Label />
                  <Tooltip.Shortcut className="media-tooltip__kbd" />
                </Tooltip.Popup>
              </Tooltip.Root>

              <Tooltip.Root side="top">
                <Tooltip.Trigger
                  render={
                    <SeekButton seconds={SEEK_TIME} className="media-button--seek" render={<Button />}>
                      <span className="media-icon__container">
                        <SeekIcon className="media-icon media-icon--seek" />
                        <span className="media-icon__label">{SEEK_TIME}</span>
                      </span>
                    </SeekButton>
                  }
                />
                <Tooltip.Popup className="media-surface media-tooltip">
                  <Tooltip.Label />
                  <Tooltip.Shortcut className="media-tooltip__kbd" />
                </Tooltip.Popup>
              </Tooltip.Root>
            </div>

            <div className="media-time-controls">
              <Time.Value type="current" className="media-time" />
              <TimeSlider.Root className="media-slider">
                <TimeSlider.Track className="media-slider__track">
                  <TimeSlider.Fill className="media-slider__fill" />
                  <TimeSlider.Buffer className="media-slider__buffer" />
                </TimeSlider.Track>
                <TimeSlider.Thumb className="media-slider__thumb" />

                <div className="media-surface media-thumbnail media-slider__thumbnail">
                  <Slider.Thumbnail className="media-thumbnail__image" />
                  <TimeSlider.Value type="pointer" className="media-time media-thumbnail__time" />
                  <SpinnerIcon className="media-thumbnail__spinner media-icon" />
                </div>
                <TimeSlider.Preview className="media-slider__preview">
                  <TimeSlider.Value type="pointer" className="media-time media-slider__value" />
                </TimeSlider.Preview>
              </TimeSlider.Root>
              <Time.Value toggle type="remaining" className="media-time" />
            </div>

            <div className="media-button-group">
              <VolumePopover />

              <SettingsMenu />

              <Tooltip.Root side="top">
                <Tooltip.Trigger
                  render={
                    <CastButton className="media-button--cast" render={<Button />}>
                      <CastEnterIcon className="media-icon media-icon--cast-enter" />
                      <CastExitIcon className="media-icon media-icon--cast-exit" />
                    </CastButton>
                  }
                />
                <Tooltip.Popup className="media-surface media-tooltip">
                  <Tooltip.Label />
                  <Tooltip.Shortcut className="media-tooltip__kbd" />
                </Tooltip.Popup>
              </Tooltip.Root>

              <Tooltip.Root side="top">
                <Tooltip.Trigger
                  render={
                    <AirPlayButton className="media-button--airplay" render={<Button />}>
                      <AirPlayEnterIcon className="media-icon media-icon--airplay-enter" />
                      <AirPlayExitIcon className="media-icon media-icon--airplay-exit" />
                    </AirPlayButton>
                  }
                />
                <Tooltip.Popup className="media-surface media-tooltip">
                  <Tooltip.Label />
                  <Tooltip.Shortcut className="media-tooltip__kbd" />
                </Tooltip.Popup>
              </Tooltip.Root>

              <Tooltip.Root side="top">
                <Tooltip.Trigger
                  render={
                    <PiPButton className="media-button--pip" render={<Button />}>
                      <PipEnterIcon className="media-icon media-icon--pip-enter" />
                      <PipExitIcon className="media-icon media-icon--pip-exit" />
                    </PiPButton>
                  }
                />
                <Tooltip.Popup className="media-surface media-tooltip">
                  <Tooltip.Label />
                  <Tooltip.Shortcut className="media-tooltip__kbd" />
                </Tooltip.Popup>
              </Tooltip.Root>

              <Tooltip.Root side="top">
                <Tooltip.Trigger
                  render={
                    <FullscreenButton className="media-button--fullscreen" render={<Button />}>
                      <FullscreenEnterIcon className="media-icon media-icon--fullscreen-enter" />
                      <FullscreenExitIcon className="media-icon media-icon--fullscreen-exit" />
                    </FullscreenButton>
                  }
                />
                <Tooltip.Popup className="media-surface media-tooltip">
                  <Tooltip.Label />
                  <Tooltip.Shortcut className="media-tooltip__kbd" />
                </Tooltip.Popup>
              </Tooltip.Root>
            </div>
          </Tooltip.Provider>
        </Controls.Root>

        <div className="media-overlay" />

        <Hotkey keys="Space" action="togglePaused" />
        <Hotkey keys="k" action="togglePaused" />
        <Hotkey keys="m" action="toggleMuted" />
        <Hotkey keys="f" action="toggleFullscreen" />
        <Hotkey keys="c" action="toggleSubtitles" />
        <Hotkey keys="i" action="togglePictureInPicture" />
        <Hotkey keys="ArrowRight" action="seekStep" value={SEEK_TIME / 2} />
        <Hotkey keys="ArrowLeft" action="seekStep" value={-(SEEK_TIME / 2)} />
        <Hotkey keys="l" action="seekStep" value={SEEK_TIME} />
        <Hotkey keys="j" action="seekStep" value={-SEEK_TIME} />
        <Hotkey keys="ArrowUp" action="volumeStep" value={0.05} />
        <Hotkey keys="ArrowDown" action="volumeStep" value={-0.05} />
        <Hotkey keys="0-9" action="seekToPercent" />
        <Hotkey keys="Home" action="seekToPercent" value={0} />
        <Hotkey keys="End" action="seekToPercent" value={100} />
        <Hotkey keys=">" action="speedUp" />
        <Hotkey keys="<" action="speedDown" />

        <Gesture type="tap" action="togglePaused" pointer="mouse" region="center" />
        <Gesture type="tap" action="toggleControls" pointer="touch" />
        <Gesture type="doubletap" action="seekStep" value={-SEEK_TIME} region="left" />
        <Gesture type="doubletap" action="toggleFullscreen" region="center" />
        <Gesture type="doubletap" action="seekStep" value={SEEK_TIME} region="right" />

        <StatusAnnouncer />
        <div className="media-input-feedback">
          <VolumeIndicator.Root className="media-surface media-input-feedback-island media-input-feedback-island--volume">
            <VolumeIndicator.Fill className="media-input-feedback-island__content">
              <VolumeHighIcon className="media-icon media-icon--volume-high" />
              <VolumeLowIcon className="media-icon media-icon--volume-low" />
              <VolumeOffIcon className="media-icon media-icon--volume-off" />
              <VolumeIndicator.Value className="media-input-feedback-island__value" />
            </VolumeIndicator.Fill>
          </VolumeIndicator.Root>

          <StatusIndicator.Root
            actions={TOP_STATUS_ACTIONS}
            className="media-surface media-input-feedback-island media-input-feedback-island--status"
          >
            <div className="media-input-feedback-island__content">
              <CaptionsOnIcon className="media-icon media-icon--captions-on" />
              <CaptionsOffIcon className="media-icon media-icon--captions-off" />
              <FullscreenEnterIcon className="media-icon media-icon--fullscreen-enter" />
              <FullscreenExitIcon className="media-icon media-icon--fullscreen-exit" />
              <PipEnterIcon className="media-icon media-icon--pip-enter" />
              <PipExitIcon className="media-icon media-icon--pip-exit" />
              <StatusIndicator.Value className="media-input-feedback-island__value" />
            </div>
          </StatusIndicator.Root>

          <SeekIndicator.Root className="media-input-feedback-bubble">
            <ChevronIcon className="media-icon media-icon--seek" />
            <SeekIndicator.Value className="media-time" />
          </SeekIndicator.Root>

          <StatusIndicator.Root actions={CENTER_STATUS_ACTIONS} className="media-input-feedback-bubble">
            <PlayIcon className="media-icon media-icon--play" />
            <PauseIcon className="media-icon media-icon--pause" />
          </StatusIndicator.Root>
        </div>
      </Container>
    </Player.Provider>
  );
}

// ================================================================
// Components
// ================================================================

const Button = forwardRef<HTMLButtonElement, ComponentProps<'button'>>(function Button({ className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={`media-button media-button--subtle media-button--icon ${className ?? ''}`}
      {...props}
    />
  );
});

function VolumePopover(): ReactNode {
  const volumeUnsupported = usePlayer((s: any) => s.volumeAvailability === 'unsupported');

  const muteButton = (
    <MuteButton className="media-button--mute" render={<Button />}>
      <VolumeOffIcon className="media-icon media-icon--volume-off" />
      <VolumeLowIcon className="media-icon media-icon--volume-low" />
      <VolumeHighIcon className="media-icon media-icon--volume-high" />
    </MuteButton>
  );

  if (volumeUnsupported) return muteButton;

  return (
    <Popover.Root openOnHover delay={200} closeDelay={100} side="top">
      <Popover.Trigger render={muteButton} />
      <Popover.Popup className="media-surface media-popover media-popover--volume">
        <VolumeSlider.Root className="media-slider" orientation="vertical" thumbAlignment="edge">
          <VolumeSlider.Track className="media-slider__track">
            <VolumeSlider.Fill className="media-slider__fill" />
          </VolumeSlider.Track>
          <VolumeSlider.Thumb className="media-slider__thumb media-slider__thumb--persistent" />
        </VolumeSlider.Root>
      </Popover.Popup>
    </Popover.Root>
  );
}

// ================================================================
// Utilities
// ================================================================

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isRenderProp(value: unknown): value is RenderProp<unknown> {
  return typeof value === 'function' || isValidElement(value);
}

// ================================================================
// Multi-Source Wrapper Player
// ================================================================

type SourceType = 'youtube' | 'vimeo' | 'selfhosted';

interface SourceConfig {
  label: string;
  type: SourceType;
  title: string;
  src: string;
}

const SOURCES: SourceConfig[] = [
  {
    label: 'YouTube',
    type: 'youtube',
    title: 'Night Changes',
    src: 'https://www.youtube.com/watch?v=syFZfO_wfMQ',
  },
  {
    label: 'Vimeo',
    type: 'vimeo',
    title: 'Studio Session',
    src: 'https://vimeo.com/1171731238',
  },
  {
    label: 'Self-Hosted',
    type: 'selfhosted',
    title: 'Night Changes',
    src: 'https://2minutecoding.com/NightChanges.mp4',
  },
];

export default function VideoPlayer() {
  const [activeSource, setActiveSource] = useState<SourceConfig>(SOURCES[0]);

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-8">
      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
        {SOURCES.map((source) => (
          <button
            key={source.type}
            onClick={() => setActiveSource(source)}
            className={`
              relative px-6 py-2.5 rounded-full font-medium text-sm transition-all duration-300
              ${activeSource.type === source.type
                ? 'text-white bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)]'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }
            `}
          >
            {source.label}
          </button>
        ))}
      </div>

      {/* Video Container */}
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-2xl bg-black/50 border border-white/10 ring-1 ring-white/5">
        <InternalPlayer src={activeSource.src} type={activeSource.type} poster={`/api/video-thumbnail?videoUrl=${encodeURIComponent(activeSource.src)}`}>
          <FloatingTag label={activeSource.label} title={activeSource.title} />
        </InternalPlayer>
      </div>
    </div>
  );
}

"use client";

import { type CSSProperties, type ComponentProps, forwardRef, type ReactNode, isValidElement, useRef } from 'react';
import { AirPlayEnterIcon, AirPlayExitIcon, CaptionsOffIcon, CaptionsOnIcon, CastEnterIcon, CastExitIcon, CheckIcon, ChevronIcon, FullscreenEnterIcon, FullscreenExitIcon, GearIcon, PauseIcon, PipEnterIcon, PipExitIcon, PlayIcon, QualityIcon, RestartIcon, SeekIcon, SpeechIcon, SpeedIcon, SpinnerIcon, VolumeHighIcon, VolumeLowIcon, VolumeOffIcon } from '@videojs/react/icons';
import { createPlayer, Poster, Container, usePlayer, AirPlayButton, useAudioTrackOptions, BufferingIndicator, useCaptionsOptions, CastButton, Controls, ErrorDialog, FullscreenButton, Gesture, Hotkey, Menu, MuteButton, PiPButton, PlayButton, usePlaybackRateOptions, Popover, useQualityOptions, SeekButton, SeekIndicator, Slider, StatusAnnouncer, StatusIndicator, Time, TimeSlider, Tooltip, VolumeIndicator, VolumeSlider, type RenderProp } from '@videojs/react';
import { Video, videoFeatures } from '@videojs/react/video';
import 'video.js/dist/video-js.css';
import { YoutubePlayer } from './youtube-player';

import { Lock, FileText, Video as VideoIcon, Play, Loader2 } from "lucide-react";
import VideoWatermark from "@/components/ContentProtection/VideoWatermark";
import styles from "./LessonPlayer.module.css";
import './player.css';
// import FloatingTag from "./FloatingTag";

interface LessonPlayerProps {
  lesson: {
    id: string;
    title: string;
    type: string;
    url?: string;
    attachments?: {
      name: string;
      url: string;
      type?: string;
      size?: number;
    }[];
    locked?: boolean;
  } | null;
  nextLesson?: () => void;
  onComplete?: () => void;
}

const SEEK_TIME = 10;
const TOP_STATUS_ACTIONS = ['toggleSubtitles', 'toggleFullscreen', 'togglePictureInPicture'] as const;
const CENTER_STATUS_ACTIONS = ['togglePaused'] as const;

function MenuChevron({ flipped = false }: { flipped?: boolean }): ReactNode {
  return <ChevronIcon className={`media-icon media-menu__chevron ${flipped ? 'media-icon--flipped' : undefined}`} />;
}

export const Player = createPlayer({ features: videoFeatures });

export interface InternalPlayerProps {
  src: string;
  type?: string;
  style?: CSSProperties;
  className?: string;
  poster?: string | RenderProp<Poster.State> | undefined;
  placeholder?: string;
  children?: ReactNode;
}

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
        {type === 'youtube' ? (
          <YoutubePlayer src={src} />
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

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isRenderProp(value: unknown): value is RenderProp<unknown> {
  return typeof value === 'function' || isValidElement(value);
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function LessonPlayer({
  lesson,
  nextLesson,
  onComplete,
}: LessonPlayerProps) {
  const playerRef = useRef<any>(null);

  const getYoutubeId = (rawUrl: string) => {
    if (!rawUrl) return null;
    const trimmed = rawUrl.trim();
    if (trimmed.startsWith("youtube/")) {
      return trimmed.replace("youtube/", "");
    }
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = trimmed.match(regExp);
    if (match && match[2].length === 11) return match[2];
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    return null;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const getPlayerSrc = (): string => {
    if (!lesson?.url) return "";
    const raw = lesson.url.trim();
    if (
      lesson.type === "youtube" ||
      raw.includes("youtube.com") ||
      raw.includes("youtu.be") ||
      raw.startsWith("youtube/")
    ) {
      const id = getYoutubeId(raw);
      if (id) return id;
      return raw.startsWith("youtube/") ? raw.replace("youtube/", "") : raw;
    }
    return raw;
  };

  const getPosterUrl = (): string => {
    if (!lesson?.url) return "";
    const raw = lesson.url.trim();
    if (
      lesson.type === "youtube" ||
      raw.includes("youtube.com") ||
      raw.includes("youtu.be") ||
      raw.startsWith("youtube/")
    ) {
      const id = getYoutubeId(raw);
      return id
        ? `https://img.youtube.com/vi/${id}/hqdefault.jpg`
        : "";
    }
    return "";
  };

  if (!lesson) {
    return (
      <div className={styles.mockVideo}>
        <VideoIcon size={60} />
        <span>No unlocked lessons are available yet.</span>
      </div>
    );
  }

  if (lesson.locked) {
    return (
      <div className={styles.mockVideo}>
        <Lock size={60} />
        <span>
          This lesson is locked. Enroll in the course to gain
          access.
        </span>
      </div>
    );
  }

  const lType = (lesson.type || "").toLowerCase();
  const isDocumentType =
    lType === "document" ||
    lType === "slide" ||
    (lesson.attachments && lesson.attachments.length > 0);
  const docExtensions = [
    ".pdf",
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsx",
    ".zip",
    ".rar",
  ];
  const lowerUrl = lesson.url?.toLowerCase() || "";
  const isDocUrl = docExtensions.some((ext) => lowerUrl.includes(ext));
  const isSlideTitle =
    lesson.title.toLowerCase().includes("slide") ||
    lesson.title.toLowerCase().includes("pdf");

  if (isDocumentType || isDocUrl || isSlideTitle) {
    const atts =
      lesson.attachments && lesson.attachments.length > 0
        ? lesson.attachments
        : lesson.url
          ? [{ name: lesson.title || "Download File", url: lesson.url }]
          : [];

    return (
      <div className={styles.documentContainer}>
        <div className={styles.documentHeader}>
          <FileText
            size={40}
            style={{
              color: "var(--primary, #3b82f6)",
              marginBottom: "10px",
            }}
          />
          <h2>{lesson.title}</h2>
          <p>
            {lesson.type === "slide"
              ? "Slides & Presentations"
              : "Documents & Resources"}
          </p>
        </div>
        <div className={styles.attachmentsList}>
          {atts.length === 0 ? (
            <div
              style={{
                padding: "20px",
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              No files or attachments have been uploaded for
              this document yet.
            </div>
          ) : (
            atts.map((att, idx) => {
              const fullUrl = att.url
                ? att.url.startsWith("/")
                  ? `${process.env.NEXT_PUBLIC_UPLOADS_URL || ""}${att.url}`
                  : att.url
                : "";
              const downloadHref = `/api/download?url=${encodeURIComponent(fullUrl)}&name=${encodeURIComponent(att.name || "document")}`;
              return (
                <a
                  key={idx}
                  href={downloadHref}
                  className={styles.attachmentCard}
                  onClick={() => onComplete?.()}
                >
                  <div className={styles.attIcon}>
                    <FileText size={24} />
                  </div>
                  <div className={styles.attInfo}>
                    <span className={styles.attName}>
                      {att.name}
                    </span>
                  </div>
                  <div className={styles.attAction}>
                    Download
                  </div>
                </a>
              );
            })
          )}
        </div>
      </div>
    );
  }

  const playerSrc = getPlayerSrc();
  const posterUrl = getPosterUrl();

  return (
    <div
      className={styles.playerContainer}
      onContextMenu={handleContextMenu}
    >
      <InternalPlayer src={playerSrc} type={lesson.type === 'youtube' ? 'youtube' : 'selfhosted'} poster={posterUrl}>
      </InternalPlayer>

      {/* ── Watermark — topmost, no pointer events ─────────────── */}
      <div className={styles.watermarkWrapper}>
        <VideoWatermark />
      </div>
    </div>
  );
}

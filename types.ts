export interface SyncMessage {
  type: 'SYNC' | 'PLAY' | 'PAUSE' | 'SEEK' | 'CHANGE_VIDEO';
  videoId?: string;
  timestamp?: number; // Current playback time
  playerState?: number; // 1 = playing, 2 = paused, etc.
  hostTime?: number; // Date.now() when message was sent
}

export interface RoomState {
  videoId: string;
  isPlaying: boolean;
  currentTime: number;
}

export enum PlayerState {
  UNSTARTED = -1,
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = 3,
  CUED = 5,
}

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import YouTube, { YouTubePlayer, YouTubeEvent } from 'react-youtube';
import Peer, { DataConnection } from 'peerjs';
import { Copy, Users, Play, Pause, AlertCircle, CheckCircle2, Link as LinkIcon, ExternalLink, Loader2 } from 'lucide-react';
import { getVideoIdFromUrl } from '../utils';
import { SyncMessage, PlayerState } from '../types';

const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // State
  const isHost = searchParams.get('role') === 'host';
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [peerId, setPeerId] = useState<string | null>(null);
  const [connections, setConnections] = useState<DataConnection[]>([]);
  const [videoId, setVideoId] = useState<string>('jfKfPfyJRdk'); // Default chill beat
  const [inputUrl, setInputUrl] = useState('');
  const [viewerCount, setViewerCount] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const [guestSynced, setGuestSynced] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Refs
  const peerRef = useRef<Peer | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const hostSyncInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize PeerJS
  useEffect(() => {
    if (!roomId) return;

    const initPeer = async () => {
      try {
        // Use default PeerJS cloud server
        const peer = new Peer(isHost ? `synctune-${roomId}` : undefined);
        
        peer.on('open', (id) => {
          console.log('My peer ID is: ' + id);
          setPeerId(id);
          setStatus(isHost ? 'connected' : 'connecting');
          
          if (!isHost) {
            connectToHost(peer, `synctune-${roomId}`);
          }
        });

        peer.on('connection', (conn) => {
          if (isHost) {
            handleHostConnection(conn);
          }
        });

        peer.on('error', (err) => {
          console.error('Peer error:', err);
          if (err.type === 'unavailable-id' && isHost) {
             // ID taken, likely refreshing host page. 
             // Ideally we'd recover, but for MVP we might need a new room or force guest mode.
             // Here we just warn.
          }
          setStatus('error');
        });

        peerRef.current = peer;
      } catch (err) {
        console.error("Failed to init peer", err);
        setStatus('error');
      }
    };

    initPeer();

    return () => {
      if (hostSyncInterval.current) clearInterval(hostSyncInterval.current);
      peerRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isHost]);

  // HOST: Handle incoming connections
  const handleHostConnection = (conn: DataConnection) => {
    conn.on('open', () => {
      setConnections(prev => [...prev, conn]);
      setViewerCount(prev => prev + 1);

      // Send immediate sync state to new guest
      if (playerRef.current) {
        const payload: SyncMessage = {
          type: 'CHANGE_VIDEO',
          videoId: videoId,
          timestamp: playerRef.current.getCurrentTime(),
          playerState: playerRef.current.getPlayerState()
        };
        conn.send(payload);
      }
    });

    conn.on('close', () => {
      setConnections(prev => prev.filter(c => c !== conn));
      setViewerCount(prev => Math.max(1, prev - 1));
    });
  };

  // GUEST: Connect to Host
  const connectToHost = (peer: Peer, hostId: string) => {
    const conn = peer.connect(hostId, { reliable: true });
    
    conn.on('open', () => {
      setStatus('connected');
      setConnections([conn]);
    });

    conn.on('data', (data) => {
      handleSyncMessage(data as SyncMessage);
    });

    conn.on('close', () => {
      setStatus('error');
    });

    conn.on('error', () => {
        setStatus('error');
    });
  };

  // GUEST: Handle messages from Host
  const handleSyncMessage = (msg: SyncMessage) => {
    const player = playerRef.current;
    if (!player) return;

    switch (msg.type) {
      case 'CHANGE_VIDEO':
        if (msg.videoId && msg.videoId !== videoId) {
          setVideoId(msg.videoId);
          setGuestSynced(false); // Reset sync flag on new video
        }
        break;
      
      case 'PLAY':
        player.playVideo();
        if (msg.timestamp) {
           const timeDiff = Math.abs(player.getCurrentTime() - msg.timestamp);
           if (timeDiff > 1.0) player.seekTo(msg.timestamp, true);
        }
        break;

      case 'PAUSE':
        player.pauseVideo();
        break;

      case 'SEEK':
        if (msg.timestamp !== undefined) {
          player.seekTo(msg.timestamp, true);
        }
        break;

      case 'SYNC':
        // Heartbeat sync
        if (msg.timestamp !== undefined && msg.playerState !== undefined) {
          const currentTime = player.getCurrentTime();
          const diff = Math.abs(currentTime - msg.timestamp);
          
          // Only sync if drift is noticeable (> 1s) to avoid stuttering
          if (diff > 1.5) {
            player.seekTo(msg.timestamp, true);
          }

          // Sync play state
          const localState = player.getPlayerState();
          if (msg.playerState === PlayerState.PLAYING && localState !== PlayerState.PLAYING) {
            player.playVideo();
          } else if (msg.playerState === PlayerState.PAUSED && localState !== PlayerState.PAUSED) {
            player.pauseVideo();
          }
        }
        break;
    }
  };

  // HOST: Broadcast functions
  const broadcast = (msg: SyncMessage) => {
    connections.forEach(conn => {
      if (conn.open) conn.send(msg);
    });
  };

  // HOST: Periodic Sync Loop
  useEffect(() => {
    if (isHost && status === 'connected') {
      hostSyncInterval.current = setInterval(() => {
        if (playerRef.current) {
          broadcast({
            type: 'SYNC',
            timestamp: playerRef.current.getCurrentTime(),
            playerState: playerRef.current.getPlayerState()
          });
        }
      }, 3000); // Sync every 3 seconds
    }
    return () => {
      if (hostSyncInterval.current) clearInterval(hostSyncInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, status, connections]);


  // Player Event Handlers
  const onPlayerReady = (event: YouTubeEvent) => {
    playerRef.current = event.target;
    setIsReady(true);
    
    // If guest, mute initially to allow autoplay (browser policy)
    // We will ask user to unmute/join later.
    if (!isHost) {
      // playerRef.current.mute(); // Optional strategy, better to have a "Join" overlay
    }
  };

  const onPlayerStateChange = (event: YouTubeEvent) => {
    if (!isHost) return;

    const state = event.data;
    const time = event.target.getCurrentTime();

    if (state === PlayerState.PLAYING) {
      broadcast({ type: 'PLAY', timestamp: time });
    } else if (state === PlayerState.PAUSED) {
      broadcast({ type: 'PAUSE', timestamp: time });
    } else if (state === PlayerState.BUFFERING) {
      // Often triggered by seek
      broadcast({ type: 'SEEK', timestamp: time });
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = getVideoIdFromUrl(inputUrl);
    if (id) {
      setVideoId(id);
      broadcast({ type: 'CHANGE_VIDEO', videoId: id });
      setInputUrl('');
    }
  };

  const copyRoomLink = () => {
    const url = window.location.href.split('?')[0]; // Remove role param for sharing
    navigator.clipboard.writeText(url);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Guest Join Interaction
  const handleGuestJoin = () => {
    if (playerRef.current) {
      playerRef.current.playVideo();
      setGuestSynced(true);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      {/* Room Controls Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${status === 'connected' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {status === 'connected' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              <span>{status === 'connected' ? (isHost ? 'Host (Live)' : 'Connected') : 'Connecting...'}</span>
            </div>
            
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
              <Users size={16} />
              <span>{viewerCount} in room</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex-1 md:flex-none flex items-center gap-2 bg-zinc-950 rounded-lg px-3 py-2 border border-zinc-800 text-sm text-zinc-400 select-all">
              <span className="truncate max-w-[150px]">{roomId}</span>
            </div>
            <button 
              onClick={copyRoomLink}
              className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors relative"
              title="Copy Link"
            >
              {copySuccess ? <CheckCircle2 size={20} className="text-green-500" /> : <Copy size={20} />}
            </button>
          </div>

        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 flex flex-col items-center">
        
        {/* Video Player Container */}
        <div className="w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative border border-zinc-800">
          <YouTube
            videoId={videoId}
            className="w-full h-full"
            opts={{
              width: '100%',
              height: '100%',
              playerVars: {
                autoplay: 0,
                controls: isHost ? 1 : 0, // Hide controls for guests
                modestbranding: 1,
                rel: 0,
                disablekb: isHost ? 0 : 1
              },
            }}
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
          />

          {/* Guest Overlay: Force user interaction for Audio Context */}
          {!isHost && !guestSynced && isReady && (
            <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center z-20">
              <button 
                onClick={handleGuestJoin}
                className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-full font-bold text-lg transition-transform hover:scale-105 shadow-xl animate-pulse"
              >
                <Play size={24} className="fill-white" />
                Click to Join Stream
              </button>
            </div>
          )}
          
          {/* Guest Overlay: Loading */}
          {!isReady && (
             <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center z-10">
               <Loader2 className="animate-spin text-indigo-500" size={48} />
             </div>
          )}
        </div>

        {/* Host Controls */}
        {isHost && (
          <div className="mt-8 w-full max-w-2xl">
            <form onSubmit={handleUrlSubmit} className="relative flex gap-2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LinkIcon size={18} className="text-zinc-500" />
              </div>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Paste YouTube URL to change video..."
                className="block w-full pl-10 pr-3 py-3 border border-zinc-700 rounded-lg leading-5 bg-zinc-900 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
              />
              <button
                type="submit"
                disabled={!inputUrl}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Change <ExternalLink size={16} />
              </button>
            </form>
            <p className="mt-3 text-xs text-zinc-500 text-center">
              As host, you control the playback. Pausing or seeking will update all guests automatically.
            </p>
          </div>
        )}

        {/* Guest Status */}
        {!isHost && (
          <div className="mt-8 text-center space-y-2">
            <h3 className="text-lg font-medium text-white">
              {guestSynced ? "You are synced with the host" : "Click the player to start"}
            </h3>
            <p className="text-sm text-zinc-500">
              Sit back and enjoy. Playback is controlled by the host.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Room;
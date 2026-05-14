import React, { useState, useRef, useEffect } from "react";

export default function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    // Instrumental lofi hip hop stream
    audioRef.current = new Audio("https://streams.fluxfm.de/Chillhop/mp3-128");
    audioRef.current.loop = true;
    audioRef.current.volume = 0.25;

    // Load YouTube IFrame API async
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    // Initialize YouTube player when API is ready
    window.onYouTubeIframeAPIReady = () => {
      if (playerRef.current) return;
      
      playerRef.current = new window.YT.Player('panda-player', {
        height: '100%',
        width: '100%',
        videoId: '8Tp4-qtcYgY',
        playerVars: {
          autoplay: 1,
          start: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          disablekb: 1,
          iv_load_policy: 3
        },
        events: {
          onReady: (event) => {
            event.target.playVideo();
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.ENDED) {
              event.target.seekTo(0);
              event.target.playVideo();
            }
          }
        }
      });
    };

    // If API already loaded, initialize immediately
    if (window.YT && window.YT.Player) {
      window.onYouTubeIframeAPIReady();
    } else if (typeof window.YT === 'undefined') {
      setTimeout(() => {
        if (window.YT && window.YT.Player) {
          window.onYouTubeIframeAPIReady();
        }
      }, 1000);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => console.log("Audio play failed:", err));
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <button
        onClick={togglePlay}
        className="relative group transition-all duration-300 hover:scale-105 overflow-hidden rounded-full"
        style={{ width: '140px', height: '140px' }}
      >
        <div 
          id="panda-player" 
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: 'scale(1.5)',
            transformOrigin: 'center center',
            backgroundColor: 'transparent'
          }}
        />
        {/* Overlay to hide any YouTube UI elements */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-transparent" />
        
        {/* Audio waves animation */}
        {isPlaying && (
          <div className="absolute top-3 right-3 flex items-end gap-1 z-10">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-2 bg-white rounded-full animate-wave shadow-lg"
                style={{
                  height: '12px',
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: '0.6s'
                }}
              />
            ))}
          </div>
        )}
      </button>

      <style>{`
        @keyframes wave {
          0%, 100% { height: 10px; }
          50% { height: 26px; }
        }
        .animate-wave {
          animation: wave 0.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
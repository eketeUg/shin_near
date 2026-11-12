'use client';

import { useState, useEffect } from 'react';

interface LoadingScreenProps {
  onComplete: () => void;
}

const LoadingScreen = ({ onComplete }: LoadingScreenProps) => {
  const [actualProgress, setActualProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isPhaserLoaded, setIsPhaserLoaded] = useState(false);
  const [splashPhase, setSplashPhase] = useState<'bg' | 'studio' | 'loading'>('bg');

  useEffect(() => {
    // Sequence the splash screens
    const timer1 = setTimeout(() => setSplashPhase('studio'), 4000); // 4 seconds for bg
    const timer2 = setTimeout(() => setSplashPhase('loading'), 7000); // 3 seconds for studio logo
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  useEffect(() => {
    const handleProgress = (e: any) => {
      setActualProgress(e.detail.progress * 100);
    };

    const handleComplete = () => {
      setActualProgress(100);
      setIsPhaserLoaded(true);
    };

    window.addEventListener('phaserLoadProgress', handleProgress);
    window.addEventListener('phaserLoadComplete', handleComplete);

    return () => {
      window.removeEventListener('phaserLoadProgress', handleProgress);
      window.removeEventListener('phaserLoadComplete', handleComplete);
    };
  }, []);

  // Smooth out the progress bar visually so it never jumps instantly
  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev < actualProgress) {
           // Increment by approx 1.5% every 30ms -> gives at least 2 seconds of satisfying loading visual
          return Math.min(prev + 1.5, actualProgress);
        }
        return prev;
      });
    }, 30);
    
    return () => clearInterval(timer);
  }, [actualProgress]);

  // Tell app we're done only when both the splash sequence is done, phaser is loaded, and visual progress finishes
  useEffect(() => {
    if (splashPhase === 'loading' && isPhaserLoaded && displayProgress >= 100) {
      const timer = setTimeout(onComplete, 1200); // 1.2s delay so user can admire the 100% "Ready to Fight"
      return () => clearTimeout(timer);
    }
  }, [splashPhase, isPhaserLoaded, displayProgress, onComplete]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black overflow-hidden pointer-events-none select-none">
      
      {/* Phase 1: Background Image */}
      <div 
        className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
          splashPhase === 'bg' ? 'opacity-100' : 'opacity-60'
        }`}
        style={{
          backgroundImage: "url('/assets/shin_bg.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
      
      {/* Opaque dark overlay transitions in after bg phase */}
      <div 
        className={`absolute inset-0 bg-black/50 backdrop-blur-[4px] transition-opacity duration-1000 ease-in-out ${
          splashPhase === 'bg' ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* Phase 2: Studio Logo */}
      <div 
        className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 ease-in-out ${
          splashPhase === 'studio' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <h2 className="text-white text-3xl md:text-5xl font-cinzel font-black tracking-[0.4em] md:tracking-[0.5em] uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] mb-8 text-center">
          28DREAMS STUDIO
        </h2>
        <p className="text-gray-400 tracking-[0.4em] drop-shadow-[0_0_5px_rgba(255,0,0,0.5)] text-sm md:text-base uppercase font-light">Presents</p>
      </div>

      {/* Phase 3: Loading Assets */}
      <div 
        className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 delay-300 ease-in-out ${
          splashPhase === 'loading' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'
        }`}
      >
        {/* SHIN Logo Container */}
        <div className="relative mb-8 md:mb-12">
          <h1 className="text-6xl md:text-9xl font-black font-cinzel tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600 glow-text animate-pulse">
            SHIN
          </h1>
          <div className="absolute -bottom-2 md:-bottom-4 left-0 w-full h-1 bg-shin-red shadow-[0_0_20px_rgba(255,0,0,0.8)]"></div>
        </div>

        {/* Progress Bar Container */}
        <div className="relative w-64 md:w-96 h-1 md:h-2 bg-gray-900 rounded-full overflow-hidden border border-gray-800 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
          <div 
            className="h-full bg-gradient-to-r from-shin-red via-red-500 to-red-900 transition-all duration-200 ease-out"
            style={{ width: `${displayProgress}%` }}
          />
        </div>
        
        <p className="mt-6 text-xs text-gray-400 font-mono uppercase tracking-widest animate-pulse">
          {displayProgress < 100 ? `Loading Assets... ${Math.floor(displayProgress)}%` : 'Ready to Fight'}
        </p>
      </div>

    </div>
  );
};

export default LoadingScreen;

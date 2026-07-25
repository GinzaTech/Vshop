import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { useFlowStore } from '../store/useFlowStore';

const speeds = [0.5, 1, 1.5, 2];

export function PlaybackControls() {
  const isPlaying = useFlowStore((state) => state.isPlaying);
  const speed = useFlowStore((state) => state.speed);
  const play = useFlowStore((state) => state.play);
  const pause = useFlowStore((state) => state.pause);
  const stepNext = useFlowStore((state) => state.stepNext);
  const stepBack = useFlowStore((state) => state.stepBack);
  const reset = useFlowStore((state) => state.reset);
  const setSpeed = useFlowStore((state) => state.setSpeed);

  return (
    <div className="playback">
      <button type="button" className="icon-button" onClick={stepBack} title="Step back" aria-label="Step back">
        <SkipBack size={18} />
      </button>
      <button type="button" className="primary-button" onClick={isPlaying ? pause : play}>
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <button type="button" className="icon-button" onClick={stepNext} title="Step next" aria-label="Step next">
        <SkipForward size={18} />
      </button>
      <button type="button" className="icon-button" onClick={reset} title="Reset" aria-label="Reset">
        <RotateCcw size={18} />
      </button>
      <div className="segmented" aria-label="Playback speed">
        {speeds.map((item) => (
          <button key={item} type="button" className={item === speed ? 'selected' : undefined} onClick={() => setSpeed(item)}>
            {item}x
          </button>
        ))}
      </div>
    </div>
  );
}

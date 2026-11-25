import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { valueForKey, valueFromX } from '../../study/slider';

interface KnobSliderProps {
  value: number;
  min: number;
  max: number;
  label: string;
  valueText: string;
  onChange: (value: number) => void;
}

/** Slider that only moves by dragging the knob (or the keyboard); tapping the track does nothing. */
export function KnobSlider({ value, min, max, label, valueText, onChange }: KnobSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!dragging.current || !track) return;
    const rect = track.getBoundingClientRect();
    onChange(valueFromX(e.clientX, rect.left, rect.width, min, max));
  }

  function endDrag() {
    dragging.current = false;
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const next = valueForKey(e.key, value, min, max);
    if (next === null) return;
    e.preventDefault();
    onChange(next);
  }

  return (
    <div
      className="knob-slider"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      onKeyDown={onKeyDown}
    >
      <div className="knob-track" ref={trackRef}>
        <div className="knob-fill" style={{ width: `${percent}%` }} />
        <div
          className="knob-thumb"
          style={{ left: `${percent}%` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      </div>
    </div>
  );
}

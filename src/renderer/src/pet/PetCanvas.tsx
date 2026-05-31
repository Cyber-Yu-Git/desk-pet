import { useEffect, useRef } from 'react';
import type { PetState } from '../../../shared/types';

interface PetCanvasProps {
  state: PetState;
}

const stateColors: Record<PetState, string> = {
  idle: '#6ee7b7',
  working: '#93c5fd',
  reminding: '#fde68a',
  success: '#86efac',
  error: '#fca5a5',
  waiting: '#f9a8d4',
  sleeping: '#c4b5fd',
  sharing: '#67e8f9'
};

export function PetCanvas({ state }: PetCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    let animationId = 0;
    let lastFrame = 0;
    let frame = 0;
    const fps = 12;
    const frameDuration = 1000 / fps;

    const draw = (timestamp: number): void => {
      animationId = window.requestAnimationFrame(draw);
      if (timestamp - lastFrame < frameDuration) return;

      lastFrame = timestamp;
      frame += 1;
      drawPet(context, canvas.width, canvas.height, stateRef.current, frame);
    };

    animationId = window.requestAnimationFrame(draw);

    return () => window.cancelAnimationFrame(animationId);
  }, []);

  return <canvas ref={canvasRef} className="pet-canvas" width={220} height={220} />;
}

function drawPet(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: PetState,
  frame: number
): void {
  context.clearRect(0, 0, width, height);

  const bob = Math.sin(frame / 4) * 4;
  const color = stateColors[state];
  const centerX = width / 2;
  const centerY = height / 2 + bob;

  context.imageSmoothingEnabled = false;
  context.fillStyle = 'rgba(0, 0, 0, 0.18)';
  context.beginPath();
  context.ellipse(centerX, height - 28, 54, 14, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = color;
  roundRect(context, centerX - 54, centerY - 48, 108, 112, 24);
  context.fill();

  context.fillStyle = '#0f172a';
  context.fillRect(centerX - 27, centerY - 8, 12, 18);
  context.fillRect(centerX + 15, centerY - 8, 12, 18);

  context.fillStyle = '#f8fafc';
  context.fillRect(centerX - 23, centerY - 4, 4, 4);
  context.fillRect(centerX + 19, centerY - 4, 4, 4);

  context.strokeStyle = '#0f172a';
  context.lineWidth = 5;
  context.beginPath();
  context.arc(centerX, centerY + 24, 16, 0, Math.PI);
  context.stroke();

  if (state === 'working') {
    context.fillStyle = '#1d4ed8';
    context.fillRect(centerX - 72, centerY + 66, 144, 14);
  }

  if (state === 'success') {
    context.fillStyle = '#facc15';
    context.beginPath();
    context.arc(centerX + 58, centerY - 62, 12 + Math.sin(frame / 2) * 2, 0, Math.PI * 2);
    context.fill();
  }

  if (state === 'error') {
    context.strokeStyle = '#991b1b';
    context.beginPath();
    context.moveTo(centerX - 34, centerY - 18);
    context.lineTo(centerX - 10, centerY - 2);
    context.moveTo(centerX + 34, centerY - 18);
    context.lineTo(centerX + 10, centerY - 2);
    context.stroke();
  }
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

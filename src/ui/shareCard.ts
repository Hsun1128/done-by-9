import { ENDINGS } from '../data/endings';
import { formatClock } from '../engine/clock';
import type { Summary } from '../engine/types';

const WIDTH = 1080;
const HEIGHT = 1920;
const FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif';

/** Wraps text by character, which is correct for Chinese and acceptable for short Latin runs. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): readonly string[] {
  const lines: string[] = [];
  let line = '';
  for (const char of text) {
    if (ctx.measureText(line + char).width > maxWidth && line !== '') {
      lines.push(line);
      line = char;
    } else {
      line += char;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  y: number,
  label: string,
  value: number,
  color: string,
): void {
  const x = 120;
  const width = WIDTH - 240;
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 40px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y);
  ctx.textAlign = 'right';
  ctx.fillText(String(value), x + width, y);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, y + 22, width, 22);
  ctx.fillStyle = color;
  ctx.fillRect(x, y + 22, (width * Math.min(100, Math.max(0, value))) / 100, 22);
}

/** Renders the 9:16 end-of-day card (story size) as a PNG. */
export function renderShareCard(summary: Summary, siteUrl: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return Promise.reject(new Error('Canvas 2D is not available'));

  const ending = ENDINGS[summary.ending];

  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, '#1b1f3a');
  sky.addColorStop(1, '#4a3566');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `500 44px ${FONT}`;
  ctx.fillText('21:00 前，全部搞定・07:00 到 21:00', WIDTH / 2, 200);

  ctx.font = `220px ${FONT}`;
  ctx.fillText(ending.emoji, WIDTH / 2, 520);

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 92px ${FONT}`;
  ctx.fillText(ending.title, WIDTH / 2, 700);

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `400 46px ${FONT}`;
  wrap(ctx, ending.subtitle, WIDTH - 240).forEach((line, index) => {
    ctx.fillText(line, WIDTH / 2, 800 + index * 68);
  });

  ctx.fillStyle = '#ffd98a';
  ctx.font = `700 64px ${FONT}`;
  ctx.fillText(
    summary.allDone ? `${formatClock(summary.finishClock)} 全部完成` : '21:00・還有事沒做完',
    WIDTH / 2,
    1100,
  );

  drawBar(ctx, 1260, '孩子自己動手', summary.avgDiscipline, '#8fd694');
  drawBar(ctx, 1380, '平均心情', summary.avgMood, '#ffd98a');
  drawBar(ctx, 1500, '親子連結', summary.bond, '#ff9bb3');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 44px ${FONT}`;
  ctx.fillText(`今天花了 NT$${summary.spent.toLocaleString('en-US')}・剩 NT$${summary.money.toLocaleString('en-US')}`, WIDTH / 2, 1640);

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `400 40px ${FONT}`;
  ctx.fillText(siteUrl.replace(/^https?:\/\//, ''), WIDTH / 2, 1760);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new Error('Could not encode the share card'));
      else resolve(blob);
    }, 'image/png');
  });
}

import './style.css';
import { parseConfig } from './config';
import { createStage, StageUnavailableError } from './scene/stage';
import { createSeedSource } from './seed';
import { resolveStorage } from './storage';
import { browserSender, createTracker } from './telemetry/analytics';
import { mountApp } from './ui/app';
import { createSound } from './ui/sound';

const root = document.getElementById('app');
if (root === null) {
  throw new Error('Missing #app element in index.html');
}

const config = parseConfig(import.meta.env);

/** The game is 3D-only. Without WebGL we say so plainly instead of limping along. */
function showUnavailable(reason: string): void {
  const message = document.createElement('p');
  message.className = 'stage-error';
  message.textContent = `這個遊戲需要 WebGL 才能顯示 3D 場景，但這個瀏覽器無法啟用它。請改用最新版的 Chrome、Safari 或 Edge。（${reason}）`;
  root?.replaceChildren(message);
}

const sound = createSound();
const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

try {
  mountApp({
    root,
    config,
    storage: resolveStorage(() => window.localStorage),
    tracker: createTracker(config.analyticsUrl, browserSender, () => Date.now()),
    createStage,
    sound,
    nextSeed: createSeedSource(window.location.search),
    reducedMotion,
  });
} catch (error) {
  if (!(error instanceof StageUnavailableError)) throw error;
  showUnavailable(error.message);
}

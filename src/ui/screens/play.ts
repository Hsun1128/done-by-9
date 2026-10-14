import { CARE_TEXT } from '../../data/selfcare';
import { formatClock, minutesUntilEnd, dayProgress } from '../../engine/clock';
import { BLADDER_DISTRACTED, BREATH_MINUTES, MONEY_STRESS_BELOW } from '../../engine/constants';
import { CHORE_META } from '../../data/chores';
import { careAt, careStatus, choreAt, interactionAt } from '../../engine/game';
import { KIDS } from '../../data/meta';
import { eventById } from '../../data/deck';
import { ZONES } from '../../engine/world';
import { KID_IDS, type CareId, type EventChoice, type GameState, type NextUp } from '../../engine/types';
import { kidCard, meter } from '../components';
import { h } from '../dom';

/** What just happened after the player chose something: shown until they continue. */
export interface Outcome {
  readonly text: string;
  /** NT$ change caused by the choice, signed. */
  readonly money: number;
}

export interface PlayUi {
  readonly game: GameState;
  readonly outcome: Outcome | null;
  readonly guide: NextUp | null;
  readonly muted: boolean;
}

export interface PlayHandlers {
  readonly onInteract: () => void;
  readonly onChoose: (choiceId: string) => void;
  readonly onLeave: () => void;
  readonly onCare: (care: CareId) => void;
  readonly onBreathe: () => void;
  readonly onChore: () => void;
  readonly onGuide: () => void;
  readonly onContinue: () => void;
  readonly onFinish: () => void;
  readonly onStick: (x: number, z: number) => void;
  readonly onToggleMute: () => void;
}

export interface PlayView {
  readonly element: HTMLElement;
  update(ui: PlayUi): void;
}

const money = (n: number): string => `NT$ ${n.toLocaleString('en-US')}`;
const signed = (n: number): string => `${n < 0 ? '−' : '+'}NT$ ${Math.abs(n).toLocaleString('en-US')}`;

/** One slot of the screen whose children are rebuilt only when their key changes. */
function slot(className: string, tag: 'div' | 'header' | 'section' = 'div') {
  const element = h(tag, { className });
  let lastKey = '';
  return {
    element,
    set(key: string, build: () => readonly (Node | string)[]): void {
      if (key === lastKey) return;
      lastKey = key;
      element.replaceChildren(...build());
    },
  };
}

function choiceCost(choice: EventChoice): string {
  const parts = [`約 ${choice.minutes} 分鐘`];
  if (choice.money !== 0) parts.push(signed(choice.money));
  if (choice.effects.energy <= -3) parts.push('很累');
  return parts.join('・');
}

export function createPlayView(stage: HTMLElement, handlers: PlayHandlers): PlayView {
  const hud = slot('hud', 'header');
  const nextUp = slot('nextup');
  const kids = slot('kids');
  const dock = slot('dock');
  const sheet = slot('sheet');
  const toolbar = slot('toolbar');

  // Joystick for touch screens: pointer position inside the pad becomes a movement vector.
  const knob = h('div', { className: 'pad__knob' });
  const pad = h('div', { className: 'pad', attrs: { 'aria-hidden': 'true' } }, knob);
  const RADIUS = 46;
  const move = (event: PointerEvent): void => {
    const box = pad.getBoundingClientRect();
    const dx = event.clientX - (box.left + box.width / 2);
    const dz = event.clientY - (box.top + box.height / 2);
    const length = Math.min(RADIUS, Math.hypot(dx, dz));
    const angle = Math.atan2(dz, dx);
    const x = (Math.cos(angle) * length) / RADIUS;
    const z = (Math.sin(angle) * length) / RADIUS;
    knob.style.transform = `translate(${x * RADIUS}px, ${z * RADIUS}px)`;
    handlers.onStick(Math.abs(x) < 0.2 ? 0 : x, Math.abs(z) < 0.2 ? 0 : z);
  };
  const release = (): void => {
    knob.style.transform = 'translate(0, 0)';
    handlers.onStick(0, 0);
  };
  pad.addEventListener('pointerdown', (event) => {
    pad.setPointerCapture(event.pointerId);
    move(event);
  });
  pad.addEventListener('pointermove', (event) => {
    if (pad.hasPointerCapture(event.pointerId)) move(event);
  });
  pad.addEventListener('pointerup', release);
  pad.addEventListener('pointercancel', release);

  const stageBox = h('div', { className: 'playstage' }, stage, toolbar.element, pad);
  const element = h(
    'main',
    { className: 'screen screen--play' },
    hud.element,
    stageBox,
    nextUp.element,
    dock.element,
    kids.element,
    sheet.element,
  );

  function update(ui: PlayUi): void {
    const { game, outcome, guide } = ui;
    const left = minutesUntilEnd(game.clock);

    hud.set(
      [
        game.clock,
        Math.round(game.energy),
        Math.round(game.patience),
        Math.round(game.fullness),
        Math.round(game.bladder),
        game.money,
      ].join('|'),
      () => {
        const fill = h('div', { className: 'timebar__fill' });
        fill.style.width = `${Math.round(dayProgress(game.clock) * 100)}%`;
        return [
          h(
            'div',
            { className: 'hud__row' },
            h('span', { className: 'hud__clock' }, formatClock(game.clock)),
            h(
              'span',
              {
                className: `hud__money${game.money < MONEY_STRESS_BELOW ? ' hud__money--low' : ''}`,
                attrs: { 'aria-label': `本週彈性預算 ${money(game.money)}` },
              },
              `💰 ${money(game.money)}`,
            ),
            h('span', { className: 'hud__left' }, `21:00 另一半到家・還有 ${left >= 60 ? `${Math.floor(left / 60)} 小時 ` : ''}${left % 60} 分`),
          ),
          h('div', { className: 'timebar' }, fill),
          h(
            'div',
            { className: 'meters' },
            meter('精力', game.energy, 'energy', game.energy < 25),
            meter('耐心', game.patience, 'patience', game.patience < 30),
            meter('肚子', game.fullness, 'food', game.fullness < 20),
            meter('內急', game.bladder, 'bladder', game.bladder >= BLADDER_DISTRACTED),
          ),
        ];
      },
    );

    toolbar.set(String(ui.muted), () => [
      h(
        'button',
        { className: 'ghost', onClick: handlers.onToggleMute, attrs: { 'aria-pressed': String(ui.muted) } },
        ui.muted ? '🔇 聲音關' : '🔊 聲音開',
      ),
    ]);

    nextUp.set(guide === null ? 'none' : `${guide.zone}|${guide.reason}|${guide.text}`, () =>
      guide === null
        ? [h('span', { className: 'nextup__text' }, '都處理好了，休息一下。')]
        : [
            h('span', { className: `nextup__text nextup__text--${guide.reason}` }, `${guide.reason === 'urgent' ? '緊急：' : '下一步：'}${guide.text}`),
            h('button', { className: 'secondary nextup__go', onClick: handlers.onGuide }, '帶我去 (G)'),
          ],
    );

    const interaction = interactionAt(game);
    const cares = careAt(game);
    const offer = choreAt(game);
    dock.set(
      [
        game.at ?? 'walking',
        interaction.kind,
        'eventId' in interaction ? interaction.eventId : '',
        'kid' in interaction ? interaction.kid : '',
        cares.map((care) => `${care}:${careStatus(game, care)}`).join(','),
        offer === null ? '' : `${offer.task}:${offer.kids.join('+')}`,
        game.pending === null ? 'free' : 'talking',
      ].join('|'),
      () => {
        const buttons: HTMLElement[] = [];
        switch (interaction.kind) {
          case 'event': {
            const event = eventById(interaction.eventId);
            buttons.push(
              h(
                'button',
                { className: `primary${interaction.urgent ? ' primary--urgent' : ''}`, onClick: handlers.onInteract },
                `${interaction.urgent ? '‼️ ' : '❗ '}${event.title} (E)`,
              ),
            );
            break;
          }
          case 'checkin': {
            const profile = KIDS[interaction.kid];
            buttons.push(
              h('button', { className: 'primary', onClick: handlers.onInteract }, `和${profile.name}說話 (E)`),
            );
            break;
          }
          case 'blocked':
            buttons.push(
              h('button', { className: 'primary', disabled: true }, '先處理紅色的 ‼️ 再說'),
            );
            break;
          case 'none':
            buttons.push(
              h(
                'button',
                { className: 'primary', disabled: true },
                game.at === null ? '走近有 ❗ 的地方' : `${ZONES[game.at].label}：這裡沒事`,
              ),
            );
            break;
        }
        if (offer !== null) {
          const meta = CHORE_META[offer.task];
          buttons.push(
            h(
              'button',
              { className: 'primary primary--chore', onClick: handlers.onChore },
              `🧑‍🍳 ${meta.button}${offer.kids.length > 1 ? '（兩個一起）' : ''} (F)`,
            ),
          );
        }
        for (const care of cares) {
          const text = CARE_TEXT[care];
          const status = careStatus(game, care);
          buttons.push(
            h(
              'button',
              {
                className: 'secondary',
                disabled: status !== 'ok',
                onClick: () => {
                  handlers.onCare(care);
                },
                attrs: { title: status === 'ok' ? text.label : text.hint },
              },
              `${text.emoji} ${status === 'ok' ? text.label : text.hint} (R)`,
            ),
          );
        }
        buttons.push(
          h(
            'button',
            { className: 'secondary', onClick: handlers.onBreathe, attrs: { title: `耐心 +，約 ${BREATH_MINUTES} 分鐘` } },
            '🌬️ 深呼吸 (B)',
          ),
        );
        return buttons;
      },
    );

    kids.set(
      KID_IDS.map((id) => {
        const kid = game.kids[id];
        return [Math.round(kid.mood), Math.round(Object.values(kid.progress).reduce((a, b) => a + b, 0))].join(':');
      }).join('|') + `|${Math.floor(game.clock / 15)}`,
      () => KID_IDS.map((id) => kidCard(id, game.kids[id], game.clock)),
    );

    sheet.set(
      outcome !== null
        ? `outcome|${outcome.text}|${game.finished}`
        : game.pending !== null
          ? `ask|${game.pending.event.id}`
          : 'closed',
      () => {
        if (outcome !== null) {
          return [
            h(
              'section',
              { className: 'card sheet__card', attrs: { role: 'dialog', 'aria-live': 'polite', 'aria-label': '結果' } },
              h('p', { className: 'outcome__text' }, outcome.text),
              outcome.money !== 0 &&
                h('p', { className: `outcome__money${outcome.money < 0 ? ' outcome__money--out' : ''}` }, signed(outcome.money)),
              h(
                'button',
                { className: 'primary', onClick: game.finished ? handlers.onFinish : handlers.onContinue },
                game.finished ? '看今天的結算' : '繼續 (E)',
              ),
            ),
          ];
        }
        if (game.pending === null) return [];
        const event = game.pending.event;
        const buttons = event.choices.map((choice, index) =>
          h(
            'button',
            {
              className: 'choice',
              onClick: () => {
                handlers.onChoose(choice.id);
              },
            },
            h('span', { className: 'choice__key' }, String(index + 1)),
            h('span', { className: 'choice__label' }, choice.label),
            h('span', { className: 'choice__cost' }, choiceCost(choice)),
          ),
        );
        return [
          h(
            'section',
            { className: 'card sheet__card', attrs: { role: 'dialog', 'aria-label': event.title } },
            h('h2', { className: 'card__title' }, event.title),
            h('p', { className: 'card__body' }, event.body),
            h('div', { className: 'choices' }, ...buttons),
            h('button', { className: 'ghost', onClick: handlers.onLeave }, '先不處理 (Esc)'),
          ),
        ];
      },
    );

    element.classList.toggle('is-talking', game.pending !== null || outcome !== null);
  }

  return { element, update };
}

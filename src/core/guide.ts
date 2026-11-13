import { renderExample as drawExample } from './example';
import { guideFor, type Example } from './guides';
import { lang, onLangChange, t } from './i18n';
import { el } from './util';
import { GAMES } from '../games/registry';

const dialog = () => document.querySelector<HTMLDialogElement>('#guide')!;

function renderExample(e: Example): HTMLElement {
  const box = el('figure', e.mark ? `example ${e.mark}` : 'example');
  const caption = el('figcaption');
  if (e.mark) caption.append(el('span', 'ex-verdict', e.mark === 'ok' ? '✓ ' : '✕ '));
  caption.append(e.caption);
  box.append(drawExample(e), caption);
  return box;
}

function section(title: string, node: HTMLElement): HTMLElement {
  const wrap = el('section', 'guide-section');
  wrap.append(el('h3', '', title), node);
  return wrap;
}

function list(items: string[]): HTMLElement {
  const ul = el('ul');
  items.forEach((i) => ul.append(el('li', '', i)));
  return ul;
}

let shownGame: string | null = null;

function render() {
  const body = el('div', 'sheet-body guide');
  const game = GAMES.find((g) => g.id === shownGame);
  const guide = game ? guideFor(game.id, lang()) : null;

  if (game && guide) {
    const back = el('button', 'guide-back', `‹ ${t('All rules')}`);
    back.type = 'button';
    back.addEventListener('click', () => open(null));
    const title = el('h2', '', t(game.title));
    const icon = el('span', 'guide-icon');
    icon.innerHTML = game.icon;
    icon.setAttribute('aria-hidden', 'true');
    const head = el('div', 'guide-head');
    head.append(icon, title);
    body.append(back, head);
    body.append(section(t('Goal'), el('p', '', guide.goal)));
    body.append(section(t('Rules of the game'), list(guide.rules)));
    const examples = el('div');
    guide.examples.forEach((e) => examples.append(renderExample(e)));
    body.append(section(t(guide.examples.length > 1 ? 'Examples' : 'Example'), examples));
    body.append(section(t('Controls'), list(guide.controls)));
    body.append(section(t('Tips'), list(guide.tips)));
  } else {
    body.append(el('h2', '', t('Rules & how to play')));
    body.append(el('p', 'guide-intro', t('Choose a game to learn how to play it.')));
    const cards = el('div', 'guide-list');
    for (const g of GAMES) {
      const btn = el('button', 'guide-item');
      btn.type = 'button';
      const icon = el('span', 'guide-icon');
      icon.innerHTML = g.icon;
      icon.setAttribute('aria-hidden', 'true');
      const text = el('span', 'guide-item-text');
      text.append(el('strong', '', t(g.title)), el('small', '', t(g.blurb)));
      btn.append(icon, text, el('span', 'chev', '›'));
      btn.addEventListener('click', () => open(g.id));
      cards.append(btn);
    }
    body.append(cards);
  }

  const close = el('button', 'wide', t('Close'));
  close.type = 'button';
  close.addEventListener('click', () => dialog().close());
  body.append(close);
  dialog().replaceChildren(body);
  body.scrollTop = 0;
}

function open(id: string | null) {
  shownGame = id;
  render();
  if (!dialog().open) dialog().showModal();
}

/** Opens the rules dialog, on a specific game or on the list of all games. */
export function openGuide(gameId: string | null = null) {
  open(gameId);
}

onLangChange(() => {
  if (dialog().open) render();
});

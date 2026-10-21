// TEXT FRAGMENTS: the only words in the game. A few at a time, fading in and
// out of the dark like something half-remembered. Never instructions, never UI.

export function showFragment(el, text, { delay = 0, hold = 5, fade = 2.5 } = {}) {
  return new Promise((resolve) => {
    setTimeout(() => {
      el.textContent = text;
      el.style.transitionDuration = `${fade}s`;
      el.classList.add('on');
      setTimeout(() => {
        el.classList.remove('on');
        setTimeout(resolve, fade * 1000);
      }, (fade + hold) * 1000);
    }, delay * 1000);
  });
}

const paths: Record<string, string> = {
  farm: '<path d="m2 11 10-8 10 8M5 10v10h14V10M9 20v-6h6v6"/>',
  book: '<path d="M12 5C9 3 5 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-1-10 1Zm0 0v15"/>',
  bag: '<path d="M5 10h14l1 11H4l1-11Zm3 0V7a4 4 0 0 1 8 0v3M7 15h10"/>',
  coin: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6.4"/><path d="M10 9h3a1.6 1.6 0 0 1 0 3h-3m0-3v7h3a2 2 0 0 0 0-4m-1-5v2m0 7v1"/>',
  sound: '<path d="m11 5-6 5H2v4h3l6 5V5Zm4 3q4 4 0 8m3-11q7 7 0 14"/>',
  mute: '<path d="m11 5-6 5H2v4h3l6 5V5Zm5 4 6 6m0-6-6 6"/>',
  settings:
    '<path d="m9 3 .7-1h4.6l.7 2 2 .9 2-.3 2 3.5-1.4 1.6v3l1.4 1.6-2 3.5-2-.3-2 .9-.7 2H9.7l-.7-2-2-.9-2 .3-2-3.5 1.4-1.6v-3L3 8.1l2-3.5 2 .3 2-.9Z"/><circle cx="12" cy="11.7" r="3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  rain: '<path d="M5 14a4 4 0 0 1 0-8 6 6 0 0 1 11-1 5 5 0 0 1 2 10H6m1 2-1 3m6-3-1 3m6-3-1 3"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  sprout: '<path d="M12 21v-7C7 14 4 11 3 6c6 0 9 3 9 8Zm0 0c0-6 3-10 10-11-1 7-4 10-10 11Z"/>',
  tools: '<path d="m4 21 12-13m-6-5c5-1 10 3 11 8l-3 1c-1-4-4-7-9-7l1-2Z"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3h.01"/>',
  crate: '<path d="M3 7h18v13H3zm0 0 4-4h10l4 4M5 9l14 9M19 9 5 18"/>',
  shop: '<path d="m3 10 2-6h14l2 6c0 3-4 3-5 1-1 2-4 2-5 0-1 2-4 2-5 0-1 1-3 1-3-1Zm2 3v7h14v-7"/>',
  fish: '<path d="M3 12s4-7 10-5l4 3 4-3v10l-4-3c-5 6-11 3-14-2Z"/><circle cx="7.5" cy="11" r=".6"/>',
};
export function icon(name: string) {
  return (
    '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' +
    (paths[name] || '') +
    '</svg>'
  );
}
export function decorate(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.dataset.icon!);
  });
}

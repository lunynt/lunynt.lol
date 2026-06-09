const BLOCKED_SHORTCUT_KEYS = new Set(['i', 'j', 'c', 'u']);
const DEVTOOLS_GAP_THRESHOLD = 160;
const DEVTOOLS_POLL_MS = 1500;

function blockContextMenu(event: MouseEvent) {
  event.preventDefault();
}

function blockDevtoolShortcuts(event: KeyboardEvent) {
  const key = event.key.toLowerCase();

  if (key === 'f12') {
    event.preventDefault();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && (event.shiftKey || key === 'u') && BLOCKED_SHORTCUT_KEYS.has(key)) {
    event.preventDefault();
  }
}

function printConsoleWarning() {
  console.log('%cstop.', 'color:#f87171;font-size:32px;font-weight:700;text-shadow:1px 1px 0 #000');
  console.log(
    '%cthis console is for developers. pasting code here that someone gave you can let them take over your account or steal your data.',
    'color:#f87171;font-size:13px;'
  );
}

let devtoolsWarned = false;

function checkDevtoolsGap() {
  const widthGap = window.outerWidth - window.innerWidth;
  const heightGap = window.outerHeight - window.innerHeight;

  if (!devtoolsWarned && (widthGap > DEVTOOLS_GAP_THRESHOLD || heightGap > DEVTOOLS_GAP_THRESHOLD)) {
    devtoolsWarned = true;
    printConsoleWarning();
  }
}

export function initAntiInspect() {
  document.addEventListener('contextmenu', blockContextMenu);
  document.addEventListener('keydown', blockDevtoolShortcuts);
  printConsoleWarning();
  window.setInterval(checkDevtoolsGap, DEVTOOLS_POLL_MS);
}

// UE 5.9 Preview 1 compatibility: use the printable uppercase key map for
// game controls. Unshifted letters were not reaching this installed runtime.
// Keep the original trusted event, physical code, modifiers, repeat and timing.
// Never change text-entry fields or operating-system/browser shortcuts.
(() => {
  const gameLetter = event => {
    if (event.ctrlKey || event.metaKey || event.altKey || !/^[a-z]$/.test(event.key)) return;
    const target = document.activeElement;
    if (!target || target.id !== 'canvas' || target.isContentEditable) return;
    Object.defineProperty(event, 'key', {value:event.key.toUpperCase(), configurable:true});
  };
  window.addEventListener('keydown', gameLetter, {capture:true});
  window.addEventListener('keyup', gameLetter, {capture:true});
})();

/* Two-thumb controls: slide across the direction pad without lifting a finger. */
(function (global) {
  'use strict';
  const enabled = (global.navigator.maxTouchPoints || 0) > 0 || global.matchMedia('(pointer:coarse)').matches;
  function attach(game) {
    document.documentElement.classList.toggle('lumen-touch', enabled);
    const controls = document.getElementById('touch-controls');
    const pointers = new Map(), timers = new Map();
    const buttons = [...controls.querySelectorAll('[data-touch]')];
    function held() {
      buttons.forEach(button => button.classList.toggle('held', [...pointers.values()].some(value => value === button.dataset.touch)));
    }
    function release(id) {
      const action = pointers.get(id);
      if (!action) return;
      game.input.virtual(action, false, id); pointers.delete(id);
      clearTimeout(timers.get(id)); timers.delete(id);
      if (!game.input.down('left') && !game.input.down('right')) game.input.virtual('run', false, 'auto');
      held();
    }
    function press(action, id) {
      if (pointers.get(id) === action) return;
      release(id); pointers.set(id, action); game.input.virtual(action, true, id);
      game.input.touchActive = true; held();
      if (action === 'left' || action === 'right') {
        timers.set(id, setTimeout(() => { if (game.mode === 'playing' && pointers.has(id)) game.input.virtual('run', true, 'auto'); }, 380));
      }
    }
    for (const button of buttons) {
      const action = button.dataset.touch;
      button.addEventListener('pointerdown', event => {
        if (game.mode !== 'playing') return;
        event.preventDefault();
        game.audio.unlock();
        try { button.setPointerCapture(event.pointerId); } catch (_) {}
        press(action, event.pointerId);
      });
      button.addEventListener('pointermove', event => {
        if (!['left','right'].includes(pointers.get(event.pointerId))) return;
        const box = controls.querySelector('.touch-move').getBoundingClientRect();
        if (event.clientY < box.top - 40 || event.clientY > box.bottom + 40 || event.clientX < box.left - 48 || event.clientX > box.right + 48) { release(event.pointerId); return; }
        press(event.clientX < box.left + box.width / 2 ? 'left' : 'right', event.pointerId);
      });
      for (const name of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(name, event => release(event.pointerId));
      button.addEventListener('contextmenu', event => event.preventDefault());
    }
    const reset = () => { for (const id of [...pointers.keys()]) release(id); };
    game.on('mode', mode => { if (mode !== 'playing') reset(); });
    global.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  }
  global.LumenTouch = { enabled, attach };
})(window);

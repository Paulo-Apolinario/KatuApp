// Same measurement contract as the panel. Background/idle time is not work time.
export function createActivityMeter(now: () => number = () => Date.now()) {
  let last = now(),
    interaction = last,
    visible = false,
    seconds = 0;
  const tick = () => {
    const current = now(),
      elapsed = Math.max(0, Math.min(2000, current - last));
    if (visible && current - interaction <= 60000) seconds += elapsed / 1000;
    last = current;
  };
  return {
    tick,
    touch() {
      tick();
      interaction = now();
    },
    setVisible(value: boolean) {
      tick();
      visible = value;
      last = now();
      if (value) interaction = last;
    },
    drain() {
      tick();
      const value = Math.min(30, Math.floor(seconds));
      seconds = 0;
      return value;
    },
  };
}

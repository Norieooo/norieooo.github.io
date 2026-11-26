(() => {
  'use strict';

  const record = document.querySelector('.record');
  const recordFrame = record.querySelector('.record-frame');
  const printToggle = record.querySelector('.print-toggle');
  const printLabel = record.querySelector('[data-print-label]');
  const monitor = document.querySelector('.monitor-view');
  const seconds = monitor.querySelector('[data-seconds]');
  const threshold = document.querySelector('.threshold');
  const thresholdScene = threshold.querySelector('.threshold-scene');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const soundButtons = [...document.querySelectorAll('[data-sound]')];

  let frame = 0;
  let printProgress = 1;
  let originalSelected = false;
  let soundEnabled = false;
  let sound;

  const clamp = value => Math.min(1, Math.max(0, value));

  function setPrintCaption() {
    const label = originalSelected || printProgress < .5 ? '开馆前原片' : '闭馆后底片';
    if (printLabel.textContent !== label) printLabel.textContent = label;
  }

  function updateSound(level) {
    if (!sound) return;
    const volume = soundEnabled && !document.hidden ? level : 0;
    if (Math.abs(volume - sound.volume) < .0005) return;
    const time = sound.context.currentTime;
    sound.gain.gain.cancelScheduledValues(time);
    sound.gain.gain.setTargetAtTime(volume, time, .19);
    sound.volume = volume;
  }

  function updateScenes() {
    frame = 0;
    const viewport = document.documentElement.clientHeight;
    const recordTop = recordFrame.getBoundingClientRect().top;
    const monitorTop = monitor.getBoundingClientRect().top;
    const thresholdTop = threshold.getBoundingClientRect().top;
    const travel = Math.max(1, threshold.offsetHeight - thresholdScene.offsetHeight);
    const intrusion = clamp((viewport * .9 - monitorTop) / (viewport * .72));
    const entry = clamp((viewport - thresholdTop) / viewport);
    const descent = clamp(-thresholdTop / travel);
    const reduce = motion.matches;

    printProgress = reduce ? 1 : clamp((viewport * .96 - recordTop) / (viewport * .66));
    record.style.setProperty('--print', printProgress.toFixed(3));
    record.style.setProperty('--tear', (4 * printProgress * (1 - printProgress)).toFixed(3));
    setPrintCaption();

    monitor.style.setProperty('--intrusion', reduce ? 1 : intrusion.toFixed(3));
    const timecode = String(reduce ? 17 : 3 + Math.floor(intrusion * 14)).padStart(2, '0');
    if (seconds.textContent !== timecode) seconds.textContent = timecode;

    threshold.style.setProperty('--door', reduce ? 1 : (.22 * entry + .78 * descent).toFixed(3));
    threshold.style.setProperty('--visitor', reduce ? 1 : clamp((descent - .58) / .36).toFixed(3));

    const presence = clamp((viewport * .89 - monitorTop) / (viewport * .72));
    updateSound(presence * (.055 + .035 * entry + .024 * descent));
  }

  function scheduleUpdate() {
    if (!frame) frame = window.requestAnimationFrame(updateScenes);
  }

  function createSound() {
    const context = new AudioContext();
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(context.destination);

    // The two nearby frequencies create a slow pulse as they overlap.
    for (const frequency of [55, 53.6]) {
      const tone = context.createOscillator();
      const amplitude = context.createGain();
      tone.type = 'triangle';
      tone.frequency.value = frequency;
      amplitude.gain.value = .35;
      tone.connect(amplitude).connect(gain);
      tone.start();
    }
    return { context, gain, volume: 0 };
  }

  function updateSoundButtons() {
    for (const button of soundButtons) {
      button.setAttribute('aria-pressed', String(soundEnabled));
      button.querySelector('[data-sound-state]').textContent = soundEnabled ? '开' : '关';
    }
  }

  async function toggleSound() {
    if (soundEnabled) {
      soundEnabled = false;
      updateSound(0);
      updateSoundButtons();
      return;
    }

    soundButtons.forEach(button => { button.disabled = true; });
    try {
      sound ??= createSound();
      await sound.context.resume();
      soundEnabled = true;
      updateSoundButtons();
      scheduleUpdate();
    } catch {
      soundButtons.forEach(button => {
        button.querySelector('[data-sound-state]').textContent = '不可用';
        button.setAttribute('aria-disabled', 'true');
      });
    } finally {
      soundButtons.forEach(button => {
        button.disabled = button.getAttribute('aria-disabled') === 'true';
      });
    }
  }

  printToggle.hidden = false;
  printToggle.addEventListener('click', () => {
    originalSelected = !originalSelected;
    record.dataset.print = originalSelected ? 'original' : 'auto';
    printToggle.setAttribute('aria-pressed', String(originalSelected));
    setPrintCaption();
  });

  if ('AudioContext' in window) {
    soundButtons.forEach(button => {
      button.hidden = false;
      button.addEventListener('click', toggleSound);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) updateSound(0);
      else scheduleUpdate();
    });
  }

  document.documentElement.classList.add('enhanced');
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('pageshow', scheduleUpdate);
  motion.addEventListener('change', scheduleUpdate);
  updateScenes();
})();

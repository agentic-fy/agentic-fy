/**
 * Typewriter headline for the hero.
 *
 * The first phrase is already in the HTML (so it shows instantly, works
 * without JS, and is indexable). This script then animates: it holds the first
 * phrase, erases it, and types the following phrases about the commands, in a
 * loop — with a blinking caret handled by CSS.
 *
 * Accessibility: honored prefers-reduced-motion leaves the static first phrase
 * in place and never animates.
 */
(function () {
  'use strict';

  var el = document.querySelector('.typewriter .tw-text');
  if (!el) return;

  // The first phrase matches the static HTML so the hand-off is seamless.
  var phrases = [
    'Build the right thing, and build it right.',
    'agentic-fy propose "Create my first API in NestJS" — draft the plan.',
    'agentic-fy apply — implement the tasks.',
    'agentic-fy verify — prove it with evidence.',
    'agentic-fy archive — merge the specs and ship.',
  ];

  // Timings (ms).
  var TYPE = 45; // per character while typing
  var ERASE = 25; // per character while erasing
  var HOLD_FULL = 3000; // pause once a phrase is fully typed (>= 3s per request)
  var HOLD_EMPTY = 250; // pause once erased, before the next phrase

  var index = 0; // current phrase (starts on the one already shown)
  var pos = phrases[0].length; // caret starts at end of the static first phrase

  function tick() {
    var current = phrases[index];

    // Phase 1: hold the fully-typed phrase, then start erasing.
    if (pos === current.length) {
      setTimeout(erasing, HOLD_FULL);
      return;
    }
    // Still typing.
    pos += 1;
    el.textContent = current.slice(0, pos);
    setTimeout(tick, TYPE);
  }

  function erasing() {
    var current = phrases[index];
    if (pos === 0) {
      index = (index + 1) % phrases.length;
      setTimeout(tick, HOLD_EMPTY);
      return;
    }
    pos -= 1;
    el.textContent = current.slice(0, pos);
    setTimeout(erasing, ERASE);
  }

  // Start by holding the already-visible first phrase, then erase into the loop.
  setTimeout(erasing, HOLD_FULL);
})();

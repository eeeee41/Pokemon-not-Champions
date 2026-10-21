// Original animations for the site's own moves, written against the same
// scene interface as Pokémon Showdown's (scene.showEffect, sprite.anim, ...),
// plus the scene's extras: flash, screenGlitch and shake. Effect images are
// our own (scripts/build-custom-fx.py → assets/fx-custom/).
//
// Positions are Showdown's: x across, y up, z into the screen (your side 0,
// the foe 200). Times are ms from the start of the animation.

const FX = 'fx-custom/';
export const CUSTOM_EFFECTS = {
  glitchshard: {url: `${FX}glitchshard.png`, w: 64, h: 64, pixelated: true},
  glitchblock: {url: `${FX}glitchblock.png`, w: 64, h: 24, pixelated: true},
  bit: {url: `${FX}bit.png`, w: 16, h: 16, pixelated: true},
  pixelburst: {url: `${FX}pixelburst.png`, w: 96, h: 96, pixelated: true},
  antimatter: {url: `${FX}antimatter.png`, w: 128, h: 128},
  beamcore: {url: `${FX}beamcore.png`, w: 96, h: 96},
  spark: {url: `${FX}spark.png`, w: 24, h: 24},
  shockwave: {url: `${FX}shockwave.png`, w: 192, h: 192},
  sigil: {url: `${FX}sigil.png`, w: 192, h: 192},
  darkflame: {url: `${FX}darkflame.png`, w: 64, h: 96},
};

const rnd = (a = 1) => (Math.random() * 2 - 1) * a;
const CYAN = {filter: 'hue-rotate(-95deg) saturate(1.5)'};
const RED = {filter: 'hue-rotate(95deg) saturate(2.2) brightness(1.1)'};

/** A point part of the way from one sprite to another. */
const between = (a, b, k) => ({x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k});

/** Quick side-to-side shudder of a sprite, starting after `wait` ms. */
function shudder(sprite, wait, times = 6, size = 8, each = 45) {
  if (wait) sprite.delay(wait);
  for (let i = 0; i < times; i++) sprite.anim({x: sprite.x + (i % 2 ? -size : size), time: each});
  sprite.anim({time: each});
}

export const CUSTOM_ANIMS = {
  // MissingNo.'s signature: every stat +6. The world glitches around it.
  glitchedpower: {
    anim(scene, [user]) {
      scene.backgroundEffect('#000000', 1900, 0.85);
      scene.screenGlitch(120, 1000, 1);
      shudder(user, 0, 8, 7, 45);
      // Shards of broken data burst out of it.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + rnd(0.25);
        const r = 95 + rnd(35);
        scene.showEffect('glitchshard', {x: user.x, y: user.y + 10, z: user.z, scale: 0.15, opacity: 1, time: 100 + i * 25}, {
          x: user.x + Math.cos(a) * r, y: user.y + 10 + Math.sin(a) * r * 0.8, z: user.z, scale: 0.45 + Math.random() * 0.45, opacity: 0, time: 680 + i * 25,
        }, 'decel');
      }
      // Corrupted blocks smear across it.
      for (let i = 0; i < 6; i++) {
        scene.showEffect('glitchblock', {x: user.x - 70, y: user.y - 25 + i * 17, z: user.z, scale: 1, xscale: 1.5, opacity: 0.95, time: 280 + i * 70},
          {x: user.x + 75, xscale: 2.8, opacity: 0, time: 520 + i * 70}, 'linear');
      }
      // A column of data rising: every stat going up.
      for (let i = 0; i < 20; i++) {
        const dx = rnd(60);
        scene.showEffect('bit', {x: user.x + dx, y: user.y - 45 + Math.random() * 20, z: user.z, scale: 1.3, opacity: 0.95, time: 360 + i * 40},
          {x: user.x + dx, y: user.y + 115 + Math.random() * 40, z: user.z, scale: 0.6, opacity: 0, time: 920 + i * 40}, 'accel');
      }
      // It pulls everything in... and bursts.
      scene.showEffect('pixelburst', {x: user.x, y: user.y + 10, z: user.z, scale: 2.6, opacity: 0, time: 880},
        {scale: 0.3, opacity: 1, time: 1160}, 'accel');
      scene.showEffect('pixelburst', {x: user.x, y: user.y + 10, z: user.z, scale: 0.4, opacity: 1, time: 1190},
        {scale: 4.2, opacity: 0, time: 1620}, 'decel');
      scene.showEffect('shockwave', {x: user.x, y: user.y + 10, z: user.z, scale: 0.2, opacity: 1, time: 1190},
        {scale: 3.4, opacity: 0, time: 1680}, 'decel', null, CYAN);
      scene.showEffect('shockwave', {x: user.x, y: user.y + 10, z: user.z, scale: 0.2, opacity: 0.8, time: 1300},
        {scale: 2.4, opacity: 0, time: 1760}, 'decel');
      scene.flash('#ffffff', 1180, 280, 0.9);
      scene.shake(1190, 9, 6);
      user.delay(790);
      user.anim({scale: 1.32, y: user.y + 8, time: 150}, 'decel');
      user.anim({time: 420}, 'swing');
    },
  },

  // MissingNo.'s G-Max move: a storm of corrupted data.
  gmaxglitch: {
    anim(scene, [user, target]) {
      scene.backgroundEffect('linear-gradient(#08000f, #26003f)', 2350, 0.92);
      user.anim({y: user.y + 22, time: 320}, 'decel');
      user.delay(1250);
      user.anim({time: 320}, 'swing');
      // It gathers static.
      scene.showEffect('pixelburst', {x: user.x, y: user.y + 30, z: user.z, scale: 3, opacity: 0, time: 0},
        {scale: 0.4, opacity: 1, time: 480}, 'accel', 'fade');
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        scene.showEffect('bit', {x: user.x + Math.cos(a) * 90, y: user.y + 30 + Math.sin(a) * 70, z: user.z, scale: 1.4, opacity: 0, time: i * 35},
          {x: user.x, y: user.y + 30, z: user.z, scale: 0.5, opacity: 1, time: 420 + i * 25}, 'accel', 'fade');
      }
      // A stream of corrupted data hits the target.
      for (let i = 0; i < 24; i++) {
        const fromAt = between(user, target, 0.05);
        const jitter = rnd(22);
        scene.showEffect(i % 3 ? 'bit' : 'glitchblock', {...fromAt, y: fromAt.y + 30 + jitter, scale: i % 3 ? 1.6 : 0.9, opacity: 1, time: 460 + i * 30},
          {x: target.x + rnd(18), y: target.y + 10 + jitter / 2, z: target.z, scale: i % 3 ? 1 : 0.6, opacity: 0.9, time: 760 + i * 30}, 'accel', 'fade');
      }
      scene.screenGlitch(700, 1250, 2);
      // Broken shards rain down on it.
      for (let i = 0; i < 16; i++) {
        const dx = rnd(65);
        scene.showEffect('glitchshard', {x: target.x + dx, y: target.y + 230, z: target.z, scale: 0.75, opacity: 1, time: 1000 + i * 42},
          {x: target.x + dx * 0.4, y: target.y + 5, z: target.z, scale: 0.4, opacity: 0.3, time: 1290 + i * 42}, 'accel', 'explode');
      }
      shudder(target, 1000, 10, 10, 50);
      // The crash.
      scene.showEffect('pixelburst', {x: target.x, y: target.y + 10, z: target.z, scale: 0.5, opacity: 1, time: 1680},
        {scale: 5.5, opacity: 0, time: 2150}, 'decel');
      scene.showEffect('shockwave', {x: target.x, y: target.y + 10, z: target.z, scale: 0.3, opacity: 1, time: 1680},
        {scale: 3.6, opacity: 0, time: 2150}, 'decel', null, CYAN);
      scene.showEffect('shockwave', {x: target.x, y: target.y + 10, z: target.z, scale: 0.3, opacity: 0.9, time: 1800},
        {scale: 2.8, opacity: 0, time: 2250}, 'decel');
      scene.flash('#ffffff', 1670, 300, 0.95);
      scene.shake(1680, 16, 9, 42);
    },
  },

  // Megatron's signature: an antimatter blast from his fusion cannon.
  fusioncannon: {
    anim(scene, [user, target]) {
      scene.backgroundEffect('#03000a', 2350, 0.92);
      const muzzle = between(user, target, 0.13);
      muzzle.y += 18;
      // Energy converges on the cannon.
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 75 + Math.random() * 40;
        scene.showEffect('spark', {x: muzzle.x + Math.cos(a) * r, y: muzzle.y + Math.sin(a) * r * 0.75, z: muzzle.z, scale: 1.1, opacity: 0, time: i * 40},
          {...muzzle, scale: 0.35, opacity: 1, time: 380 + i * 30}, 'accel', 'fade');
      }
      scene.showEffect('beamcore', {...muzzle, scale: 0.08, opacity: 0.6, time: 0}, {scale: 0.85, opacity: 1, time: 900}, 'linear', 'fade');
      scene.showEffect('shockwave', {...muzzle, scale: 1.4, opacity: 0, time: 520}, {scale: 0.15, opacity: 0.9, time: 900}, 'accel', 'fade');
      // Fire: the recoil, the beam, the antimatter.
      user.delay(930);
      user.anim({z: user.behind(22), x: user.leftof(-6), time: 110}, 'decel');
      user.anim({time: 520}, 'swing');
      scene.flash('#e9dcff', 920, 160, 0.55);
      for (let i = 0; i < 26; i++) {
        scene.showEffect('beamcore', {...muzzle, scale: 0.8, opacity: 0.95, time: 930 + i * 20},
          {x: target.x, y: target.y + 8, z: target.z, scale: 0.95, opacity: 0.85, time: 1110 + i * 20}, 'linear', 'fade');
      }
      scene.showEffect('antimatter', {...muzzle, scale: 0.5, opacity: 1, time: 920},
        {x: target.x, y: target.y + 8, z: target.z, scale: 0.85, opacity: 1, time: 1110}, 'accel');
      // Impact.
      scene.showEffect('antimatter', {x: target.x, y: target.y + 8, z: target.z, scale: 0.8, opacity: 1, time: 1120},
        {scale: 3.4, opacity: 0, time: 1580}, 'decel');
      scene.showEffect('shockwave', {x: target.x, y: target.y + 8, z: target.z, scale: 0.3, opacity: 1, time: 1130},
        {scale: 3.2, opacity: 0, time: 1560}, 'decel');
      scene.showEffect('shockwave', {x: target.x, y: target.y + 8, z: target.z, scale: 0.3, opacity: 0.8, time: 1250},
        {scale: 2.6, opacity: 0, time: 1700}, 'decel');
      scene.flash('#ffffff', 1110, 240, 0.9);
      scene.shake(1120, 17, 10, 40);
      target.delay(1120);
      target.anim({z: target.behind(28), time: 120}, 'decel');
      target.anim({x: target.x + 6, time: 60});
      target.anim({x: target.x - 6, time: 60});
      target.anim({time: 420}, 'swing');
      for (let i = 0; i < 5; i++) {
        const dx = (i - 2) * 26;
        scene.showEffect('darkflame', {x: target.x + dx, y: target.y - 30, z: target.z, scale: 0.4, opacity: 0.9, time: 1280 + i * 60},
          {y: target.y + 45 + Math.random() * 25, scale: 0.85, opacity: 0, time: 1900 + i * 60}, 'decel');
      }
    },
  },

  // Megatron's ultimate command: Attack and Sp. Atk up, defences down.
  peacethroughtyranny: {
    anim(scene, [user]) {
      scene.backgroundEffect('radial-gradient(circle at 30% 75%, #400012, #0a0004 72%)', 1950, 0.92);
      // His crest spreads across the floor beneath him.
      scene.showEffect('sigil', {x: user.x, y: user.y - 52, z: user.z, scale: 0.2, yscale: 0.08, opacity: 0, time: 0},
        {scale: 1.35, yscale: 0.42, opacity: 0.9, time: 520}, 'decel');
      scene.showEffect('sigil', {x: user.x, y: user.y - 52, z: user.z, scale: 1.35, yscale: 0.42, opacity: 0.9, time: 520},
        {scale: 1.75, yscale: 0.55, opacity: 0, time: 1700}, 'linear');
      // Dark flames rise around him.
      for (let i = 0; i < 8; i++) {
        const dx = (i - 3.5) * 21;
        scene.showEffect('darkflame', {x: user.x + dx, y: user.y - 55, z: user.z, scale: 0.45, opacity: 0.95, time: 180 + i * 65},
          {y: user.y + 40 + Math.random() * 30, scale: 1, opacity: 0, time: 880 + i * 65}, 'decel');
      }
      // Power surging up (Attack, Sp. Atk +2)...
      for (let i = 0; i < 14; i++) {
        const dx = rnd(55);
        scene.showEffect('spark', {x: user.x + dx, y: user.y - 30, z: user.z, scale: 1.3, opacity: 1, time: 600 + i * 40},
          {x: user.x + dx, y: user.y + 120 + Math.random() * 30, z: user.z, scale: 0.5, opacity: 0, time: 1100 + i * 40}, 'accel', null, RED);
      }
      // ...and his guard falling away (Defense, Sp. Def -1).
      for (let i = 0; i < 6; i++) {
        const dx = rnd(50);
        scene.showEffect('bit', {x: user.x + dx, y: user.y + 50, z: user.z, scale: 1.1, opacity: 0.8, time: 900 + i * 60},
          {x: user.x + dx, y: user.y - 40, z: user.z, scale: 0.5, opacity: 0, time: 1350 + i * 60}, 'accel', null, {filter: 'grayscale(1) brightness(.8)'});
      }
      // The command: a roar of red light.
      user.delay(480);
      user.anim({scale: 1.2, y: user.y + 6, time: 220}, 'decel');
      user.anim({time: 520}, 'swing');
      scene.showEffect('shockwave', {x: user.x, y: user.y + 10, z: user.z, scale: 0.3, opacity: 1, time: 700},
        {scale: 3, opacity: 0, time: 1200}, 'decel', null, RED);
      scene.flash('#5a0010', 690, 260, 0.4);
      scene.shake(700, 8, 6);
    },
  },
};

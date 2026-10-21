// Plays Pokémon Showdown's move animations (vendor/showdown/) on our stadium.
//
// Showdown's animations are written for its own 640x360 battle screen, where
// each Pokémon has a position (x, y, z: your side at z 0, the foe at z 200).
// This scene gives them the same interface (showEffect, backgroundEffect,
// sprites that move with anim(...)), and maps Showdown's screen onto ours:
// positions are fitted so each Showdown Pokémon lands exactly on ours, and
// effects are scaled evenly so they keep their shape.
//
// While an animation plays, every Pokémon on the field is drawn as a copy in
// the effect layer (so the animation can move it), and the real sprite is
// hidden; afterwards the real ones come back.
import $ from 'jquery';
import {BattleMoveAnims} from '../../../vendor/showdown/battle-animations-moves';
import {BattleOtherAnims, BattleStatusAnims, BattleEffects} from '../../../vendor/showdown/battle-animations';
import {Config} from '../../../vendor/showdown/config';
import {assetUrl} from '../sprites.jsx';
import {dex} from '../../engine/dex.js';
import {CUSTOM_ANIMS, CUSTOM_EFFECTS} from './custom.js';

const FX_DIR = 'showdown-fx/';
const fxUrl = name => assetUrl(FX_DIR + name);

// Image URLs, once: Showdown's effects from our assets, plus our own.
let prepared = false;
function prepare() {
  if (prepared) return;
  prepared = true;
  Config.root = '';
  for (const effect of Object.values(BattleEffects)) {
    if (effect.url && !/^(blob:|data:|https?:|\/)/.test(effect.url)) effect.url = fxUrl(effect.url);
  }
  for (const [id, effect] of Object.entries(CUSTOM_EFFECTS)) BattleEffects[id] = {...effect, url: effect.url && assetUrl(effect.url)};
}

// A move without its own animation borrows a well-known move's of the same type
// and kind; a G-Max move borrows its type's Max Move.
const MAX_BY_TYPE = {
  Normal: 'maxstrike', Fire: 'maxflare', Water: 'maxgeyser', Grass: 'maxovergrowth', Electric: 'maxlightning',
  Ice: 'maxhailstorm', Fighting: 'maxknuckle', Poison: 'maxooze', Ground: 'maxquake', Flying: 'maxairstream',
  Psychic: 'maxmindstorm', Bug: 'maxflutterby', Rock: 'maxrockfall', Ghost: 'maxphantasm', Dragon: 'maxwyrmwind',
  Dark: 'maxdarkness', Steel: 'maxsteelspike', Fairy: 'maxstarfall',
};
const STAND_INS = {
  Physical: {
    Normal: 'bodyslam', Fire: 'flareblitz', Water: 'waterfall', Grass: 'leafblade', Electric: 'wildcharge', Ice: 'iciclecrash',
    Fighting: 'closecombat', Poison: 'poisonjab', Ground: 'earthquake', Flying: 'bravebird', Psychic: 'zenheadbutt', Bug: 'xscissor',
    Rock: 'stoneedge', Ghost: 'shadowclaw', Dragon: 'dragonclaw', Dark: 'crunch', Steel: 'ironhead', Fairy: 'playrough',
  },
  Special: {
    Normal: 'hypervoice', Fire: 'flamethrower', Water: 'surf', Grass: 'energyball', Electric: 'thunderbolt', Ice: 'icebeam',
    Fighting: 'aurasphere', Poison: 'sludgebomb', Ground: 'earthpower', Flying: 'airslash', Psychic: 'psychic', Bug: 'bugbuzz',
    Rock: 'powergem', Ghost: 'shadowball', Dragon: 'dragonpulse', Dark: 'darkpulse', Steel: 'flashcannon', Fairy: 'moonblast',
  },
};

function standIn(id) {
  const move = dex.moves.get(id);
  if (!move.exists) return BattleMoveAnims.tackle;
  if (move.isMax && MAX_BY_TYPE[move.type]) return BattleMoveAnims[MAX_BY_TYPE[move.type]];
  if (move.category === 'Status') return BattleOtherAnims[move.target === 'self' ? 'selfstatus' : 'lightstatus'] || BattleMoveAnims.tackle;
  return BattleMoveAnims[STAND_INS[move.category]?.[move.type]] || BattleMoveAnims.tackle;
}

/** Showdown's screen position for a location (its BattleScene#pos, gen 6+ sprites). */
function showdownPos(loc, obj) {
  loc = {x: 0, y: 0, z: 0, scale: 1, opacity: 1, ...loc};
  if (!loc.xscale && loc.xscale !== 0) loc.xscale = loc.scale;
  if (!loc.yscale && loc.yscale !== 0) loc.yscale = loc.scale;
  let left = 210;
  let top = 245;
  let scale = 1.5 - 0.5 * (loc.z / 200);
  if (scale < 0.1) scale = 0.1;
  left += (410 - 190) * (loc.z / 200);
  top += (135 - 245) * (loc.z / 200);
  left += Math.floor(loc.x * scale);
  top -= Math.floor(loc.y * scale);
  const width = Math.floor(obj.w * scale * loc.xscale);
  const height = Math.floor(obj.h * scale * loc.yscale);
  const hoffset = Math.floor((obj.h - (obj.y || 0) * 2) * scale * loc.yscale);
  // The point the effect is centred on, before Showdown subtracts half its size.
  return {cx: left, cy: top, width, height, hoffset, opacity: loc.opacity, display: loc.display};
}

/** Least-squares line through (a, b) pairs: b ≈ k·a + m. */
function fitLine(pairs) {
  const n = pairs.length;
  const ma = pairs.reduce((s, [a]) => s + a, 0) / n;
  const mb = pairs.reduce((s, [, b]) => s + b, 0) / n;
  let num = 0;
  let den = 0;
  for (const [a, b] of pairs) {
    num += (a - ma) * (b - mb);
    den += (a - ma) ** 2;
  }
  const k = den ? num / den : 1;
  return {k, m: mb - k * ma};
}

/** A Pokémon as Showdown's animations see it (its PokemonSprite interface). */
class FxSprite {
  constructor(scene, {x, y, z, isFrontSprite, el = null, sp = null, missed = false}) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.z = z;
    this.isFrontSprite = isFrontSprite;
    this.isMissedPokemon = missed;
    this.sp = sp || {w: 0, h: 0, url: ''};
    this.$el = el ? $(el) : $();
    this.dx = 0; // nudges so the copy sits exactly on the real sprite
    this.dy = 0;
    this.isSubActive = false;
  }

  delay(time) {
    if (this.$el.length) this.$el.delay(this.scene.t(time));
    return this;
  }

  anim(end, transition) {
    if (!this.$el.length) return this;
    end = {x: this.x, y: this.y, z: this.z, scale: 1, opacity: 1, time: 500, ...end};
    const to = this.scene.posT(end, this.sp, transition, this);
    to.left = [to.left[0] + this.dx, to.left[1]];
    to.top = [to.top[0] + this.dy, to.top[1]];
    this.$el.animate(to, this.scene.t(end.time));
    return this;
  }

  behindx(offset) {
    return this.x + (this.isFrontSprite ? 1 : -1) * offset;
  }

  behindy(offset) {
    return this.y + (this.isFrontSprite ? -1 : 1) * offset;
  }

  leftof(offset) {
    return this.x + (this.isFrontSprite ? 1 : -1) * offset;
  }

  behind(offset) {
    return this.z + (this.isFrontSprite ? 1 : -1) * offset;
  }
}

export class FxScene {
  /**
   * @param {HTMLElement} host an empty element covering the arena
   * @param {{activeCount: number, perspective: 'p1'|'p2'}} options
   */
  constructor(host, {activeCount = 1, perspective = 'p1'} = {}) {
    prepare();
    this.host = host;
    this.arena = host.parentElement;
    this.activeCount = activeCount;
    this.perspective = perspective;
    // What Showdown's animations read from their scene.
    this.gen = 9;
    this.mod = '';
    this.animating = true;
    this.acceleration = 1;
    this.bgmNum = 0;
    this.battle = {mySide: {x: 0, y: 0, z: 0}, gameType: activeCount > 1 ? 'doubles' : 'singles', gen: 9};
    this.timeOffset = 0;
    this.minDelay = 0;
    this.timeScale = 1;
    this.$host = $(host);
    this.$bgEffect = $('<div class="fx-bg"></div>').appendTo(this.$host);
    this.$sprites = $('<div class="fx-sprites"></div>').appendTo(this.$host);
    this.$fx = $('<div class="fx-effects"></div>').appendTo(this.$host);
    this.$delay = $('<div></div>');
    // Showdown's backdrop: Earthquake & co. shake it (top -100 at rest). It's a
    // stand-in whose movement is copied onto the arena's background layers.
    this.$bg = $('<div class="fx-bg-proxy"></div>').css({position: 'absolute', top: -100, bottom: 0, display: 'none'}).appendTo(this.$host);
    this.shakeFrame = 0;
    this.activeAnimations = $();
    this.map = {ax: 1, bx: 0, ay: 1, by: 0, s: 1};
    this.sprites = {};
    this.playing = null;
  }

  // ---- what Showdown's animations call ----

  t(time) {
    return Math.max(0, Math.round((time || 0) * this.timeScale));
  }

  pos(loc, obj) {
    const p = showdownPos(loc, obj);
    const {ax, bx, ay, by, s} = this.map;
    const width = Math.floor(p.width * s);
    const height = Math.floor(p.height * s);
    const out = {
      left: Math.floor(ax * p.cx + bx - width / 2),
      top: Math.floor(ay * p.cy + by - (p.hoffset * s) / 2),
      width,
      height,
      opacity: p.opacity,
    };
    if (p.display) out.display = p.display;
    return out;
  }

  posT(loc, obj, transition, oldLoc) {
    const pos = this.pos(loc, obj);
    const oldPos = oldLoc ? this.pos(oldLoc, obj) : null;
    const map = {left: 'linear', top: 'linear', width: 'linear', height: 'linear', opacity: 'linear'};
    if (transition === 'ballistic') map.top = pos.top < oldPos.top ? 'ballisticUp' : 'ballisticDown';
    if (transition === 'ballisticUnder') map.top = pos.top < oldPos.top ? 'ballisticDown' : 'ballisticUp';
    if (transition === 'ballistic2') map.top = pos.top < oldPos.top ? 'quadUp' : 'quadDown';
    if (transition === 'ballistic2Back') map.top = loc.z > 0 ? 'quadUp' : 'quadDown';
    if (transition === 'ballistic2Under') map.top = pos.top < oldPos.top ? 'quadDown' : 'quadUp';
    if (transition === 'swing') Object.assign(map, {left: 'swing', top: 'swing', width: 'swing', height: 'swing'});
    if (transition === 'accel') Object.assign(map, {left: 'quadDown', top: 'quadDown', width: 'quadDown', height: 'quadDown'});
    if (transition === 'decel') Object.assign(map, {left: 'quadUp', top: 'quadUp', width: 'quadUp', height: 'quadUp'});
    return {
      left: [pos.left, map.left],
      top: [pos.top, map.top],
      width: [pos.width, map.width],
      height: [pos.height, map.height],
      opacity: [pos.opacity, map.opacity],
    };
  }

  showEffect(effect, start, end, transition, after, additionalCss) {
    if (typeof effect === 'string') effect = BattleEffects[effect];
    if (!effect) return $();
    let $effect = effect.rawHTML ? $(effect.rawHTML).css({display: 'block', position: 'absolute'}) :
      $(`<img src="${effect.url}" style="display:block;position:absolute" alt="" />`);
    if (effect.pixelated) $effect.addClass('pixelated');
    this.$fx.append($effect);
    if (additionalCss) $effect.css(additionalCss);
    $effect = this.$fx.children().last();
    return this.animateEffect($effect, effect, start, end, transition, after);
  }

  animateEffect($effect, effect, start, end, transition, after) {
    if (typeof effect === 'string') effect = BattleEffects[effect];
    start = {...start};
    end = {...end};
    if (!start.time) start.time = 0;
    if (!end.time) end.time = start.time + 500;
    start.time += this.timeOffset;
    end.time += this.timeOffset;
    if (!end.scale && end.scale !== 0 && start.scale) end.scale = start.scale;
    if (!end.xscale && end.xscale !== 0 && start.xscale) end.xscale = start.xscale;
    if (!end.yscale && end.yscale !== 0 && start.yscale) end.yscale = start.yscale;
    end = {...start, ...end};
    const startpos = this.pos(start, effect);
    const endpos = this.posT(end, effect, transition, start);
    if (start.time) {
      $effect.css({...startpos, opacity: 0});
      $effect.delay(this.t(start.time)).animate({opacity: startpos.opacity}, 1);
    } else if ($effect.queue().length) {
      $effect.animate(startpos, 0);
    } else {
      $effect.css(startpos);
    }
    $effect.animate(endpos, this.t(end.time - start.time));
    if (after === 'fade') $effect.animate({opacity: 0}, this.t(100));
    if (after === 'explode') {
      if (end.scale) end.scale *= 3;
      if (end.xscale) end.xscale *= 3;
      if (end.yscale) end.yscale *= 3;
      end.opacity = 0;
      $effect.animate(this.pos(end, effect), this.t(200));
    }
    this.waitFor($effect);
    return $effect;
  }

  backgroundEffect(bg, duration, opacity = 1, delay = 0) {
    // Showdown's backdrops are its own images: point their URLs at ours.
    bg = String(bg).replace(/url\((['"]?)[^'")]*?fx\/([A-Za-z0-9_.-]+)\1\)/g, (_, q, name) => `url('${fxUrl(name)}')`);
    const $effect = $('<div class="fx-background"></div>').css({background: bg, backgroundSize: 'cover', backgroundPosition: 'center', display: 'block', opacity: 0});
    this.$bgEffect.append($effect);
    $effect.delay(this.t(delay)).animate({opacity}, this.t(250)).delay(this.t(duration - 250));
    $effect.animate({opacity: 0}, this.t(250));
    this.waitFor($effect);
  }

  wait(time) {
    this.timeOffset += time;
  }

  waitFor(elem) {
    this.activeAnimations = this.activeAnimations.add(elem);
  }

  // ---- extras for the site's own animations (fx/custom.js) ----

  /** A full-screen flash over everything, `at` ms in. */
  flash(color, at = 0, duration = 220, opacity = 0.85) {
    const $el = $('<div class="fx-flash"></div>').css({background: color, opacity: 0}).appendTo(this.$fx);
    $el.delay(this.t(at + this.timeOffset)).animate({opacity}, this.t(60)).animate({opacity: 0}, this.t(duration));
    this.waitFor($el);
    return $el;
  }

  /** The screen tears and flickers like a broken signal, from `at` for `duration` ms. */
  screenGlitch(at = 0, duration = 700, strength = 1) {
    const $el = $('<div class="fx-glitch-overlay"></div>').css({
      backgroundImage: `url('${assetUrl('fx-custom/tearbars.png')}'), url('${assetUrl('fx-custom/noise.png')}')`,
      opacity: Math.min(1, 0.55 + 0.35 * strength),
    }).appendTo(this.$fx);
    const arena = this.arena;
    $el.delay(this.t(at + this.timeOffset)).queue(next => {
      $el.css('display', 'block');
      arena.classList.add('fx-glitching');
      if (strength > 1) arena.classList.add('fx-glitching-hard');
      next();
    }).delay(this.t(duration)).queue(next => {
      $el.css('display', 'none');
      arena.classList.remove('fx-glitching', 'fx-glitching-hard');
      next();
    });
    this.waitFor($el);
  }

  /** Shakes the arena: `times` jolts of up to `strength` px (Showdown units), from `at`. */
  shake(at = 0, strength = 10, times = 6, each = 45) {
    this.$bg.delay(this.t(at + this.timeOffset));
    for (let i = 0; i < times; i++) {
      const k = (i % 2 ? -1 : 1) * strength * (1 - i / (times + 1));
      this.$bg.animate({top: -100 + k}, this.t(each));
    }
    this.$bg.animate({top: -100}, this.t(each));
    this.waitFor(this.$bg);
  }

  updateSidebar() {}

  setBgm() {}

  rollBgm() {}

  // ---- running animations ----

  /** Builds a copy of each Pokémon on the field and fits Showdown's screen onto ours. */
  setUp(field) {
    this.$sprites.empty();
    this.sprites = {};
    const box = this.arena.getBoundingClientRect();
    const anchors = [];
    for (const mon of field) {
      const el = this.arena.querySelector(`.mon[data-slot="${mon.slot}"] .mon-body > .sprite`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const far = mon.side !== this.perspective;
      const slot = mon.index;
      let x = 0;
      if (this.activeCount === 2) x = (slot * -75 + 18) * (far ? 1 : -1);
      if (this.activeCount === 3) x = (slot * -70 + 20) * (far ? 1 : -1);
      const y = far ? slot * 7 : slot * -10;
      const z = far ? 200 : 0;
      const at = showdownPos({x, y, z}, {w: 0, h: 0});
      const real = {x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2, w: r.width, h: r.height};
      anchors.push({mon, el, x, y, z, far, at, real});
    }
    if (anchors.length >= 2) {
      const fx = fitLine(anchors.map(a => [a.at.cx, a.real.x]));
      const fy = fitLine(anchors.map(a => [a.at.cy, a.real.y]));
      const s = Math.sqrt(Math.abs(fx.k * fy.k)) || 1;
      this.map = {ax: fx.k, bx: fx.m, ay: fy.k, by: fy.m, s};
    } else {
      const s = box.width / 640;
      this.map = {ax: s, bx: 0, ay: box.height / 360, by: 0, s};
    }
    for (const a of anchors) {
      const zScale = 1.5 - 0.5 * (a.z / 200);
      const sp = {w: a.real.w / (zScale * this.map.s), h: a.real.h / (zScale * this.map.s), url: '', shiny: !!a.mon.shiny};
      const copy = this.copyOf(a.el);
      this.$sprites.append(copy);
      const sprite = new FxSprite(this, {x: a.x, y: a.y, z: a.z, isFrontSprite: a.far, el: copy, sp});
      const rest = this.pos({x: a.x, y: a.y, z: a.z}, sp);
      sprite.dx = a.real.x - a.real.w / 2 - rest.left;
      sprite.dy = a.real.y - a.real.h / 2 - rest.top;
      $(copy).css({left: rest.left + sprite.dx, top: rest.top + sprite.dy, width: rest.width, height: rest.height});
      sprite.realEl = a.el.closest('.mon');
      this.sprites[a.mon.slot] = sprite;
    }
  }

  /** A copy of a sprite whose sheet image scales with the element (background in %). */
  copyOf(el) {
    const copy = document.createElement('div');
    copy.className = 'fx-mon';
    const cs = getComputedStyle(el);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const [sw, sh] = cs.backgroundSize.split(' ').map(parseFloat);
    const [px, py] = cs.backgroundPosition.split(' ').map(parseFloat);
    copy.style.backgroundImage = cs.backgroundImage;
    copy.style.backgroundRepeat = 'no-repeat';
    copy.style.backgroundSize = `${(sw / w) * 100}% ${(sh / h) * 100}%`;
    copy.style.backgroundPosition = `${sw === w ? 0 : (-px / (sw - w)) * 100}% ${sh === h ? 0 : (-py / (sh - h)) * 100}%`;
    if (cs.transform && cs.transform !== 'none') copy.style.transform = cs.transform;
    const body = el.closest('.mon-body');
    if (body) copy.style.filter = getComputedStyle(body).filter;
    return copy;
  }

  spriteFor(slot) {
    return this.sprites[slot] || null;
  }

  /** Where a missed attack goes: past the target, invisible (Showdown's missedPokemon). */
  missedNear(target) {
    if (!target) return new FxSprite(this, {x: 0, y: 0, z: 200, isFrontSprite: true, missed: true});
    return new FxSprite(this, {x: target.leftof(-100), y: target.y, z: target.z, isFrontSprite: target.isFrontSprite, missed: true});
  }

  /**
   * Plays one animation. kind: 'move' | 'prepare' | 'other' | 'status' | 'residual'.
   * `field`: every Pokémon on the field ({slot, side, index, shiny}); `slots`: the
   * participants ('miss:p2a' = just past p2a, for a miss). Resolves when it's done.
   */
  play(kind, id, field, slots) {
    this.stop();
    const table = kind === 'other' ? BattleOtherAnims : kind === 'status' ? BattleStatusAnims : null;
    let entry = table ? table[id] : (CUSTOM_ANIMS[id] || BattleMoveAnims[id]);
    if (kind === 'move' && !entry) entry = standIn(id);
    const fn = !entry ? null : kind === 'prepare' ? entry.prepareAnim : kind === 'residual' ? entry.residualAnim : entry.anim;
    if (!fn) return Promise.resolve();
    this.setUp(field);
    const args = slots.map(slot => (slot.startsWith('miss:') ? this.missedNear(this.spriteFor(slot.slice(5))) : this.spriteFor(slot)));
    if (!args[0]) return Promise.resolve();
    for (let i = 1; i < args.length; i++) if (!args[i]) args[i] = this.missedNear(null);
    if (args.length < 2) args.push(args[0]);
    this.activeAnimations = $();
    this.timeOffset = 0;
    this.minDelay = 0;
    for (const sprite of Object.values(this.sprites)) sprite.realEl?.classList.add('fx-hidden');
    this.host.classList.add('playing');
    this.followBackdrop();
    try {
      fn(this, args);
    } catch (err) {
      console.warn(`Animation ${id} failed`, err);
    }
    if (this.timeOffset) {
      this.$delay.delay(this.t(this.timeOffset));
      this.activeAnimations = this.activeAnimations.add(this.$delay);
    }
    for (const sprite of Object.values(this.sprites)) this.waitFor(sprite.$el);
    const done = this.activeAnimations.length ? this.activeAnimations.promise() : Promise.resolve();
    const token = {};
    this.playing = token;
    return new Promise(resolve => {
      $.when(done).always(() => {
        if (this.playing === token) this.cleanUp();
        resolve();
      });
    });
  }

  /** Ends whatever is playing now and puts the real sprites back. */
  stop() {
    if (!this.playing) return;
    this.playing = null;
    this.$host.find('*').stop(true, true);
    this.$delay.stop(true, true);
    this.cleanUp();
  }

  /** Copies the stand-in backdrop's movement onto the arena while something plays. */
  followBackdrop() {
    cancelAnimationFrame(this.shakeFrame);
    const step = () => {
      const top = parseFloat(this.$bg.css('top')) || -100;
      this.arena.style.setProperty('--fx-shake', `${((top + 100) * this.map.s).toFixed(1)}px`);
      if (this.playing || this.host.classList.contains('playing')) this.shakeFrame = requestAnimationFrame(step);
    };
    this.shakeFrame = requestAnimationFrame(step);
  }

  cleanUp() {
    cancelAnimationFrame(this.shakeFrame);
    this.$bg.stop(true).css({top: -100, bottom: 0});
    this.arena.style.removeProperty('--fx-shake');
    this.arena.classList.remove('fx-glitching', 'fx-glitching-hard');
    this.playing = null;
    this.$fx.empty();
    this.$bgEffect.empty();
    this.$sprites.empty();
    this.host.classList.remove('playing');
    for (const sprite of Object.values(this.sprites)) sprite.realEl?.classList.remove('fx-hidden');
    this.sprites = {};
  }

  destroy() {
    this.stop();
    cancelAnimationFrame(this.shakeFrame);
    this.$host.empty();
  }
}

/** Is there an animation for this? */
export function hasAnim(kind, id) {
  if (kind === 'other') return !!BattleOtherAnims[id];
  if (kind === 'status') return !!BattleStatusAnims[id];
  return !!(CUSTOM_ANIMS[id] || BattleMoveAnims[id]);
}


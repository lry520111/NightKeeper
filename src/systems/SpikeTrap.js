// SpikeTrap.js
// Random spike traps that pop up periodically from the floor
// Deals damage to the player if they're standing on it when it activates

import Phaser from 'phaser';

// Spike parameters
const SPIKE_SIZE = 28;             // Spike tile size (pixels)
const WARN_DURATION_MS = 800;      // Warning flash before spikes emerge
const ACTIVE_DURATION_MS = 1200;   // How long spikes stay up
const COOLDOWN_MIN_MS = 3000;      // Min time between activations
const COOLDOWN_MAX_MS = 6000;      // Max time between activations
const DAMAGE_RADIUS = 20;          // Hit detection radius (pixels)
const SPIKE_DAMAGE = 1;            // Damage dealt to player

export default class SpikeTrap {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x - World X position (center)
   * @param {number} y - World Y position (center)
   */
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;

    // State machine: idle → warning → active → cooldown → idle
    this.state = 'idle';
    this.stateTimer = this._randomCooldown();
    this.hasHitThisCycle = false;

    // Callback
    this.onHitPlayer = null; // (trap) => void

    // Graphics
    this.graphics = scene.add.graphics().setDepth(3);
    this._drawIdle();
  }

  _randomCooldown() {
    return COOLDOWN_MIN_MS + Math.random() * (COOLDOWN_MAX_MS - COOLDOWN_MIN_MS);
  }

  /**
   * Update spike trap state
   * @param {number} delta - Frame delta in ms
   * @param {Phaser.Physics.Arcade.Sprite} playerSprite - Player sprite
   */
  update(delta, playerSprite) {
    this.stateTimer -= delta;

    switch (this.state) {
      case 'idle':
        if (this.stateTimer <= 0) {
          this.state = 'warning';
          this.stateTimer = WARN_DURATION_MS;
          this.hasHitThisCycle = false;
        }
        break;

      case 'warning':
        this._drawWarning();
        if (this.stateTimer <= 0) {
          this.state = 'active';
          this.stateTimer = ACTIVE_DURATION_MS;
        }
        break;

      case 'active':
        this._drawActive();
        // Check player collision
        if (!this.hasHitThisCycle && playerSprite) {
          const dx = playerSprite.x - this.x;
          const dy = playerSprite.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < DAMAGE_RADIUS) {
            this.hasHitThisCycle = true;
            if (this.onHitPlayer) this.onHitPlayer(this);
          }
        }
        if (this.stateTimer <= 0) {
          this.state = 'cooldown';
          this.stateTimer = this._randomCooldown();
          this._drawIdle();
        }
        break;

      case 'cooldown':
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = this._randomCooldown();
        }
        break;
    }
  }

  _drawIdle() {
    const g = this.graphics;
    g.clear();
    // Subtle floor marking (small dark square with dots)
    g.fillStyle(0x1a1a1a, 0.4);
    g.fillRect(this.x - SPIKE_SIZE / 2, this.y - SPIKE_SIZE / 2, SPIKE_SIZE, SPIKE_SIZE);
    // Corner dots hint at trap
    const dotR = 2;
    g.fillStyle(0x444444, 0.5);
    g.fillCircle(this.x - 8, this.y - 8, dotR);
    g.fillCircle(this.x + 8, this.y - 8, dotR);
    g.fillCircle(this.x - 8, this.y + 8, dotR);
    g.fillCircle(this.x + 8, this.y + 8, dotR);
  }

  _drawWarning() {
    const g = this.graphics;
    g.clear();
    // Flashing red/orange warning
    const flash = Math.sin(Date.now() * 0.015) > 0;
    const color = flash ? 0xff6600 : 0xff2200;
    g.fillStyle(color, 0.4);
    g.fillRect(this.x - SPIKE_SIZE / 2, this.y - SPIKE_SIZE / 2, SPIKE_SIZE, SPIKE_SIZE);
    // Exclamation mark
    g.fillStyle(0xffcc00, 0.8);
    g.fillRect(this.x - 2, this.y - 10, 4, 12);
    g.fillCircle(this.x, this.y + 6, 3);
  }

  _drawActive() {
    const g = this.graphics;
    g.clear();
    // Spikes emerged - draw pointed triangles
    g.fillStyle(0x888888, 0.9);
    // 4 spike points
    const offsets = [
      { dx: -6, dy: -6 }, { dx: 6, dy: -6 },
      { dx: -6, dy: 6 },  { dx: 6, dy: 6 },
    ];
    for (const o of offsets) {
      const cx = this.x + o.dx;
      const cy = this.y + o.dy;
      g.fillTriangle(
        cx, cy - 8,      // top point
        cx - 4, cy + 4,  // bottom left
        cx + 4, cy + 4   // bottom right
      );
    }
    // Center spike (bigger)
    g.fillStyle(0xaaaaaa, 1);
    g.fillTriangle(
      this.x, this.y - 10,
      this.x - 5, this.y + 5,
      this.x + 5, this.y + 5
    );
    // Red glow around base
    g.lineStyle(2, 0xff3333, 0.5);
    g.strokeRect(this.x - SPIKE_SIZE / 2, this.y - SPIKE_SIZE / 2, SPIKE_SIZE, SPIKE_SIZE);
  }

  destroy() {
    if (this.graphics) this.graphics.destroy();
  }
}

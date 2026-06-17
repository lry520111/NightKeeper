// SecurityCamera.js
// Rotating security camera with cone-shaped light beam
// When the player is caught in the beam for a short delay, triggers alarm

import Phaser from 'phaser';

// Camera parameters
const CAMERA_RANGE = 180;          // Beam length (pixels)
const CAMERA_HALF_ANGLE = Math.PI / 6; // Beam half-angle (~30° total 60°)
const ROTATION_SPEED = 0.8;        // Rotation speed (radians/sec)
const SWEEP_ANGLE = Math.PI * 0.8; // Total sweep arc (~144°)
const DETECT_DELAY_MS = 600;       // Time in beam before alarm triggers (ms)
const BEAM_COLOR = 0xff4444;       // Red beam color
const BEAM_ALPHA = 0.18;           // Beam transparency

export default class SecurityCamera {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {number} baseAngle - Center angle of sweep (radians, 0=right)
   */
  constructor(scene, x, y, baseAngle = -Math.PI / 2) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.baseAngle = baseAngle;
    this.currentAngle = baseAngle;
    this.sweepDir = 1; // 1 or -1
    this.sweepProgress = 0; // 0~1

    // Detection state
    this.playerInBeam = false;
    this.detectTimer = 0;
    this.triggered = false;

    // Callback
    this.onAlarm = null; // () => void

    // Graphics
    this.graphics = scene.add.graphics().setDepth(8);

    // Camera body sprite (small red dot)
    this.body = scene.add.circle(x, y, 6, 0xff2222, 1).setDepth(9);
    // Pulsing ring
    this.ring = scene.add.circle(x, y, 10, 0xff0000, 0).setDepth(9);
    this.ring.setStrokeStyle(2, 0xff4444, 0.7);
  }

  /**
   * Update camera rotation and detection
   * @param {number} delta - Frame delta in ms
   * @param {Phaser.Physics.Arcade.Sprite} playerSprite - Player sprite
   */
  update(delta, playerSprite) {
    if (this.triggered) return;

    const dt = delta / 1000;

    // Sweep rotation
    this.sweepProgress += this.sweepDir * ROTATION_SPEED * dt / SWEEP_ANGLE;
    if (this.sweepProgress >= 1) {
      this.sweepProgress = 1;
      this.sweepDir = -1;
    } else if (this.sweepProgress <= 0) {
      this.sweepProgress = 0;
      this.sweepDir = 1;
    }
    this.currentAngle = this.baseAngle + (this.sweepProgress - 0.5) * SWEEP_ANGLE;

    // Check if player is in beam
    const inBeam = this._isPointInCone(playerSprite.x, playerSprite.y);

    if (inBeam) {
      this.detectTimer += delta;
      if (this.detectTimer >= DETECT_DELAY_MS) {
        this.triggered = true;
        if (this.onAlarm) this.onAlarm();
      }
    } else {
      this.detectTimer = Math.max(0, this.detectTimer - delta * 0.5); // Slow decay
    }

    this.playerInBeam = inBeam;

    // Draw beam
    this._drawBeam();
  }

  _isPointInCone(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > CAMERA_RANGE || dist < 5) return false;

    const angleToPlayer = Math.atan2(dy, dx);
    let diff = angleToPlayer - this.currentAngle;
    // Normalize to [-PI, PI]
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    return Math.abs(diff) <= CAMERA_HALF_ANGLE;
  }

  _drawBeam() {
    const g = this.graphics;
    g.clear();

    // Beam color changes based on detection state
    let color = BEAM_COLOR;
    let alpha = BEAM_ALPHA;
    if (this.playerInBeam) {
      color = 0xff0000;
      alpha = 0.35;
    }
    if (this.triggered) {
      color = 0xff0000;
      alpha = 0.5;
    }

    // Draw cone as filled triangle fan
    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(this.x, this.y);

    const segments = 12;
    const startAngle = this.currentAngle - CAMERA_HALF_ANGLE;
    const endAngle = this.currentAngle + CAMERA_HALF_ANGLE;
    const step = (endAngle - startAngle) / segments;

    for (let i = 0; i <= segments; i++) {
      const a = startAngle + step * i;
      g.lineTo(
        this.x + Math.cos(a) * CAMERA_RANGE,
        this.y + Math.sin(a) * CAMERA_RANGE
      );
    }

    g.closePath();
    g.fillPath();

    // Beam edge lines
    g.lineStyle(1, color, alpha * 2);
    g.lineBetween(
      this.x, this.y,
      this.x + Math.cos(startAngle) * CAMERA_RANGE,
      this.y + Math.sin(startAngle) * CAMERA_RANGE
    );
    g.lineBetween(
      this.x, this.y,
      this.x + Math.cos(endAngle) * CAMERA_RANGE,
      this.y + Math.sin(endAngle) * CAMERA_RANGE
    );

    // Pulsing ring effect when detecting
    if (this.playerInBeam && !this.triggered) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);
      this.ring.setAlpha(pulse * 0.6);
      this.ring.setScale(1 + pulse * 0.3);
    } else {
      this.ring.setAlpha(0.2);
      this.ring.setScale(1);
    }
  }

  destroy() {
    if (this.graphics) this.graphics.destroy();
    if (this.body) this.body.destroy();
    if (this.ring) this.ring.destroy();
  }
}

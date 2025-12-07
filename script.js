// script.js - Movement + Dash + Wall Jump + Stamina + Particles + Camera zoom
// Intégration avec ton level generator et HTML existants (btnSlash, btnStraight, btnTP, btnDash).

// --- CANVAS SETUP ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// --- GLOBALS / GAME VARIABLES ---
const gravity = 0.9;
let cameraX = 0, cameraY = 0;
let shakeScreen = 0;
let screenRed = 0;

// --- PARTICLES (simple system) ---
class Particle {
    constructor(x, y, vx, vy, life, size) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.life = life; this.maxLife = life; this.size = size;
    }
    update(dt) {
        this.vy += gravity * 0.02;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt * 1000;
    }
    draw() {
        const t = Math.max(0, this.life / this.maxLife);
        ctx.globalAlpha = Math.max(0, t);
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        ctx.globalAlpha = 1;
    }
}
const particles = [];
function spawnParticles(x, y, count = 8, spread = 2, speed = 2, size = 3, life = 400) {
    for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const v = (Math.random() * 0.6 + 0.7) * speed;
        particles.push(new Particle(x, y, Math.cos(ang) * v * spread, Math.sin(ang) * v * spread, life, size));
    }
}

// --- ADVANCED PLATFORM SYSTEM & LEVEL GENERATOR ---

class Platform {
    constructor(x, y, width, height, type = "normal") {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type; // normal | fragile | moving | wall
        this.baseX = x;
        this.dir = 1;
        this.broken = false;
    }

    update() {
        if (this.type === "moving") {
            this.x += this.dir * 1.2;
            if (this.x > this.baseX + 120 || this.x < this.baseX - 120) {
                this.dir *= -1;
            }
        }
    }

    draw() {
        if (this.broken) return;

        if (this.type === "normal") ctx.fillStyle = "#0f0";
        if (this.type === "fragile") ctx.fillStyle = "#ff0";
        if (this.type === "moving") ctx.fillStyle = "#0ff";
        if (this.type === "wall") ctx.fillStyle = "#f0f";

        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

function generateLevelPlatforms(totalLevels = 10, platformsPerLevel = 7) {
    const platforms = [];
    const spawnablePlatforms = [];

    const levelHeight = canvas.height / totalLevels;
    let worldX = 0;

    for (let lvl = 0; lvl < totalLevels; lvl++) {
        const y = canvas.height - (lvl + 1) * levelHeight + rand(-80, 80);
        let lastX = worldX;

        for (let i = 0; i < platformsPerLevel; i++) {

            // DIFFICULTY SCALING
            const difficulty = lvl / totalLevels;

            const width = rand(120, 260 - difficulty * 80);
            const gap = rand(90, 260 + difficulty * 200);
            const x = lastX + gap;

            let type = "normal";
            const roll = Math.random();

            if (roll < 0.12) type = "fragile";
            else if (roll < 0.22) type = "moving";

            const plat = new Platform(x, y, width, 20, type);
            platforms.push(plat);
            spawnablePlatforms.push(plat);

            // WALLS FOR WALL-JUMP
            if (Math.random() < 0.35) {
                const wallHeight = rand(120, 320);
                const wallY = y - wallHeight;
                const wallX = x + rand(30, width - 30);
                platforms.push(new Platform(wallX, wallY, 26, wallHeight, "wall"));
            }

            // VERTICAL PLAY (UPPER / LOWER PATHS)
            if (Math.random() < 0.30 && lvl < totalLevels - 1) {
                const upperY = y - rand(100, 240);
                const upperWidth = rand(120, 200);
                const upperX = x + rand(60, 140);
                const upperPlat = new Platform(upperX, upperY, upperWidth, 20, Math.random() < 0.4 ? "moving" : "normal");
                platforms.push(upperPlat);
                spawnablePlatforms.push(upperPlat);
            }

            if (Math.random() < 0.25 && lvl > 0) {
                const lowerY = y + rand(100, 260);
                const lowerWidth = rand(120, 220);
                const lowerX = x + rand(40, 160);
                const lowerPlat = new Platform(lowerX, lowerY, lowerWidth, 20, "fragile");
                platforms.push(lowerPlat);
                spawnablePlatforms.push(lowerPlat);
            }

            lastX = x + width;
        }

        worldX += rand(200, 350);
    }

    const levelWidth = Math.max(...platforms.map(p => p.x + p.width)) + 400;
    const levelHeightTotal = canvas.height;
    return { width: levelWidth, height: levelHeightTotal, platforms, spawnablePlatforms };
}

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

// ✅ Important: garde bien cette ligne APRES la fonction
const level = generateLevelPlatforms();


// --- ATTACK (kept) ---
class Attack {
    constructor(x, y, type, direction = 1) {
        this.type = type; this.x = x; this.y = y;
        this.width = type === "straight" ? 50 : 70;
        this.height = 50;
        this.direction = direction; this.damage = type === "slash" ? 1 : 2;
        this.duration = type === "slash" ? 300 : 200;
        this.created = Date.now(); this.expired = false;
    }
    update() {
        if (this.type === "straight") this.x += 10 * this.direction;
        if (Date.now() - this.created >= this.duration) this.expired = true;
    }
    collidesWith(enemy) {
        return this.x < enemy.x + enemy.width &&
            this.x + this.width > enemy.x &&
            this.y < enemy.y + enemy.height &&
            this.y + this.height > enemy.y;
    }
    draw() {
        ctx.fillStyle = this.type === "slash" ? "#0ff" : "#ff0";
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

// --- ENEMY (kept) ---
class Enemy {
    constructor(x, y, patrolWidth = 200) {
        this.width = 50; this.height = 50; this.x = x; this.y = y;
        this.maxHealth = 8; this.health = this.maxHealth;
        this.vx = 2; this.vy = 0; this.direction = 1; this.onGround = false;
        this.gravity = gravity; this.startX = x; this.patrolWidth = patrolWidth;
    }
    update(platforms, player) {
        if (this.health <= 0) return;
        this.vy += this.gravity;
        this.y += this.vy;
        this.onGround = false;
        let currentPlatform = null;
        for (const p of platforms) {
            if (this.x < p.x + p.width &&
                this.x + this.width > p.x &&
                this.y < p.y + p.height &&
                this.y + this.height > p.y) {
                if (this.vy > 0 && this.y + this.height - this.vy <= p.y) {
                    this.y = p.y - this.height; this.vy = 0; this.onGround = true; currentPlatform = p;
                }
                if (this.vy < 0 && this.y - this.vy >= p.y + p.height) {
                    this.y = p.y + p.height; this.vy = 0;
                }
            }
        }
        if (this.onGround && currentPlatform) {
            if (this.x < currentPlatform.x) this.direction = 1;
            if (this.x + this.width > currentPlatform.x + currentPlatform.width) this.direction = -1;
            const detectRange = 200;
            if (player && Math.abs(player.x - this.x) < detectRange) {
                if (player.y + player.height === this.y + this.height) {
                    this.direction = player.x > this.x ? 1 : -1;
                }
            }
            this.x += this.vx * this.direction;
            if (player && this.health > 0 &&
                this.x < player.x + player.width &&
                this.x + this.width > player.x &&
                this.y < player.y + player.height &&
                this.y + this.height > player.y) {
                player.takeDamage(player.maxHealth);
            }
        }
    }
    takeDamage(amount) { this.health -= amount; if (this.health < 0) this.health = 0; }
    draw() {
        if (this.health <= 0) return;
        const ratio = this.health / this.maxHealth;
        ctx.fillStyle = `rgba(255,0,0,${0.3 + 0.7 * ratio})`;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = "#fff";
        ctx.fillRect(this.x, this.y - 5, (this.health / this.maxHealth) * this.width, 3);
    }
}

// --- PLAYER (updated, with dash / wall jump / stamina) ---
class Player {
    constructor() {
        this.width = 50; this.height = 50;
        this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;

        // advanced movement tuning
        this.maxSpeed = 8;       // ground max
        this.accel = 1.2;        // acceleration per frame input
        this.friction = 0.85;    // friction factor (when no input)
        this.airControl = 0.35;  // fraction of acc in air

        // jumping
        this.jumpPower = 15;
        this.coyoteTime = 120;   // ms
        this.jumpBuffer = 120;   // ms
        this.lastGroundTime = -9999;
        this.lastJumpPress = -9999;
        this.jumpCut = 0.5;      // variable jump multiplier when released early

        // dash
        this.dashSpeed = 22;
        this.dashDuration = 120;    // ms
        this.dashCooldown = 900;    // ms
        this.lastDash = -9999;
        this.isDashing = false;
        this.dashStart = 0;
        this.dashDir = 1;
        this.invincible = false;

        // wall jump
        this.wallSliding = false;
        this.wallSlideSpeed = 3;
        this.onWallDir = 0; // -1 left, 1 right

        // stamina (for dash + tp)
        this.maxStamina = 100;
        this.stamina = this.maxStamina;
        this.staminaRegen = 12; // per second
        this.dashCost = 35;
        this.tpCost = 50;

        // attacks / tp / health
        this.attacks = [];
        this.lastSlash = 0; this.lastStraight = 0;
        this.slashCooldown = 2000; this.straightCooldown = 500;
        this.tpDistance = 200; this.tpCooldown = 5000; this.lastTP = -9999;
        this.tpEffectTime = 300; this.tpEffectActive = false; this.tpEffectStart = 0;
        this.inAirTime = 0; this.maxAirTime = 5000;
        this.maxHealth = 5; this.health = this.maxHealth;
    }

    attack(type) {
        const now = Date.now();
        if (type === "slash" && now - this.lastSlash >= this.slashCooldown) {
            this.attacks.push(new Attack(this.x, this.y, "slash"));
            this.lastSlash = now;
        }
        if (type === "straight" && now - this.lastStraight >= this.straightCooldown) {
            let dir = this.vx >= 0 ? 1 : -1;
            this.attacks.push(new Attack(this.x, this.y, "straight", dir));
            this.lastStraight = now;
        }
    }

    teleport(targetX, targetY) {
        const now = Date.now();
        if (now - this.lastTP < this.tpCooldown) return false;
        if (this.stamina < this.tpCost) return false;

        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > this.tpDistance) return false;

        this.stamina -= this.tpCost;
        this.tpEffectActive = true; this.tpEffectStart = now;
        this.x = targetX - this.width / 2; this.y = targetY - this.height / 2;
        this.lastTP = now;
        shakeScreen = 8; screenRed = 0.3;
        spawnParticles(this.x + this.width / 2, this.y + this.height / 2, 18, 2.5, 3.5, 4, 300);
        return true;
    }

    dash(direction) {
        const now = Date.now();
        if (now - this.lastDash < this.dashCooldown) return false;
        if (this.isDashing) return false;
        if (this.stamina < this.dashCost) return false;

        this.stamina -= this.dashCost;
        this.isDashing = true; this.invincible = true;
        this.dashStart = now; this.lastDash = now;
        this.dashDir = direction || (this.vx >= 0 ? 1 : -1);
        this.vx = this.dashDir * this.dashSpeed; this.vy = 0;
        shakeScreen = 10;
        spawnParticles(this.x + this.width / 2 - this.dashDir * 10, this.y + this.height / 2, 14, 1.8, 5, 3, 300);
        return true;
    }

    update(platforms, enemies, deltaTime) {
        const now = Date.now();

        // DASH timer
        if (this.isDashing) {
            this.vx = this.dashDir * this.dashSpeed;
            this.vy = 0;
            if (now - this.dashStart > this.dashDuration) {
                this.isDashing = false; this.invincible = false;
            }
        }

        // regenerate stamina
        this.stamina += this.staminaRegen * (deltaTime / 1000);
        if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;

        // input jump buffering timestamps handled outside (game loop updates lastJumpPress)

        // Apply gravity
        this.vy += gravity;
        if (this.vy > 28) this.vy = 28;

        // Apply velocities to position (x handled by game loop movement for better feel)
        this.x += this.vx;
        this.y += this.vy;

        // reset onGround flag then resolve collisions
        this.onGround = false;
        this.wallSliding = false;
        this.onWallDir = 0;
        // Simple AABB collision detection with platforms
        for (const p of platforms) {
            if (this.x < p.x + p.width &&
                this.x + this.width > p.x &&
                this.y < p.y + p.height &&
                this.y + this.height > p.y) {
                // from top (landing)
                if (this.vy > 0 && (this.y + this.height - this.vy) <= p.y) {
                    this.y = p.y - this.height; this.vy = 0; this.onGround = true; this.lastGroundTime = Date.now();
                    this.inAirTime = 0;
                }
                // from bottom (head hit)
                else if (this.vy < 0 && (this.y - this.vy) >= p.y + p.height) {
                    this.y = p.y + p.height; this.vy = 0;
                }
                // from left (hit wall)
                else if (this.vx > 0 && (this.x + this.width - this.vx) <= p.x) {
                    this.x = p.x - this.width; this.vx = 0;
                    // if in air -> possible wall slide
                    if (!this.onGround) { this.wallSliding = true; this.onWallDir = 1; this.lastWallTouch = Date.now(); }
                }
                // from right
                else if (this.vx < 0 && (this.x - this.vx) >= p.x + p.width) {
                    this.x = p.x + p.width; this.vx = 0;
                    if (!this.onGround) { this.wallSliding = true; this.onWallDir = -1; this.lastWallTouch = Date.now(); }
                }
            }
            
        }


        // Wall slide effect
        if (this.wallSliding) {
            if (this.vy > this.wallSlideSpeed) this.vy = this.wallSlideSpeed;
        }
        // In-air timer (for long fall detection)
        if (!this.onGround) this.inAirTime += deltaTime;
        else this.inAirTime = 0;
        if (this.inAirTime >= this.maxAirTime) {
            shakeScreen = 10; screenRed = 0.5; this.takeDamage(3); resetPlayer();
        }

        // Update attacks and collisions with enemies
        for (const atk of this.attacks) {
            atk.update();
            for (const e of enemies) {
                if (atk.collidesWith(e) && e.health > 0) {
                    e.takeDamage(atk.damage);
                    atk.expired = true;
                    spawnParticles(e.x + e.width / 2, e.y + e.height / 2, 8, 1.8, 3, 3, 240);
                }
            }
        }
        this.attacks = this.attacks.filter(a => !a.expired);

        // death check
        if (this.health <= 0) {
            screenRed = 0.7; shakeScreen = 15; resetPlayer(); this.health = this.maxHealth;
        }
    }

    // wall jump: called from game loop when jump pressed while wallSliding
    wallJump() {
        if (!this.wallSliding) return false;
        // push away from wall and up
        this.vx = -this.onWallDir * (this.maxSpeed * 1.1);
        this.vy = -this.jumpPower * 0.95;
        this.wallSliding = false;
        spawnParticles(this.x + this.width / 2, this.y + this.height / 2, 10, 1.8, 3, 3, 240);
        return true;
    }

    takeDamage(amount) {
        if (this.invincible) return;
        this.health -= amount;
        if (this.health < 0) this.health = 0;
        screenRed = 0.5; shakeScreen = 10;
    }

    draw() {
        // dash ghost
        if (this.isDashing) {
            ctx.fillStyle = "rgba(0,255,255,0.25)";
            ctx.fillRect(this.x - 10, this.y, this.width + 20, this.height);
        }

        // player
        ctx.fillStyle = "#fff";
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // life bar
        ctx.fillStyle = "#f00";
        ctx.fillRect(this.x, this.y - 10, (this.health / this.maxHealth) * this.width, 5);

        // stamina bar
        ctx.fillStyle = "#0af";
        ctx.fillRect(this.x, this.y - 18, (this.stamina / this.maxStamina) * this.width, 4);

        // tp range indicator
        if (tpMode) {
            ctx.strokeStyle = "rgba(0,255,255,0.5)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.tpDistance, 0, Math.PI * 2);
            ctx.stroke();
        }

        // TP effect
        if (this.tpEffectActive) {
            const now = Date.now();
            const progress = (now - this.tpEffectStart) / this.tpEffectTime;
            if (progress >= 1) this.tpEffectActive = false;
            else {
                const size = this.width + progress * 50;
                ctx.strokeStyle = `rgba(0,255,255,${1 - progress})`;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(this.x + this.width / 2, this.y + this.height / 2, size, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // attacks
        this.attacks.forEach(a => a.draw());
    }
}

// --- SPAWN player & enemies from generator ---
const player = new Player();
const spawnPlat = level.spawnablePlatforms[0] || level.platforms[0];
player.x = spawnPlat.x + spawnPlat.width / 2 - player.width / 2;
player.y = spawnPlat.y - player.height;

const enemies = [];
for (let i = 1; i < Math.min(12, level.spawnablePlatforms.length); i += 2) {
    const plat = level.spawnablePlatforms[i];
    enemies.push(new Enemy(plat.x + plat.width / 2 - 25, plat.y - 50));
}

// --- INPUT HANDLING (PC + MOBILE) ---
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (e.key === 'j') player.attack('slash');
    if (e.key === 'k') player.attack('straight');
    if (e.key === 'l') player.dash(player.vx >= 0 ? 1 : -1); // L = dash
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

const btnSlash = document.getElementById("btnSlash");
const btnStraight = document.getElementById("btnStraight");
const btnTP = document.getElementById("btnTP");
const btnDash = document.getElementById("btnDash");
if (btnSlash) btnSlash.addEventListener('click', () => player.attack('slash'));
if (btnStraight) btnStraight.addEventListener('click', () => player.attack('straight'));
if (btnDash) btnDash.addEventListener('click', () => player.dash(player.vx >= 0 ? 1 : -1));
if (btnTP) btnTP.addEventListener('click', () => {
    const now = Date.now(); if (now - player.lastTP >= player.tpCooldown && player.stamina >= player.tpCost) tpMode = true;
});

// mobile touch input (simple halves)
canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
const mobileKeys = { left: false, right: false, jump: false, dash: false };
function handleTouchStart(e) { e.preventDefault(); for (const t of e.touches) setTouchKey(t); }
function handleTouchMove(e) { e.preventDefault(); mobileKeys.left = false; mobileKeys.right = false; mobileKeys.jump = false; for (const t of e.touches) setTouchKey(t); }
function handleTouchEnd(e) { e.preventDefault(); mobileKeys.left = false; mobileKeys.right = false; mobileKeys.jump = false; }
function setTouchKey(touch) {
    const x = touch.clientX, y = touch.clientY, w = canvas.width, h = canvas.height;
    if (y < h * 0.4) mobileKeys.jump = true;
    if (x < w * 0.35) mobileKeys.left = true;
    else if (x > w * 0.65) mobileKeys.right = true;
    else {
        // center area -> dash (tap)
        mobileKeys.dash = true;
    }
}

// --- TELEPORT INPUT ---
let tpMode = false;
canvas.addEventListener('click', e => {
    if (!tpMode) return;
    const rect = canvas.getBoundingClientRect();
    const targetX = e.clientX + cameraX;
    const targetY = e.clientY + cameraY;
    if (player.teleport(targetX, targetY)) tpMode = false;
});
canvas.addEventListener('touchstart', (ev) => {
    if (!tpMode) return;
    const t = ev.touches[0];
    const targetX = t.clientX + cameraX;
    const targetY = t.clientY + cameraY;
    if (player.teleport(targetX, targetY)) tpMode = false;
}, { passive: false });

// --- CAMERA update (anticipation + zoom) ---
let camZoom = 1;
function updateCamera(dt) {
    // anticipation based on player velocity
    const anticipateX = Math.sign(player.vx) * Math.min(160, Math.abs(player.vx) * 12);
    const targetX = player.x - canvas.width / 3 + anticipateX * 0.12;
    const targetY = player.y - canvas.height / 2;

    const lerp = 0.12;
    cameraX += (targetX - cameraX) * lerp;
    cameraY += (targetY - cameraY) * lerp;

    if (cameraX < 0) cameraX = 0;
    if (cameraY < 0) cameraY = 0;
    if (cameraX + canvas.width > level.width) cameraX = level.width - canvas.width;

    // zoom slightly by speed
    const speedFactor = Math.min(1, Math.abs(player.vx) / player.maxSpeed);
    const targetZoom = 1 - speedFactor * 0.06;
    camZoom += (targetZoom - camZoom) * 0.08;

    // shake
    if (shakeScreen > 0) {
        cameraX += Math.random() * shakeScreen - shakeScreen / 2;
        cameraY += Math.random() * shakeScreen - shakeScreen / 2;
        shakeScreen -= 0.6;
    }
    if (shakeScreen < 0) shakeScreen = 0;
}

// --- HELPERS ---
function resetPlayer() {
    const plat = level.spawnablePlatforms[0] || level.platforms[0];
    player.x = plat.x + plat.width / 2 - player.width / 2;
    player.y = plat.y - player.height;
    player.vx = 0; player.vy = 0; player.inAirTime = 0; player.stamina = player.maxStamina;
}

// --- INITIAL RESET ---
resetPlayer();

// --- GAME LOOP ---
let lastTime = Date.now();
function gameLoop() {
    const now = Date.now();
    const deltaTime = now - lastTime;
    lastTime = now;

    // --- INPUT -> movement logic (acceleration + friction + coyote + buffer)
    // record jump press (buffer)
    if (keys['ArrowUp'] || keys['w'] || keys[' '] || mobileKeys.jump) {
        player.lastJumpPress = Date.now();
    }

    // horizontal input
    let moveDir = 0;
    if (keys['ArrowLeft'] || keys['a'] || mobileKeys.left) moveDir = -1;
    if (keys['ArrowRight'] || keys['d'] || mobileKeys.right) moveDir = 1;

    // mobile center tap for dash
    if (mobileKeys.dash) { player.dash(player.vx >= 0 ? 1 : -1); mobileKeys.dash = false; }

    // block normal movement when dashing
    if (!player.isDashing) {
        if (moveDir !== 0) {
            const control = player.onGround ? 1 : player.airControl;
            player.vx += moveDir * player.accel * control;
            if (player.vx > player.maxSpeed) player.vx = player.maxSpeed;
            if (player.vx < -player.maxSpeed) player.vx = -player.maxSpeed;
        } else {
            // friction
            player.vx *= player.friction;
            if (Math.abs(player.vx) < 0.04) player.vx = 0;
        }
    }

    // coyote + jump buffer
    const nowMs = Date.now();
    const canUseCoyote = (nowMs - player.lastGroundTime) <= player.coyoteTime;
    const jumpBuffered = (nowMs - player.lastJumpPress) <= player.jumpBuffer;

    // wall jump check
    if (player.wallSliding && jumpBuffered) {
        if (player.wallJump()) {
            player.lastJumpPress = -9999;
        }
    } else if (jumpBuffered && (player.onGround || canUseCoyote)) {
        // normal jump
        player.vy = -player.jumpPower;
        player.lastJumpPress = -9999;
        spawnParticles(player.x + player.width / 2, player.y + player.height, 10, 1.6, 2.5, 3, 220);
    }

    // variable jump cut: if release early
    const jumpHeld = (keys['ArrowUp'] || keys['w'] || keys[' '] || mobileKeys.jump);
    if (!jumpHeld && player.vy < 0) player.vy *= player.jumpCut;

    // dash input (pc)
    if (keys['l']) {
        keys['l'] = false; // consume
        player.dash(player.vx >= 0 ? 1 : -1);
    }

    // --- UPDATE ENTITIES ---
    player.update(level.platforms, enemies, deltaTime);
    for (const e of enemies) e.update(level.platforms, player);

    // particles update
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(deltaTime / 16); // normalized dt
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    // camera
    updateCamera(deltaTime);

    // --- DRAW ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // apply camera + zoom transform
    ctx.save();
    // center scaling around screen center so UI isn't skewed (we will restore before drawing UI)
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-canvas.width / 2 - cameraX, -canvas.height / 2 - cameraY);

    // long fall micro-shake visual (extra)
    if (player.vy > 0 && player.inAirTime > 1500) {
        const amp = 5;
        ctx.translate(Math.random() * amp - amp / 2, Math.random() * amp - amp / 2);
    }

    // draw platforms and enemies and player
    for (const p of level.platforms) p.draw();
    for (const e of enemies) { if (e.health > 0) e.draw(); }
    player.draw();

    // draw particles (world-space)
    for (const part of particles) part.draw();

    ctx.restore();

    // damage red overlay (UI space)
    if (screenRed > 0) {
        ctx.fillStyle = `rgba(255,0,0,${screenRed})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        screenRed -= 0.02;
    }

    // HUD: cooldown & stamina & dash indicator (simple)
    ctx.fillStyle = "#fff";
    ctx.font = "14px sans-serif";
    ctx.fillText(`HP: ${player.health}/${player.maxHealth}`, 12, 20);
    ctx.fillText(`Stamina: ${Math.round(player.stamina)}/${player.maxStamina}`, 12, 40);
    ctx.fillText(`Dash CD: ${Math.max(0, Math.round((player.lastDash + player.dashCooldown - Date.now()) / 100)) / 10}s`, 12, 60);

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

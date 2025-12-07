// --- CANVAS SETUP ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// --- GAME VARIABLES ---
const gravity = 0.6;

// --- PLAYER ---
class Player {
    constructor() {
        this.width = 50;
        this.height = 50;
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.speed = 6;
        this.jumpPower = 14;
        this.onGround = false;

        this.attacks = [];
        this.lastSlash = 0;
        this.lastStraight = 0;
        this.slashCooldown = 2000;
        this.straightCooldown = 500;

        // Téléportation
        this.tpDistance = 200; // distance max
        this.tpCooldown = 5000; // 5 sec
        this.lastTP = -this.tpCooldown;
        this.tpTarget = null;

        this.inAirTime = 0;
        this.maxAirTime = 5000;
        this.maxHealth = 5;
        this.health = this.maxHealth;

        this.tpEffectTime = 300; // durée de l'effet TP
        this.tpEffectActive = false;
        this.tpEffectStart = 0;
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

        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > this.tpDistance) return false;

        // Effet téléportation
        this.tpEffectActive = true;
        this.tpEffectStart = now;

        // On téléporte le joueur
        this.x = targetX - this.width / 2;
        this.y = targetY - this.height / 2;
        this.lastTP = now;
        shakeScreen = 8; // tremblement effet TP
        screenRed = 0.3; // flash
        return true;
    }

    update(platforms, enemies, deltaTime) {
        // Horizontal movement
        this.x += this.vx;

        platforms.forEach(p => {
            if (this.x < p.x + p.width &&
                this.x + this.width > p.x &&
                this.y < p.y + p.height &&
                this.y + this.height > p.y) {
                if (this.vx > 0) this.x = p.x - this.width;
                if (this.vx < 0) this.x = p.x + p.width;
            }
        });

        // Vertical movement
        this.vy += gravity;
        this.y += this.vy;
        this.onGround = false;
        platforms.forEach(p => {
            if (this.x < p.x + p.width &&
                this.x + this.width > p.x &&
                this.y < p.y + p.height &&
                this.y + this.height > p.y) {
                if (this.vy > 0 && this.y + this.height - this.vy <= p.y) {
                    this.y = p.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                }
                if (this.vy < 0 && this.y - this.vy >= p.y + p.height) {
                    this.y = p.y + p.height;
                    this.vy = 0;
                }
            }
        });

        // Chute prolongée
        if (!this.onGround) this.inAirTime += deltaTime;
        else this.inAirTime = 0;

        if (this.inAirTime >= this.maxAirTime) {
            shakeScreen = 10;
            screenRed = 0.5;
            this.takeDamage(3);
            resetPlayer();
        }

        // Update attacks
        this.attacks.forEach(atk => {
            atk.update();
            enemies.forEach(e => {
                if (atk.collidesWith(e) && e.health > 0) {
                    e.takeDamage(atk.damage);
                    atk.expired = true;
                }
            });
        });
        this.attacks = this.attacks.filter(a => !a.expired);

        // Mort
        if (this.health <= 0) {
            screenRed = 0.7;
            shakeScreen = 15;
            resetPlayer();
            this.health = this.maxHealth;
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health < 0) this.health = 0;
        screenRed = 0.5;
        shakeScreen = 10;
    }

    draw() {
        // Effet TP
        if (this.tpEffectActive) {
            const now = Date.now();
            const progress = (now - this.tpEffectStart) / this.tpEffectTime;
            if (progress >= 1) {
                this.tpEffectActive = false;
            } else {
                const size = this.width + progress * 50;
                ctx.strokeStyle = `rgba(0,255,255,${1 - progress})`;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(this.x + this.width / 2, this.y + this.height / 2, size, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // Joueur
        ctx.fillStyle = "#fff";
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Barre de vie
        ctx.fillStyle = "#f00";
        ctx.fillRect(this.x, this.y - 10, (this.health / this.maxHealth) * this.width, 5);

        // Zone téléportation si actif
        if (tpMode) {
            ctx.strokeStyle = "rgba(0,255,255,0.5)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.tpDistance, 0, Math.PI * 2);
            ctx.stroke();
        }

        this.attacks.forEach(a => a.draw());
    }
}

// --- INPUT TELEPORT ---
let tpMode = false;

canvas.addEventListener('click', e => {
    if (!tpMode) return;
    const rect = canvas.getBoundingClientRect();
    const targetX = e.clientX + cameraX;
    const targetY = e.clientY + cameraY;
    if (player.teleport(targetX, targetY)) {
        tpMode = false;
    }
});

const btnTP = document.getElementById("btnTP");
if (btnTP) {
    btnTP.addEventListener('click', () => {
        const now = Date.now();
        if (now - player.lastTP >= player.tpCooldown) {
            tpMode = true;
        }
    });
}

// --- ATTACK ---
class Attack {
    constructor(x, y, type, direction = 1) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = type === "straight" ? 50 : 70;
        this.height = 50;
        this.direction = direction;
        this.damage = type === "slash" ? 1 : 2;
        this.duration = type === "slash" ? 300 : 200;
        this.created = Date.now();
        this.expired = false;
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

// --- PLATFORM ---
class Platform {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    draw() {
        ctx.fillStyle = "#0f0";
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

// --- ENEMY ---
class Enemy {
    constructor(x, y, patrolWidth = 200) {
        this.width = 50;
        this.height = 50;
        this.x = x;
        this.y = y;
        this.maxHealth = 8; // plus résistant
        this.health = this.maxHealth;
        this.vx = 2;
        this.vy = 0;
        this.direction = 1;
        this.onGround = false;
        this.gravity = 0.6;
        this.startX = x;
        this.patrolWidth = patrolWidth;
    }

    update(platforms, player) {
        if (this.health <= 0) return;

        this.vy += this.gravity;
        this.y += this.vy;
        this.onGround = false;
        let currentPlatform = null;

        platforms.forEach(p => {
            if (this.x < p.x + p.width &&
                this.x + this.width > p.x &&
                this.y < p.y + p.height &&
                this.y + this.height > p.y) {
                if (this.vy > 0 && this.y + this.height - this.vy <= p.y) {
                    this.y = p.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                    currentPlatform = p;
                }
                if (this.vy < 0 && this.y - this.vy >= p.y + p.height) {
                    this.y = p.y + p.height;
                    this.vy = 0;
                }
            }
        });

        // patrol
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

            // contact joueur = one-shot
            if (player && this.health > 0 &&
                this.x < player.x + player.width &&
                this.x + this.width > player.x &&
                this.y < player.y + player.height &&
                this.y + this.height > player.y) {
                player.takeDamage(player.maxHealth);
            }
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health < 0) this.health = 0;
    }

    draw() {
        if (this.health <= 0) return;
        const ratio = this.health / this.maxHealth;
        ctx.fillStyle = `rgba(255,0,0,${0.3 + 0.7 * ratio})`;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = "#fff";
        ctx.fillRect(this.x, this.y - 5, (this.health / this.maxHealth) * this.width, 3);
    }
}

function generateLevelPlatforms(totalLevels = 8, platformsPerLevel = 6) {
    const platforms = [];
    const spawnablePlatforms = [];
    const levelHeight = canvas.height / totalLevels; // hauteur par étage
    let baseX = 0;

    for (let lvl = 0; lvl < totalLevels; lvl++) {
        // Hauteur de l'étage avec variation
        const y = canvas.height - (lvl + 1) * levelHeight + Math.floor(Math.random() * 80) - 40;
        let lastX = baseX;

        for (let i = 0; i < platformsPerLevel; i++) {
            const width = Math.floor(Math.random() * 200) + 150;
            const gap = Math.floor(Math.random() * 250) + 50;

            const x = lastX + gap;
            lastX = x + width;

            // plateforme principale
            const plat = new Platform(x, y, width, 20);
            platforms.push(plat);
            spawnablePlatforms.push(plat);

            // obstacles verticaux
            if (Math.random() < 0.3) {
                const obsHeight = Math.floor(Math.random() * 120) + 50;
                const obsX = x + Math.floor(Math.random() * (width - 50));
                platforms.push(new Platform(obsX, y - obsHeight, 50, obsHeight));
            }

            // pont descendant pour demi-tour
            if (Math.random() < 0.25 && lvl < totalLevels - 1) {
                const nextY = y + Math.floor(Math.random() * (levelHeight / 2)) + 50;
                const bridgeWidth = Math.floor(Math.random() * 150) + 100;
                const bridgeX = x + width + Math.floor(Math.random() * 50);
                const bridge = new Platform(bridgeX, nextY, bridgeWidth, 20);
                platforms.push(bridge);
                spawnablePlatforms.push(bridge);
                lastX = bridgeX + bridgeWidth;
            }

            // pont ascendant pour exploration verticale
            if (Math.random() < 0.2 && lvl > 0) {
                const prevY = y - Math.floor(Math.random() * (levelHeight / 2)) - 50;
                const bridgeWidth = Math.floor(Math.random() * 150) + 100;
                const bridgeX = x + Math.floor(Math.random() * 50);
                const bridge = new Platform(bridgeX, prevY, bridgeWidth, 20);
                platforms.push(bridge);
                spawnablePlatforms.push(bridge);
            }
        }

        // Décalage horizontal pour progression globale
        baseX += 150;
    }

    const levelWidth = Math.max(...platforms.map(p => p.x + p.width)) + 300;
    const levelHeightTotal = canvas.height;
    return { width: levelWidth, height: levelHeightTotal, platforms, spawnablePlatforms };
}

// --- INITIALIZE LEVEL ---
const level = generateLevelPlatforms();

// spawn player
const player = new Player();
const spawnPlat = level.spawnablePlatforms[0];
player.x = spawnPlat.x + spawnPlat.width / 2 - player.width / 2;
player.y = spawnPlat.y - player.height;

// spawn enemies sur certaines plateformes
const enemies = [];
for (let i = 1; i < Math.min(12, level.spawnablePlatforms.length); i += 2) {
    const plat = level.spawnablePlatforms[i];
    enemies.push(new Enemy(plat.x + plat.width / 2 - 25, plat.y - 50));
}

// --- CAMERA ---
let cameraX = 0;
let cameraY = 0;
let shakeScreen = 0;
let screenRed = 0;

function updateCamera() {
    cameraX = player.x - canvas.width / 3;
    cameraY = player.y - canvas.height / 2;

    if (cameraX < 0) cameraX = 0;
    if (cameraY < 0) cameraY = 0;
    if (cameraX + canvas.width > level.width) cameraX = level.width - canvas.width;

    if (shakeScreen > 0) {
        cameraX += Math.random() * shakeScreen - shakeScreen / 2;
        cameraY += Math.random() * shakeScreen - shakeScreen / 2;
        shakeScreen -= 0.5;
    }
}

function resetPlayer() {
    const plat = level.spawnablePlatforms[0];
    player.x = plat.x + plat.width / 2 - player.width / 2;
    player.y = plat.y - player.height;
    player.vx = 0;
    player.vy = 0;
    player.inAirTime = 0;
}

// --- INPUT PC ---
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (e.key === 'j') player.attack('slash');
    if (e.key === 'k') player.attack('straight');
});
window.addEventListener('keyup', e => keys[e.key] = false);

const btnSlash = document.getElementById("btnSlash");
const btnStraight = document.getElementById("btnStraight");
if (btnSlash) btnSlash.addEventListener('click', () => player.attack('slash'));
if (btnStraight) btnStraight.addEventListener('click', () => player.attack('straight'));

// --- INPUT MOBILE ---
canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
canvas.addEventListener("touchend", handleTouchEnd, { passive: false });

const mobileKeys = { left: false, right: false, jump: false };

function handleTouchStart(e) {
    e.preventDefault();
    for (let t of e.touches) setTouchKey(t);
}

function handleTouchMove(e) {
    e.preventDefault();
    mobileKeys.left = false;
    mobileKeys.right = false;
    mobileKeys.jump = false;
    for (let t of e.touches) setTouchKey(t);
}

function handleTouchEnd(e) {
    e.preventDefault();
    mobileKeys.left = false;
    mobileKeys.right = false;
    mobileKeys.jump = false;
}

function setTouchKey(touch) {
    const x = touch.clientX;
    const y = touch.clientY;
    const w = canvas.width;
    const h = canvas.height;

    if (y < h / 2) mobileKeys.jump = true;   // haut = saut
    if (x < w / 2) mobileKeys.left = true;   // gauche = gauche
    if (x >= w / 2) mobileKeys.right = true; // droite = droite
}

// --- GAME LOOP ---
let lastTime = Date.now();
function gameLoop() {
    const now = Date.now();
    const deltaTime = now - lastTime;
    lastTime = now;

    // reset vitesse
    player.vx = 0;

    // --- Mouvement PC + Mobile ---
    if (keys['ArrowLeft'] || keys['a'] || mobileKeys.left) player.vx = -player.speed;
    if (keys['ArrowRight'] || keys['d'] || mobileKeys.right) player.vx = player.speed;
    if ((keys['ArrowUp'] || keys['w'] || keys[' '] || mobileKeys.jump) && player.onGround) {
        player.vy = -player.jumpPower;
    }

    // --- Update player et ennemis ---
    player.update(level.platforms, enemies, deltaTime);
    enemies.forEach(e => e.update(level.platforms, player));

    // --- Camera ---
    updateCamera();

    // --- Dessin ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    // tremblement si chute longue
    if (player.vy > 0 && player.inAirTime > 1500) {
        const amp = 5;
        ctx.translate(Math.random() * amp - amp / 2, Math.random() * amp - amp / 2);
    }

    level.platforms.forEach(p => p.draw());
    enemies.forEach(e => { if (e.health > 0) e.draw(); });
    player.draw();

    ctx.restore();

    // effet rouge si dégâts
    if (screenRed > 0) {
        ctx.fillStyle = `rgba(255,0,0,${screenRed})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        screenRed -= 0.02;
    }

    requestAnimationFrame(gameLoop);
}

gameLoop();

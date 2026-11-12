import { Scene } from 'phaser';

export default class Player extends Phaser.Physics.Arcade.Sprite {
    public id: string;
    private isLocal: boolean;
    private charType: string;

    // Combat Properties
    public hp: number = 300;
    public maxHp: number = 300;
    public spirit: number = 40;
    public maxSpirit: number = 100;
    public isDead: boolean = false;
    public isHurt: boolean = false;
    public attackHitbox!: Phaser.GameObjects.Zone;
    public isAttacking: boolean = false;
    public isSpecialAttack: boolean = false;
    public isBlocking: boolean = false;
    public hasHit: boolean = false;

    // Red sprite clone for visible hurt tint
    private hurtOverlay: Phaser.GameObjects.Sprite | null = null;

    // End-of-game statistics
    public stats = {
        damageDealt: 0,
        damageTaken: 0,
        blocks: 0,
        hitsLanded: 0,
        specialsLanded: 0
    };

    // Audio states for looping sounds
    private moveSound: Phaser.Sound.BaseSound | null = null;
    private idleSound: Phaser.Sound.BaseSound | null = null;

    // Combo System
    private comboStep: number = 1;
    private lastAttackTime: number = 0;

    constructor(scene: Scene, x: number, y: number, texture: string, charType: string, id: string, isLocal: boolean = false) {
        super(scene, x, y, texture);

        this.id = id;
        this.isLocal = isLocal;
        this.charType = charType;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(true);
        this.setOrigin(0.5, 0.5);
        this.setScale(2.0);

        try {
            this.moveSound = scene.sound.add('move', { loop: true });
            this.idleSound = scene.sound.add('idle', { loop: true });
            if (this.idleSound) this.idleSound.play();
        } catch (e) {
            console.warn('Audio not loaded yet:', e);
        }

        const body = this.body as Phaser.Physics.Arcade.Body;
        if (charType === 'ninja_monk' || charType === 'ninja_peasant') {
            body.setSize(30, 68);
            body.setOffset(33, 28);
        } else {
            body.setSize(40, 90);
            body.setOffset(44, 38);
        }

        this.attackHitbox = scene.add.zone(x, y, 70, 100);
        scene.physics.add.existing(this.attackHitbox);
        const hitboxBody = this.attackHitbox.body as Phaser.Physics.Arcade.Body;
        hitboxBody.setAllowGravity(false);
        hitboxBody.moves = false;
    }

    public addSpirit(delta: number) {
        this.spirit = Math.max(0, Math.min(this.maxSpirit, this.spirit + delta));
        window.dispatchEvent(new CustomEvent('playerSpiritChanged', {
            detail: { playerId: this.id, spirit: this.spirit, maxSpirit: this.maxSpirit }
        }));
    }

    update(cursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys, joystick?: { left: boolean, right: boolean, up: boolean, down: boolean }) {
        if (this.isDead) return;

        const offsetX = this.flipX ? -62 : 62;
        this.attackHitbox.x = this.x + offsetX;
        this.attackHitbox.y = this.y;

        if (this.hurtOverlay) {
            this.hurtOverlay.setPosition(this.x, this.y);
            this.hurtOverlay.setFlipX(this.flipX);
        }

        if (!joystick) return;

        const speed = 460;
        const jumpForce = -460;

        const isAttackingOrBlocking = this.isAttacking || this.isBlocking || this.isHurt;
        const dynamicBody = this.body as Phaser.Physics.Arcade.Body;

        if (isAttackingOrBlocking) {
            if (dynamicBody?.onFloor() && !this.isSpecialAttack) {
                this.setVelocityX(0);
            }
        } else {
            if (joystick.left) {
                this.setVelocityX(-speed);
                this.setFlipX(true);
                if (dynamicBody?.onFloor()) {
                    this.anims.play(`${this.charType}_run`, true);
                    this.playMoveSound();
                }
            } else if (joystick.right) {
                this.setVelocityX(speed);
                this.setFlipX(false);
                if (dynamicBody?.onFloor()) {
                    this.anims.play(`${this.charType}_run`, true);
                    this.playMoveSound();
                }
            } else {
                this.setVelocityX(0);
                if (dynamicBody?.onFloor()) {
                    this.anims.play(`${this.charType}_idle`, true);
                    this.playIdleSound();
                }
            }

            if (joystick.up && dynamicBody?.onFloor()) {
                this.setVelocityY(jumpForce);
                try { this.scene.sound.play('jump'); } catch (e) {}
            }
        }

        if (!dynamicBody?.onFloor() && !isAttackingOrBlocking) {
            this.anims.play(`${this.charType}_jump`, true);
            this.stopLoopingSounds();
        }
    }

    private playMoveSound() {
        if (this.idleSound?.isPlaying) this.idleSound.stop();
        if (this.moveSound && !this.moveSound.isPlaying) this.moveSound.play();
    }

    private playIdleSound() {
        if (this.moveSound?.isPlaying) this.moveSound.stop();
        if (this.idleSound && !this.idleSound.isPlaying) this.idleSound.play();
    }

    private stopLoopingSounds() {
        if (this.moveSound?.isPlaying) this.moveSound.stop();
        if (this.idleSound?.isPlaying) this.idleSound.stop();
    }

    playAttackAnimation() {
        if (this.isAttacking || this.isBlocking || this.isDead || this.isHurt) return;

        const now = this.scene.time.now;
        if (now - this.lastAttackTime > 800) {
            this.comboStep = 1;
        } else {
            this.comboStep++;
        }

        let animKey = `${this.charType}_attack_${this.comboStep}`;
        if (!this.scene.anims.exists(animKey)) {
            this.comboStep = 1;
            animKey = `${this.charType}_attack_1`;
        }

        if (!this.scene.anims.exists(animKey)) {
            return;
        }

        this.lastAttackTime = now;
        this.isAttacking = true;
        this.isSpecialAttack = false;
        this.hasHit = false;
        this.anims.play(animKey);
        this.stopLoopingSounds();

        try {
            this.scene.sound.play(`${this.charType}_attack`);
            this.scene.sound.play(`${this.charType}_effort`);
            window.dispatchEvent(new CustomEvent('playerAudio', { detail: { type: 'attack', charType: this.charType } }));
        } catch (e) {}

        this.once(`animationcomplete-${animKey}`, () => {
            this.isAttacking = false;
            this.isSpecialAttack = false;
            const dynamicBody = this.body as Phaser.Physics.Arcade.Body;
            if (dynamicBody?.onFloor() && !this.isDead) {
                this.anims.play(`${this.charType}_idle`);
            }
        });
    }

    /**
     * Unleashes a high-velocity Spirit Dash-Strike when Spirit >= 50.
     * Leaves a glowing golden afterimage and deals heavy guard-piercing damage!
     */
    playSpecialAttackAnimation(): boolean {
        if (this.isAttacking || this.isDead || this.isHurt || this.spirit < 50) return false;

        this.stopBlock();
        this.addSpirit(-50);

        let animKey = `${this.charType}_attack_3`;
        if (!this.scene.anims.exists(animKey)) {
            animKey = `${this.charType}_attack_2`;
        }
        if (!this.scene.anims.exists(animKey)) {
            animKey = `${this.charType}_attack_1`;
        }
        if (!this.scene.anims.exists(animKey)) return false;

        this.isAttacking = true;
        this.isSpecialAttack = true;
        this.hasHit = false;

        // Propel forward in facing direction
        const dashVel = this.flipX ? -620 : 620;
        this.setVelocityX(dashVel);
        this.setTint(0xffd700);

        // Spawn glowing golden spirit afterimage
        const ghost = this.scene.add.sprite(this.x, this.y, this.texture.key);
        ghost.setScale(this.scaleX * 1.08, this.scaleY * 1.08);
        ghost.setFlipX(this.flipX);
        ghost.setTint(0xffae00);
        ghost.setBlendMode(Phaser.BlendModes.ADD);
        ghost.setAlpha(0.75);
        this.scene.tweens.add({
            targets: ghost,
            alpha: 0,
            x: this.x + (this.flipX ? 40 : -40),
            duration: 320,
            onComplete: () => ghost.destroy()
        });

        this.anims.play(animKey);
        this.stopLoopingSounds();

        try {
            this.scene.sound.play(`${this.charType}_attack`);
            this.scene.sound.play(`${this.charType}_effort`);
        } catch (e) {}

        this.once(`animationcomplete-${animKey}`, () => {
            this.isAttacking = false;
            this.isSpecialAttack = false;
            this.clearTint();
            this.setVelocityX(0);
            const dynamicBody = this.body as Phaser.Physics.Arcade.Body;
            if (dynamicBody?.onFloor() && !this.isDead) {
                this.anims.play(`${this.charType}_idle`);
            }
        });

        return true;
    }

    startBlock() {
        if (this.isAttacking || this.isDead || this.isHurt) return;
        if (this.isBlocking) return;

        this.isBlocking = true;
        this.anims.play(`${this.charType}_block`, true);
        this.stopLoopingSounds();
    }

    stopBlock() {
        if (!this.isBlocking) return;

        this.isBlocking = false;
        const dynamicBody = this.body as Phaser.Physics.Arcade.Body;
        if (dynamicBody?.onFloor() && !this.isDead && !this.isAttacking && !this.isHurt) {
            this.anims.play(`${this.charType}_idle`, true);
        }
    }

    playHurtAnimation() {
        if (this.isDead || this.isHurt) return;

        this.isAttacking = false;
        this.isSpecialAttack = false;
        this.isBlocking = false;

        const hurtKey = `${this.charType}_hurt`;
        if (!this.scene.anims.exists(hurtKey)) return;

        this.isHurt = true;
        this.anims.play(hurtKey, true);

        this.hurtOverlay = this.scene.add.sprite(this.x, this.y, `${this.charType}_hurt`);
        this.hurtOverlay.setScale(this.scaleX, this.scaleY);
        this.hurtOverlay.setFlipX(this.flipX);
        this.hurtOverlay.setTint(0xff0000);
        this.hurtOverlay.setBlendMode(Phaser.BlendModes.ADD);
        this.hurtOverlay.setAlpha(0.85);
        this.hurtOverlay.setDepth(this.depth + 1);
        this.hurtOverlay.play(hurtKey);

        const pulseTween = this.scene.tweens.add({
            targets: this.hurtOverlay,
            alpha: { from: 0.85, to: 0.3 },
            duration: 120,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.once(`animationcomplete-${hurtKey}`, () => {
            pulseTween.stop();
            if (this.hurtOverlay) {
                this.hurtOverlay.destroy();
                this.hurtOverlay = null;
            }
            this.clearTint();
            this.isHurt = false;
            const dynamicBody = this.body as Phaser.Physics.Arcade.Body;
            if (dynamicBody?.onFloor() && !this.isDead && !this.isAttacking && !this.isBlocking) {
                this.anims.play(`${this.charType}_idle`);
            }
        });
    }

    resetState() {
        this.isAttacking = false;
        this.isSpecialAttack = false;
        this.isBlocking = false;
        this.isHurt = false;
        this.hasHit = false;
        this.isDead = false;
        this.spirit = 40;
        this.comboStep = 1;
        this.clearTint();
        if (this.hurtOverlay) {
            this.hurtOverlay.destroy();
            this.hurtOverlay = null;
        }
        this.stopLoopingSounds();
    }

    private showDamageText(amount: number, isSpecial: boolean = false) {
        const isBlock = amount === 0;
        const textStr = isBlock
            ? 'GUARD!'
            : isSpecial
              ? `⚡ SPIRIT -${amount}`
              : `-${amount}`;

        let color = '#ffffff';
        if (!isBlock) {
            color = isSpecial ? '#fbbf24' : this.id === 'local_player' ? '#ffcc00' : '#ff3333';
        }

        const damageText = this.scene.add.text(this.x, this.y - 65, textStr, {
            fontFamily: 'Cinzel, serif',
            fontSize: isSpecial ? '32px' : isBlock ? '18px' : '26px',
            color: color,
            stroke: '#000000',
            strokeThickness: 5,
            fontStyle: 'bold'
        });
        damageText.setOrigin(0.5);
        damageText.setDepth(100);

        this.scene.tweens.add({
            targets: damageText,
            y: this.y - 135,
            scaleX: isSpecial ? 1.25 : 1.0,
            scaleY: isSpecial ? 1.25 : 1.0,
            alpha: 0,
            duration: 850,
            ease: 'Cubic.easeOut',
            onComplete: () => damageText.destroy()
        });
    }

    takeDamage(amount: number, attackerX?: number, isSpecial: boolean = false): number {
        if (this.isDead) return 0;

        let actualDamage = amount;
        let knockbackDir = 0;
        if (attackerX !== undefined) {
            knockbackDir = this.x < attackerX ? -1 : 1;
        } else {
            knockbackDir = this.flipX ? 1 : -1;
        }

        if (this.isBlocking) {
            // Spirit attacks pierce guard for chip damage!
            actualDamage = isSpecial ? Math.round(amount * 0.35) : 0;
            this.stats.blocks += 1;
            this.addSpirit(15);
            this.setVelocityX(knockbackDir * (isSpecial ? 280 : 150));

            try {
                this.scene.sound.play('hit', { volume: 0.5 });
                window.dispatchEvent(new CustomEvent('playerAudio', { detail: { type: 'block_hit', id: this.id } }));
            } catch (e) {}

            this.showDamageText(actualDamage, isSpecial);
        } else {
            this.setVelocityX(knockbackDir * (isSpecial ? 460 : 300));
            this.setVelocityY(isSpecial ? -180 : -100);
            this.addSpirit(12);

            try {
                this.scene.sound.play('hit');
                window.dispatchEvent(new CustomEvent('playerAudio', { detail: { type: 'hit', id: this.id } }));
            } catch (e) {}

            this.showDamageText(actualDamage, isSpecial);
        }

        this.hp -= actualDamage;
        this.stats.damageTaken += actualDamage;

        if (actualDamage > 0) {
            this.setTint(isSpecial ? 0xffae00 : 0xff2222);
        } else {
            this.setTint(0xffffff);
            this.scene.time.delayedCall(120, () => {
                if (!this.isDead) this.clearTint();
            });
        }

        if (this.hp <= 0) {
            this.hp = 0;
            if (!this.isDead) {
                this.isDead = true;
                this.isHurt = false;
                this.isAttacking = false;
                this.isSpecialAttack = false;
                this.isBlocking = false;
                this.setVelocityX(0);
                this.stopLoopingSounds();
                this.anims.play(`${this.charType}_dead`);
                try {
                    this.scene.sound.play('death');
                    window.dispatchEvent(new CustomEvent('playerAudio', { detail: { type: 'death', id: this.id } }));
                } catch (e) {}
            }
        } else if (actualDamage > 0) {
            this.playHurtAnimation();
        }

        window.dispatchEvent(new CustomEvent('playerHealthChanged', {
            detail: { playerId: this.id, hp: this.hp, maxHp: this.maxHp }
        }));

        return actualDamage;
    }
}

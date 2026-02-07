class MinigameRunner {
    constructor(canvasId, timerId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.timerEl = document.getElementById(timerId);

        this.active = false;
        this.isBot = false;
        this.resultMessage = "";
        this.startTime = 0;
        this.duration = 12000;
        this.callback = null;

        this.width = 360;
        this.height = 640;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // EXACT FILENAMES AS REQUESTED
        this.carroImg = new Image();
        this.carroImg.src = 'assets/images/Gemini_Generated_Image_hs7387hs7387hs73.jpg';
        this.carroImg.onerror = () => console.log("ERRO: Imagem do carro não encontrada");

        this.akumaImg = new Image();
        this.akumaImg.src = 'assets/images/Gemini_Generated_Image_dujxvdujxvdujxvd.jpg';
        this.akumaImg.onerror = () => console.log("ERRO: Imagem do Akuma não encontrada");

        this.car = {
            x: this.width / 2 - 50,
            y: this.height - 160,
            width: 100,
            height: 100, // Increased to 100x100
            speed: 10
        };

        this.obstacles = [];
        this.baseSpeed = 4;
        this.spawnTimer = 0;
        this.spawnRate = 35;

        this.keys = {};
        this.setupListeners();
    }

    setupListeners() {
        window.addEventListener('keydown', (e) => { this.keys[e.key] = true; });
        window.addEventListener('keyup', (e) => { this.keys[e.key] = false; });
        this.canvas.addEventListener('touchmove', (e) => {
            if (!this.active) return;
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const touchX = (e.touches[0].clientX - rect.left) * (this.width / rect.width);
            this.car.x = touchX - this.car.width / 2;
            this.constrainCar();
        }, { passive: false });
    }

    constrainCar() {
        if (this.car.x < 0) this.car.x = 0;
        if (this.car.x > this.width - this.car.width) this.car.x = this.width - this.car.width;
    }

    start(isBot, callback) {
        this.active = true;
        this.isBot = isBot;
        this.resultMessage = "";
        this.startTime = Date.now();
        this.callback = callback;
        this.obstacles = [];
        this.spawnTimer = 0;
        this.car.x = this.width / 2 - 50;
        this.car.y = this.height - 160;

        window.soundManager.stopMusic();
        window.soundManager.play('menu_click');
        this.loop();
    }

    stop(result) {
        if (!this.active) return;
        this.active = false;

        if (result === 'win') {
            window.soundManager.play('win');
            this.resultMessage = "VITÓRIA! O mestre compra 2 cartas";
        } else if (result === 'lose') {
            window.soundManager.play('lose');
            this.resultMessage = "DERROTA! Você compra 3 cartas";
        }

        if (this.callback) this.callback(result);
    }

    loop() {
        if (!this.active) return;
        const elapsed = Date.now() - this.startTime;
        const remaining = Math.max(0, Math.ceil((this.duration - elapsed) / 1000));
        this.timerEl.innerText = remaining + "s";
        if (elapsed >= this.duration) { this.stop('win'); return; }
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    update() {
        if (!this.active) return;

        // Bot Logic
        if (this.isBot) {
            const nearest = this.obstacles.find(o => o.y > 0 && o.y < this.car.y);
            if (nearest) {
                const targetX = nearest.x > this.width / 2 ? nearest.x - 110 : nearest.x + 110;
                if (this.car.x < targetX) this.car.x += 4;
                if (this.car.x > targetX) this.car.x -= 4;
            }
        } else {
            // Player Input
            if (this.keys['ArrowLeft'] || this.keys['Left']) this.car.x -= this.car.speed;
            if (this.keys['ArrowRight'] || this.keys['Right']) this.car.x += this.car.speed;
        }
        this.constrainCar();

        this.spawnTimer--;
        if (this.spawnTimer <= 0) {
            this.obstacles.push({
                x: Math.random() * (this.width - 100),
                y: -100,
                width: 100,
                height: 100,
                speed: this.baseSpeed + Math.random() * 2
            });
            this.spawnTimer = this.spawnRate;
        }

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.y += obs.speed;
            if (this.checkCollision(this.car, obs)) { this.stop('lose'); return; }
            if (obs.y > this.height) this.obstacles.splice(i, 1);
        }
    }

    checkCollision(a, b) {
        const px = a.width * 0.3, py = a.height * 0.3;
        return a.x + px < b.x + b.width - px &&
            a.x + a.width - px > b.x + px &&
            a.y + py < b.y + b.height - py &&
            a.y + a.height - py > b.y + py;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Road markings
        this.ctx.strokeStyle = '#222';
        this.ctx.lineWidth = 10;
        this.ctx.setLineDash([60, 60]);
        this.ctx.lineDashOffset = -(Date.now() / 20) % 120;
        this.ctx.beginPath();
        this.ctx.moveTo(this.width / 2, 0);
        this.ctx.lineTo(this.width / 2, this.height);
        this.ctx.stroke();

        // 1. CAR (ROTATED OBLIGATORILY BY 90 DEGREES + LOGO CROP)
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'screen';
        this.ctx.translate(this.car.x + this.car.width / 2, this.car.y + this.car.height / 2);
        this.ctx.rotate(Math.PI / 2);

        // Use 9-param drawImage to crop out logos from edges (central 85%)
        const sW = this.carroImg.naturalWidth || 512;
        const sH = this.carroImg.naturalHeight || 512;
        this.ctx.drawImage(this.carroImg, sW * 0.07, sH * 0.07, sW * 0.86, sH * 0.86, -50, -50, 100, 100);

        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.restore();

        // 2. OBSTACLES (AKUMAS + LOGO CROP)
        this.obstacles.forEach(obs => {
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'screen';
            const oSW = this.akumaImg.naturalWidth || 512;
            const oSH = this.akumaImg.naturalHeight || 512;
            // Crop edges to remove the IA logo in the corner
            this.ctx.drawImage(this.akumaImg, oSW * 0.07, oSH * 0.07, oSW * 0.86, oSH * 0.86, obs.x, obs.y, 100, 100);
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.restore();
        });

        // 3. RESULTS OVERLAY
        if (this.resultMessage) {
            this.ctx.fillStyle = "rgba(0,0,0,0.8)";
            this.ctx.fillRect(0, this.height / 2 - 60, this.width, 120);

            this.ctx.fillStyle = "white";
            this.ctx.font = "900 20px Outfit, sans-serif";
            this.ctx.textAlign = "center";
            this.ctx.fillText(this.resultMessage.split('!')[0] + "!", this.width / 2, this.height / 2 - 10);
            this.ctx.font = "700 16px Outfit, sans-serif";
            this.ctx.fillText(this.resultMessage.split('!')[1].trim(), this.width / 2, this.height / 2 + 30);
        }

        // ABSOLUTELY NO fillRect(red) OR circles ALLOWED. 
        // If images fail, you will only see the background to signal the error.
    }
}

window.MinigameRunner = MinigameRunner;

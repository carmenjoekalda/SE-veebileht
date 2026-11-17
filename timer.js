document.addEventListener("DOMContentLoaded", () => {
    const modeElement = document.querySelector(".mode-name");
    const timerDisplay = document.querySelector(".timer-value");
    const soundLabel = document.querySelector(".timer-h3");
    const beginBtn = document.querySelector(".button1");
    const changeSoundBtn = document.querySelector(".button2");
    const timerCircle = document.querySelector(".timer");
    
    // Kontrollime, kas tegemist on "Relax" või "Work" moodiga
    const isFocusMode = modeElement && modeElement.textContent.toLowerCase().includes("focus")

    // Häälte playlist
    const TRACKS = {
        relax: [
            { name: "Lo-Fi Rain & Vinyl", src: "Audio/lofi-rain.mp3", synthType: "lofi" },
            { name: "Deep Brown Noise", src: "Audio/brown-noise.mp3", synthType: "brown" },
            { name: "Soft White Noise", src: "Audio/white-noise.mp3", synthType: "white" },
            { name: "Nightfall Ambient Pad", src: "Audio/ambient-pad.mp3", synthType: "ambient" }
        ],
        focus: [
            { name: "40Hz Gamma Binaural", src: "Audio/binaural-40hz.mp3", synthType: "binaural" },
            { name: "Rhythmic Pulse (14Hz)", src: "Audio/rhythmic-pulse.mp3", synthType: "rhythmic" },
            { name: "Deep-Work Drone", src: "Audio/deep-work.mp3", synthType: "deepwork" }
        ],
    };

    const currentPlaylist = isFocusMode ? TRACKS.focus : TRACKS.relax;
    let currentTrackIndex = 0;
    
    // Timeri algolek
    let durationMinutes = 25;
    let remainingSeconds = durationMinutes * 60;
    let timerInterval = null;
    let isRunning = false;
    let hasStarted = false;

    // Meetod audio mängimiseks, laadime algoleku
    const audioPlayer = new Audio();
    audioPlayer.loop = true;
    let audioCtx = null;
    let synthNodes = [];
    let usingSynth = false;

    soundLabel.textContent = currentPlaylist[currentTrackIndex].name;

    // Kasutaja poolt valitud modal, injectime otse siia
    const modalOverlay = document.createElement("div");
    modalOverlay.className = "timer-modal-overlay";
    modalOverlay.innerHTML = `
        <div class="timer-modal">
            <h3>Set Session Duration</h3>
            <p>Choose your time in minutes or pick a preset</p>
            <div class="preset-buttons">
                <button type="button" data-min="15">15m</button>
                <button type="button" data-min="25" class="active">25m</button>
                <button type="button" data-min="45">45m</button>
                <button type="button" data-min="60">60m</button>
            </div>
            <div class="custom-time-input">
                <input type="number" id="custom-minutes" min="1" max="240" value="25" />
                <span>min</span>
            </div>
            <div class="modal-actions">
                <button type="button" id="cancel-modal" class="modal-btn-secondary">Cancel</button>
                <button type="button" id="confirm-start" class="modal-btn-primary">Start Timer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalOverlay);

    const customInput = document.getElementById("custom-minutes");
    const presetBtns = modalOverlay.querySelectorAll(".preset-buttons button");

    // Kontrollime, kas nuppu vajutati
    presetBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            presetBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            customInput.value = btn.dataset.min;
        });
    });

    customInput.addEventListener("input", () => {
        presetBtns.forEach(b => {
            b.classList.toggle("active", b.dataset.min === customInput.value);
        });
    });

    // Audio engine loogika
    function stopSynth() {
        synthNodes.forEach(node => {
            try {
                if (node.stop) node.stop();
                if (node.disconnect) node.disconnect();
            } catch (e) {}
        });
        synthNodes = [];
    }

    function startSynth(type) {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }
        stopSynth();

        const masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.2;
        masterGain.connect(audioCtx.destination);
        synthNodes.push(masterGain);

        // Randomizer
        if (type === "white" || type === "brown" || type === "lofi") {
            const bufferSize = 2 * audioCtx.sampleRate;
            const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            let lastOut = 0.0;
            
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                if (type === "brown" || type === "lofi") {
                    output[i] = (lastOut + (0.02 * white)) / 1.02;
                    lastOut = output[i];
                    output[i] *= 3.5;
                } else {
                    output[i] = white * 0.25;
                }
            }

            // Audiofiltrid
            const whiteNoise = audioCtx.createBufferSource();
            whiteNoise.buffer = noiseBuffer;
            whiteNoise.loop = true;

            const filter = audioCtx.createBufferSource();
            filter.type = "lowpass";
            filter.frequency.value = type === "white" ? 1800 : 500;

            whiteNoise.connect(filter);
            filter.connect(masterGain);
            whiteNoise.start(0);
            synthNodes.push(whiteNoise, filter);

            if (type === "lofi") {
                [220, 277.18, 329.63].forEach(freq => {
                    const osc = audioCtx.createOscillator();
                    const oscGain = audioCtx.createGain();
                    osc.type = "sine";
                    osc.frequency.value = freq;
                    oscGain.gain.value = 0.08;
                    osc.connect(oscGain);
                    oscGain.connect(masterGain);
                    osc.start();
                    synthNodes.push(osc, oscGain);
                });
            }
        } else if (type === "binaural") {
            // Mängime läbi mõlema audiokanali erinevate võngetega binaural beats, vasakust 200Hz, paremast 240Hz
            const merger = audioCtx.createChannelMerger(2);
            const leftOsc = audioCtx.createOscillator();
            const rightOsc = audioCtx.createOscillator();

            leftOsc.type = "sine";
            rightOsc.type = "sine";
            leftOsc.frequency.value = 200;
            rightOsc.frequency.value = 240;

            leftOsc.connect(merger, 0, 0);
            rightOsc.connect(merger, 0, 1);
            merger.connect(masterGain);

            leftOsc.start();
            rightOsc.start();
            synthNodes.push(leftOsc, rightOsc, merger);
        } else if (type === "rhythmic") {
            const osc = audioCtx.createOscillator();
            const lfo = audioCtx.createOscillator();
            const pulseGain = audioCtx.createGain();

            osc.type = "triangle";
            osc.frequency.value = 180;
            lfo.type = "sine";
            lfo.frequency.value = 14;

            lfo.connect(pulseGain.gain);
            osc.connect(pulseGain);
            pulseGain.connect(masterGain);

            osc.start();
            lfo.start();
            synthNodes.push(osc, lfo, pulseGain);
        } else {
            const freqs = type === "deepwork" ? [110, 164.81, 220] : [130.81, 196.00, 246.94];
            freqs.forEach(freq => {
                const osc = audioCtx.createOscillator();
                osc.type = "sine";
                osc.frequency.value = freq;
                osc.connect(masterGain);
                osc.start();
                synthNodes.push(osc)
            });
        }
    }

    function playMedia() {
        const track = currentPlaylist[currentTrackIndex];
        audioPlayer.src = track.src;

        audioPlayer.play().then(() => {
            usingSynth = false;
            stopSynth();
        }).catch(() => {
            // Kui kohalik audiofail puudub, teeme fallback-i Web Audio API poole
            usingSynth = true;
            startSynth(track.synthType);
        });
    }

    function pauseMedia() {
        audioPlayer.pause();
        if (usingSynth) stopSynth;
    }

    // Timeri loogika
    function formatTime(totalSecs) {
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    function updateTimerUI() {
        timerDisplay.textContent = formatTime(remainingSeconds)
    }

    function startCountdown() {
        isRunning = true;
        hasStarted = true;
        beginBtn.textContent = "Pause Session";
        timerCircle.classList.add("timer-active");
        playMedia();

        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
           if (remainingSeconds > 0) {
            remainingSeconds--;
            updateTimerUI();
           } else {
            completeSession();
           }
        }, 1000);
    }

    function pauseCountdown() {
        isRunning = false;
        beginBtn.textContent = "Resume Session";
        timerCircle.classList.remove("timer-active");
        clearInterval(timerInterval);
        pauseMedia();
    }

    function completeSession() {
        clearInterval(timerInterval);
        isRunning = false;
        hasStarted = false;
        pauseMedia();
        timerCircle.classList.remove("timer-active");
        beginBtn.textContent = "Begin Session";
        soundLabel.textContent = "Session Complete!";
    }

    // Nupu eventlistenerid
    beginBtn.addEventListener("click", () => {
        if (!hasStarted) {
            // Avame modaali aja valimiseks
            modalOverlay.classList.add("show");
            customInput.focus();
        } else if (isRunning) {
            pauseCountdown();
        } else {
            startCountdown();
        }
    });

    // Kui keskringile vajutada, prompti kasutajat ajakestust valima
    timerCircle.style.cursor = "pointer";
    timerCircle.title = "Click to change duration";
    timerCircle.addEventListener("click", () => {
        if (isRunning) pauseCountdown();
        modalOverlay.classList.add("show");
    });

    document.getElementById("cancel-modal").addEventListener("click", () => {
        modalOverlay.classList.remove("show");
    });

    document.getElementById("cancel-modal").addEventListener("click", () => {
        const parsed = parseInt(customInput.value, 10);
        durationMinutes = (!isNaN(parsed) && parsed > 0) ? Math.min(parsed, 240) : 25;
        remainingSeconds = durationMinutes * 60;
        updateTimerUI();
        modalOverlay.classList.remove("show");
        startCountdown();
    });

    changeSoundBtn.addEventListener("click", () => {
        currentTrackIndex = (currentTrackIndex + 1) % currentPlaylist.length;
        soundLabel.textContent = currentPlaylist[currentTrackIndex].name;
        if (isRunning) {
            playMedia();
        }
    });
});
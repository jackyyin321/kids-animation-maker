// Animation Maker - Main Application with HEIC Support
class AnimationMaker {
    constructor() {
        this.frames = [];
        this.currentFrameIndex = null;
        this.isPlaying = false;
        this.playInterval = null;
        this.globalDuration = 500;
        this.loop = true;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordingStartTime = null;

        this.initElements();
        this.initEventListeners();
        this.initSortable();
        this.updateCanvas();
    }

    initElements() {
        // Upload elements
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.selectFilesBtn = document.getElementById('selectFilesBtn');

        // Preview elements
        this.previewCanvas = document.getElementById('previewCanvas');
        this.ctx = this.previewCanvas.getContext('2d');
        this.playButton = document.getElementById('playButton');
        this.playingIndicator = document.getElementById('playingIndicator');

        // Timeline elements
        this.timeline = document.getElementById('timeline');
        this.frameCount = document.getElementById('frameCount');

        // Control elements
        this.globalDurationSlider = document.getElementById('globalDuration');
        this.globalDurationValue = document.getElementById('globalDurationValue');
        this.loopCheckbox = document.getElementById('loopCheckbox');

        // Export elements
        this.saveProjectBtn = document.getElementById('saveProjectBtn');
        this.loadProjectBtn = document.getElementById('loadProjectBtn');
        this.loadProjectInput = document.getElementById('loadProjectInput');
        this.exportGifBtn = document.getElementById('exportGifBtn');
        this.exportVideoBtn = document.getElementById('exportVideoBtn');

        // Modal elements
        this.frameModal = document.getElementById('frameModal');
        this.modalClose = document.querySelector('.modal-close');
        this.modalFrameImage = document.getElementById('modalFrameImage');
        this.frameDurationSlider = document.getElementById('frameDuration');
        this.frameDurationValue = document.getElementById('frameDurationValue');
        this.recordAudioBtn = document.getElementById('recordAudioBtn');
        this.uploadAudioBtn = document.getElementById('uploadAudioBtn');
        this.playAudioBtn = document.getElementById('playAudioBtn');
        this.deleteAudioBtn = document.getElementById('deleteAudioBtn');
        this.audioFileInput = document.getElementById('audioFileInput');
        this.recordingIndicator = document.getElementById('recordingIndicator');
        this.recordingTime = document.getElementById('recordingTime');
        this.applyFrameChanges = document.getElementById('applyFrameChanges');

        // Loading overlay
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.loadingText = document.getElementById('loadingText');

        // Toast container
        this.toastContainer = document.getElementById('toastContainer');
    }

    initEventListeners() {
        // Upload events
        this.dropZone.addEventListener('click', () => this.fileInput.click());
        this.selectFilesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.fileInput.click();
        });
        this.fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));

        // Drag and drop events
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });
        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('drag-over');
        });
        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            this.handleFiles(e.dataTransfer.files);
        });

        // Play button
        this.playButton.addEventListener('click', () => this.togglePlay());

        // Global duration slider
        this.globalDurationSlider.addEventListener('input', (e) => {
            this.globalDuration = parseInt(e.target.value);
            this.globalDurationValue.textContent = (this.globalDuration / 1000).toFixed(1) + '秒';
            this.frames.forEach(frame => {
                if (!frame.customDuration) {
                    frame.duration = this.globalDuration;
                }
            });
            this.renderTimeline();
        });

        // Loop checkbox
        this.loopCheckbox.addEventListener('change', (e) => {
            this.loop = e.target.checked;
        });

        // Export buttons
        this.saveProjectBtn.addEventListener('click', () => this.saveProject());
        this.loadProjectBtn.addEventListener('click', () => this.loadProjectInput.click());
        this.loadProjectInput.addEventListener('change', (e) => this.loadProject(e.target.files[0]));
        this.exportGifBtn.addEventListener('click', () => this.exportGif());
        this.exportVideoBtn.addEventListener('click', () => this.exportVideo());

        // Modal events
        this.modalClose.addEventListener('click', () => this.closeModal());
        this.frameModal.addEventListener('click', (e) => {
            if (e.target === this.frameModal) this.closeModal();
        });

        // Frame duration slider
        this.frameDurationSlider.addEventListener('input', (e) => {
            const duration = parseInt(e.target.value);
            this.frameDurationValue.textContent = (duration / 1000).toFixed(1) + '秒';
        });

        // Audio buttons
        this.recordAudioBtn.addEventListener('click', () => this.toggleRecording());
        this.uploadAudioBtn.addEventListener('click', () => this.audioFileInput.click());
        this.audioFileInput.addEventListener('change', (e) => this.handleAudioFile(e.target.files[0]));
        this.playAudioBtn.addEventListener('click', () => this.playFrameAudio());
        this.deleteAudioBtn.addEventListener('click', () => this.deleteFrameAudio());

        // Apply frame changes
        this.applyFrameChanges.addEventListener('click', () => this.applyFrameEdits());
    }

    initSortable() {
        Sortable.create(this.timeline, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            filter: '.timeline-empty',
            onEnd: (evt) => {
                const movedFrame = this.frames.splice(evt.oldIndex, 1)[0];
                this.frames.splice(evt.newIndex, 0, movedFrame);
                this.showToast('✅ 顺序已调整', 'success');
            }
        });
    }

    async handleFiles(files) {
        const allFiles = Array.from(files);

        if (allFiles.length === 0) {
            this.showToast('❌ 请选择图片文件', 'error');
            return;
        }

        this.showLoading('正在加载照片...');
        let successCount = 0;

        for (const file of allFiles) {
            try {
                let processedFile = file;

                // Check if file is HEIC/HEIF format
                const isHEIC = file.name.toLowerCase().endsWith('.heic') ||
                    file.name.toLowerCase().endsWith('.heif') ||
                    file.type === 'image/heic' ||
                    file.type === 'image/heif';

                if (isHEIC) {
                    // Check if heic2any library is loaded
                    if (typeof heic2any === 'undefined') {
                        console.error('heic2any library not loaded');
                        this.showToast('❌ HEIC转换库未加载，请刷新页面重试', 'error');
                        continue;
                    }

                    // Convert HEIC to JPEG
                    try {
                        this.loadingText.textContent = `正在转换 ${file.name}...`;
                        console.log('Starting HEIC conversion for:', file.name);

                        const convertedBlob = await heic2any({
                            blob: file,
                            toType: 'image/jpeg',
                            quality: 0.9
                        });

                        console.log('HEIC conversion successful');

                        // heic2any might return an array of blobs for multi-page HEIC
                        const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                        processedFile = new File([blob], file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'), { type: 'image/jpeg' });
                    } catch (conversionError) {
                        console.error('HEIC conversion error:', conversionError);
                        console.error('Error details:', {
                            name: conversionError.name,
                            message: conversionError.message,
                            stack: conversionError.stack
                        });

                        // Provide specific error messages based on error type
                        let errorMessage = `❌ 无法转换 ${file.name}`;

                        if (conversionError.message && conversionError.message.includes('format not supported')) {
                            errorMessage = `❌ ${file.name} 使用了不支持的HEIC编码格式。\n\n💡 建议：\n1. 在iPhone上转换为JPG后再上传\n2. 或使用在线转换工具：https://heictojpg.com\n3. 或直接上传JPG/PNG格式的照片`;
                            this.showToast(errorMessage, 'error');
                            // Show a more detailed alert for the first unsupported file
                            if (!this.heicWarningShown) {
                                this.heicWarningShown = true;
                                setTimeout(() => {
                                    alert('⚠️ HEIC格式提示\n\n您的HEIC文件使用了不支持的编码格式。\n\n建议解决方案：\n\n1. 在iPhone设置中：\n   设置 → 相机 → 格式 → 选择"最兼容"\n   这样新拍的照片会自动保存为JPG格式\n\n2. 或使用在线转换工具：\n   https://heictojpg.com\n\n3. 或直接上传JPG/PNG格式的照片');
                                }, 500);
                            }
                        } else {
                            errorMessage = `❌ 无法转换 ${file.name}: ${conversionError.message || '未知错误'}`;
                            this.showToast(errorMessage, 'error');
                        }

                        continue;
                    }
                }

                // Check if it's an image file
                if (!processedFile.type.startsWith('image/')) {
                    continue;
                }

                this.loadingText.textContent = '正在加载照片...';
                const imageData = await this.readFileAsDataURL(processedFile);
                const frame = {
                    id: 'frame-' + Date.now() + '-' + Math.random(),
                    imageData: imageData,
                    duration: this.globalDuration,
                    customDuration: false,
                    audio: null
                };
                this.frames.push(frame);
                successCount++;
            } catch (error) {
                console.error('Error loading image:', error);
            }
        }

        this.hideLoading();
        this.renderTimeline();
        this.updateCanvas();

        if (successCount > 0) {
            this.showToast(`✅ 已添加 ${successCount} 张照片`, 'success');
            this.playSound('upload');
        }
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    renderTimeline() {
        const emptyMessage = this.timeline.querySelector('.timeline-empty');
        if (this.frames.length === 0) {
            if (!emptyMessage) {
                this.timeline.innerHTML = '<div class="timeline-empty"><p>👆 上传照片开始创作吧！</p></div>';
            }
            this.frameCount.textContent = '0 帧';
            return;
        }

        if (emptyMessage) {
            emptyMessage.remove();
        }

        this.timeline.innerHTML = '';
        this.frames.forEach((frame, index) => {
            const frameEl = this.createFrameElement(frame, index);
            this.timeline.appendChild(frameEl);
        });

        this.frameCount.textContent = `${this.frames.length} 帧`;
    }

    createFrameElement(frame, index) {
        const div = document.createElement('div');
        div.className = 'frame-item';
        div.dataset.frameId = frame.id;

        const img = document.createElement('img');
        img.src = frame.imageData;
        img.className = 'frame-thumbnail';
        img.addEventListener('click', () => this.editFrame(index));

        const info = document.createElement('div');
        info.className = 'frame-info';

        const duration = document.createElement('div');
        duration.className = 'frame-duration';
        duration.textContent = `⏱️ ${(frame.duration / 1000).toFixed(1)}秒`;

        info.appendChild(duration);

        if (frame.audio) {
            const audioIndicator = document.createElement('div');
            audioIndicator.className = 'frame-audio-indicator';
            audioIndicator.textContent = '🎵 有音频';
            info.appendChild(audioIndicator);
        }

        const actions = document.createElement('div');
        actions.className = 'frame-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-frame';
        copyBtn.textContent = '📋';
        copyBtn.title = '复制';
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyFrame(index);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-frame';
        deleteBtn.textContent = '❌';
        deleteBtn.title = '删除';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteFrame(index);
        });

        actions.appendChild(copyBtn);
        actions.appendChild(deleteBtn);

        div.appendChild(img);
        div.appendChild(info);
        div.appendChild(actions);

        return div;
    }

    copyFrame(index) {
        const originalFrame = this.frames[index];
        const newFrame = {
            id: 'frame-' + Date.now() + '-' + Math.random(),
            imageData: originalFrame.imageData,
            duration: originalFrame.duration,
            customDuration: originalFrame.customDuration,
            audio: originalFrame.audio ? { ...originalFrame.audio } : null
        };
        this.frames.splice(index + 1, 0, newFrame);
        this.renderTimeline();
        this.showToast('✅ 已复制帧', 'success');
        this.playSound('copy');
    }

    deleteFrame(index) {
        this.frames.splice(index, 1);
        this.renderTimeline();
        this.updateCanvas();
        this.showToast('✅ 已删除帧', 'success');
        this.playSound('delete');
    }

    editFrame(index) {
        this.currentFrameIndex = index;
        const frame = this.frames[index];

        this.modalFrameImage.src = frame.imageData;
        this.frameDurationSlider.value = frame.duration;
        this.frameDurationValue.textContent = (frame.duration / 1000).toFixed(1) + '秒';

        if (frame.audio) {
            this.playAudioBtn.classList.remove('hidden');
            this.deleteAudioBtn.classList.remove('hidden');
        } else {
            this.playAudioBtn.classList.add('hidden');
            this.deleteAudioBtn.classList.add('hidden');
        }

        this.frameModal.classList.remove('hidden');
    }

    closeModal() {
        this.frameModal.classList.add('hidden');
        this.currentFrameIndex = null;
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
    }

    applyFrameEdits() {
        if (this.currentFrameIndex === null) return;

        const frame = this.frames[this.currentFrameIndex];
        const newDuration = parseInt(this.frameDurationSlider.value);

        if (newDuration !== this.globalDuration) {
            frame.customDuration = true;
        }
        frame.duration = newDuration;

        this.renderTimeline();
        this.closeModal();
        this.showToast('✅ 已保存修改', 'success');
    }

    async toggleRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (e) => {
                this.audioChunks.push(e.data);
            };

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = (e) => {
                    const frame = this.frames[this.currentFrameIndex];
                    frame.audio = {
                        type: 'recording',
                        data: e.target.result
                    };
                    this.playAudioBtn.classList.remove('hidden');
                    this.deleteAudioBtn.classList.remove('hidden');
                    this.recordingIndicator.classList.add('hidden');
                    this.showToast('✅ 录音完成', 'success');
                };
                reader.readAsDataURL(audioBlob);

                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
            this.recordingIndicator.classList.remove('hidden');
            this.recordingStartTime = Date.now();
            this.updateRecordingTime();

        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.showToast('❌ 无法访问麦克风', 'error');
        }
    }

    updateRecordingTime() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
            this.recordingTime.textContent = elapsed;

            if (elapsed >= 30) {
                this.mediaRecorder.stop();
            } else {
                setTimeout(() => this.updateRecordingTime(), 1000);
            }
        }
    }

    async handleAudioFile(file) {
        if (!file || !file.type.startsWith('audio/')) {
            this.showToast('❌ 请选择音频文件', 'error');
            return;
        }

        const audioData = await this.readFileAsDataURL(file);
        const frame = this.frames[this.currentFrameIndex];
        frame.audio = {
            type: 'file',
            data: audioData
        };

        this.playAudioBtn.classList.remove('hidden');
        this.deleteAudioBtn.classList.remove('hidden');
        this.showToast('✅ 音频已添加', 'success');
    }

    playFrameAudio() {
        if (this.currentFrameIndex === null) return;

        const frame = this.frames[this.currentFrameIndex];
        if (!frame.audio) return;

        const audio = new Audio(frame.audio.data);
        audio.play();
    }

    deleteFrameAudio() {
        if (this.currentFrameIndex === null) return;

        const frame = this.frames[this.currentFrameIndex];
        frame.audio = null;

        this.playAudioBtn.classList.add('hidden');
        this.deleteAudioBtn.classList.add('hidden');
        this.showToast('✅ 音频已删除', 'success');
    }

    updateCanvas() {
        if (this.frames.length === 0) {
            this.previewCanvas.width = 800;
            this.previewCanvas.height = 600;
            this.ctx.fillStyle = '#f0f0f0';
            this.ctx.fillRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
            this.ctx.fillStyle = '#999';
            this.ctx.font = '30px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('上传照片开始创作', this.previewCanvas.width / 2, this.previewCanvas.height / 2);
            return;
        }

        const firstFrame = this.frames[0];
        const img = new Image();
        img.onload = () => {
            this.previewCanvas.width = img.width;
            this.previewCanvas.height = img.height;
            this.ctx.drawImage(img, 0, 0);
        };
        img.src = firstFrame.imageData;
    }

    togglePlay() {
        if (this.frames.length === 0) {
            this.showToast('❌ 请先添加照片', 'error');
            return;
        }

        if (this.isPlaying) {
            this.stopPlay();
        } else {
            this.startPlay();
        }
    }

    startPlay() {
        this.isPlaying = true;
        this.playButton.classList.add('playing');
        this.playingIndicator.classList.remove('hidden');

        let currentIndex = 0;

        const playFrame = () => {
            if (!this.isPlaying) return;

            const frame = this.frames[currentIndex];
            const img = new Image();
            img.onload = () => {
                this.previewCanvas.width = img.width;
                this.previewCanvas.height = img.height;
                this.ctx.drawImage(img, 0, 0);
            };
            img.src = frame.imageData;

            if (frame.audio) {
                const audio = new Audio(frame.audio.data);
                audio.play();
            }

            currentIndex++;
            if (currentIndex >= this.frames.length) {
                if (this.loop) {
                    currentIndex = 0;
                    setTimeout(playFrame, frame.duration);
                } else {
                    this.stopPlay();
                    return;
                }
            } else {
                setTimeout(playFrame, frame.duration);
            }
        };

        playFrame();
        this.playSound('play');
    }

    stopPlay() {
        this.isPlaying = false;
        this.playButton.classList.remove('playing');
        this.playingIndicator.classList.add('hidden');
        this.updateCanvas();
    }

    saveProject() {
        const project = {
            name: '我的动画',
            frames: this.frames,
            globalDuration: this.globalDuration,
            loop: this.loop,
            createdAt: new Date().toISOString()
        };

        const json = JSON.stringify(project);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `animation-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
        this.showToast('✅ 项目已保存', 'success');
    }

    async loadProject(file) {
        if (!file) return;

        try {
            const text = await file.text();
            const project = JSON.parse(text);

            this.frames = project.frames || [];
            this.globalDuration = project.globalDuration || 500;
            this.loop = project.loop !== undefined ? project.loop : true;

            this.globalDurationSlider.value = this.globalDuration;
            this.globalDurationValue.textContent = (this.globalDuration / 1000).toFixed(1) + '秒';
            this.loopCheckbox.checked = this.loop;

            this.renderTimeline();
            this.updateCanvas();
            this.showToast('✅ 项目已加载', 'success');
        } catch (error) {
            console.error('Error loading project:', error);
            this.showToast('❌ 加载失败', 'error');
        }
    }

    async exportGif() {
        if (this.frames.length === 0) {
            this.showToast('❌ 请先添加照片', 'error');
            return;
        }

        // Check if GIF library is loaded
        if (typeof GIF === 'undefined') {
            this.showToast('❌ GIF库未加载,请刷新页面重试', 'error');
            return;
        }

        this.showLoading('正在生成GIF...');

        try {
            const gif = new GIF({
                workers: 2,
                quality: 10,
                workerScript: 'gif.worker.js',
                debug: true
            });

            // Add error handler BEFORE adding frames
            gif.on('error', (error) => {
                console.error('GIF generation error:', error);
                this.hideLoading();
                this.showToast('❌ GIF生成失败,请尝试减少帧数', 'error');
            });

            gif.on('progress', (p) => {
                this.loadingText.textContent = `正在生成GIF... ${Math.round(p * 100)}%`;
            });

            // Add frames
            for (const frame of this.frames) {
                try {
                    const img = await this.loadImage(frame.imageData);
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);

                    gif.addFrame(canvas, { delay: frame.duration });
                } catch (frameError) {
                    console.error('Error loading frame:', frameError);
                    this.hideLoading();
                    this.showToast('❌ 加载帧失败', 'error');
                    return;
                }
            }

            gif.on('finished', (blob) => {
                try {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `animation-${Date.now()}.gif`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    setTimeout(() => URL.revokeObjectURL(url), 100);

                    this.hideLoading();
                    this.showToast('🎉 GIF已导出', 'success');
                    this.playSound('success');
                } catch (downloadError) {
                    console.error('Download error:', downloadError);
                    this.hideLoading();
                    this.showToast('❌ 下载失败', 'error');
                }
            });

            // Start rendering
            gif.render();

        } catch (error) {
            console.error('Error exporting GIF:', error);
            this.hideLoading();
            this.showToast('❌ 导出失败: ' + (error.message || '未知错误'), 'error');
        }
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    async exportVideo() {
        this.showToast('ℹ️ 视频导出功能需要更高级的库支持', 'info');
        // Video export would require MediaRecorder API or FFmpeg.js
        // This is a placeholder for future implementation
    }

    showLoading(text) {
        this.loadingText.textContent = text;
        this.loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    playSound(type) {
        // Placeholder for sound effects
        // Could use Web Audio API to generate simple beeps
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AnimationMaker();
});

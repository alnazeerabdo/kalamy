// DOM Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const statusText = document.getElementById('statusText');
const outputArea = document.getElementById('output');
const apiKeyInput = document.getElementById('apiKey');

// State variables
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// Configuration
// REPLACE THIS WITH YOUR DEPLOYED WORKER URL AFTER DEPLOYMENT
const WORKER_URL = 'https://your-worker-name.your-subdomain.workers.dev';

// Event Listeners
startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = processAudio;

        mediaRecorder.start();
        isRecording = true;
        updateUI(true);
    } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('حدث خطأ أثناء الوصول إلى الميكروفون. الرجاء التأكد من السماح بالوصول.');
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        updateUI(false);

        // Stop all tracks to release microphone
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
}

function updateUI(recording) {
    startBtn.disabled = recording;
    stopBtn.disabled = !recording;

    if (recording) {
        statusDiv.classList.remove('hidden');
        statusText.textContent = 'جاري التسجيل...';
        outputArea.placeholder = 'جاري الاستماع...';
    } else {
        statusText.textContent = 'جاري المعالجة...';
    }
}

async function processAudio() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); // Chrome/Firefox default
    const base64Audio = await blobToBase64(audioBlob);

    // Remove data URL prefix (e.g., "data:audio/webm;base64,")
    const base64Data = base64Audio.split(',')[1];
    const mimeType = base64Audio.split(';')[0].split(':')[1];

    await sendToGemini(base64Data, mimeType);
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function sendToGemini(base64Data, mimeType) {
    const userKey = apiKeyInput.value.trim();

    try {
        let response;

        if (userKey) {
            // Scenario A: Direct to Google API
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${userKey}`;

            const payload = {
                contents: [{
                    parts: [{
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data
                        }
                    }, {
                        text: "Transcribe this audio to Arabic text. Output only the transcription without any additional text."
                    }]
                }]
            };

            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

        } else {
            // Scenario B: Via Cloudflare Worker
            // Note: For local testing without a deployed worker, this will fail unless WORKER_URL is set correctly
            if (WORKER_URL.includes('your-worker-name')) {
                alert('الرجاء إدخال مفتاح API أو نشر Cloudflare Worker وتحديث الرابط في الكود.');
                statusDiv.classList.add('hidden');
                return;
            }

            response = await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audio: base64Data,
                    mimeType: mimeType
                })
            });
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || 'API Request Failed');
        }

        const data = await response.json();

        // Extract text from Gemini response structure
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
            outputArea.value = text;
        } else {
            outputArea.value = 'لم يتم التعرف على أي نص.';
        }

    } catch (error) {
        console.error('Error:', error);
        outputArea.value = `حدث خطأ: ${error.message}`;
    } finally {
        statusDiv.classList.add('hidden');
    }
}

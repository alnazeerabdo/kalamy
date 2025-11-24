export default {
    async fetch(request, env, ctx) {
        // Handle CORS Preflight
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            });
        }

        if (request.method !== "POST") {
            return new Response("Method Not Allowed", { status: 405 });
        }

        try {
            const { audio, mimeType } = await request.json();

            if (!audio || !mimeType) {
                return new Response(JSON.stringify({ error: "Missing audio or mimeType" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                });
            }

            const apiKey = env.GEMINI_API_KEY;
            if (!apiKey) {
                return new Response(JSON.stringify({ error: "Server configuration error: Missing API Key" }), {
                    status: 500,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"
                    },
                });
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${apiKey}`;

            const payload = {
                contents: [{
                    parts: [{
                        inlineData: {
                            mimeType: mimeType,
                            data: audio
                        }
                    }, {
                        text: "Transcribe this audio to Arabic text. Output only the transcription without any additional text."
                    }]
                }]
            };

            const geminiResponse = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await geminiResponse.json();

            return new Response(JSON.stringify(data), {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            });

        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }
    },
};

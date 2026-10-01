const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_LENGTH = 20;
const MAX_GEMINI_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

export const chatWithGemini = async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ success: false, message: 'Gemini is not configured. Add GEMINI_API_KEY to server/.env.' });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, message: 'Send at least one message.' });
  }

  const contents = messages.slice(-MAX_HISTORY_LENGTH).map((message) => ({
    role: message?.role,
    parts: [{ text: message?.text?.trim() }],
  }));
  const validContents = contents.every(({ role, parts }) => (
    ['user', 'model'].includes(role) &&
    typeof parts[0].text === 'string' &&
    parts[0].text.length > 0 &&
    parts[0].text.length <= MAX_MESSAGE_LENGTH
  ));

  if (!validContents || contents.at(-1).role !== 'user') {
    return res.status(400).json({ success: false, message: 'Chat history is invalid or contains an oversized message.' });
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  try {
    let response;
    let data;
    for (let attempt = 0; attempt < MAX_GEMINI_ATTEMPTS; attempt += 1) {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents,
          generationConfig: { maxOutputTokens: 1024 },
        }),
      });
      data = await response.json().catch(() => ({}));

      if (response.status !== 503 || attempt === MAX_GEMINI_ATTEMPTS - 1) break;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
    }

    if (!response.ok) {
      const providerMessage = data.error?.message || 'Gemini rejected the request.';
      console.error(`Gemini API returned ${response.status}: ${providerMessage}`);
      if (response.status === 503) {
        res.set('Retry-After', '2');
        return res.status(503).json({ success: false, message: 'Gemini is temporarily busy. Please try again in a moment.' });
      }
      return res.status(502).json({ success: false, message: providerMessage });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();
    if (!reply) {
      return res.status(502).json({ success: false, message: 'Gemini returned no text. Try rephrasing your message.' });
    }

    return res.status(200).json({ success: true, reply });
  } catch (error) {
    console.error('Gemini request failed:', error.message);
    return res.status(502).json({ success: false, message: 'Could not reach Gemini. Check the server connection and try again.' });
  }
};
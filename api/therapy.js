export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { system, messages } = req.body || {};
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Server error: No API key configured' });
    }

    // Auto-detect Google Gemini keys (AQ. or AIza prefix) vs Anthropic Claude keys
    const isGemini = apiKey.startsWith('AQ.') || apiKey.startsWith('AIza') || Boolean(process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY);

    if (isGemini) {
      const contents = (messages || []).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
      }));

      const bodyPayload = {
        contents,
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      };

      if (system) {
        bodyPayload.systemInstruction = {
          parts: [{ text: system }]
        };
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyPayload)
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: data.error?.message || 'Gemini API error'
        });
      }

      return res.status(200).json(data);
    }

    // Standard Anthropic Claude request
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system,
        messages
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.error?.message || 'API error' 
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ 
      error: 'Server error: ' + error.message 
    });
  }
}


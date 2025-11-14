import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY env var');
  process.exit(1);
}

/**
 * Proxy SDP → OpenAI Realtime (WebRTC)
 * body: { sdp: string, model: string }
 */
app.post('/api/realtime/sdp', async (req, res) => {
  try {
    const { sdp, model } = req.body as { sdp: string; model: string };
    if (!sdp || !model) return res.status(400).json({ error: 'Missing sdp or model' });

    const r = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/sdp'
      },
      body: sdp
    });

    const answer = await r.text();
    if (!r.ok) {
      return res.status(r.status).send(answer || 'Realtime SDP exchange failed');
    }
    res.status(200).send(answer);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`Server ready on http://localhost:${port}`));

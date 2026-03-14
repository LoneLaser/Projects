import { Router, Request, Response } from 'express';
import { suggestDashboard } from '../services/ai';

const aiRouter = Router();

// POST /api/ai/suggest — Generate dashboard suggestions for a query
aiRouter.post('/suggest', async (req: Request, res: Response) => {
  const { queryId } = req.body;

  if (!queryId) {
    res.status(400).json({ error: 'queryId is required' });
    return;
  }

  try {
    const result = await suggestDashboard(queryId);
    res.json(result);
  } catch (err: any) {
    console.error('AI suggest error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/config — Return current AI provider configuration (non-sensitive)
aiRouter.get('/config', (_req: Request, res: Response) => {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3';
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  res.json({
    provider,
    configured: provider === 'openai' ? hasOpenAIKey : true,
    model: provider === 'openai' ? openaiModel : ollamaModel,
    ollamaUrl: provider === 'ollama' ? ollamaUrl : undefined,
  });
});

export default aiRouter;

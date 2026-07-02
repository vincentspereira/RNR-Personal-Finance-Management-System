/**
 * Pluggable vision provider with a single typed adapter interface.
 * Per user preference, default is Z.ai's GLM-5V; Anthropic Claude Sonnet
 * remains a fallback for parity.
 */
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config';

export interface VisionProvider {
  readonly name: 'zai' | 'anthropic';
  callVision(base64Image: string, prompt: string): Promise<string>;
}

class ZaiVisionProvider implements VisionProvider {
  readonly name = 'zai' as const;
  async callVision(base64Image: string, prompt: string): Promise<string> {
    if (!config.zaiApiKey) throw new Error('ZAI_API_KEY is not configured.');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;
    const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.zaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'glm-5v-turbo',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: prompt },
            ],
          },
        ],
        max_tokens: 4096,
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Z.ai API error: ${response.status} - ${err}`);
    }
    const result = await response.json() as any;
    return result.choices?.[0]?.message?.content || '';
  }
}

class AnthropicVisionProvider implements VisionProvider {
  readonly name = 'anthropic' as const;
  private client?: Anthropic;
  private getClient(): Anthropic {
    if (!config.anthropicApiKey || config.anthropicApiKey === 'sk-ant-placeholder') {
      throw new Error('ANTHROPIC_API_KEY is not configured.');
    }
    if (!this.client) this.client = new Anthropic({ apiKey: config.anthropicApiKey });
    return this.client;
  }
  async callVision(base64Image: string, prompt: string): Promise<string> {
    const response = await this.getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });
    const textBlock = response.content.find((b: any) => b.type === 'text');
    return (textBlock as any)?.text || '';
  }
}

let cached: VisionProvider | null = null;

export function getVisionProvider(): VisionProvider {
  if (cached) return cached;
  const preferred = config.visionProvider;
  if (preferred === 'zai' && config.zaiApiKey) {
    cached = new ZaiVisionProvider();
    return cached;
  }
  if (preferred === 'anthropic' && config.anthropicApiKey && config.anthropicApiKey !== 'sk-ant-placeholder') {
    cached = new AnthropicVisionProvider();
    return cached;
  }
  // Fallback to whichever is configured.
  if (config.zaiApiKey) {
    cached = new ZaiVisionProvider();
    return cached;
  }
  if (config.anthropicApiKey && config.anthropicApiKey !== 'sk-ant-placeholder') {
    cached = new AnthropicVisionProvider();
    return cached;
  }
  throw new Error('No vision API key configured. Set ZAI_API_KEY or ANTHROPIC_API_KEY in your .env file.');
}

// Test seam — lets tests inject a mock provider.
export function _setVisionProviderForTest(provider: VisionProvider | null) {
  cached = provider;
}

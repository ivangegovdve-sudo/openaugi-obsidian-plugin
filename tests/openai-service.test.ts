import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as obsidian from 'obsidian';
import { OpenAIService } from '../src/services/openai-service';

/** Build a `requestUrl` response stub from a status code and JSON body. */
function mockResponse(status: number, json: unknown) {
  return { status, text: JSON.stringify(json), json, arrayBuffer: new ArrayBuffer(0) };
}

describe('OpenAIService', () => {
  let service: OpenAIService;

  beforeEach(() => {
    service = new OpenAIService('test-api-key', 'gpt-5');
  });

  describe('constructor', () => {
    it('stores API key and model', () => {
      // Access private fields via any cast (testing internals)
      expect((service as any).apiKey).toBe('test-api-key');
      expect((service as any).model).toBe('gpt-5');
    });
  });

  describe('extractCustomContext (via prompt building)', () => {
    // We test this through the prompt generation methods since extractCustomContext is private

    it('includes context: section in transcript prompt', () => {
      const content = 'Some transcript\n\ncontext:\nFocus on tech topics\n\nMore content';
      const prompt = (service as any).getPrompt(content);
      expect(prompt).toContain('USER CONTEXT');
      expect(prompt).toContain('Focus on tech topics');
    });

    it('includes fenced context: section in transcript prompt', () => {
      const content = 'Some content\n\n```context:\nOnly extract action items\n```\n\nMore stuff';
      const prompt = (service as any).getPrompt(content);
      expect(prompt).toContain('USER CONTEXT');
      expect(prompt).toContain('Only extract action items');
    });

    it('handles content without context section', () => {
      const content = 'Just a regular transcript with no special context';
      const prompt = (service as any).getPrompt(content);
      expect(prompt).not.toContain('USER CONTEXT');
      expect(prompt).toContain('Just a regular transcript');
    });
  });

  describe('getPrompt', () => {
    it('includes the transcript content', () => {
      const prompt = (service as any).getPrompt('My voice note about productivity');
      expect(prompt).toContain('Transcript:\nMy voice note about productivity');
    });

    it('includes atomic notes instructions', () => {
      const prompt = (service as any).getPrompt('test');
      expect(prompt).toContain('Atomic Notes');
      expect(prompt).toContain('self-contained');
    });

    it('includes task extraction instructions', () => {
      const prompt = (service as any).getPrompt('test');
      expect(prompt).toContain('Tasks');
      expect(prompt).toContain('actionable');
    });

    it('includes AUGI command handling', () => {
      const prompt = (service as any).getPrompt('test');
      expect(prompt).toContain('AUGI');
      expect(prompt).toContain('auggie');
    });
  });

  describe('getDistillPrompt', () => {
    it('includes content to distill', () => {
      const prompt = (service as any).getDistillPrompt('Note content here');
      expect(prompt).toContain('Content to Distill:\nNote content here');
    });

    it('uses custom prompt when provided', () => {
      const custom = 'You are a custom processor. Do something special.';
      const prompt = (service as any).getDistillPrompt('content', custom);
      expect(prompt).toContain(custom);
      // Should NOT contain the default distill instructions
      expect(prompt).not.toContain('expert knowledge curator');
    });

    it('uses default prompt when no custom prompt', () => {
      const prompt = (service as any).getDistillPrompt('content');
      expect(prompt).toContain('expert knowledge curator');
    });

    it('appends custom context from content', () => {
      const content = 'Notes here\n\ncontext:\nFocus on architecture\n\nMore notes';
      const prompt = (service as any).getDistillPrompt(content);
      expect(prompt).toContain('USER CONTEXT');
      expect(prompt).toContain('Focus on architecture');
    });
  });

  describe('getPublishPrompt', () => {
    it('includes content to transform', () => {
      const prompt = (service as any).getPublishPrompt('Blog content');
      expect(prompt).toContain('Content to Transform:\nBlog content');
    });

    it('uses default publish prompt', () => {
      const prompt = (service as any).getPublishPrompt('content');
      expect(prompt).toContain('publishable blog post');
      expect(prompt).toContain('PRESERVE');
    });

    it('uses custom prompt when provided', () => {
      const custom = 'Write a newsletter instead.';
      const prompt = (service as any).getPublishPrompt('content', custom);
      expect(prompt).toContain('Write a newsletter instead.');
      expect(prompt).not.toContain('publishable blog post');
    });
  });

  describe('parseTranscript', () => {
    it('throws when API key is not set', async () => {
      const noKeyService = new OpenAIService('', 'gpt-5');
      await expect(noKeyService.parseTranscript('content')).rejects.toThrow('OpenAI API key not set');
    });

    it('calls OpenAI API with correct parameters', async () => {
      const response = mockResponse(200, ({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: 'Test summary',
                notes: [{ title: 'Note 1', content: 'Content 1' }],
                tasks: ['- [ ] Task 1']
              }),
              refusal: null
            }
          }]
        }));

      const requestSpy = vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(response as any);

      const result = await service.parseTranscript('Test transcript');

      expect(requestSpy).toHaveBeenCalledOnce();
      const [params] = requestSpy.mock.calls[0];
      expect(params.url).toBe('https://api.openai.com/v1/chat/completions');
      expect(params.method).toBe('POST');
      expect(JSON.parse(params.body as string).model).toBe('gpt-5');

      expect(result.summary).toBe('Test summary');
      expect(result.notes).toHaveLength(1);
      expect(result.tasks).toHaveLength(1);

      requestSpy.mockRestore();
    });

    it('throws on API error response', async () => {
      const response = mockResponse(401, { error: { message: 'Invalid API key' } });

      const requestSpy = vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(response as any);

      await expect(service.parseTranscript('content')).rejects.toThrow('OpenAI API error');

      requestSpy.mockRestore();
    });
  });

  describe('distillContent', () => {
    it('throws when API key is not set', async () => {
      const noKeyService = new OpenAIService('', 'gpt-5');
      await expect(noKeyService.distillContent('content')).rejects.toThrow('OpenAI API key not set');
    });

    it('parses structured response correctly', async () => {
      const response = mockResponse(200, ({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: 'Distilled summary about [[Topic A]]',
                notes: [
                  { title: 'Topic A', content: 'Deep dive into A' },
                  { title: 'Topic B', content: 'Overview of B' },
                ],
                tasks: []
              }),
              refusal: null
            }
          }]
        }));

      const requestSpy = vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(response as any);

      const result = await service.distillContent('aggregated content');

      expect(result.summary).toContain('Topic A');
      expect(result.notes).toHaveLength(2);
      expect(result.sourceNotes).toEqual([]); // Initialized as empty
      expect(result.tasks).toEqual([]);

      requestSpy.mockRestore();
    });
  });

  describe('publishContent', () => {
    it('returns plain text content', async () => {
      const response = mockResponse(200, ({
          choices: [{
            message: {
              content: '# My Blog Post\n\nThis is the published content.',
              refusal: null
            }
          }]
        }));

      const requestSpy = vi.spyOn(obsidian, 'requestUrl').mockResolvedValue(response as any);

      const result = await service.publishContent('raw notes');

      expect(result).toContain('# My Blog Post');
      expect(result).toContain('published content');

      requestSpy.mockRestore();
    });
  });
});

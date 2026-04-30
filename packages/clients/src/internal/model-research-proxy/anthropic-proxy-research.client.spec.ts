import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { of, throwError } from 'rxjs';
import { AnthropicProxyResearchClient } from './anthropic-proxy-research.client';
import { researchConfig, clearEnvCache } from '@dofe/infra-common';

// Mock the config
jest.mock('@dofe/infra-common', () => ({
  researchConfig: {
    get apiBaseUrl() {
      return 'http://localhost:3100';
    },
    get researchBotProxyToken() {
      return 'test-token';
    },
    get anthropicCompatiblePath() {
      return '/api/v1/anthropic-compatible/v1/messages';
    },
    get researchProxyEndpoint() {
      return 'http://localhost:3100/api/v1/anthropic-compatible/v1/messages';
    },
  },
  clearEnvCache: jest.fn(),
}));

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockHttpService = {
  post: jest.fn(),
};

describe('AnthropicProxyResearchClient', () => {
  let client: AnthropicProxyResearchClient;
  let httpService: HttpService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnthropicProxyResearchClient,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: mockLogger,
        },
      ],
    }).compile();

    client = module.get<AnthropicProxyResearchClient>(AnthropicProxyResearchClient);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  describe('research', () => {
    const testMessages = [
      { role: 'user' as const, content: 'Hello, research!' },
    ];

    it('throws a config error when apiBaseUrl is missing', async () => {
      // Override the mock to return empty apiBaseUrl
      jest.spyOn(researchConfig, 'apiBaseUrl', 'get').mockReturnValue('');

      await expect(client.research(testMessages)).rejects.toThrow(
        'Missing apiBaseUrl for model capability research proxy',
      );
    });

    it('throws a config error when researchBotProxyToken is missing', async () => {
      // Restore apiBaseUrl but mock token as empty
      jest.spyOn(researchConfig, 'apiBaseUrl', 'get').mockReturnValue('http://localhost:3100');
      jest.spyOn(researchConfig, 'researchBotProxyToken', 'get').mockReturnValue('');

      await expect(client.research(testMessages)).rejects.toThrow(
        'Missing researchBotProxyToken for model capability research',
      );
    });

    it('sends request with fixed sentinel model value', async () => {
      // Restore valid config
      jest.spyOn(researchConfig, 'apiBaseUrl', 'get').mockReturnValue('http://localhost:3100');
      jest.spyOn(researchConfig, 'researchBotProxyToken', 'get').mockReturnValue('test-token');

      const mockResponse = {
        data: {
          id: 'msg_test',
          content: [
            { type: 'text', text: 'Research response' },
          ],
        },
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      await client.research(testMessages);

      expect(mockHttpService.post).toHaveBeenCalledTimes(1);
      const [url, requestBody, options] = mockHttpService.post.mock.calls[0];

      expect(url).toBe('http://localhost:3100/api/v1/anthropic-compatible/v1/messages');
      expect(requestBody.model).toBe('__proxy_override_required__');
      expect(requestBody.messages).toEqual(testMessages);
      expect(options.headers['Authorization']).toBe('Bearer test-token');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.timeout).toBe(120000);
    });

    it('normalizes Anthropic response to single text string', async () => {
      jest.spyOn(researchConfig, 'apiBaseUrl', 'get').mockReturnValue('http://localhost:3100');
      jest.spyOn(researchConfig, 'researchBotProxyToken', 'get').mockReturnValue('test-token');

      const mockResponse = {
        data: {
          id: 'msg_test',
          content: [
            { type: 'text', text: 'First part' },
            { type: 'tool_use', id: 'tool1', name: 'search', input: {} },
            { type: 'text', text: 'Second part' },
            { type: 'text', text: '  ' }, // empty after trim
          ],
        },
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await client.research(testMessages);

      // Should concatenate non-empty text blocks in order
      expect(result).toBe('First partSecond part');
    });

    it('throws error when no usable text blocks in response', async () => {
      jest.spyOn(researchConfig, 'apiBaseUrl', 'get').mockReturnValue('http://localhost:3100');
      jest.spyOn(researchConfig, 'researchBotProxyToken', 'get').mockReturnValue('test-token');

      const mockResponse = {
        data: {
          id: 'msg_test',
          content: [
            { type: 'tool_use', id: 'tool1', name: 'search', input: {} },
            { type: 'text', text: '  ' },
          ],
        },
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      await expect(client.research(testMessages)).rejects.toThrow(
        'No usable text content in Anthropic proxy response',
      );
    });

    it('handles HTTP errors appropriately', async () => {
      jest.spyOn(researchConfig, 'apiBaseUrl', 'get').mockReturnValue('http://localhost:3100');
      jest.spyOn(researchConfig, 'researchBotProxyToken', 'get').mockReturnValue('test-token');

      const axiosError = {
        response: { status: 401, data: { error: 'Unauthorized' } },
        message: 'Request failed with status code 401',
        code: 'ERR_BAD_REQUEST',
      };

      mockHttpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(client.research(testMessages)).rejects.toThrow(
        'Anthropic proxy research API error: Unauthorized',
      );
    });
  });
});

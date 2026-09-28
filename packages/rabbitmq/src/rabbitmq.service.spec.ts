import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { RabbitmqService } from './rabbitmq.service';
import { RABBITMQ_CONNECTION } from './dto/rabbitmq.dto';

describe('RabbitmqService', () => {
  let service: RabbitmqService;

  const mockChannel = {
    on: vi.fn(),
    prefetch: vi.fn().mockResolvedValue(undefined),
    assertQueue: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockReturnValue(true),
    consume: vi.fn().mockResolvedValue({ consumerTag: 'tag-1' }),
    cancel: vi.fn().mockResolvedValue(undefined),
    ack: vi.fn(),
    nack: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockConnection = {
    connection: { closed: false },
    on: vi.fn(),
    createChannel: vi.fn().mockResolvedValue(mockChannel),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockRabbitmqConnection = {
    connection: mockConnection,
    connect: vi.fn().mockResolvedValue(mockConnection),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RabbitmqService,
        {
          provide: RABBITMQ_CONNECTION,
          useValue: mockRabbitmqConnection,
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<RabbitmqService>(RabbitmqService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('initializes connection and channel on module init', async () => {
    await service.onModuleInit();

    expect(mockRabbitmqConnection.connect).toHaveBeenCalled();
    expect(mockConnection.createChannel).toHaveBeenCalled();
    expect(mockChannel.prefetch).toHaveBeenCalledWith(1);
  });

  it('degrades send message when RabbitMQ is optional', async () => {
    const originalOptional = process.env.RABBITMQ_OPTIONAL;
    process.env.RABBITMQ_OPTIONAL = 'true';
    mockRabbitmqConnection.connect.mockRejectedValueOnce(new Error('offline'));

    try {
      await expect(
        service.sendMessageToRabbitMQ('test-queue', { hello: 'world' }),
      ).resolves.toBeUndefined();
    } finally {
      process.env.RABBITMQ_OPTIONAL = originalOptional;
    }
  });
});

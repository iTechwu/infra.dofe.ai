import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { RabbitmqService } from './rabbitmq.service';
import { RABBITMQ_CONNECTION } from './dto/rabbitmq.dto';

describe('RabbitmqService', () => {
  let service: RabbitmqService;

  const mockChannel = {
    on: jest.fn(),
    prefetch: jest.fn().mockResolvedValue(undefined),
    assertQueue: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockReturnValue(true),
    consume: jest.fn().mockResolvedValue({ consumerTag: 'tag-1' }),
    cancel: jest.fn().mockResolvedValue(undefined),
    ack: jest.fn(),
    nack: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const mockConnection = {
    connection: { closed: false },
    on: jest.fn(),
    createChannel: jest.fn().mockResolvedValue(mockChannel),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const mockRabbitmqConnection = {
    connection: mockConnection,
    connect: jest.fn().mockResolvedValue(mockConnection),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

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

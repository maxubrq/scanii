import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import * as amqp from 'amqplib';
import { createLogger, SkaniiLogger } from '@skanii/logger';
import { SkaniiAmqpProducer, AmqpProducerConfig, PublishOptions } from '../producer';

// Mock amqplib
vi.mock('amqplib');

// Mock logger
vi.mock('@skanii/logger');

describe('SkaniiAmqpProducer', () => {
    let mockConnection: any;
    let mockChannel: any;
    let mockLogger: SkaniiLogger;
    let producer: SkaniiAmqpProducer;
    let config: AmqpProducerConfig;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Mock connection
        mockConnection = {
            createChannel: vi.fn(),
            close: vi.fn(),
            on: vi.fn(),
        };

        // Mock channel
        mockChannel = {
            assertExchange: vi.fn(),
            assertQueue: vi.fn(),
            publish: vi.fn(),
            sendToQueue: vi.fn(),
            close: vi.fn(),
            once: vi.fn(),
        };

        // Mock logger
        mockLogger = {
            info: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        } as any;

        // Mock amqplib connect
        (amqp.connect as Mock).mockResolvedValue(mockConnection);
        mockConnection.createChannel.mockResolvedValue(mockChannel);
        mockChannel.assertExchange.mockResolvedValue(undefined);
        mockChannel.assertQueue.mockResolvedValue(undefined);

        // Mock createLogger
        (createLogger as Mock).mockReturnValue(mockLogger);

        // Default config
        config = {
            url: 'amqp://localhost',
            exchange: 'test-exchange',
            exchangeType: 'topic',
            durable: true,
            reconnectAttempts: 3,
            reconnectDelay: 1000,
        };

        producer = new SkaniiAmqpProducer('test-producer', config, mockLogger);
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    describe('Constructor', () => {
        it('should initialize with default config values', () => {
            const minimalConfig = { url: 'amqp://localhost' };
            const producerWithDefaults = new SkaniiAmqpProducer('test', minimalConfig);
            
            expect(createLogger).toHaveBeenCalledWith('test');
            expect(producerWithDefaults).toBeInstanceOf(SkaniiAmqpProducer);
        });

        it('should initialize with custom config', () => {
            expect(producer).toBeInstanceOf(SkaniiAmqpProducer);
            // Producer was created with custom logger, so createLogger should not be called
            expect(producer.isConnected()).toBe(false);
        });

        it('should use provided logger', () => {
            const customLogger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
            const producerWithCustomLogger = new SkaniiAmqpProducer('test', config, customLogger);
            expect(producerWithCustomLogger).toBeInstanceOf(SkaniiAmqpProducer);
        });
    });

    describe('connect()', () => {
        it('should connect successfully', async () => {
            await producer.connect();

            expect(amqp.connect).toHaveBeenCalledWith(config.url);
            expect(mockConnection.createChannel).toHaveBeenCalled();
            expect(mockChannel.assertExchange).toHaveBeenCalledWith(
                config.exchange,
                config.exchangeType,
                { durable: config.durable }
            );
            expect(mockConnection.on).toHaveBeenCalledWith('error', expect.any(Function));
            expect(mockConnection.on).toHaveBeenCalledWith('close', expect.any(Function));
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Successfully connected to AMQP broker')
            );
        });

        it('should handle connection failure', async () => {
            const error = new Error('Connection failed');
            (amqp.connect as Mock).mockRejectedValue(error);

            await expect(producer.connect()).rejects.toThrow('Connection failed');
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to connect to AMQP broker'),
                { extra: { error: 'Error: Connection failed' } }
            );
        });

        it('should handle channel creation failure', async () => {
            const error = new Error('Channel creation failed');
            mockConnection.createChannel.mockRejectedValue(error);

            await expect(producer.connect()).rejects.toThrow('Channel creation failed');
        });

        it('should return early if already connected', async () => {
            // First connection
            await producer.connect();
            vi.clearAllMocks();

            // Second connection attempt
            await producer.connect();

            expect(amqp.connect).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Already connected to AMQP broker')
            );
        });

        it('should wait if connection is in progress', async () => {
            // Start first connection (don't await)
            const firstConnection = producer.connect();
            
            // Start second connection while first is in progress
            const secondConnection = producer.connect();

            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Connection already in progress, waiting...')
            );

            // Complete both connections
            await Promise.all([firstConnection, secondConnection]);
            
            // Should only connect once
            expect(amqp.connect).toHaveBeenCalledTimes(1);
        });
    });

    describe('publish()', () => {
        beforeEach(async () => {
            await producer.connect();
            vi.clearAllMocks();
        });

        it('should publish message successfully', async () => {
            mockChannel.publish.mockReturnValue(true);
            const message = { test: 'data' };
            const options: PublishOptions = {
                routingKey: 'test.route',
                persistent: true,
            };

            const result = await producer.publish(message, options);

            expect(result).toBe(true);
            expect(mockChannel.publish).toHaveBeenCalledWith(
                config.exchange,
                'test.route',
                Buffer.from(JSON.stringify(message)),
                expect.objectContaining({
                    persistent: true,
                    timestamp: expect.any(Number),
                })
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Message published to exchange')
            );
        });

        it('should handle channel buffer full scenario', async () => {
            mockChannel.publish.mockReturnValue(false);
            const message = { test: 'data' };

            // Mock the drain event
            mockChannel.once.mockImplementation((event: string, callback: () => void) => {
                if (event === 'drain') {
                    setTimeout(callback, 10);
                }
            });

            const result = await producer.publish(message);

            expect(result).toBe(true);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Message not published immediately')
            );
            expect(mockChannel.once).toHaveBeenCalledWith('drain', expect.any(Function));
        });

        it('should use default values for options', async () => {
            mockChannel.publish.mockReturnValue(true);
            const message = { test: 'data' };

            await producer.publish(message);

            expect(mockChannel.publish).toHaveBeenCalledWith(
                config.exchange,
                '',
                Buffer.from(JSON.stringify(message)),
                expect.objectContaining({
                    persistent: true,
                    timestamp: expect.any(Number),
                })
            );
        });

        it('should connect if not connected', async () => {
            // Create new producer that's not connected
            const newProducer = new SkaniiAmqpProducer('test-new', config, mockLogger);
            mockChannel.publish.mockReturnValue(true);

            await newProducer.publish({ test: 'data' });

            expect(amqp.connect).toHaveBeenCalled();
            expect(mockChannel.publish).toHaveBeenCalled();
        });

        it('should handle publish error', async () => {
            const error = new Error('Publish failed');
            mockChannel.publish.mockImplementation(() => {
                throw error;
            });

            await expect(producer.publish({ test: 'data' })).rejects.toThrow('Publish failed');
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to publish message'),
                { extra: { error: 'Error: Publish failed' } }
            );
        });
    });

    describe('publishToQueue()', () => {
        beforeEach(async () => {
            await producer.connect();
            vi.clearAllMocks();
        });

        it('should publish to queue successfully', async () => {
            mockChannel.sendToQueue.mockReturnValue(true);
            const queueName = 'test-queue';
            const message = { test: 'data' };
            const options = { persistent: true };

            const result = await producer.publishToQueue(queueName, message, options);

            expect(result).toBe(true);
            expect(mockChannel.assertQueue).toHaveBeenCalledWith(queueName, {
                durable: config.durable,
            });
            expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
                queueName,
                Buffer.from(JSON.stringify(message)),
                expect.objectContaining({
                    persistent: true,
                    timestamp: expect.any(Number),
                })
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`Message sent to queue: ${queueName}`)
            );
        });

        it('should handle queue buffer full scenario', async () => {
            mockChannel.sendToQueue.mockReturnValue(false);
            const queueName = 'test-queue';
            const message = { test: 'data' };

            mockChannel.once.mockImplementation((event: string, callback: () => void) => {
                if (event === 'drain') {
                    setTimeout(callback, 10);
                }
            });

            const result = await producer.publishToQueue(queueName, message);

            expect(result).toBe(true);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Message not sent immediately')
            );
        });

        it('should connect if not connected', async () => {
            const newProducer = new SkaniiAmqpProducer('test-new', config, mockLogger);
            mockChannel.sendToQueue.mockReturnValue(true);

            await newProducer.publishToQueue('test-queue', { test: 'data' });

            expect(amqp.connect).toHaveBeenCalled();
            expect(mockChannel.sendToQueue).toHaveBeenCalled();
        });

        it('should handle sendToQueue error', async () => {
            const error = new Error('Send to queue failed');
            mockChannel.sendToQueue.mockImplementation(() => {
                throw error;
            });

            await expect(producer.publishToQueue('test-queue', { test: 'data' }))
                .rejects.toThrow('Send to queue failed');
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to send message to queue'),
                { extra: { error: 'Error: Send to queue failed' } }
            );
        });
    });

    describe('close()', () => {
        it('should close channel and connection successfully', async () => {
            await producer.connect();
            mockChannel.close.mockResolvedValue(undefined);
            mockConnection.close.mockResolvedValue(undefined);

            await producer.close();

            expect(mockChannel.close).toHaveBeenCalled();
            expect(mockConnection.close).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('AMQP connection closed')
            );
        });

        it('should handle close error', async () => {
            await producer.connect();
            const error = new Error('Close failed');
            mockChannel.close.mockRejectedValue(error);

            await expect(producer.close()).rejects.toThrow('Close failed');
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error closing AMQP connection'),
                { extra: { error: 'Error: Close failed' } }
            );
        });

        it('should handle closing when not connected', async () => {
            await producer.close();
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('AMQP connection closed')
            );
        });
    });

    describe('isConnected()', () => {
        it('should return false when not connected', () => {
            expect(producer.isConnected()).toBe(false);
        });

        it('should return true when connected', async () => {
            await producer.connect();
            expect(producer.isConnected()).toBe(true);
        });

        it('should return false when only connection exists', async () => {
            // Simulate partial connection
            (producer as any).connection = mockConnection;
            (producer as any).channel = null;
            
            expect(producer.isConnected()).toBe(false);
        });
    });

    describe('Error Handling and Reconnection', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should handle connection error and schedule reconnect', async () => {
            await producer.connect();
            
            // Get the error handler
            const errorHandler = mockConnection.on.mock.calls.find(
                (call: any[]) => call[0] === 'error'
            )[1];

            // Simulate connection error
            const error = new Error('Connection error');
            errorHandler(error);

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('AMQP connection error'),
                { extra: { error: 'Connection error' } }
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Scheduling reconnection attempt 1/3')
            );

            // Fast-forward timer
            vi.advanceTimersByTime(1000);
            await vi.runAllTimersAsync();

            expect(amqp.connect).toHaveBeenCalledTimes(2);
        });

        it('should handle connection close and schedule reconnect', async () => {
            await producer.connect();
            
            // Get the close handler
            const closeHandler = mockConnection.on.mock.calls.find(
                (call: any[]) => call[0] === 'close'
            )[1];

            // Simulate connection close
            closeHandler();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('AMQP connection closed unexpectedly')
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Scheduling reconnection attempt 1/3')
            );
        });

        it('should stop reconnecting after max attempts', async () => {
            await producer.connect();
            
            const errorHandler = mockConnection.on.mock.calls.find(
                (call: any[]) => call[0] === 'error'
            )[1];

            // Simulate multiple connection failures
            (amqp.connect as Mock).mockRejectedValue(new Error('Connection failed'));

            // Trigger errors to exceed max reconnect attempts
            for (let i = 0; i < 4; i++) {
                errorHandler(new Error('Connection error'));
                vi.advanceTimersByTime(1000);
                await vi.runAllTimersAsync();
            }

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Max reconnection attempts reached')
            );
        });

        it('should log reconnection failure', async () => {
            await producer.connect();
            
            const errorHandler = mockConnection.on.mock.calls.find(
                (call: any[]) => call[0] === 'error'
            )[1];

            // Make reconnection fail
            (amqp.connect as Mock).mockRejectedValue(new Error('Reconnection failed'));

            errorHandler(new Error('Connection error'));
            vi.advanceTimersByTime(1000);
            await vi.runAllTimersAsync();

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Reconnection attempt failed'),
                { extra: { error: 'Error: Reconnection failed' } }
            );
        });
    });

    describe('waitForConnection()', () => {
        it('should resolve when connection is established', async () => {
            // Start connecting in background
            const connectPromise = producer.connect();
            
            // Call waitForConnection through a method that uses it
            const secondConnectPromise = producer.connect();
            
            await Promise.all([connectPromise, secondConnectPromise]);
            
            expect(producer.isConnected()).toBe(true);
        });

        it('should reject when connection fails', async () => {
            (amqp.connect as Mock).mockRejectedValue(new Error('Connection failed'));
            
            // Start connecting
            const connectPromise = producer.connect().catch(() => {});
            
            // Try to connect again while first is failing
            const secondConnectPromise = producer.connect();
            
            await expect(secondConnectPromise).rejects.toThrow();
        });
    });
});

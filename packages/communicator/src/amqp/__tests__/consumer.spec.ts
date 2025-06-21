import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import * as amqp from 'amqplib';
import { createLogger } from '@skanii/logger';
import { SkaniiAmqpConsumer, AmqpConsumerConfig, ConsumeOptions, MessageHandler } from '../consumer';

// Mock dependencies
vi.mock('amqplib');
vi.mock('@skanii/logger');

const mockAmqp = vi.mocked(amqp);
const mockCreateLogger = vi.mocked(createLogger);

// Mock implementations
const mockConnection = {
    createChannel: vi.fn(),
    on: vi.fn(),
    close: vi.fn(),
};

const mockChannel = {
    prefetch: vi.fn(),
    assertExchange: vi.fn(),
    assertQueue: vi.fn(),
    bindQueue: vi.fn(),
    consume: vi.fn(),
    cancel: vi.fn(),
    ack: vi.fn(),
    nack: vi.fn(),
    reject: vi.fn(),
    close: vi.fn(),
};

const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
};

describe('SkaniiAmqpConsumer', () => {
    let consumer: SkaniiAmqpConsumer;
    let config: AmqpConsumerConfig;

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Setup mock returns
        mockAmqp.connect.mockResolvedValue(mockConnection as any);
        mockConnection.createChannel.mockResolvedValue(mockChannel as any);
        mockCreateLogger.mockReturnValue(mockLogger as any);
        
        // Setup default successful mocks
        mockChannel.prefetch.mockResolvedValue(undefined);
        mockChannel.assertExchange.mockResolvedValue(undefined);
        mockChannel.assertQueue.mockResolvedValue({ queue: 'test-queue' } as any);
        mockChannel.bindQueue.mockResolvedValue(undefined);
        mockChannel.consume.mockResolvedValue({ consumerTag: 'test-consumer-tag' } as any);
        mockChannel.cancel.mockResolvedValue(undefined);
        mockChannel.close.mockResolvedValue(undefined);
        mockConnection.close.mockResolvedValue(undefined);

        config = {
            url: 'amqp://localhost',
            exchange: 'test-exchange',
            exchangeType: 'topic',
            durable: true,
            reconnectAttempts: 3,
            reconnectDelay: 1000,
            prefetchCount: 5,
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Constructor', () => {
        it('should create instance with default config', () => {
            consumer = new SkaniiAmqpConsumer('test-consumer', { url: 'amqp://localhost' });
            
            expect(consumer).toBeInstanceOf(SkaniiAmqpConsumer);
            expect(mockCreateLogger).toHaveBeenCalledWith('test-consumer');
        });

        it('should create instance with custom config', () => {
            consumer = new SkaniiAmqpConsumer('test-consumer', config, mockLogger as any);
            
            expect(consumer).toBeInstanceOf(SkaniiAmqpConsumer);
            expect(mockCreateLogger).not.toHaveBeenCalled();
        });

        it('should merge config with defaults', () => {
            const minimalConfig = { url: 'amqp://localhost' };
            consumer = new SkaniiAmqpConsumer('test-consumer', minimalConfig);
            
            expect(consumer).toBeInstanceOf(SkaniiAmqpConsumer);
        });
    });

    describe('connect', () => {
        beforeEach(() => {
            consumer = new SkaniiAmqpConsumer('test-consumer', config, mockLogger as any);
        });

        it('should connect successfully', async () => {
            await consumer.connect();

            expect(mockAmqp.connect).toHaveBeenCalledWith(config.url);
            expect(mockConnection.createChannel).toHaveBeenCalled();
            expect(mockChannel.prefetch).toHaveBeenCalledWith(config.prefetchCount);
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
            mockAmqp.connect.mockRejectedValue(error);

            await expect(consumer.connect()).rejects.toThrow('Connection failed');
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to connect to AMQP broker'),
                { extra: { error: 'Error: Connection failed' } }
            );
        });

        it('should handle channel creation failure', async () => {
            const error = new Error('Channel creation failed');
            mockConnection.createChannel.mockRejectedValue(error);

            await expect(consumer.connect()).rejects.toThrow('Channel creation failed');
        });

        it('should not connect if already connected', async () => {
            // First connection
            await consumer.connect();
            vi.clearAllMocks();

            // Second connection attempt
            await consumer.connect();

            expect(mockAmqp.connect).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Already connected to AMQP broker')
            );
        });

                 it('should wait for connection if already connecting', async () => {
             let resolveConnect: (value: any) => void;
             const connectPromise = new Promise<any>(resolve => {
                 resolveConnect = resolve;
             });
             
             // Start first connection (will be pending)
             mockAmqp.connect.mockImplementation(() => connectPromise);
             
             const firstConnect = consumer.connect();
             
             // Start second connection while first is in progress
             const secondConnect = consumer.connect();
             
             expect(mockLogger.info).toHaveBeenCalledWith(
                 expect.stringContaining('Connection already in progress, waiting...')
             );
             
             // Resolve the connection
             resolveConnect!(mockConnection);
             
             await firstConnect;
             await secondConnect;
             
             // Should only connect once
             expect(mockAmqp.connect).toHaveBeenCalledTimes(1);
         });
    });

    describe('consume', () => {
        let messageHandler: MessageHandler;
        let consumeOptions: ConsumeOptions;

        beforeEach(async () => {
            consumer = new SkaniiAmqpConsumer('test-consumer', config, mockLogger as any);
            await consumer.connect();
            vi.clearAllMocks();

            messageHandler = vi.fn();
            consumeOptions = {
                queueName: 'test-queue',
                routingKeys: ['test.routing.key'],
                exchange: 'test-exchange',
            };
        });

        it('should start consuming successfully', async () => {
            const consumerTag = await consumer.consume(consumeOptions, messageHandler);

            expect(mockChannel.assertQueue).toHaveBeenCalledWith('test-queue', {
                durable: config.durable,
                exclusive: false,
                autoDelete: false,
                arguments: {},
            });
            expect(mockChannel.bindQueue).toHaveBeenCalledWith(
                'test-queue',
                'test-exchange',
                'test.routing.key'
            );
            expect(mockChannel.consume).toHaveBeenCalledWith(
                'test-queue',
                expect.any(Function),
                {
                    noAck: false,
                    consumerTag: undefined,
                    exclusive: false,
                }
            );
            expect(consumerTag).toBe('test-consumer-tag');
            expect(consumer.getActiveConsumers().get('test-queue')).toBe('test-consumer-tag');
        });

        it('should handle consume without routing keys', async () => {
            const options = { ...consumeOptions, routingKeys: [] };
            await consumer.consume(options, messageHandler);

            expect(mockChannel.bindQueue).toHaveBeenCalledWith(
                'test-queue',
                'test-exchange',
                ''
            );
        });

        it('should handle consume with custom options', async () => {
            const options: ConsumeOptions = {
                queueName: 'custom-queue',
                routingKeys: ['key1', 'key2'],
                exclusive: true,
                autoDelete: true,
                noAck: true,
                consumerTag: 'custom-tag',
                arguments: { 'x-message-ttl': 60000 },
            };

            await consumer.consume(options, messageHandler);

            expect(mockChannel.assertQueue).toHaveBeenCalledWith('custom-queue', {
                durable: config.durable,
                exclusive: true,
                autoDelete: true,
                arguments: { 'x-message-ttl': 60000 },
            });
            expect(mockChannel.bindQueue).toHaveBeenCalledTimes(2);
            expect(mockChannel.consume).toHaveBeenCalledWith(
                'custom-queue',
                expect.any(Function),
                {
                    noAck: true,
                    consumerTag: 'custom-tag',
                    exclusive: true,
                }
            );
        });

        it('should connect if not already connected', async () => {
            const newConsumer = new SkaniiAmqpConsumer('test-consumer-2', config, mockLogger as any);
            
            await newConsumer.consume(consumeOptions, messageHandler);

            expect(mockAmqp.connect).toHaveBeenCalled();
        });

        it('should handle queue assertion failure', async () => {
            const error = new Error('Queue assertion failed');
            mockChannel.assertQueue.mockRejectedValue(error);

            await expect(consumer.consume(consumeOptions, messageHandler)).rejects.toThrow(
                'Queue assertion failed'
            );
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to start consuming from queue test-queue'),
                { extra: { error: 'Error: Queue assertion failed' } }
            );
        });

        it('should process messages successfully', async () => {
            const mockMessage = {
                content: Buffer.from('test message'),
                properties: { messageId: 'msg-123' },
            };

            // Setup message handler to be called
            let messageProcessor: (message: any) => Promise<void>;
            mockChannel.consume.mockImplementation((queue, processor) => {
                messageProcessor = processor;
                return Promise.resolve({ consumerTag: 'test-consumer-tag' });
            });

            await consumer.consume(consumeOptions, messageHandler);

            // Simulate message processing
            await messageProcessor!(mockMessage);

            expect(messageHandler).toHaveBeenCalledWith(
                mockMessage,
                expect.any(Function),
                expect.any(Function)
            );
            expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
        });

        it('should handle message processing errors', async () => {
            const mockMessage = {
                content: Buffer.from('test message'),
                properties: { messageId: 'msg-123' },
            };
            const error = new Error('Processing failed');
            messageHandler = vi.fn().mockRejectedValue(error);

            let messageProcessor: (message: any) => Promise<void>;
            mockChannel.consume.mockImplementation((queue, processor) => {
                messageProcessor = processor;
                return Promise.resolve({ consumerTag: 'test-consumer-tag' });
            });

            await consumer.consume(consumeOptions, messageHandler);

            // Simulate message processing with error
            await messageProcessor!(mockMessage);

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error processing message'),
                {
                    extra: {
                        error: 'Error: Processing failed',
                        queue: 'test-queue',
                        messageId: 'msg-123',
                    },
                }
            );
            expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, true);
        });

                 it('should handle null messages', async () => {
             let messageProcessor: (message: any) => Promise<void>;
             mockChannel.consume.mockImplementation((queue, processor) => {
                 messageProcessor = processor;
                 return Promise.resolve({ consumerTag: 'test-consumer-tag' });
             });

             await consumer.consume(consumeOptions, messageHandler);

             // Simulate null message
             await messageProcessor!(null);

             expect(messageHandler).not.toHaveBeenCalled();
             expect(mockChannel.ack).not.toHaveBeenCalled();
         });

         it('should handle message processing with callback ack/nack', async () => {
             const mockMessage = {
                 content: Buffer.from('test message'),
                 properties: { messageId: 'msg-123' },
             };

             // Message handler that uses the callback ack/nack functions
             const messageHandlerWithCallbacks = vi.fn().mockImplementation(async (message, ack, nack) => {
                 // Use the callback functions provided by the consumer
                 if (message.content.toString() === 'test message') {
                     ack();
                 } else {
                     nack();
                 }
             });

             let messageProcessor: (message: any) => Promise<void>;
             mockChannel.consume.mockImplementation((queue, processor) => {
                 messageProcessor = processor;
                 return Promise.resolve({ consumerTag: 'test-consumer-tag' });
             });

             await consumer.consume(consumeOptions, messageHandlerWithCallbacks);

             // Simulate message processing
             await messageProcessor!(mockMessage);

             expect(messageHandlerWithCallbacks).toHaveBeenCalledWith(
                 mockMessage,
                 expect.any(Function),
                 expect.any(Function)
             );
             // Should be called twice - once by callback, once by automatic ack
             expect(mockChannel.ack).toHaveBeenCalledTimes(2);
         });

         it('should handle message processing with callback nack', async () => {
             const mockMessage = {
                 content: Buffer.from('bad message'),
                 properties: { messageId: 'msg-123' },
             };

             // Message handler that uses the nack callback
             const messageHandlerWithNack = vi.fn().mockImplementation(async (message, ack, nack) => {
                 // Use the nack callback function
                 if (message.content.toString() === 'bad message') {
                     nack();
                 } else {
                     ack();
                 }
             });

             let messageProcessor: (message: any) => Promise<void>;
             mockChannel.consume.mockImplementation((queue, processor) => {
                 messageProcessor = processor;
                 return Promise.resolve({ consumerTag: 'test-consumer-tag' });
             });

             await consumer.consume(consumeOptions, messageHandlerWithNack);

             // Simulate message processing
             await messageProcessor!(mockMessage);

             expect(messageHandlerWithNack).toHaveBeenCalledWith(
                 mockMessage,
                 expect.any(Function),
                 expect.any(Function)
             );
             // Should be called once by callback nack, once by automatic ack
             expect(mockChannel.nack).toHaveBeenCalledTimes(1);
             expect(mockChannel.ack).toHaveBeenCalledTimes(1);
         });

         it('should handle message processing with noAck option', async () => {
             const mockMessage = {
                 content: Buffer.from('test message'),
                 properties: { messageId: 'msg-123' },
             };

             let messageProcessor: (message: any) => Promise<void>;
             mockChannel.consume.mockImplementation((queue, processor) => {
                 messageProcessor = processor;
                 return Promise.resolve({ consumerTag: 'test-consumer-tag' });
             });

             const optionsWithNoAck = { ...consumeOptions, noAck: true };
             await consumer.consume(optionsWithNoAck, messageHandler);

             // Simulate message processing
             await messageProcessor!(mockMessage);

             expect(messageHandler).toHaveBeenCalledWith(
                 mockMessage,
                 expect.any(Function),
                 expect.any(Function)
             );
             // Should not be called because noAck is true
             expect(mockChannel.ack).not.toHaveBeenCalled();
         });

         it('should handle message processing errors with noAck option', async () => {
             const mockMessage = {
                 content: Buffer.from('test message'),
                 properties: { messageId: 'msg-123' },
             };
             const error = new Error('Processing failed');
             const failingMessageHandler = vi.fn().mockRejectedValue(error);

             let messageProcessor: (message: any) => Promise<void>;
             mockChannel.consume.mockImplementation((queue, processor) => {
                 messageProcessor = processor;
                 return Promise.resolve({ consumerTag: 'test-consumer-tag' });
             });

             const optionsWithNoAck = { ...consumeOptions, noAck: true };
             await consumer.consume(optionsWithNoAck, failingMessageHandler);

             // Simulate message processing with error
             await messageProcessor!(mockMessage);

             expect(mockLogger.error).toHaveBeenCalledWith(
                 expect.stringContaining('Error processing message'),
                 {
                     extra: {
                         error: 'Error: Processing failed',
                         queue: 'test-queue',
                         messageId: 'msg-123',
                     },
                 }
             );
             // Should not nack because noAck is true
             expect(mockChannel.nack).not.toHaveBeenCalled();
         });
    });

    describe('stopConsuming', () => {
        beforeEach(async () => {
            consumer = new SkaniiAmqpConsumer('test-consumer', config, mockLogger as any);
            await consumer.connect();
        });

        it('should stop consuming successfully', async () => {
            const messageHandler = vi.fn();
            const consumeOptions = { queueName: 'test-queue', routingKeys: ['test.key'] };
            
            await consumer.consume(consumeOptions, messageHandler);
            vi.clearAllMocks();

            await consumer.stopConsuming('test-queue');

            expect(mockChannel.cancel).toHaveBeenCalledWith('test-consumer-tag');
            expect(consumer.getActiveConsumers().has('test-queue')).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Stopped consuming from queue test-queue')
            );
        });

        it('should handle stopping non-existent consumer', async () => {
            await consumer.stopConsuming('non-existent-queue');

            expect(mockChannel.cancel).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('No active consumer found for queue non-existent-queue')
            );
        });

        it('should handle cancel failure', async () => {
            const messageHandler = vi.fn();
            const consumeOptions = { queueName: 'test-queue', routingKeys: ['test.key'] };
            
            await consumer.consume(consumeOptions, messageHandler);
            
            const error = new Error('Cancel failed');
            mockChannel.cancel.mockRejectedValue(error);

            await expect(consumer.stopConsuming('test-queue')).rejects.toThrow('Cancel failed');
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to stop consuming from queue test-queue'),
                { extra: { error: 'Error: Cancel failed' } }
            );
        });
    });

    describe('Message acknowledgment methods', () => {
        let mockMessage: any;

        beforeEach(async () => {
            consumer = new SkaniiAmqpConsumer('test-consumer', config, mockLogger as any);
            await consumer.connect();
            
            mockMessage = {
                content: Buffer.from('test'),
                properties: { messageId: 'msg-123' },
            };
        });

        it('should acknowledge message', () => {
            consumer.ack(mockMessage);
            expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage, false);
        });

        it('should acknowledge message with allUpTo flag', () => {
            consumer.ack(mockMessage, true);
            expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage, true);
        });

        it('should nack message', () => {
            consumer.nack(mockMessage);
            expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, true);
        });

        it('should nack message without requeue', () => {
            consumer.nack(mockMessage, false);
            expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);
        });

        it('should reject message', () => {
            consumer.reject(mockMessage);
            expect(mockChannel.reject).toHaveBeenCalledWith(mockMessage, false);
        });

        it('should reject message with requeue', () => {
            consumer.reject(mockMessage, true);
            expect(mockChannel.reject).toHaveBeenCalledWith(mockMessage, true);
        });

        it('should handle ack when no channel', () => {
            const newConsumer = new SkaniiAmqpConsumer('test', config, mockLogger as any);
            expect(() => newConsumer.ack(mockMessage)).not.toThrow();
        });

        it('should handle nack when no channel', () => {
            const newConsumer = new SkaniiAmqpConsumer('test', config, mockLogger as any);
            expect(() => newConsumer.nack(mockMessage)).not.toThrow();
        });

        it('should handle reject when no channel', () => {
            const newConsumer = new SkaniiAmqpConsumer('test', config, mockLogger as any);
            expect(() => newConsumer.reject(mockMessage)).not.toThrow();
        });
    });

    describe('close', () => {
        beforeEach(async () => {
            consumer = new SkaniiAmqpConsumer('test-consumer', config, mockLogger as any);
            await consumer.connect();
        });

        it('should close connection successfully', async () => {
            await consumer.close();

            expect(mockChannel.close).toHaveBeenCalled();
            expect(mockConnection.close).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('AMQP connection closed')
            );
        });

        it('should stop all active consumers before closing', async () => {
            const messageHandler = vi.fn();
            await consumer.consume({ queueName: 'queue1', routingKeys: ['key1'] }, messageHandler);
            await consumer.consume({ queueName: 'queue2', routingKeys: ['key2'] }, messageHandler);
            
            vi.clearAllMocks();

            await consumer.close();

            expect(mockChannel.cancel).toHaveBeenCalledTimes(2);
            expect(mockChannel.close).toHaveBeenCalled();
            expect(mockConnection.close).toHaveBeenCalled();
        });

        it('should handle close errors', async () => {
            const error = new Error('Close failed');
            mockChannel.close.mockRejectedValue(error);

            await expect(consumer.close()).rejects.toThrow('Close failed');
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error closing AMQP connection'),
                { extra: { error: 'Error: Close failed' } }
            );
        });

        it('should handle close when not connected', async () => {
            const newConsumer = new SkaniiAmqpConsumer('test', config, mockLogger as any);
            await expect(newConsumer.close()).resolves.not.toThrow();
        });
    });

    describe('isConnected', () => {
        it('should return false when not connected', () => {
            consumer = new SkaniiAmqpConsumer('test-consumer', config, mockLogger as any);
            expect(consumer.isConnected()).toBe(false);
        });

        it('should return true when connected', async () => {
            consumer = new SkaniiAmqpConsumer('test-consumer', config, mockLogger as any);
            await consumer.connect();
            expect(consumer.isConnected()).toBe(true);
        });

        it('should return false when connection lost', async () => {
            consumer = new SkaniiAmqpConsumer('test-consumer', config, mockLogger as any);
            await consumer.connect();
            
            // Simulate connection loss
            await consumer.close();
            expect(consumer.isConnected()).toBe(false);
        });
    });

    describe('getActiveConsumers', () => {
        beforeEach(async () => {
            consumer = new SkaniiAmqpConsumer('test-consumer', config, mockLogger as any);
            await consumer.connect();
        });

        it('should return empty map when no active consumers', () => {
            const activeConsumers = consumer.getActiveConsumers();
            expect(activeConsumers.size).toBe(0);
        });

        it('should return active consumers', async () => {
            const messageHandler = vi.fn();
            await consumer.consume({ queueName: 'queue1', routingKeys: ['key1'] }, messageHandler);
            await consumer.consume({ queueName: 'queue2', routingKeys: ['key2'] }, messageHandler);

            const activeConsumers = consumer.getActiveConsumers();
            expect(activeConsumers.size).toBe(2);
            expect(activeConsumers.get('queue1')).toBe('test-consumer-tag');
            expect(activeConsumers.get('queue2')).toBe('test-consumer-tag');
        });

        it('should return a copy of the map', async () => {
            const messageHandler = vi.fn();
            await consumer.consume({ queueName: 'queue1', routingKeys: ['key1'] }, messageHandler);

            const activeConsumers1 = consumer.getActiveConsumers();
            const activeConsumers2 = consumer.getActiveConsumers();

            expect(activeConsumers1).not.toBe(activeConsumers2);
            expect(activeConsumers1.size).toBe(activeConsumers2.size);
        });
    });

    describe('Connection error handling', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        it('should handle connection errors and schedule reconnect', async () => {
            consumer = new SkaniiAmqpConsumer('test-consumer', config, mockLogger as any);
            await consumer.connect();

                         // Get the error handler
             const errorHandler = mockConnection.on.mock.calls.find(call => call[0] === 'error')?.[1];
            
            // Clear mocks and simulate connection error
            vi.clearAllMocks();
            mockAmqp.connect.mockResolvedValue(mockConnection as any);
            mockConnection.createChannel.mockResolvedValue(mockChannel as any);
            
                         const error = new Error('Connection error');
             errorHandler!(error);

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('AMQP connection error'),
                { extra: { error: 'Connection error' } }
            );
            expect(consumer.isConnected()).toBe(false);
            expect(consumer.getActiveConsumers().size).toBe(0);

            // Advance time to trigger reconnect
            vi.advanceTimersByTime(1000);
            await vi.runAllTimersAsync();

            expect(mockAmqp.connect).toHaveBeenCalled();
        });

        it('should handle connection close and schedule reconnect', async () => {
            consumer = new SkaniiAmqpConsumer('test-consumer', config, mockLogger as any);
            await consumer.connect();

                         // Get the close handler
             const closeHandler = mockConnection.on.mock.calls.find(call => call[0] === 'close')?.[1];
            
            // Clear mocks and simulate connection close
            vi.clearAllMocks();
            mockAmqp.connect.mockResolvedValue(mockConnection as any);
            mockConnection.createChannel.mockResolvedValue(mockChannel as any);
            
                         closeHandler!();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('AMQP connection closed unexpectedly')
            );
            expect(consumer.isConnected()).toBe(false);

            // Advance time to trigger reconnect
            vi.advanceTimersByTime(1000);
            await vi.runAllTimersAsync();

            expect(mockAmqp.connect).toHaveBeenCalled();
        });

                 it('should stop reconnecting after max attempts', async () => {
             consumer = new SkaniiAmqpConsumer('test-consumer', config, mockLogger as any);
             await consumer.connect();

             const errorHandler = mockConnection.on.mock.calls.find(call => call[0] === 'error')?.[1];
            
            // Make all reconnection attempts fail
            mockAmqp.connect.mockRejectedValue(new Error('Connection failed'));
            
                         // Trigger multiple connection errors
             for (let i = 0; i < config.reconnectAttempts! + 1; i++) {
                 errorHandler!(new Error('Connection error'));
                 vi.advanceTimersByTime(1000);
                 await vi.runAllTimersAsync();
             }

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Max reconnection attempts reached')
            );
        });

                 it('should handle reconnection failures', async () => {
             consumer = new SkaniiAmqpConsumer('test-consumer', config, mockLogger as any);
             await consumer.connect();

             const errorHandler = mockConnection.on.mock.calls.find(call => call[0] === 'error')?.[1];
            
            // Make reconnection fail
            mockAmqp.connect.mockRejectedValue(new Error('Reconnection failed'));
            
                         errorHandler!(new Error('Connection error'));

            // Advance time to trigger reconnect
            vi.advanceTimersByTime(1000);
            await vi.runAllTimersAsync();

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Reconnection attempt failed'),
                { extra: { error: 'Error: Reconnection failed' } }
            );
        });
    });

    describe('Edge cases', () => {
                 it('should handle waitForConnection timeout', async () => {
             consumer = new SkaniiAmqpConsumer('test-consumer', config, mockLogger as any);
             
             let rejectConnect: (error: Error) => void;
             const connectPromise = new Promise<any>((resolve, reject) => {
                 rejectConnect = reject;
             });
             
             // Make connect hang then fail
             mockAmqp.connect.mockImplementation(() => connectPromise);
             
             const firstConnectPromise = consumer.connect();
             
             // Try to connect again while first is pending
             const secondConnectPromise = consumer.connect();
             
             // Simulate connect failure
             rejectConnect!(new Error('Connect failed'));
             
             await expect(firstConnectPromise).rejects.toThrow('Connect failed');
             await expect(secondConnectPromise).rejects.toThrow('Connection failed');
         });

        it('should handle various exchange types', async () => {
            const configs = [
                { ...config, exchangeType: 'direct' as const },
                { ...config, exchangeType: 'fanout' as const },
                { ...config, exchangeType: 'headers' as const },
            ];

            for (const cfg of configs) {
                const testConsumer = new SkaniiAmqpConsumer('test', cfg, mockLogger as any);
                await testConsumer.connect();
                
                expect(mockChannel.assertExchange).toHaveBeenCalledWith(
                    cfg.exchange,
                    cfg.exchangeType,
                    { durable: cfg.durable }
                );
                
                await testConsumer.close();
                vi.clearAllMocks();
                
                // Reset mocks for next iteration
                mockAmqp.connect.mockResolvedValue(mockConnection as any);
                mockConnection.createChannel.mockResolvedValue(mockChannel as any);
                mockChannel.prefetch.mockResolvedValue(undefined);
                mockChannel.assertExchange.mockResolvedValue(undefined);
                mockChannel.close.mockResolvedValue(undefined);
                mockConnection.close.mockResolvedValue(undefined);
            }
        });
    });
});

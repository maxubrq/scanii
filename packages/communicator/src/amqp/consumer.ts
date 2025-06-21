import * as amqp from 'amqplib';
import { createLogger, SkaniiLogger } from '@skanii/logger';

export interface AmqpConsumerConfig {
    url: string;
    exchange?: string;
    exchangeType?: 'direct' | 'topic' | 'fanout' | 'headers';
    durable?: boolean;
    reconnectAttempts?: number;
    reconnectDelay?: number;
    prefetchCount?: number;
}

export interface ConsumeOptions {
    queueName: string;
    routingKeys?: string[];
    exchange?: string;
    exclusive?: boolean;
    autoDelete?: boolean;
    noAck?: boolean;
    consumerTag?: string;
    arguments?: Record<string, any>;
}

export interface MessageHandler {
    (message: amqp.ConsumeMessage | null, ack: () => void, nack: () => void): Promise<void> | void;
}

/**
 * @description AMQP consumer class
 * @param name - The name of the consumer
 * @param config - The configuration for the consumer
 * @param logger - The logger for the consumer
 * @returns The consumer instance
 */
export class SkaniiAmqpConsumer {
    private connection: amqp.ChannelModel | null = null;
    private channel: amqp.Channel | null = null;
    private config: Required<AmqpConsumerConfig>;
    private isConnecting = false;
    private reconnectCount = 0;
    private name: string;
    private activeConsumers: Map<string, string> = new Map(); // queueName -> consumerTag

    constructor(
        name: string,
        config: AmqpConsumerConfig,
        private readonly logger: SkaniiLogger = createLogger(name),
    ) {
        this.name = name;
        this.config = {
            exchange: 'skanii',
            exchangeType: 'topic',
            durable: true,
            reconnectAttempts: 5,
            reconnectDelay: 5000,
            prefetchCount: 10,
            ...config,
        };

        // Bindings methods
        this.ack = this.ack.bind(this);
        this.nack = this.nack.bind(this);
        this.reject = this.reject.bind(this);
        this.close = this.close.bind(this);
        this.connect = this.connect.bind(this);
        this.consume = this.consume.bind(this);
        this.stopConsuming = this.stopConsuming.bind(this);
        this.isConnected = this.isConnected.bind(this);
        this.getActiveConsumers = this.getActiveConsumers.bind(this);
        this.waitForConnection = this.waitForConnection.bind(this);
        this.handleConnectionError = this.handleConnectionError.bind(this);
        this.handleConnectionClose = this.handleConnectionClose.bind(this);
    }

    /**
     * @description Connect to the AMQP broker
     * @returns A promise that resolves when the connection is established
     */
    async connect(): Promise<void> {
        if (this.isConnecting) {
            this.logger.info(
                `[${this.name}_SkaniiAmqpConsumer]: Connection already in progress, waiting...`,
            );
            return this.waitForConnection();
        }

        if (this.isConnected()) {
            this.logger.info(`[${this.name}_SkaniiAmqpConsumer]: Already connected to AMQP broker`);
            return;
        }

        this.isConnecting = true;

        try {
            this.logger.info(
                `[${this.name}_SkaniiAmqpConsumer]: Connecting to AMQP broker at ${this.config.url}`,
            );

            this.connection = await amqp.connect(this.config.url);
            this.channel = await this.connection.createChannel();

            // Set prefetch count for fair dispatch
            await this.channel.prefetch(this.config.prefetchCount);

            // Declare exchange
            await this.channel.assertExchange(this.config.exchange, this.config.exchangeType, {
                durable: this.config.durable,
            });

            // Setup connection event handlers
            this.connection.on('error', this.handleConnectionError.bind(this));
            this.connection.on('close', this.handleConnectionClose.bind(this));

            this.reconnectCount = 0;
            this.isConnecting = false;

            this.logger.info(
                `[${this.name}_SkaniiAmqpConsumer]: Successfully connected to AMQP broker`,
            );
        } catch (error) {
            this.isConnecting = false;
            this.logger.error(
                `[${this.name}_SkaniiAmqpConsumer]: Failed to connect to AMQP broker`,
                {
                    extra: { error: String(error) },
                },
            );
            throw error;
        }
    }

    /**
     * @description Start consuming messages from a queue
     * @param options - The consume options
     * @param messageHandler - The message handler function
     * @returns A promise that resolves with the consumer tag
     */
    async consume(options: ConsumeOptions, messageHandler: MessageHandler): Promise<string> {
        if (!this.channel) {
            await this.connect();
        }

        const {
            queueName,
            routingKeys = [],
            exchange = this.config.exchange,
            exclusive = false,
            autoDelete = false,
            noAck = false,
            consumerTag,
            arguments: queueArgs = {},
        } = options;

        try {
            // Declare queue
            const queueInfo = await this.channel!.assertQueue(queueName, {
                durable: this.config.durable,
                exclusive,
                autoDelete,
                arguments: queueArgs,
            });

            // Bind queue to exchange with routing keys
            if (routingKeys.length > 0) {
                for (const routingKey of routingKeys) {
                    await this.channel!.bindQueue(queueName, exchange, routingKey);
                    this.logger.debug(
                        `[${this.name}_SkaniiAmqpConsumer]: Bound queue ${queueName} to exchange ${exchange} with routing key ${routingKey}`,
                    );
                }
            } else {
                // Bind with empty routing key for direct/fanout exchanges
                await this.channel!.bindQueue(queueName, exchange, '');
            }

            // Start consuming
            const consumeResult = await this.channel!.consume(
                queueName,
                async (message) => {
                    if (message) {
                        try {
                            const ack = () => {
                                this.channel!.ack(message);
                            };

                            const nack = () => {
                                this.channel!.nack(message, false, true);
                            };

                            await messageHandler(message, ack, nack);

                            // Acknowledge message if not using noAck
                            if (!noAck) {
                                this.channel!.ack(message);
                            }
                        } catch (error) {
                            this.logger.error(
                                `[${this.name}_SkaniiAmqpConsumer]: Error processing message`,
                                {
                                    extra: {
                                        error: String(error),
                                        queue: queueName,
                                        messageId: message.properties.messageId,
                                    },
                                },
                            );

                            // Reject message and requeue
                            if (!noAck) {
                                this.channel!.nack(message, false, true);
                            }
                        }
                    }
                },
                {
                    noAck,
                    consumerTag,
                    exclusive,
                },
            );

            const finalConsumerTag = consumeResult.consumerTag;
            this.activeConsumers.set(queueName, finalConsumerTag);

            this.logger.info(
                `[${this.name}_SkaniiAmqpConsumer]: Started consuming from queue ${queueName} with consumer tag ${finalConsumerTag}`,
            );

            return finalConsumerTag;
        } catch (error) {
            this.logger.error(
                `[${this.name}_SkaniiAmqpConsumer]: Failed to start consuming from queue ${queueName}`,
                {
                    extra: { error: String(error) },
                },
            );
            throw error;
        }
    }

    /**
     * @description Stop consuming from a specific queue
     * @param queueName - The name of the queue to stop consuming from
     * @returns A promise that resolves when consumption is stopped
     */
    async stopConsuming(queueName: string): Promise<void> {
        const consumerTag = this.activeConsumers.get(queueName);

        if (!consumerTag || !this.channel) {
            this.logger.warn(
                `[${this.name}_SkaniiAmqpConsumer]: No active consumer found for queue ${queueName}`,
            );
            return;
        }

        try {
            await this.channel.cancel(consumerTag);
            this.activeConsumers.delete(queueName);

            this.logger.info(
                `[${this.name}_SkaniiAmqpConsumer]: Stopped consuming from queue ${queueName}`,
            );
        } catch (error) {
            this.logger.error(
                `[${this.name}_SkaniiAmqpConsumer]: Failed to stop consuming from queue ${queueName}`,
                {
                    extra: { error: String(error) },
                },
            );
            throw error;
        }
    }

    /**
     * @description Acknowledge a message
     * @param message - The message to acknowledge
     * @param allUpTo - Acknowledge all messages up to this one
     */
    public ack(message: amqp.ConsumeMessage, allUpTo = false): void {
        if (this.channel) {
            this.channel.ack(message, allUpTo);
        }
    }

    /**
     * @description Reject a message
     * @param message - The message to reject
     * @param requeue - Whether to requeue the message
     */
    public nack(message: amqp.ConsumeMessage, requeue = true): void {
        if (this.channel) {
            this.channel.nack(message, false, requeue);
        }
    }

    /**
     * @description Reject a message (alias for nack with requeue=false)
     * @param message - The message to reject
     * @param requeue - Whether to requeue the message
     */
    public reject(message: amqp.ConsumeMessage, requeue = false): void {
        if (this.channel) {
            this.channel.reject(message, requeue);
        }
    }

    /**
     * @description Close the connection to the AMQP broker
     * @returns A promise that resolves when the connection is closed
     */
    public async close(): Promise<void> {
        try {
            // Stop all active consumers
            for (const [queueName] of this.activeConsumers) {
                await this.stopConsuming(queueName);
            }

            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }

            if (this.connection) {
                await this.connection.close();
                this.connection = null;
            }

            this.logger.info(`[${this.name}_SkaniiAmqpConsumer]: AMQP connection closed`);
        } catch (error) {
            this.logger.error(`[${this.name}_SkaniiAmqpConsumer]: Error closing AMQP connection`, {
                extra: { error: String(error) },
            });
            throw error;
        }
    }

    /**
     * @description Check if the consumer is connected to the AMQP broker
     * @returns A boolean indicating if the consumer is connected
     */
    public isConnected(): boolean {
        return !!(this.connection && this.channel);
    }

    /**
     * @description Get the list of active consumers
     * @returns A map of queue names to consumer tags
     */
    public getActiveConsumers(): Map<string, string> {
        return new Map(this.activeConsumers);
    }

    /**
     * @description Wait for the connection to be established
     * @returns A promise that resolves when the connection is established
     */
    private async waitForConnection(): Promise<void> {
        return new Promise((resolve, reject) => {
            const checkConnection = () => {
                if (!this.isConnecting) {
                    if (this.isConnected()) {
                        resolve();
                    } else {
                        reject(new Error('Connection failed'));
                    }
                } else {
                    setTimeout(checkConnection, 100);
                }
            };
            checkConnection();
        });
    }

    private handleConnectionError(error: Error): void {
        this.logger.error(`[${this.name}_SkaniiAmqpConsumer]: AMQP connection error`, {
            extra: { error: error.message },
        });
        this.connection = null;
        this.channel = null;
        this.activeConsumers.clear();
        this.scheduleReconnect();
    }

    private handleConnectionClose(): void {
        this.logger.warn(`[${this.name}_SkaniiAmqpConsumer]: AMQP connection closed unexpectedly`);
        this.connection = null;
        this.channel = null;
        this.activeConsumers.clear();
        this.scheduleReconnect();
    }

    private scheduleReconnect(): void {
        if (this.reconnectCount >= this.config.reconnectAttempts) {
            this.logger.error(
                `[${this.name}_SkaniiAmqpConsumer]: Max reconnection attempts reached`,
            );
            return;
        }

        this.reconnectCount++;
        this.logger.info(
            `[${this.name}_SkaniiAmqpConsumer]: Scheduling reconnection attempt ${this.reconnectCount}/${this.config.reconnectAttempts} in ${this.config.reconnectDelay}ms`,
        );

        setTimeout(() => {
            this.connect().catch((error) => {
                this.logger.error(
                    `[${this.name}_SkaniiAmqpConsumer]: Reconnection attempt failed`,
                    {
                        extra: { error: String(error) },
                    },
                );
            });
        }, this.config.reconnectDelay);
    }
}

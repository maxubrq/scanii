import * as amqp from 'amqplib';
import { createLogger, SkaniiLogger } from '@skanii/logger';

export interface AmqpProducerConfig {
    url: string;
    exchange?: string;
    exchangeType?: 'direct' | 'topic' | 'fanout' | 'headers';
    durable?: boolean;
    reconnectAttempts?: number;
    reconnectDelay?: number;
}

export interface PublishOptions {
    routingKey?: string;
    exchange?: string;
    persistent?: boolean;
    messageId?: string;
    correlationId?: string;
    replyTo?: string;
    expiration?: string;
    headers?: Record<string, any>;
}

/**
 * @description AMQP producer class
 * @param name - The name of the producer
 * @param config - The configuration for the producer
 * @param logger - The logger for the producer
 * @returns The producer instance
 */
export class SkaniiAmqpProducer {
    private connection: amqp.ChannelModel | null = null;
    private channel: amqp.Channel | null = null;
    private config: Required<AmqpProducerConfig>;
    private isConnecting = false;
    private reconnectCount = 0;
    private name: string;
    constructor(
        name: string,
        config: AmqpProducerConfig,
        private readonly logger: SkaniiLogger = createLogger(name),
    ) {
        this.name = name;
        this.config = {
            exchange: 'skanii',
            exchangeType: 'topic',
            durable: true,
            reconnectAttempts: 5,
            reconnectDelay: 5000,
            ...config,
        };

        // Bindings methods
        this.connect = this.connect.bind(this);
        this.publish = this.publish.bind(this);
        this.publishToQueue = this.publishToQueue.bind(this);
        this.close = this.close.bind(this);
        this.isConnected = this.isConnected.bind(this);
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
                `[${this.name}_SkaniiAmqpProducer]: Connection already in progress, waiting...`,
            );
            return this.waitForConnection();
        }

        if (this.isConnected()) {
            this.logger.info(`[${this.name}_SkaniiAmqpProducer]: Already connected to AMQP broker`);
            return;
        }

        this.isConnecting = true;

        try {
            this.logger.info(
                `[${this.name}_SkaniiAmqpProducer]: Connecting to AMQP broker at ${this.config.url}`,
            );

            this.connection = await amqp.connect(this.config.url);
            this.channel = await this.connection.createChannel();

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
                `[${this.name}_SkaniiAmqpProducer]: Successfully connected to AMQP broker`,
            );
        } catch (error) {
            this.isConnecting = false;
            this.logger.error(
                `[${this.name}_SkaniiAmqpProducer]: Failed to connect to AMQP broker`,
                {
                    extra: { error: String(error) },
                },
            );
            throw error;
        }
    }

    /**
     * @description Publish a message to the AMQP broker
     * @param message - The message to publish
     * @param options - The options for the publish
     * @returns A promise that resolves when the message is published
     */
    async publish(message: any, options: PublishOptions = {}): Promise<boolean> {
        if (!this.channel) {
            await this.connect();
        }

        const {
            routingKey = '',
            exchange = this.config.exchange,
            persistent = true,
            ...publishOptions
        } = options;

        const messageBuffer = Buffer.from(JSON.stringify(message));
        const messageOptions: amqp.Options.Publish = {
            persistent,
            timestamp: Date.now(),
            ...publishOptions,
        };

        try {
            const result = this.channel!.publish(
                exchange,
                routingKey,
                messageBuffer,
                messageOptions,
            );

            if (!result) {
                this.logger.warn(
                    `[${this.name}_SkaniiAmqpProducer]: Message not published immediately (channel buffer full)`,
                );
                // Wait for drain event
                await new Promise<void>((resolve) => {
                    this.channel!.once('drain', resolve);
                });
            }

            this.logger.debug(
                `[${this.name}_SkaniiAmqpProducer]: Message published to exchange: ${exchange}, routing key: ${routingKey}`,
            );
            return true;
        } catch (error) {
            this.logger.error(`[${this.name}_SkaniiAmqpProducer]: Failed to publish message`, {
                extra: { error: String(error) },
            });
            throw error;
        }
    }

    /**
     * @description Publish a message to a queue
     * @param queueName - The name of the queue
     * @param message - The message to publish
     * @param options - The options for the publish
     * @returns A promise that resolves when the message is published
     */
    async publishToQueue(
        queueName: string,
        message: any,
        options: Omit<PublishOptions, 'routingKey' | 'exchange'> = {},
    ): Promise<boolean> {
        if (!this.channel) {
            await this.connect();
        }

        // Declare queue if it doesn't exist
        await this.channel!.assertQueue(queueName, { durable: this.config.durable });

        const messageBuffer = Buffer.from(JSON.stringify(message));
        const messageOptions: amqp.Options.Publish = {
            persistent: true,
            timestamp: Date.now(),
            ...options,
        };

        try {
            const result = this.channel!.sendToQueue(queueName, messageBuffer, messageOptions);

            if (!result) {
                this.logger.warn(
                    `[${this.name}_SkaniiAmqpProducer]: Message not sent immediately (channel buffer full)`,
                );
                await new Promise<void>((resolve) => {
                    this.channel!.once('drain', resolve);
                });
            }

            this.logger.debug(
                `[${this.name}_SkaniiAmqpProducer]: Message sent to queue: ${queueName}`,
            );
            return true;
        } catch (error) {
            this.logger.error(
                `[${this.name}_SkaniiAmqpProducer]: Failed to send message to queue`,
                {
                    extra: { error: String(error) },
                },
            );
            throw error;
        }
    }

    /**
     * @description Close the connection to the AMQP broker
     * @returns A promise that resolves when the connection is closed
     */
    async close(): Promise<void> {
        try {
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }

            if (this.connection) {
                await this.connection.close();
                this.connection = null;
            }

            this.logger.info(`[${this.name}_SkaniiAmqpProducer]: AMQP connection closed`);
        } catch (error) {
            this.logger.error(`[${this.name}_SkaniiAmqpProducer]: Error closing AMQP connection`, {
                extra: { error: String(error) },
            });
            throw error;
        }
    }

    /**
     * @description Check if the producer is connected to the AMQP broker
     * @returns A boolean indicating if the producer is connected
     */
    public isConnected(): boolean {
        return !!(this.connection && this.channel);
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

    /**
     * @description Handle a connection error
     * @param error - The error that occurred
     */
    private handleConnectionError(error: Error): void {
        this.logger.error(`[${this.name}_SkaniiAmqpProducer]: AMQP connection error`, {
            extra: { error: error.message },
        });
        this.connection = null;
        this.channel = null;
        this.scheduleReconnect();
    }

    /**
     * @description Handle a connection close
     */
    private handleConnectionClose(): void {
        this.logger.warn(`[${this.name}_SkaniiAmqpProducer]: AMQP connection closed unexpectedly`);
        this.connection = null;
        this.channel = null;
        this.scheduleReconnect();
    }

    /**
     * @description Schedule a reconnection attempt
     */
    private scheduleReconnect(): void {
        if (this.reconnectCount >= this.config.reconnectAttempts) {
            this.logger.error(
                `[${this.name}_SkaniiAmqpProducer]: Max reconnection attempts reached`,
            );
            return;
        }

        this.reconnectCount++;
        this.logger.info(
            `[${this.name}_SkaniiAmqpProducer]: Scheduling reconnection attempt ${this.reconnectCount}/${this.config.reconnectAttempts} in ${this.config.reconnectDelay}ms`,
        );

        setTimeout(() => {
            this.connect().catch((error) => {
                this.logger.error(
                    `[${this.name}_SkaniiAmqpProducer]: Reconnection attempt failed`,
                    {
                        extra: { error: String(error) },
                    },
                );
            });
        }, this.config.reconnectDelay);
    }
}

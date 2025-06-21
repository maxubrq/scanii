import type {
    Meter,
    Counter,
    Histogram,
    UpDownCounter,
    ObservableResult,
    ObservableCounter,
    ObservableGauge,
    ObservableUpDownCounter,
} from '@opentelemetry/api';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';

/**
 * The options for a metric.
 */
export interface MetricOptions {
    description?: string;
    unit?: string;
}

/**
 * The metrics meter.
 */
export class SkaniiMetricsMeter {
    private _provider: MeterProvider;
    private _meter: Meter;
    private _metrics: Map<string, any> = new Map();

    constructor(
        /**
         * The name of the meter.
         */
        private readonly name: string,
        /**
         * The version of the meter.
         */
        private readonly version: string,
        /**
         * The exporters of the meter.
         */
        private readonly exporters: MetricReader[] = [],
    ) {
        this._provider = new MeterProvider({
            readers: this.exporters,
        });

        this._meter = this._provider.getMeter(this.name, this.version);
    }

    /**
     * Gets the meter.
     */
    public get meter(): Meter {
        return this._meter;
    }

    /**
     * Creates a counter metric.
     */
    public createCounter(name: string, options?: MetricOptions): Counter {
        const counter = this._meter.createCounter(name, options);
        this._metrics.set(name, counter);
        return counter;
    }

    /**
     * Creates an up-down counter metric
     */
    public createUpDownCounter(name: string, options?: MetricOptions): UpDownCounter {
        const counter = this._meter.createUpDownCounter(name, options);
        this._metrics.set(name, counter);
        return counter;
    }

    /**
     * Creates a histogram metric
     */
    public createHistogram(name: string, options?: MetricOptions): Histogram {
        const histogram = this._meter.createHistogram(name, options);
        this._metrics.set(name, histogram);
        return histogram;
    }

    /**
     * Creates an observable counter metric
     */
    public createObservableCounter(
        name: string,
        options?: MetricOptions,
        callback?: (result: ObservableResult) => void,
    ): ObservableCounter {
        const counter = this._meter.createObservableCounter(name, options);
        if (callback) {
            counter.addCallback(callback);
        }
        this._metrics.set(name, counter);
        return counter;
    }

    /**
     * Creates an observable gauge metric
     */
    public createObservableGauge(
        name: string,
        options?: MetricOptions,
        callback?: (result: ObservableResult) => void,
    ): ObservableGauge {
        const gauge = this._meter.createObservableGauge(name, options);
        if (callback) {
            gauge.addCallback(callback);
        }
        this._metrics.set(name, gauge);
        return gauge;
    }

    /**
     * Creates an observable up-down counter metric
     */
    public createObservableUpDownCounter(
        name: string,
        options?: MetricOptions,
        callback?: (result: ObservableResult) => void,
    ): ObservableUpDownCounter {
        const counter = this._meter.createObservableUpDownCounter(name, options);
        if (callback) {
            counter.addCallback(callback);
        }
        this._metrics.set(name, counter);
        return counter;
    }

    /**
     * Gets a previously created metric by name
     */
    public getMetric<T>(name: string): T | undefined {
        return this._metrics.get(name) as T;
    }

    /**
     * Shuts down the meter provider and all its readers
     */
    public async shutdown(): Promise<void> {
        await this._provider.shutdown();
    }
}

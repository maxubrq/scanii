import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { SkaniiMetricsMeter } from "./metrics-metter";
import { SkaniiPrometheusExporter } from "./prometheus-exporter";
import { Counter, Histogram } from "@opentelemetry/api";
const { endpoint, port } = PrometheusExporter.DEFAULT_OPTIONS;

export const METRICS_KEYS = {
  HTTP_REQUEST_TOTAL: {
    key: "http_requests_total",
    description: "Total number of HTTP requests",
    labels: ["status", "method", "path"],
  },
  HTTP_REQUEST_DURATION: {
    key: "http_request_duration_seconds",
    description: "Duration of HTTP requests",
    labels: ["status", "method", "path"],
  },
  HTTP_REQUEST_ERRORS_TOTAL: {
    key: "http_request_errors_total",
    description: "Total number of HTTP request errors",
    labels: ["status", "method", "path"],
  },
  MESSAGES_CONSUMED_TOTAL: {
    key: "messages_consumed_total",
    description: "Total number of messages consumed",
    labels: ["status", "method", "path"],
  },
  MESSAGE_PROCESSING_DURATION_SECONDS: {
    key: "message_processing_duration_seconds",
    description: "Duration of message processing",
    labels: ["status", "method", "path"],
  },
  MESSAGE_PROCESSING_ERRORS_TOTAL: {
    key: "message_processing_errors_total",
    description: "Total number of message processing errors",
    labels: ["status", "method", "path"],
  },
};

export class SkaniiMetrics {
  private _exporter: SkaniiPrometheusExporter = new SkaniiPrometheusExporter(
    {},
    (err) => {
      if (err) {
        console.error(err);
      } else {
        console.log(`Prometheus exporter started on ${endpoint}:${port}`);
      }
    },
  );

  private _meter: SkaniiMetricsMeter;

  constructor(
    private readonly name: string,
    private readonly version: string,
  ) {
    this._meter = new SkaniiMetricsMeter(this.name, this.version, [
      this._exporter,
    ]);
  }

  private _httpRequestTotal: Counter | undefined;
  private _httpRequestDuration: Histogram | undefined;
  private _httpRequestErrorsTotal: Counter | undefined;
  private _messagesConsumedTotal: Counter | undefined;
  private _messageProcessingDurationSeconds: Histogram | undefined;
  private _messageProcessingErrorsTotal: Counter | undefined;

  public countHttpRequest(status: number, method: string, path: string) {
    if (!this._httpRequestTotal) {
      this._httpRequestTotal = this._meter.createCounter(
        METRICS_KEYS.HTTP_REQUEST_TOTAL.key,
        {
          description: METRICS_KEYS.HTTP_REQUEST_TOTAL.description,
        },
      );
    }
    this._httpRequestTotal.add(1, { status, method, path });
  }

  public recordHttpRequestDuration(
    status: number,
    method: string,
    path: string,
    duration: number,
  ) {
    if (!this._httpRequestDuration) {
      this._httpRequestDuration = this._meter.createHistogram(
        METRICS_KEYS.HTTP_REQUEST_DURATION.key,
        {
          description: METRICS_KEYS.HTTP_REQUEST_DURATION.description,
        },
      );
    }
    this._httpRequestDuration.record(duration, { status, method, path });
  }

  public countHttpRequestError(status: number, method: string, path: string) {
    if (!this._httpRequestErrorsTotal) {
      this._httpRequestErrorsTotal = this._meter.createCounter(
        METRICS_KEYS.HTTP_REQUEST_ERRORS_TOTAL.key,
        {
          description: METRICS_KEYS.HTTP_REQUEST_ERRORS_TOTAL.description,
        },
      );
    }

    this._httpRequestErrorsTotal.add(1, { status, method, path });
  }

  public countMessagesConsumed(status: number, method: string, path: string) {
    if (!this._messagesConsumedTotal) {
      this._messagesConsumedTotal = this._meter.createCounter(
        METRICS_KEYS.MESSAGES_CONSUMED_TOTAL.key,
      );
    }

    this._messagesConsumedTotal.add(1, { status, method, path });
  }

  public recordMessageProcessingDuration(
    status: number,
    method: string,
    path: string,
    duration: number,
  ) {
    if (!this._messageProcessingDurationSeconds) {
      this._messageProcessingDurationSeconds = this._meter.createHistogram(
        METRICS_KEYS.MESSAGE_PROCESSING_DURATION_SECONDS.key,
      );
    }

    this._messageProcessingDurationSeconds.record(duration, {
      status,
      method,
      path,
    });
  }

  public countMessageProcessingError(
    status: number,
    method: string,
    path: string,
  ) {
    if (!this._messageProcessingErrorsTotal) {
      this._messageProcessingErrorsTotal = this._meter.createCounter(
        METRICS_KEYS.MESSAGE_PROCESSING_ERRORS_TOTAL.key,
      );
    }

    this._messageProcessingErrorsTotal.add(1, { status, method, path });
  }
}

export default SkaniiMetrics;

import { Context, Hono, MiddlewareHandler } from 'hono';
import { serve, ServerType } from '@hono/node-server';
import { createLogger, SkaniiLogger } from '@skanii/logger';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { SkaniiRequestIdMiddleware } from './http-middleware';
import { compress } from 'hono/compress';
import { csrf } from 'hono/csrf';

/**
 * The HTTP method of the route.
 */
export type SkaniiHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * The HTTP route of the application.
 */
export type SkaniiHttpRoute = {
    /**
     * The HTTP method of the route.
     */
    method: SkaniiHttpMethod;
    /**
     * The path of the route.
     */
    path: string;
    /**
     * The handler of the route.
     */
    handler: (c: Context) => Promise<Response>;
};

/**
 * The options of the HTTP application.
 */
export type SkaniiHttpAppOptions = {
    /**
     * The port of the application.
     */
    port: number;
    /**
     * The routes of the application. If not provided, the application will not have any routes.
     * But you can add routes later using the `addRoute` method.
     */
    routes: SkaniiHttpRoute[];
    /**
     * The middlewares of the application.
     */
    middlewares: MiddlewareHandler[];
};

export const DEFAULT_OPTIONS: SkaniiHttpAppOptions = {
    port: Number(process.env.PORT) || 3000,
    routes: [],
    middlewares: [SkaniiRequestIdMiddleware(), cors(), secureHeaders(), csrf(), compress()],
};

/**
 * The HTTP application.
 */
export class SkaniiHttpApp {
    private readonly _app: Hono;
    private readonly _routes: SkaniiHttpRoute[] = [];
    private readonly _name: string;
    private _server: ServerType | null = null;

    constructor(
        /**
         * The name of the application.
         */
        name: string,
        /**
         * The options of the application.
         */
        private readonly options: SkaniiHttpAppOptions = DEFAULT_OPTIONS,
        /**
         * The logger of the application.
         */
        private readonly logger: SkaniiLogger = createLogger(name),
    ) {
        this._name = name;
        this._app = new Hono();
        this._routes = this.options.routes;

        // Add middlewares
        if (this.options.middlewares.length) {
            this.options.middlewares.forEach((middleware) => {
                this._app.use(middleware);
            });
        }

        // Add routes
        if (this._routes.length) {
            this._routes.forEach((route) => {
                this.addRoute(route.method, route.path, route.handler);
            });
        }
    }

    /**
     * Use a middleware.
     * @param middleware - The middleware to use.
     */
    public use(...middleware: MiddlewareHandler[]): void {
        this._app.use(...middleware);
    }

    /**
     * Add a route to the application.
     * @param method - The HTTP method of the route.
     * @param path - The path of the route.
     * @param handler - The handler of the route.
     */
    public async addRoute(
        method: SkaniiHttpMethod,
        path: string,
        handler: (c: Context) => Promise<Response>,
    ): Promise<void> {
        switch (method) {
            case 'GET':
                this._app.get(path, handler);
                break;
            case 'POST':
                this._app.post(path, handler);
                break;
            case 'PUT':
                this._app.put(path, handler);
                break;
            case 'DELETE':
                this._app.delete(path, handler);
                break;
            default:
                throw new Error(`[${this._name}] Invalid method: ${method}`);
        }
    }

    /**
     * Start the application.
     *
     * @param clients - The clients to use. If not provided, the default clients will be used.
     */
    public async start(
        clients: {
            serve: typeof serve;
        } = {
            serve,
        },
    ): Promise<void> {
        const port = this.options.port;
        if (this._server) {
            this.logger.warn(
                `[${this._name}] Server is already running on ${this._server.address}:${port}`,
            );
            return;
        }

        this.logger.info(`[${this._name}] Starting server on port ${port}`);
        this._server = clients.serve(
            {
                fetch: this._app.fetch,
                port,
            },
            (info) => {
                this.logger.info(`[${this._name}] Server is running on ${info.address}:${port}`);
            },
        );
    }

    /**
     * Stop the application.
     */
    public async stop(): Promise<void> {
        if (!this._server) {
            this.logger.warn(`[${this._name}] Server is not running`);
            return;
        }

        this._server.close();
    }
}

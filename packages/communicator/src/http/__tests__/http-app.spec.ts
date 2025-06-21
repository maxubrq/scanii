import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { Context, Hono, MiddlewareHandler } from 'hono';
import { serve, ServerType } from '@hono/node-server';
import { createLogger, SkaniiLogger } from '@skanii/logger';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { compress } from 'hono/compress';
import { csrf } from 'hono/csrf';
import { SkaniiRequestIdMiddleware } from '../http-middleware';
import { SkaniiHttpApp, DEFAULT_OPTIONS, SkaniiHttpRoute, SkaniiHttpAppOptions } from '../http-app';

// Mock all dependencies
vi.mock('hono', () => ({
    Hono: vi.fn(),
    Context: vi.fn(),
}));

vi.mock('@hono/node-server', () => ({
    serve: vi.fn(),
}));

vi.mock('@skanii/logger', () => ({
    createLogger: vi.fn(),
}));

vi.mock('hono/cors', () => ({
    cors: vi.fn(),
}));

vi.mock('hono/secure-headers', () => ({
    secureHeaders: vi.fn(),
}));

vi.mock('hono/compress', () => ({
    compress: vi.fn(),
}));

vi.mock('hono/csrf', () => ({
    csrf: vi.fn(),
}));

vi.mock('../http-middleware', () => ({
    SkaniiRequestIdMiddleware: vi.fn(),
}));

describe('SkaniiHttpApp', () => {
    let mockHonoInstance: {
        use: MockedFunction<any>;
        get: MockedFunction<any>;
        post: MockedFunction<any>;
        put: MockedFunction<any>;
        delete: MockedFunction<any>;
        fetch: MockedFunction<any>;
    };
    let mockLogger: SkaniiLogger;
    let mockServe: MockedFunction<typeof serve>;
    let mockServer: ServerType;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Mock Hono instance
        mockHonoInstance = {
            use: vi.fn(),
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            fetch: vi.fn(),
        };
        (Hono as any).mockImplementation(() => mockHonoInstance);

        // Mock logger
        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        } as any;
        (createLogger as MockedFunction<typeof createLogger>).mockReturnValue(mockLogger);

        // Mock server
        mockServer = {
            close: vi.fn(),
            address: 'localhost',
        } as any;
        mockServe = serve as MockedFunction<typeof serve>;
        mockServe.mockReturnValue(mockServer);

        // Mock middleware functions
        (SkaniiRequestIdMiddleware as MockedFunction<any>).mockReturnValue(vi.fn());
        (cors as MockedFunction<any>).mockReturnValue(vi.fn());
        (secureHeaders as MockedFunction<any>).mockReturnValue(vi.fn());
        (csrf as MockedFunction<any>).mockReturnValue(vi.fn());
        (compress as MockedFunction<any>).mockReturnValue(vi.fn());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Constructor', () => {
        it('should create an instance with default options', () => {
            const app = new SkaniiHttpApp('test-app');

            expect(Hono).toHaveBeenCalledTimes(1);
            expect(createLogger).toHaveBeenCalledWith('test-app');
            expect(mockHonoInstance.use).toHaveBeenCalledTimes(5); // Default middlewares
        });

        it('should create an instance with custom options', () => {
            const customMiddleware = vi.fn();
            const customOptions: SkaniiHttpAppOptions = {
                port: 4000,
                routes: [],
                middlewares: [customMiddleware],
            };

            const app = new SkaniiHttpApp('test-app', customOptions);

            expect(createLogger).toHaveBeenCalledWith('test-app');
            expect(mockHonoInstance.use).toHaveBeenCalledWith(customMiddleware);
        });

        it('should set up routes provided in options', () => {
            const mockHandler = vi.fn();
            const routes: SkaniiHttpRoute[] = [
                { method: 'GET', path: '/test', handler: mockHandler },
                { method: 'POST', path: '/create', handler: mockHandler },
                { method: 'PUT', path: '/update', handler: mockHandler },
                { method: 'DELETE', path: '/delete', handler: mockHandler },
            ];

            const customOptions: SkaniiHttpAppOptions = {
                port: 4000,
                routes,
                middlewares: [],
            };

            const app = new SkaniiHttpApp('test-app', customOptions);

            expect(mockHonoInstance.get).toHaveBeenCalledWith('/test', mockHandler);
            expect(mockHonoInstance.post).toHaveBeenCalledWith('/create', mockHandler);
            expect(mockHonoInstance.put).toHaveBeenCalledWith('/update', mockHandler);
            expect(mockHonoInstance.delete).toHaveBeenCalledWith('/delete', mockHandler);
        });

        it('should use custom port from options', () => {
            const customOptions: SkaniiHttpAppOptions = {
                port: 9000,
                routes: [],
                middlewares: [],
            };

            const app = new SkaniiHttpApp('test-app', customOptions);

            expect(createLogger).toHaveBeenCalledWith('test-app');
        });
    });

    describe('use method', () => {
        it('should add middleware to the app', () => {
            const app = new SkaniiHttpApp('test-app');
            const middleware1 = vi.fn();
            const middleware2 = vi.fn();

            app.use(middleware1, middleware2);

            expect(mockHonoInstance.use).toHaveBeenCalledWith(middleware1, middleware2);
        });
    });

    describe('addRoute method', () => {
        let app: SkaniiHttpApp;
        let mockHandler: (c: Context) => Promise<Response>;

        beforeEach(() => {
            app = new SkaniiHttpApp('test-app');
            mockHandler = vi.fn().mockResolvedValue(new Response());
        });

        it('should add GET route', async () => {
            await app.addRoute('GET', '/test', mockHandler);
            expect(mockHonoInstance.get).toHaveBeenCalledWith('/test', mockHandler);
        });

        it('should add POST route', async () => {
            await app.addRoute('POST', '/test', mockHandler);
            expect(mockHonoInstance.post).toHaveBeenCalledWith('/test', mockHandler);
        });

        it('should add PUT route', async () => {
            await app.addRoute('PUT', '/test', mockHandler);
            expect(mockHonoInstance.put).toHaveBeenCalledWith('/test', mockHandler);
        });

        it('should add DELETE route', async () => {
            await app.addRoute('DELETE', '/test', mockHandler);
            expect(mockHonoInstance.delete).toHaveBeenCalledWith('/test', mockHandler);
        });

        it('should throw error for invalid method', async () => {
            await expect(app.addRoute('INVALID' as any, '/test', mockHandler)).rejects.toThrow(
                '[test-app] Invalid method: INVALID',
            );
        });
    });

    describe('start method', () => {
        let app: SkaniiHttpApp;

        beforeEach(() => {
            app = new SkaniiHttpApp('test-app', { port: 3000, routes: [], middlewares: [] });
        });

        it('should start the server successfully', async () => {
            const mockCallback = vi.fn();
            mockServe.mockImplementation((options, callback) => {
                if (callback) {
                    callback({ address: 'localhost', port: 3000 } as any);
                }
                return mockServer;
            });

            await app.start();

            expect(mockLogger.info).toHaveBeenCalledWith('[test-app] Starting server on port 3000');
            expect(mockServe).toHaveBeenCalledWith(
                {
                    fetch: mockHonoInstance.fetch,
                    port: 3000,
                },
                expect.any(Function),
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                '[test-app] Server is running on localhost:3000',
            );
        });

        it('should use custom serve client', async () => {
            const customServe = vi.fn().mockReturnValue(mockServer);

            await app.start({ serve: customServe });

            expect(customServe).toHaveBeenCalled();
            expect(mockServe).not.toHaveBeenCalled();
        });

        it('should warn if server is already running', async () => {
            // Start server first time
            await app.start();

            // Try to start again
            await app.start();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                '[test-app] Server is already running on localhost:3000',
            );
        });
    });

    describe('stop method', () => {
        let app: SkaniiHttpApp;

        beforeEach(() => {
            app = new SkaniiHttpApp('test-app');
        });

        it('should stop the server successfully', async () => {
            // Start server first
            await app.start();

            // Then stop it
            await app.stop();

            expect(mockServer.close).toHaveBeenCalled();
        });

        it('should warn if server is not running', async () => {
            await app.stop();

            expect(mockLogger.warn).toHaveBeenCalledWith('[test-app] Server is not running');
        });
    });

    describe('DEFAULT_OPTIONS', () => {
        it('should have correct default values', () => {
            expect(DEFAULT_OPTIONS.port).toBeDefined();
            expect(DEFAULT_OPTIONS.routes).toEqual([]);
            expect(DEFAULT_OPTIONS.middlewares).toHaveLength(5);
        });
    });
});

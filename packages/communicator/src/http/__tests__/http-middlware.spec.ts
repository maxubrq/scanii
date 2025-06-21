import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Context } from 'hono';
import { SkaniiRequestIdMiddleware } from '../http-middleware';
import { generateResourceId, RESOURCE_TYPE } from '@skanii/domain';

// Mock the domain module
vi.mock('@skanii/domain', () => ({
    generateResourceId: vi.fn(),
    RESOURCE_TYPE: {
        SCAN: 'scan',
        FILE: 'file',
        AV: 'av',
        AV_RESULT: 'av_result',
    },
}));

describe('SkaniiRequestIdMiddleware', () => {
    let mockContext: Partial<Context>;
    let mockNext: ReturnType<typeof vi.fn>;
    let middleware: ReturnType<typeof SkaniiRequestIdMiddleware>;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup mock context
        mockContext = {
            req: {
                header: vi.fn(),
            } as any,
            set: vi.fn(),
        };

        mockNext = vi.fn().mockResolvedValue(undefined);
        middleware = SkaniiRequestIdMiddleware();
    });

    it('should use existing X-Request-Id header when present', async () => {
        const existingRequestId = 'existing-request-id-123';

        // Mock the header method to return existing request ID
        (mockContext.req!.header as any).mockReturnValue(existingRequestId);

        await middleware(mockContext as Context, mockNext);

        // Verify the existing request ID is used
        expect(mockContext.req!.header).toHaveBeenCalledWith('X-Request-Id');
        expect(mockContext.set).toHaveBeenCalledWith('requestId', existingRequestId);
        expect(generateResourceId).not.toHaveBeenCalled();
        expect(mockNext).toHaveBeenCalled();
    });

    it('should generate new request ID when X-Request-Id header is not present', async () => {
        const generatedRequestId = 'scan_abc123';

        // Mock the header method to return undefined (no header present)
        (mockContext.req!.header as any).mockReturnValue(undefined);

        // Mock generateResourceId to return a specific ID
        (generateResourceId as any).mockReturnValue(generatedRequestId);

        await middleware(mockContext as Context, mockNext);

        // Verify new request ID is generated
        expect(mockContext.req!.header).toHaveBeenCalledWith('X-Request-Id');
        expect(generateResourceId).toHaveBeenCalledWith(RESOURCE_TYPE.SCAN);
        expect(mockContext.set).toHaveBeenCalledWith('requestId', generatedRequestId);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should generate new request ID when X-Request-Id header is empty string', async () => {
        const generatedRequestId = 'scan_def456';

        // Mock the header method to return empty string
        (mockContext.req!.header as any).mockReturnValue('');

        // Mock generateResourceId to return a specific ID
        (generateResourceId as any).mockReturnValue(generatedRequestId);

        await middleware(mockContext as Context, mockNext);

        // Verify new request ID is generated for empty string
        expect(mockContext.req!.header).toHaveBeenCalledWith('X-Request-Id');
        expect(generateResourceId).toHaveBeenCalledWith(RESOURCE_TYPE.SCAN);
        expect(mockContext.set).toHaveBeenCalledWith('requestId', generatedRequestId);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should generate new request ID when X-Request-Id header is null', async () => {
        const generatedRequestId = 'scan_ghi789';

        // Mock the header method to return null
        (mockContext.req!.header as any).mockReturnValue(null);

        // Mock generateResourceId to return a specific ID
        (generateResourceId as any).mockReturnValue(generatedRequestId);

        await middleware(mockContext as Context, mockNext);

        // Verify new request ID is generated for null
        expect(mockContext.req!.header).toHaveBeenCalledWith('X-Request-Id');
        expect(generateResourceId).toHaveBeenCalledWith(RESOURCE_TYPE.SCAN);
        expect(mockContext.set).toHaveBeenCalledWith('requestId', generatedRequestId);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should call next() and return its result', async () => {
        const nextResult = Symbol('next-result');
        mockNext.mockResolvedValue(nextResult);

        // Mock the header method to return undefined
        (mockContext.req!.header as any).mockReturnValue(undefined);
        (generateResourceId as any).mockReturnValue('scan_test');

        const result = await middleware(mockContext as Context, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(result).toBe(nextResult);
    });

    it('should handle async next() function properly', async () => {
        let nextCalled = false;
        const asyncNext = vi.fn(async () => {
            // Simulate some async work
            await new Promise((resolve) => setTimeout(resolve, 10));
            nextCalled = true;
        });

        (mockContext.req!.header as any).mockReturnValue('test-request-id');

        await middleware(mockContext as Context, asyncNext);

        expect(nextCalled).toBe(true);
        expect(asyncNext).toHaveBeenCalled();
    });

    it('should preserve the exact request ID format from header', async () => {
        const specialRequestId = 'custom-format_123-abc!@#';

        (mockContext.req!.header as any).mockReturnValue(specialRequestId);

        await middleware(mockContext as Context, mockNext);

        expect(mockContext.set).toHaveBeenCalledWith('requestId', specialRequestId);
        expect(generateResourceId).not.toHaveBeenCalled();
    });
});

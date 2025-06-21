import { MiddlewareHandler } from 'hono';
import { generateResourceId, RESOURCE_TYPE } from '@skanii/domain';

/**
 * The middleware to add a request ID to the request.
 */
export function SkaniiRequestIdMiddleware(): MiddlewareHandler {
    return async (c, next) => {
        const requestId = c.req.header('X-Request-Id') || generateResourceId(RESOURCE_TYPE.SCAN);
        c.set('requestId', requestId);
        return next();
    };
}

import logger from './logger.js';

// Custom error classes
export class AppError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    constructor(message, errors = []) {
        super(message, 400);
        this.errors = errors;
    }
}

export class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401);
    }
}

export class AuthorizationError extends AppError {
    constructor(message = 'Access denied') {
        super(message, 403);
    }
}

export class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404);
    }
}

export class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, 429);
    }
}

// Error handling middleware
export const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error
    logger.error('Error Handler', {
        error: {
            name: err.name,
            message: err.message,
            stack: err.stack,
            statusCode: err.statusCode,
        },
        request: {
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
        },
    });

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        error = new NotFoundError(message);
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const message = 'Duplicate field value entered';
        error = new ValidationError(message);
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = new ValidationError(message);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid token';
        error = new AuthenticationError(message);
    }

    if (err.name === 'TokenExpiredError') {
        const message = 'Token expired';
        error = new AuthenticationError(message);
    }

    // Puppeteer errors
    if (err.name === 'TimeoutError') {
        const message = 'Request timeout';
        error = new AppError(message, 408);
    }

    // Network errors
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
        const message = 'Network error - unable to connect to external service';
        error = new AppError(message, 503);
    }

    // Default error
    if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Internal server error';
    }

    // Send error response
    res.status(error.statusCode).json({
        success: false,
        error: {
            message: error.message,
            statusCode: error.statusCode,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
        },
        ...(error.errors && { errors: error.errors }),
        timestamp: new Date().toISOString(),
        path: req.url,
    });
};

// Async error wrapper
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// 404 handler
export const notFoundHandler = (req, res, next) => {
    const error = new NotFoundError(`Route ${req.originalUrl}`);
    next(error);
};

// Request validation middleware
export const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            const { error } = schema.validate(req.body);
            if (error) {
                const message = error.details.map(detail => detail.message).join(', ');
                throw new ValidationError(message);
            }
            next();
        } catch (err) {
            next(err);
        }
    };
};

// Rate limiting error handler
export const rateLimitHandler = (req, res, next) => {
    const error = new RateLimitError('Too many requests from this IP');
    next(error);
};

// Global unhandled rejection handler
export const handleUnhandledRejection = (err) => {
    logger.error('Unhandled Rejection', {
        error: {
            name: err.name,
            message: err.message,
            stack: err.stack,
        },
    });
    
    process.exit(1);
};

// Global uncaught exception handler
export const handleUncaughtException = (err) => {
    logger.error('Uncaught Exception', {
        error: {
            name: err.name,
            message: err.message,
            stack: err.stack,
        },
    });
    
    process.exit(1);
};

// Graceful shutdown handler
export const gracefulShutdown = (signal) => {
    logger.info('Graceful Shutdown', {
        signal,
        timestamp: new Date().toISOString(),
    });
    
    process.exit(0);
}; 
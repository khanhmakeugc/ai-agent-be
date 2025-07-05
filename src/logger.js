import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Create logs directory if it doesn't exist
const logsDir = './logs';
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define colors for each level
const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

// Add colors to winston
winston.addColors(logColors);

// Create custom format for logs
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        
        if (stack) {
            log += `\n${stack}`;
        }
        
        if (Object.keys(meta).length > 0) {
            log += `\n${JSON.stringify(meta, null, 2)}`;
        }
        
        return log;
    })
);

// Create console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`;
        
        if (stack) {
            log += `\n${stack}`;
        }
        
        if (Object.keys(meta).length > 0) {
            log += `\n${JSON.stringify(meta, null, 2)}`;
        }
        
        return log;
    })
);

// Create the logger
const logger = winston.createLogger({
    levels: logLevels,
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: logFormat,
    transports: [
        // Error logs
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        
        // Combined logs
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        
        // HTTP logs
        new winston.transports.File({
            filename: path.join(logsDir, 'http.log'),
            level: 'http',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat,
    }));
}

// Create a stream for Morgan HTTP logging
logger.stream = {
    write: (message) => {
        logger.http(message.trim());
    },
};

// Helper functions for structured logging
export const logAPI = {
    request: (req, res, next) => {
        const start = Date.now();
        
        // Log request
        logger.info('API Request', {
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            body: req.method !== 'GET' ? req.body : undefined,
            query: Object.keys(req.query).length > 0 ? req.query : undefined,
        });
        
        // Override res.end to log response
        const originalEnd = res.end;
        res.end = function(chunk, encoding) {
            const duration = Date.now() - start;
            
            logger.info('API Response', {
                method: req.method,
                url: req.url,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                contentLength: res.get('Content-Length'),
            });
            
            originalEnd.call(this, chunk, encoding);
        };
        
        next();
    },
    
    error: (error, req, res, next) => {
        logger.error('API Error', {
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name,
            },
            body: req.body,
            query: req.query,
        });
        
        next(error);
    },
};

// Email service specific logging
export const logEmail = {
    send: (emailData, result) => {
        logger.info('Email Sent', {
            to: emailData.to,
            subject: emailData.subject,
            messageId: result.messageId,
            template: emailData.template,
        });
    },
    
    error: (emailData, error) => {
        logger.error('Email Error', {
            to: emailData.to,
            subject: emailData.subject,
            template: emailData.template,
            error: {
                message: error.message,
                code: error.code,
            },
        });
    },
    
    bulk: (recipients, results) => {
        logger.info('Bulk Email Completed', {
            total: recipients.length,
            sent: results.sent,
            failed: results.failed,
            errors: results.errors,
        });
    },
};

// Meta API specific logging
export const logMeta = {
    auth: (action, data) => {
        logger.info('Meta Auth', {
            action,
            userId: data.id,
            userName: data.name,
        });
    },
    
    api: (endpoint, data) => {
        logger.info('Meta API Call', {
            endpoint,
            data: data,
        });
    },
    
    error: (endpoint, error) => {
        logger.error('Meta API Error', {
            endpoint,
            error: {
                message: error.message,
                code: error.code,
            },
        });
    },
    
    video: (action, url, result) => {
        logger.info('Meta Video', {
            action,
            url,
            success: !!result,
            size: result?.length,
        });
    },
};

// General application logging
export const logApp = {
    startup: (port) => {
        logger.info('Application Started', {
            port,
            environment: process.env.NODE_ENV || 'development',
            nodeVersion: process.version,
        });
    },
    
    shutdown: (signal) => {
        logger.info('Application Shutdown', {
            signal,
            timestamp: new Date().toISOString(),
        });
    },
    
    health: (status, details) => {
        logger.info('Health Check', {
            status,
            details,
            timestamp: new Date().toISOString(),
        });
    },
};

export default logger; 
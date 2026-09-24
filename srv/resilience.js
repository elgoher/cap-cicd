'use strict'

/**
 * Resilience utilities for CAP handlers.
 *
 * withRetry     — retry an async operation with exponential backoff
 * CircuitBreaker — protect downstream services from cascade failures
 */

// ─── withRetry ────────────────────────────────────────────────────────────────

/**
 * Executes `fn` up to `maxRetries` times, doubling the delay between attempts.
 *
 * @param {() => Promise<any>} fn         Async operation to retry
 * @param {number}             maxRetries Maximum number of attempts (default 3)
 * @param {number}             baseDelay  Initial delay in ms, doubles each attempt (default 300)
 * @returns {Promise<any>}     Result of the first successful call
 * @throws  {Error}            Last error if all attempts fail
 *
 * @example
 *   const data = await withRetry(() => externalApi.get('/parts/P-001'), 3, 300)
 */
async function withRetry(fn, maxRetries = 3, baseDelay = 300) {
    let lastError
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn()
        } catch (err) {
            lastError = err
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1)
                await new Promise(r => setTimeout(r, delay))
            }
        }
    }
    throw lastError
}

// ─── CircuitBreaker ───────────────────────────────────────────────────────────

/**
 * Simple Circuit Breaker.
 *
 * States:
 *   CLOSED    — normal operation, requests pass through
 *   OPEN      — downstream failed too many times; requests rejected immediately
 *   HALF-OPEN — testing recovery; next call decides if we return to CLOSED or OPEN
 *
 * @example
 *   const cb = new CircuitBreaker({ threshold: 3, resetTimeout: 10_000 })
 *   const result = await cb.call(() => externalApi.get('/parts/P-001'))
 */
class CircuitBreaker {
    /**
     * @param {object} opts
     * @param {number} opts.threshold    Failures before opening (default 3)
     * @param {number} opts.resetTimeout ms before trying HALF-OPEN (default 30 000)
     */
    constructor({ threshold = 3, resetTimeout = 30000 } = {}) {
        this.threshold    = threshold
        this.resetTimeout = resetTimeout
        this.failures     = 0
        this.state        = 'CLOSED'
        this.nextAttempt  = null
    }

    /** Execute `fn` through the circuit breaker. */
    async call(fn) {
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                const err = new Error('Circuit breaker OPEN — downstream unavailable.')
                err.code  = 'CIRCUIT_OPEN'
                throw err
            }
            // Timeout elapsed → allow one test call
            this.state = 'HALF-OPEN'
        }

        try {
            const result = await fn()
            this._onSuccess()
            return result
        } catch (err) {
            this._onFailure()
            throw err
        }
    }

    _onSuccess() {
        this.failures = 0
        this.state    = 'CLOSED'
    }

    _onFailure() {
        this.failures++
        if (this.failures >= this.threshold) {
            this.state       = 'OPEN'
            this.nextAttempt = Date.now() + this.resetTimeout
        }
    }

    get isOpen()     { return this.state === 'OPEN'      }
    get isClosed()   { return this.state === 'CLOSED'    }
    get isHalfOpen() { return this.state === 'HALF-OPEN' }
}

module.exports = { withRetry, CircuitBreaker }

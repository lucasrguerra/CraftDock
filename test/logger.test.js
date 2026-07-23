import { describe, it, expect } from 'vitest';
import { createLogger } from '../src/logger.js';

describe('logger', () => {
  it('formats text logs with timestamp, level, component and message', () => {
    let output = '';
    const stream = {
      write: (data) => { output += data; },
    };
    const log = createLogger('test-comp', { level: 'info', format: 'text', stream });
    log.info('hello world', { foo: 'bar' });

    expect(output).toContain('[INFO ] [test-comp] hello world {"foo":"bar"}');
  });

  it('formats JSON logs when format is json', () => {
    let output = '';
    const stream = {
      write: (data) => { output += data; },
    };
    const log = createLogger('json-comp', { level: 'info', format: 'json', stream });
    log.info('json message', { count: 42 });

    const parsed = JSON.parse(output.trim());
    expect(parsed.component).toBe('json-comp');
    expect(parsed.level).toBe('info');
    expect(parsed.msg).toBe('json message');
    expect(parsed.meta).toEqual({ count: 42 });
  });

  it('filters out logs above threshold level', () => {
    let output = '';
    const stream = {
      write: (data) => { output += data; },
    };
    const log = createLogger('threshold-comp', { level: 'warn', format: 'text', stream });
    log.info('should be ignored');
    log.warn('should be logged');

    expect(output).not.toContain('should be ignored');
    expect(output).toContain('should be logged');
  });

  it('serializes Error objects correctly', () => {
    let output = '';
    const stream = {
      write: (data) => { output += data; },
    };
    const log = createLogger('error-comp', { level: 'error', format: 'json', stream });
    const err = new Error('something went wrong');
    log.error('failure', { err });

    const parsed = JSON.parse(output.trim());
    expect(parsed.meta.err.error).toBe('something went wrong');
    expect(parsed.meta.err.stack).toBeDefined();
  });
});

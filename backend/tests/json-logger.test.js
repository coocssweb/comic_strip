import assert from 'node:assert/strict';
import test from 'node:test';

import { createJsonLogger } from '../src/observability/json-logger.js';

function createMemoryWriter() {
  const lines = [];
  return {
    lines,
    write(line) {
      lines.push(line);
    },
  };
}

test('fatal 日志在 fatal 阈值下仍会输出', () => {
  const writer = createMemoryWriter();
  const logger = createJsonLogger({ stdout: writer, stderr: writer, level: 'fatal' });

  logger.fatal('服务启动失败', { errorSummary: '运行基线初始化失败' });
  logger.info('不应输出');

  assert.equal(writer.lines.length, 1);
  assert.deepEqual(JSON.parse(writer.lines[0]), {
    timestamp: JSON.parse(writer.lines[0]).timestamp,
    level: 'fatal',
    event: '服务启动失败',
    errorSummary: '运行基线初始化失败',
  });
});

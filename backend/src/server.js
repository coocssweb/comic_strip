import { app } from './app.js';

async function startServer() {
  try {
    const [{ env }, { connectDatabase }] = await Promise.all([
      import('./config/env.js'),
      import('./config/database.js'),
    ]);

    await connectDatabase();

    const server = app.listen(env.port, () => {
      console.info(`服务已启动，监听端口 ${env.port}`);
    });

    server.once('error', () => {
      console.error('服务启动失败：端口无法监听');
      process.exitCode = 1;
    });
  } catch (error) {
    const startupMessage = error instanceof Error ? error.message : '未知启动异常';
    console.error(`服务启动失败：${startupMessage}`);
    process.exitCode = 1;
  }
}

void startServer();

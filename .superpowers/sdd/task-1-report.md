# Task 1 实施报告

## 状态

已完成 Task 1 要求的后端项目清单、开发规范和环境变量配置。未创建自动化测试文件或测试依赖。

## 改动

- 新增 ES Module `package.json`，包含开发、启动、格式化和静态检查脚本，以及计划指定的运行时与开发依赖。
- 运行 `npm install`，生成锁定依赖版本的 `package-lock.json`。
- 新增 `.env.example`、`.gitignore`、Prettier 配置与忽略规则。
- 新增 ESLint 平面配置，并显式声明 Node.js 的只读 `process` 全局变量；否则 ESLint 会将环境变量配置中的 `process` 误判为未定义。
- 新增 `src/config/env.js`：加载环境变量，校验正整数配置与 MongoDB 连接字符串，导出后续任务可直接导入的 `env`。

## 命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm install` | 成功，退出码 0，安装 223 个包并生成 `package-lock.json`。npm 提示 `koa-router@12.0.1` 已废弃；版本为计划指定，未擅自替换。 |
| `npm run` | 成功，确认 `dev`、`start`、`lint`、`format` 四个脚本均可识别。 |
| `npm run format` | 成功，退出码 0。 |
| `npm run lint`（首次） | 失败：`env.js` 中 5 处 `process` 触发 `no-undef`。根因是 ESLint 配置未声明 Node.js 全局变量。 |
| `npm run format` | 修复 ESLint 配置后成功，退出码 0。 |
| `npm run lint` | 修复后成功，退出码 0。 |
| `MONGODB_URI=... node --input-type=module -e "import { env } ..."` | 成功，确认默认端口、重试次数、重试间隔与 MongoDB URI 均被正确解析。 |

## 文件清单

- `backend/package.json`
- `backend/package-lock.json`
- `backend/.env.example`
- `backend/.gitignore`
- `backend/eslint.config.js`
- `backend/.prettierrc.json`
- `backend/.prettierignore`
- `backend/src/config/env.js`
- `.superpowers/sdd/task-1-report.md`

## 自审

- `env` 仅导出 Task 1 契约所需的五个字段，字段命名、默认值和正整数边界校验均与计划一致。
- 错误文案均为中文；未输出或记录任何敏感环境变量。
- `type: module` 已设置，所有新增 JavaScript 均使用 ES Module 语法。
- 未改动任务范围外的源码或规则文件。格式化过程曾移除 `backend/AGENT.md` 既有的行尾空格，已使用补丁恢复，最终不包含该文件变更。
- 隔离工作区已有根目录未跟踪 `.gitignore`，未做任何修改。
- 未执行 `git add`、`git commit` 或 `git reset`。

## 疑虑

- `koa-router@12.0.1` 的弃用提示来自 npm；该依赖及版本由计划明确指定，建议在后续依赖升级任务中统一评估迁移到 `@koa/router`。

## 审查修复（补充）

### 修复内容

- 使用 `git restore backend/AGENT.md` 恢复格式化命令移除的既有行尾空格，最终不再包含该规则文件的变更。
- 将 `parsePositiveInteger` 改为先匹配完整的非零十进制数字字符串，再转换为安全整数；`3000abc`、`3.5`、空字符串、零和超出安全整数范围的值都会被拒绝。
- 在 ESLint 的语言选项中将 `console`、`process` 与 `setTimeout` 声明为只读 Node.js 运行时全局变量，避免后续服务端代码触发 `no-undef`；保留现有的 `no-console: off` 规则。

### 补充检查

| 命令 | 结果 |
| --- | --- |
| `git restore backend/AGENT.md` | 成功。格式化后再次执行恢复，最终工作区中不再显示该文件变更。 |
| `npm run format && npm run lint` | 成功，两个命令均以退出码 0 结束。 |
| 以 `PORT=3000abc` 导入 `env.js` | 成功验证拒绝该值，并返回中文正整数错误。 |
| 以 `PORT=3.5` 导入 `env.js` | 成功验证拒绝该值，并返回中文正整数错误。 |

### 补充自审

- 正则校验发生在数值转换前，避免 `Number.parseInt` 截断非法后缀或小数造成的误接受。
- 环境变量验证仅在临时子进程环境中执行，未创建或改动 `.env` 文件。
- 根目录未跟踪 `.gitignore` 仍未改动；未执行 `git add`、`git commit` 或 `git reset`。

## 环境变量默认值修复（补充二）

### 修复内容

- `PORT`、`MONGODB_RETRY_TIMES` 和 `MONGODB_RETRY_INTERVAL_MS` 仅在对应 `process.env` 字段严格等于 `undefined` 时采用默认值。
- 显式空字符串不再被 `||` 替换为默认值，而是进入既有的正整数校验并抛出中文错误。

### 检查结果

| 检查项 | 结果 |
| --- | --- |
| `npm run format && npm run lint` | 成功，两个命令均以退出码 0 结束。 |
| `PORT`、`MONGODB_RETRY_TIMES`、`MONGODB_RETRY_INTERVAL_MS` 为空字符串 | 均被正整数校验拒绝。 |
| `PORT=3000abc` | 被正整数校验拒绝。 |
| `PORT=3.5` | 被正整数校验拒绝。 |

### 补充自审

- 空字符串验证通过 Node.js 子进程内的 `process.env` 对象完成，以避免 Windows PowerShell 将空环境变量传递为未定义值的运行时差异。
- 格式化命令再次触及 `backend/AGENT.md` 的既有行尾空格，已使用 `git restore` 恢复；最终工作区不含该文件变更。

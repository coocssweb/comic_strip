---
trigger: manual
---

# Redux 数据流规范

本规范约束 `admin-web` 中 Redux store 的写入边界，确保 UI 层与状态管理层解耦。

## 一、dispatch 隔离

- 页面组件（`pages/**/*.jsx`）和公共组件（`components/**/*.jsx`）禁止直接调用 `useDispatch` 和 `dispatch()`。
- 所有 dispatch 操作必须封装在 `src/hooks/` 下的自定义 hook 中，由 hook 向组件暴露纯业务语义的函数（如 `login()`、`acceptOrder()`、`setBalance()`）。
- 组件只调用 hook 返回的业务函数，不感知 Redux action 名称、thunk 细节和 dispatch 机制。
- 如果组件中出现 `import { useDispatch }` 或 `dispatch(`，视为违规。

## 二、hook 组织

- 封装 dispatch 的自定义 hook 统一放在 `src/hooks/` 目录下。
- hook 按领域命名，与对应 slice 保持对应关系（如 `useAuth` ↔ `authSlice`、`useOrder` ↔ `orderSlice`、`useWallet` ↔ `walletSlice`）。
- 新增 slice 时，必须同步创建对应的业务 hook；禁止只建 slice 而让组件直接 dispatch。
- 通用工具 hook（如 `useSetState`）放在 `hooks/` 顶层，不受领域分类约束。
- hook 数量超过 8 个时，按领域建子目录组织（如 `hooks/auth/`、`hooks/order/`）。

## 三、useSelector 不受限制

- 组件可直接使用 `useSelector` 读取 store 状态，不强制封装到 hook 中。
- 但如果 selector 逻辑复杂（计算、组合多个 slice、需要 memoize），应提取为独立 selector 函数或收进业务 hook。

## 四、豁免范围

- 非 React 上下文的基础设施代码（如 `utils/request.js` 中 HTTP 拦截器的 401 自动登出）允许直接使用 `store.dispatch()`，但必须在调用处注释标注豁免原因。
- `src/hooks/` 目录下的自定义 hook 内部允许使用 `useDispatch` 和 `dispatch()`，这是本规范设计的唯一 dispatch 入口。
- `src/store/` 目录下的 slice 文件内部（如 thunk 中的 `dispatch`）不受本规范约束。

## 五、审查清单

- 是否有 `pages/**` 或 `components/**` 文件直接 import 了 `useDispatch`？
- 新增 slice 后，是否同步创建了对应的业务 hook？
- 是否有 hook 名称与其封装的 slice 领域不对应？
- 非 React 环境的 `store.dispatch()` 调用是否标注了豁免原因？
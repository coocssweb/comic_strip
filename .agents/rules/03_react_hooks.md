---
trigger: manual
---

# React Hooks 与状态规范

本规范适用于`admin-web` 中所有 React 组件、hooks 和状态逻辑。重点约束 Hooks 使用、状态设计和副作用管理；组件拆分和公共组件复用仍以各子项目 `AGENT.md` 与对应 skill 为准。从原型迁移引发的样式复制风险，见 `04_frontend_style.md` 的“公共组件与原型移植”。

## 一、Hooks 基本规则

- Hooks 只能在组件或自定义 hook 顶层调用，禁止放入条件、循环、嵌套函数、异常分支。
- 自定义 hook 必须以 `use` 开头，并隐藏一类可复用状态逻辑或副作用逻辑。
- 自定义 hook 返回值必须稳定、语义清晰；不要返回一个混杂大量字段的匿名对象。
- 组件 render 阶段必须保持纯净，禁止在 render 中发请求、写缓存、触发 Toast、修改 DOM 或修改外部变量。
- 事件逻辑放在事件处理函数中，副作用同步放在 `useEffect` 中，渲染派生计算放在 render 或 `useMemo` 中。

## 二、useEffect 规则

- `useEffect` 只用于同步外部系统，例如网络订阅、浏览器事件、定时器、手动 DOM 集成、远端数据加载。
- 不要把用户点击、表单提交、删除确认、Toast 提示这类事件专属逻辑绕到 `useEffect` 里。
- 不要为了同步 props 到 state 而使用 `useEffect`。如果 state 始终由 props 推导得到，应直接在 render 中计算；只有明确需要保留用户编辑、副本或历史快照时，才将 props 初始化到 state。
- 依赖数组必须真实反映 effect 内读取的响应式值；禁止通过空数组伪装“只执行一次”。
- 禁止压制 `react-hooks/exhaustive-deps`。如果依赖不符合预期，先改代码结构，而不是改依赖数组。
- 想移除依赖时，必须证明该值不是响应式值：移到组件外、移入 effect 内、改为函数式更新，或拆分 effect。
- 一个 effect 只同步一类外部系统；多个不相关副作用必须拆成多个 effect。
- effect 必须在需要时返回清理函数，例如事件监听、定时器、订阅、轮询、异步竞态保护。
- 异步 effect 不得直接把回调函数标记为 `async`；应在内部定义异步函数并处理取消或过期响应。

## 三、useCallback、useMemo 与 memo

- `useCallback` 主要用于稳定传给子组件、effect、订阅或第三方库的函数引用；不是默认必须加的装饰器。
- 如果代码不加 `useCallback` 就出错，优先修复状态和副作用设计，再考虑是否需要 `useCallback`。
- `useCallback`、`useMemo` 或 `useEffect` 中引用的组件内函数，同样属于响应式依赖。若该函数仅供当前 callback / memo / effect 使用，应优先移动到内部；若需要多个地方复用，应使用 `useCallback` 稳定引用或提取为组件外工具函数，不得通过省略依赖或关闭 `exhaustive-deps` 规避问题。
- 以下函数应使用 `useCallback` 稳定引用：
  - 被本组件或子组件内部 `useEffect` / `useMemo` 依赖的函数；
  - 传给已 `memo` 化子组件、公共组件库组件、或内部实现不透明 / 后续可能被 `memo` 化的子组件的函数；
  - 作为公共 hook 返回值的函数。
- 是否需要 `useCallback`，不能仅以“当前这个子组件此刻有没有 memo”为判断依据——子组件后续被加上 `memo` 而父组件未同步补 `useCallback`，会导致 `memo` 静默失效且难以在 review 中发现。
- `useMemo` 只用于昂贵计算、稳定对象引用或避免无意义重渲染；不要用它包装所有普通计算。
- `useMemo` 和 `useCallback` 的依赖同样必须真实完整，不能为了减少执行次数删依赖。

### memo 使用时机

- 组件满足以下任一条件时才考虑使用 `memo`，不要默认包裹：
  - 该组件在列表中被批量渲染（如表格行、列表项），父级数据量可能达到数十条以上；
  - 该组件自身渲染开销可衡量地高（复杂计算、大量 DOM 节点、图表、富文本等），且父组件会因无关状态频繁重渲染；
  - 该组件是被明确识别为性能瓶颈的对象（如通过 React DevTools Profiler 定位到），而非主观猜测。
- 不满足以上条件的普通展示组件、表单项、页面级组件，默认不加 `memo`。
- 决定给组件加 `memo` 时，应同步检查：
  - 传入的所有函数类型 props 是否都用 `useCallback` 包裹；
  - 传入的所有对象、数组类型 props 是否都用 `useMemo` 包裹或来自稳定引用（不能是每次渲染新建的字面量）；
  - 否则 `memo` 很可能无法发挥预期效果。

## 四、state 设计

- 强关联状态应合并维护，例如分页 `{ page, pageSize }`、弹窗 `{ open, target }`、请求 `{ loading, error }`。
- 合并维护的对象状态如果只需要浅合并局部字段，优先使用项目内 `useSetState`；更新逻辑依赖旧值时使用函数补丁，例如 `setState((prevState) => ({ page: prevState.page + 1 }))`。
- 独立变化且无业务耦合的状态可以分开 `useState`，不要为了“统一”塞进一个大对象。
- 避免矛盾状态，例如同时存在 `isOpen`、`isClosed`，或 `loading` 与 `status` 重复表达同一件事。
- 避免冗余状态；能从 props、已有 state 或缓存数据计算出来的值，不进入 state。
- 避免重复状态；同一实体不要同时保存完整对象和对象 ID，除非有明确缓存或快照需求。
- 多步骤流程、请求状态机、复杂弹窗状态、批量编辑状态等具有明确业务事件或状态机特征时，优先使用 `useReducer`，并用 action 表达业务事件；普通局部状态优先保持 `useState` 或项目内 `useSetState`，避免为了统一而过度使用 `useReducer`。
- 状态更新依赖旧值时必须使用函数式更新，例如 `setPage((page) => page + 1)`。
- 不要用 state 存储不会触发渲染的数据；这类值使用 `useRef`。
- `useRef` 用于保存跨渲染周期的可变值或 DOM 引用，不得作为绕过 React 数据流的全局状态；修改 `ref.current` 不会触发重新渲染，不应用于驱动页面 UI。
- state 初始值计算成本较高时，应使用懒初始化，例如 `useState(() => createInitialState())`，避免每次渲染重复执行初始化逻辑。

## 五、数据请求与业务 hooks

- 页面直接调用 API 只适合非常简单的一次性读取；存在加载、错误、刷新、删除、分页、筛选任一逻辑时，应抽业务 hook。
- 业务 hook 负责请求、响应判断、错误归一化、刷新函数和视图模型转换；页面组件负责组合 UI。
- hook 返回的刷新、删除、提交函数应使用 `useCallback`，避免子组件收到不稳定回调。
- 请求成功后是否重置分页、关闭弹窗、清空错误，必须由调用语义显式表达，不要隐藏在通用 `fetch` 函数中。
- 竞态敏感请求必须处理过期响应，避免慢请求覆盖新状态。
- API 契约变更必须同步对应契约文档，不能只改 hook 或页面。

## 六、事件处理与副作用边界

- 用户操作触发的流程放在 `handleXxx` 中，例如保存、删除、导入、确认、取消。
- `handleXxx` 内允许调用 API、Toast、Dialog.alert、导航和状态更新。
- `useEffect` 不负责“看到某个状态变成 true 后执行事件逻辑”；这通常说明事件和状态边界错了。
- Toast、Dialog.alert、文件下载、剪贴板、路由跳转等命令式操作不得在 render 中执行。
- 需要跨组件共享命令式能力时，优先封装为稳定 hook 或服务函数，而不是通过全局变量串联。

## 七、审查清单

### Hooks

- 是否存在 `useEffect(..., [])`，但 effect 内读取了 props、state 或组件内函数？
- 是否为了消除 lint 提示关闭了 `react-hooks/exhaustive-deps`？
- 是否存在一个 effect 同时处理多个互不相关的副作用？
- 是否存在异步 effect 未处理取消或过期响应？

### State

- 是否有多个 `useState` 实际表达同一个业务流程？
- 是否有可计算值被放进 state？
- 是否有 props → state 同步仅依赖 `useEffect`，实际上可以直接计算？
- 是否有不会触发渲染的数据被错误放进 state？
- 是否有 `ref.current` 被直接用于驱动 UI 渲染？
- 是否有高成本初始化逻辑没有使用 `useState(() => initialValue)`？

### 事件与副作用

- 是否有事件逻辑被塞进 effect？
- 是否有 API 调用散落在页面和多个子组件中？
- 是否有未处理清理函数的事件监听、定时器或订阅？
- 是否有 Toast、Dialog、导航、下载等命令式操作发生在 render 中？

### 性能优化

- 是否有刷新函数、提交函数传给子组件但引用不稳定？
- 是否有 `useCallback`、`useMemo` 或 `useEffect` 中引用了组件内 helper 函数，但既未放入依赖，也未移入内部、用 `useCallback` 稳定、或提取到组件外？
- 是否有组件加了 `memo`，但没有满足使用时机的任一条件，属于无收益甚至负收益的包裹？
- 是否有组件加了 `memo`，但父组件传入的函数或对象 props 未做引用稳定，导致 `memo` 实际无效？
- 是否有函数传给公共组件、跨包组件时因“当前未 memo”而省略了 `useCallback`？
- 是否存在为了“优化”而滥用 `useMemo`、`useCallback`，反而增加了代码复杂度？
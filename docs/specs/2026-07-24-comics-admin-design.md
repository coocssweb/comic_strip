# 管理端：漫画管理页面 设计方案

- **Issue**: [#57](https://github.com/coocssweb/comic_strip/issues/57)
- **日期**: 2026-07-24
- **状态**: 已确认

## 一、路由设计

```
/login              → 登录页（已有）
/                   → redirect to /comics
/comics             → ComicListPage
/comics/:id         → ComicEditPage
```

`AdminLayout` 包裹除 `/login` 外的所有路由，提供侧边栏 + 主内容区骨架。

```
AdminLayout
├── Sidebar
│   ├── 漫画管理（active，当前唯一菜单项）
│   ├── 标签管理（disabled 占位）
│   ├── 系列管理（disabled 占位）
│   └── 设置（disabled 占位）
└── <Outlet />
```

侧边栏 ~200px 定宽，后续菜单项置灰占位。角落保留管理员名称和登出入口。

## 二、漫画列表页 `/comics`

### 顶部

- 页面标题「漫画管理」
- 右上角「+ 新建漫画」按钮 → `POST /comics`（body: `{ title }`，默认填充「未命名漫画」）→ 跳转 `/comics/:id`

### 状态 Tab

`全部 | 草稿 | 已发布 | 已下架 | 已删除`

- 切换时：更新 URL `?status=draft`，分页重置到第 1 页
- 使用已有 `pill-filter` / `pill-filter-active` 样式
- 读取 URL query 恢复筛选状态

### 表格

| 封面 | 标题 | 连载 | 状态 | 更新时间 | 操作 |
|------|------|------|------|----------|------|
| 40px 缩略图 | 可点击跳编辑 | 连载名/- | 状态标签 | 相对时间 | 「编辑」按钮 |

- 无封面显示灰色占位图
- 状态标签：草稿=默认灰、已发布=绿色、已下架=橙色、已删除=红色半透明
- 已删除行整行降低不透明度
- 封面 key 过期时显示占位图 + 提示

### 分页

复用已有 `Pagination` 组件，页码同步到 URL `?page=2`。

### 空状态

当前筛选条件无数据：「暂无漫画」+ 新建引导按钮。

## 三、漫画编辑页 `/comics/:id`

### 顶部区域

左侧：返回箭头 +「← 返回列表」  
中部：漫画标题  
右侧：当前状态标签 + 操作按钮

```
← 返回列表    漫画标题文字    草稿 ◉  [发布] [删除]
```

### 状态操作按钮（按当前状态动态显示）

| 当前状态 | 可用操作 |
|----------|----------|
| 草稿 | 发布、删除 |
| 已发布 | 下架 |
| 已下架 | 发布、删除 |
| 已删除 | 恢复 |

操作前弹确认框，成功后 Toast 提示，标记列表缓存失效。

### 左侧表单

```
┌─────────────────────┐
│ 标题   [_________]  │
│ 连载   [选择 ▼   ]  │
│ 标签   [输入...  ]  │
│        标签A ✕      │
└─────────────────────┘
```

- 标题：必填，1-100 字，`FocusInput`
- 连载：`FormSelect`，下拉列表从 `GET /series` 获取，可搜索
- 标签：输入 + 回车添加，已有标签 pill + ✕ 删除

### 右侧封面上传

```
┌──────────────┐
│              │
│   [封面]     │
│   预览区     │
│              │
│  点击替换    │
└──────────────┘
```

- 无封面：上传虚线框 +「点击上传封面」
- 有封面：显示缩略图 +「点击替换」
- 上传流程：选文件 → `POST /comics/:id/images/sts` → 直传 COS → 预览
- 仅 `image/jpeg` `image/png` `image/webp`，最大 5 MB
- 上传中显示 loading，失败 Toast 提示

### 底部正文图片区

```
┌──────────────────────────────────────┐
│ 正文图片                             │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│ │  1   │ │  2   │ │  3   │ │  +   ││
│ │  ☰   │ │  ☰   │ │  ☰   │ │上传  ││
│ └──────┘ └──────┘ └──────┘ └──────┘│
│           拖拽调整顺序               │
└──────────────────────────────────────┘
```

- 网格排列，每格缩略图 + 拖拽手柄，最后一格为上传入口
- 支持多文件选择，逐个上传
- 上传流程同封面：STS → 直传 COS → 预览
- 拖拽排序使用 HTML5 Drag and Drop API
- 保存时通过 `PUT /comics/:id/images` 绑定最终顺序

### 底部

```
[保存修改]                    ← 返回列表
```

「保存修改」调用 `PUT /comics/:id`（元信息）后，如有图片变更则调用 `PUT /comics/:id/images`。

### 未保存离开确认

表单有未保存改动时，侧边栏切换、浏览器后退/关闭触发 `beforeunload` + 路由守卫，弹出确认框。

## 四、状态管理

| 状态 | 存放位置 | 原因 |
|------|----------|------|
| 管理员认证 | Redux `authSlice`（已有） | 跨页面共享，核心业务 |
| 列表筛选 + 分页 | URL Query（`?status=draft&page=2`） | 可分享链接，刷新恢复 |
| 漫画列表数据 | RTK Query endpoint | 服务端数据，需缓存/去重/刷新 |
| 漫画详情 | RTK Query endpoint | 服务端数据 |
| 连载列表 | RTK Query endpoint | 服务端数据，跨页面复用 |
| 编辑表单草稿 | Page `useState` + `useReducer` | 页面独占，未提交 |
| 弹窗/确认框/Dialog | Page State | 纯 UI 临时 |

## 五、API 层

### 新增 API 类

**`ComicsAPI`** (`src/api/comics.js`)：

| 方法 | HTTP | 路径 |
|------|------|------|
| `list(params)` | GET | `/comics?status&page&pageSize` |
| `getById(id)` | GET | `/comics/:id` |
| `create(data)` | POST | `/comics` |
| `update(id, data)` | PUT | `/comics/:id` |
| `publish(id)` | POST | `/comics/:id/publish` |
| `unpublish(id)` | POST | `/comics/:id/unpublish` |
| `remove(id)` | DELETE | `/comics/:id` |
| `restore(id)` | POST | `/comics/:id/restore` |

**`ImageAPI`** (`src/api/image.js`)：

| 方法 | HTTP | 路径 |
|------|------|------|
| `requestSts(comicId, params)` | POST | `/comics/:comicId/images/sts` |
| `bindImages(comicId, data)` | PUT | `/comics/:comicId/images` |

### 请求/响应结构

列表请求：`GET /comics?status=draft&page=1&pageSize=20`
列表响应：`{ items: Comic[], total: number, page: number, pageSize: number }`

创建请求：`POST /comics` body: `{ title, seriesId?, tags?: string[] }`
创建响应：`Comic` 对象（201）

更新请求：`PUT /comics/:id` body: `{ title?, seriesId?, tags? }`（至少一个字段）
更新响应：`Comic` 对象

删除：`DELETE /comics/:id` → 204

图片绑定：`PUT /comics/:id/images` body: `{ cover?: string, bodyImages?: string[] }`
STS：`POST /comics/:id/images/sts` body: `{ fileName, contentType, contentLength }`

Comic 对象结构：
```json
{
  "_id": "string (UUID)",
  "title": "string",
  "seriesId": "string | null",
  "status": "draft | published | unpublished | deleted",
  "cover": "string | null (COS key)",
  "bodyImages": ["string (COS key)"],
  "tags": ["string"],
  "likeCount": 0,
  "favoriteCount": 0,
  "commentCount": 0,
  "publishedAt": "ISO date | null",
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

### 续写补齐

连载列表：`GET /series` → `{ items: Series[] }`（后续 Issue 实现，当前用占位 API 类）

## 六、组件树

```
src/
├── api/
│   ├── index.js           (+ comicsAPI, imageAPI 导出)
│   ├── comics.js          (新增: ComicsAPI)
│   └── image.js           (新增: ImageAPI)
├── layouts/
│   └── AdminLayout.jsx    (新增: Sidebar + Outlet)
├── pages/
│   ├── ComicListPage.jsx  (新增)
│   └── ComicEditPage.jsx  (新增)
├── hooks/
│   └── useComicForm.js    (新增: 表单状态 + 脏检测)
├── store/
│   └── api/
│       └── comicsApi.js   (新增: RTK Query endpoints)
└── components/
    ├── ComicStatusBadge.jsx  (新增: 状态标签)
    └── ImageUploader.jsx     (新增: 封面上传 + 多图上传)
```

## 七、API 契约同步

`admin-web-api.md` 当前为旧的 episode/series/tags 结构，需同步更新 comics 端点（本次一并完成）。


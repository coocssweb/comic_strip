---
name: admin-web-pagination
description: Use when 在 admin-web 中新增、复用、重构或排查分页条、页码切换、列表分页、筛选后重置页码、Pagination 组件相关交互
---

# admin-web Pagination

## 概览

`admin-web/src/components/Pagination.jsx` 是后台通用的分页条组件，基于 shadcn Pagination 原语（底层使用圆角按钮）封装。

与前台简单的分页条相比，管理后台的 `Pagination` 整合了：
1. **数据详情统计**（显示 “显示 1-10 / 100” 数据区间与总量）。
2. **每页条数选择器**（集成 `FormSelect`，提供 `limit` 快速切换）。
3. **双参数回调**（支持更新页码与每页条数）。

列表页面只要涉及分页逻辑，必须优先复用本组件。

## 关键特色与差异

1. **双参数回调**：
   - 切换页码或条数时，触发的 `onChange` 回调参数为 `(nextPage, nextLimit)`。
2. **重置第一页**：
   - 当用户修改每页条数时，组件会**自动重置当前页码为第 1 页**并触发 `onChange(1, newLimit)`。业务层无需在每页条数变化时单独调用逻辑。
3. **单页不隐藏**：
   - 前台为了美观，在 `totalPages <= 1` 时会隐藏分页。但在管理端，即使只有 1 页数据，为了支持切换 limit 以及展示总数，**Pagination 依然会渲染**。只有在没有数据（`total === 0`）时，组件才会渲染 `null`。
4. **切页自动回顶**：
   - 切换页码后，组件内会自动调用 `window.scrollTo({ top: 0, behavior: 'smooth' })` 平滑回滚到页面顶部。

## Props 契约

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `page` | `number` (必填) | — | 当前页码，**使用 1 起始**，请勿使用 0 起始 |
| `limit` | `number` (必填) | — | 每页显示条数 |
| `total` | `number` (必填) | — | 数据总量。`total === 0` 时组件返回 `null` |
| `totalPages` | `number` (必填) | — | 总页数，通常在外部由 `Math.ceil(total / limit)` 计算得出 |
| `onChange` | `func` (必填) | — | 页码或条数变化时的回调函数，格式为 `(nextPage, nextLimit) => {}` |
| `limitOptions`| `array` | `[10, 20, 50, 100]`| 每页条数选项列表 |

## 调用模板（对接后端接口）

```jsx
import React, { useState, useEffect } from 'react';
import Pagination from '@/components/Pagination';

const ListPage = () => {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ page: 1, limit: 10, search: '' });

  // 当搜索条件发生变化时，应重置页码为 1
  const handleSearchChange = (val) => {
    setFilters((prev) => ({ ...prev, search: val, page: 1 }));
  };

  const handlePaginationChange = (nextPage, nextLimit) => {
    setFilters((prev) => ({ ...prev, page: nextPage, limit: nextLimit }));
  };

  useEffect(() => {
    // 调接口拉取数据
    api.fetchList(filters).then(res => {
      setData(res.list);
      setTotal(res.total);
    });
  }, [filters]);

  return (
    <div>
      {/* 列表渲染 */}
      
      <Pagination
        page={filters.page}
        limit={filters.limit}
        total={total}
        totalPages={Math.ceil(total / filters.limit)}
        onChange={handlePaginationChange}
      />
    </div>
  );
};
```

## 常见错误

| 错误 | 修正 |
| --- | --- |
| 页码使用 0 起始 | 改为 1 起始。接口请求和切片换算自行处理 `(page - 1) * limit` |
| `onChange` 只接收了一个参数 `page` | `onChange` 接收两个参数 `(page, limit)`，必须正确处理 `limit` 并在 filters 状态中同步更新，否则每页条数切换会失效或造成混乱 |
| 筛选搜索条件变化后，停留在高页码导致空数据 | 筛选/搜索框的输入导致 filters 变化时，必须通过代码显示将 `page` 重置为 `1` |
| 外部自己手写 `Math.ceil(total / limit)` 传错了值 | 确保 `limit` 传值正确，如果后端接口没返回总页数，务必在外部通过除法算好传给 `totalPages` |

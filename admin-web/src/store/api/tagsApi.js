import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * 标签管理 RTK Query API slice
 * 标签驱动自动缓存失效，覆盖列表、CRUD 和状态管理操作
 */
export const tagsApi = createApi({
  reducerPath: 'tagsApi',
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.APP_API_BASE_URL,
    credentials: 'include',
  }),
  tagTypes: ['TagList', 'TagDetail'],
  endpoints: (builder) => ({
    // 查询标签列表（分页 + 状态/推荐筛选）
    getTagsList: builder.query({
      query: ({ status, isRecommended, page = 1, pageSize = 20 } = {}) => {
        const params = { page, pageSize };
        if (status) params.status = status;
        if (isRecommended !== undefined) params.isRecommended = isRecommended;
        return { url: '/admin/tags', params };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.items.map(({ _id }) => ({ type: 'TagDetail', id: _id })),
              { type: 'TagList', id: 'LIST' },
            ]
          : [{ type: 'TagList', id: 'LIST' }],
    }),

    // 查询单个标签
    getTagById: builder.query({
      query: (id) => `/admin/tags/${id}`,
      providesTags: (result, error, id) => [{ type: 'TagDetail', id }],
    }),

    // 创建标签
    createTag: builder.mutation({
      query: (payload) => ({
        url: '/admin/tags',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [{ type: 'TagList', id: 'LIST' }],
    }),

    // 更新标签（名称、排序、状态、推荐）
    updateTag: builder.mutation({
      query: ({ id, ...payload }) => ({
        url: `/admin/tags/${id}`,
        method: 'PATCH',
        body: payload,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'TagList', id: 'LIST' },
        { type: 'TagDetail', id },
      ],
    }),

    // 软删除标签
    deleteTag: builder.mutation({
      query: (id) => ({
        url: `/admin/tags/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'TagList', id: 'LIST' },
        { type: 'TagDetail', id },
      ],
    }),

    // 恢复已删除标签
    restoreTag: builder.mutation({
      query: (id) => ({
        url: `/admin/tags/${id}/restore`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'TagList', id: 'LIST' },
        { type: 'TagDetail', id },
      ],
    }),
  }),
});

export const {
  useGetTagsListQuery,
  useGetTagByIdQuery,
  useCreateTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
  useRestoreTagMutation,
} = tagsApi;

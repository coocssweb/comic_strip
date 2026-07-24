import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * 漫画管理 RTK Query API slice
 * 标签驱动自动缓存失效，覆盖列表、详情、CRUD 和生命周期操作
 */
export const comicsApi = createApi({
  reducerPath: 'comicsApi',
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.APP_API_BASE_URL,
    credentials: 'include',
  }),
  tagTypes: ['ComicsList', 'ComicDetail'],
  endpoints: (builder) => ({
    // 查询漫画列表（分页 + 筛选）
    getComicsList: builder.query({
      query: ({ status, page = 1, pageSize = 20 } = {}) => {
        const params = { page, pageSize };
        if (status) params.status = status;
        return { url: '/api/v1/comics', params };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ _id }) => ({ type: 'ComicDetail', id: _id })),
              { type: 'ComicsList', id: 'LIST' },
            ]
          : [{ type: 'ComicsList', id: 'LIST' }],
    }),

    // 查询单本漫画
    getComicById: builder.query({
      query: (id) => `/api/v1/comics/${id}`,
      providesTags: (result, error, id) => [{ type: 'ComicDetail', id }],
    }),

    // 创建漫画草稿
    createComic: builder.mutation({
      query: (payload) => ({
        url: '/api/v1/comics',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [{ type: 'ComicsList', id: 'LIST' }],
    }),

    // 更新漫画元信息
    updateComic: builder.mutation({
      query: ({ id, ...payload }) => ({
        url: `/api/v1/comics/${id}`,
        method: 'PUT',
        body: payload,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'ComicsList', id: 'LIST' },
        { type: 'ComicDetail', id },
      ],
    }),

    // 发布漫画
    publishComic: builder.mutation({
      query: (id) => ({
        url: `/api/v1/comics/${id}/publish`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'ComicsList', id: 'LIST' },
        { type: 'ComicDetail', id },
      ],
    }),

    // 下架漫画
    unpublishComic: builder.mutation({
      query: (id) => ({
        url: `/api/v1/comics/${id}/unpublish`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'ComicsList', id: 'LIST' },
        { type: 'ComicDetail', id },
      ],
    }),

    // 软删除漫画
    deleteComic: builder.mutation({
      query: (id) => ({
        url: `/api/v1/comics/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'ComicsList', id: 'LIST' },
        { type: 'ComicDetail', id },
      ],
    }),

    // 恢复已删除漫画
    restoreComic: builder.mutation({
      query: (id) => ({
        url: `/api/v1/comics/${id}/restore`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'ComicsList', id: 'LIST' },
        { type: 'ComicDetail', id },
      ],
    }),
  }),
});

export const {
  useGetComicsListQuery,
  useGetComicByIdQuery,
  useCreateComicMutation,
  useUpdateComicMutation,
  usePublishComicMutation,
  useUnpublishComicMutation,
  useDeleteComicMutation,
  useRestoreComicMutation,
} = comicsApi;

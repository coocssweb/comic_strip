import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * 连载管理 RTK Query API slice
 * 标签驱动自动缓存失效，覆盖列表、详情、CRUD 和生命周期操作
 */
export const seriesApi = createApi({
  reducerPath: 'seriesApi',
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.APP_API_BASE_URL,
    credentials: 'include',
  }),
  tagTypes: ['SeriesList', 'SeriesDetail'],
  endpoints: (builder) => ({
    // 查询连载列表（分页 + 状态筛选）
    getSeriesList: builder.query({
      query: ({ status, page = 1, pageSize = 20 } = {}) => {
        const params = { page, pageSize };
        if (status) params.status = status;
        return { url: '/api/v1/series', params };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ _id }) => ({ type: 'SeriesDetail', id: _id })),
              { type: 'SeriesList', id: 'LIST' },
            ]
          : [{ type: 'SeriesList', id: 'LIST' }],
    }),

    // 查询单本连载（含成员漫画展开）
    getSeriesById: builder.query({
      query: (id) => `/api/v1/series/${id}`,
      providesTags: (result, error, id) => [{ type: 'SeriesDetail', id }],
    }),

    // 创建连载草稿
    createSeries: builder.mutation({
      query: (payload) => ({
        url: '/api/v1/series',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [{ type: 'SeriesList', id: 'LIST' }],
    }),

    // 更新连载元信息（标题、完结状态、成员漫画全量替换）
    updateSeries: builder.mutation({
      query: ({ id, ...payload }) => ({
        url: `/api/v1/series/${id}`,
        method: 'PUT',
        body: payload,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'SeriesList', id: 'LIST' },
        { type: 'SeriesDetail', id },
      ],
    }),

    // 发布连载
    publishSeries: builder.mutation({
      query: (id) => ({
        url: `/api/v1/series/${id}/publish`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'SeriesList', id: 'LIST' },
        { type: 'SeriesDetail', id },
      ],
    }),

    // 下架连载
    unpublishSeries: builder.mutation({
      query: (id) => ({
        url: `/api/v1/series/${id}/unpublish`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'SeriesList', id: 'LIST' },
        { type: 'SeriesDetail', id },
      ],
    }),

    // 软删除连载
    deleteSeries: builder.mutation({
      query: (id) => ({
        url: `/api/v1/series/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'SeriesList', id: 'LIST' },
        { type: 'SeriesDetail', id },
      ],
    }),

    // 恢复已删除连载
    restoreSeries: builder.mutation({
      query: (id) => ({
        url: `/api/v1/series/${id}/restore`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'SeriesList', id: 'LIST' },
        { type: 'SeriesDetail', id },
      ],
    }),
  }),
});

export const {
  useGetSeriesListQuery,
  useGetSeriesByIdQuery,
  useCreateSeriesMutation,
  useUpdateSeriesMutation,
  usePublishSeriesMutation,
  useUnpublishSeriesMutation,
  useDeleteSeriesMutation,
  useRestoreSeriesMutation,
} = seriesApi;

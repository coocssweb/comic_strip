import { configureStore } from '@reduxjs/toolkit';
import { comicsApi } from './api/comicsApi';
import { seriesApi } from './api/seriesApi';
import { tagsApi } from './api/tagsApi';
import authReducer from './slices/authSlice';

export function createStore(preloadedState) {
  return configureStore({
    reducer: {
      auth: authReducer,
      [comicsApi.reducerPath]: comicsApi.reducer,
      [seriesApi.reducerPath]: seriesApi.reducer,
      [tagsApi.reducerPath]: tagsApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(comicsApi.middleware, seriesApi.middleware, tagsApi.middleware),
    preloadedState,
  });
}

export const store = createStore();

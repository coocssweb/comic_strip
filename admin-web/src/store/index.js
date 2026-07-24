import { configureStore } from '@reduxjs/toolkit';
import { comicsApi } from './api/comicsApi';
import { seriesApi } from './api/seriesApi';
import authReducer from './slices/authSlice';

export function createStore(preloadedState) {
  return configureStore({
    reducer: {
      auth: authReducer,
      [comicsApi.reducerPath]: comicsApi.reducer,
      [seriesApi.reducerPath]: seriesApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(comicsApi.middleware, seriesApi.middleware),
    preloadedState,
  });
}

export const store = createStore();

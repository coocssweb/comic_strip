import { configureStore } from '@reduxjs/toolkit';
import { comicsApi } from './api/comicsApi';
import authReducer from './slices/authSlice';

export function createStore(preloadedState) {
  return configureStore({
    reducer: {
      auth: authReducer,
      [comicsApi.reducerPath]: comicsApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(comicsApi.middleware),
    preloadedState,
  });
}

export const store = createStore();
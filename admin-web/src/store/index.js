import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';

export function createStore(preloadedState) {
  return configureStore({
    reducer: {
      auth: authReducer,
    },
    preloadedState,
  });
}

export const store = createStore();

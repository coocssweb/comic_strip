import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  status: 'bootstrapping',
  admin: null,
  idleExpiresAt: null,
  absoluteExpiresAt: null,
  serverTime: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setBootstrapping(state) {
      state.status = 'bootstrapping';
    },
    setAuthenticated(state, action) {
      const { admin, session, serverTime } = action.payload;
      state.status = 'authenticated';
      state.admin = admin ? { id: admin.id, username: admin.username } : null;
      state.idleExpiresAt = session?.idleExpiresAt || null;
      state.absoluteExpiresAt = session?.absoluteExpiresAt || null;
      state.serverTime = serverTime || null;
    },
    setUnauthenticated(state) {
      state.status = 'unauthenticated';
      state.admin = null;
      state.idleExpiresAt = null;
      state.absoluteExpiresAt = null;
      state.serverTime = null;
    },
    setUnavailable(state) {
      state.status = 'unavailable';
    },
  },
});

export const {
  setBootstrapping,
  setAuthenticated,
  setUnauthenticated,
  setUnavailable,
} = authSlice.actions;

export default authSlice.reducer;

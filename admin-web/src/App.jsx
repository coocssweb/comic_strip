import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import ProtectedLayout from './layouts/ProtectedLayout';
import Home from './pages/Home';
import Login from './pages/Login';
import { store as defaultStore } from './store';

export default function App({ store = defaultStore }) {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Home />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}

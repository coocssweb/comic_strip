import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter, Routes } from 'react-router-dom';


import { store as defaultStore } from './store';

export default function App({ store = defaultStore }) {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Routes>

        </Routes>
      </BrowserRouter>
    </Provider>
  );
}

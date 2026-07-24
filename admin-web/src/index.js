import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './styles.css';
import App from './App';

const router = createBrowserRouter([
  { path: "/*", element: <App /> },
]);

createRoot(document.getElementById("root")).render(
  <RouterProvider router={router} />
);
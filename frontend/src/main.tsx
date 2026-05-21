import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import './index.css';
import { AsOfProvider } from './lib/asOfContext';
import Dashboard from './pages/Dashboard';
import StudentProfile from './pages/StudentProfile';

const router = createBrowserRouter([
  { path: '/', element: <Dashboard /> },
  { path: '/students/:id', element: <StudentProfile /> },
  { path: '*', element: <Dashboard /> },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AsOfProvider>
      <RouterProvider router={router} />
      <Toaster richColors closeButton position="top-right" />
    </AsOfProvider>
  </React.StrictMode>,
);

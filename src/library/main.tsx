import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import './library.css';
import '../styles/themes/contact.css';
import '../styles/themes/covers.css';
import { Library } from './Library';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Library />
  </StrictMode>,
);

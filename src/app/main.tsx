import { render } from 'preact';
import { App } from './App';
import '../style.css';
import { meldeServiceWorkerAn } from '../offline/registrieren';
import './app.css';

render(<App />, document.getElementById('app')!);

meldeServiceWorkerAn();

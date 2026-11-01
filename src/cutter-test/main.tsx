import { render } from 'preact';
import { CutterTest } from './CutterTest';
import '../style.css';
import { meldeServiceWorkerAn } from '../offline/registrieren';

render(<CutterTest />, document.getElementById('app')!);

meldeServiceWorkerAn();

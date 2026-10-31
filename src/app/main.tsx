import { render } from 'preact';
import { App } from './App';
import '../style.css';
import './app.css';

render(<App />, document.getElementById('app')!);

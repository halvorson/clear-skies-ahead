import './styles.css';
import { App } from './ui/App';

const container = document.getElementById('app');
if (!container) throw new Error('#app element not found');

new App(container);

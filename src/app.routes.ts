import { Routes } from '@angular/router';
import { TerminalComponent } from './components/terminal/terminal.component';

export const APP_ROUTES: Routes = [
  { path: '', component: TerminalComponent, title: 'Puneet Goyal | Portfolio' },
  { path: '**', redirectTo: '', pathMatch: 'full' }
];
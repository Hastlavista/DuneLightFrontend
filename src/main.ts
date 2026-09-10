import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { applyCachedBrandingOnBoot } from './app/core/services/branding-bootstrap.util';

applyCachedBrandingOnBoot();
bootstrapApplication(App, appConfig).catch((err) => console.error(err));

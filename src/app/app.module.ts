import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';

import { AppComponent } from './app.component';
import { HeaderComponent } from './header/header.component';
import { IndexComponent } from './pages/index/index.component';
import { AdminComponent } from './pages/admin/admin.component';
import { BorrowComponent } from './pages/borrow/borrow.component';
import { GovernanceComponent } from './pages/governance/governance.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CookieService } from 'ngx-cookie-service';

const appRoutes: Routes = [
  { path: '', component: IndexComponent },
  { path: 'admin', component: AdminComponent },
  { path: 'borrow', component: BorrowComponent },
  { path: 'governance', component: GovernanceComponent },
  { path: '**', redirectTo: '' },
];

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    IndexComponent,
    AdminComponent,
    BorrowComponent,
    GovernanceComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    MatSlideToggleModule,
    MatIconModule,
    HttpClientModule,
    FormsModule,
    RouterModule.forRoot(appRoutes)
  ],
  providers: [CookieService],
  bootstrap: [AppComponent]
})
export class AppModule { }

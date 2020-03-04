import { Component, OnInit, AfterViewInit } from '@angular/core';
declare var $: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit, AfterViewInit {
  title = 'Konkrete';

  public collateralEnable = false;
  public typeViewStrategy = 'withdraw';

  ngOnInit() {

  }
  ngAfterViewInit() {
    this.chart();
  }

  openStrategiesModal() {
    $('#strategiesModal').modal('show');
  }

  enableCollateral() {
    this.collateralEnable = true;
  }

  viewWithdrawForm() {
    this.typeViewStrategy = 'withdraw';
  }

  viewSupplyForm() {
    this.typeViewStrategy = 'supply';
  }

  chart() {

  }

}

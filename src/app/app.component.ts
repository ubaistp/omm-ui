import { Component, OnInit, AfterViewInit } from '@angular/core';
import Chart from 'chart.js';
declare var $: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit, AfterViewInit {
  title = 'Konkrete';

  public supplyAPY;
  public collateralEnable = false;
  public typeViewStrategy = 'withdraw';
  public canvas: any;
  public ctx: any;
  public chartData = {
    "dataSet": Array.from({ length: 7 }, () => Math.floor(Math.random() * 50) + 10),
    "label": [1578392733000, 1578306333000, 1578219933000, 1578133533000, 1578047133000, 1577960733000, 1577874333000],
  };
  public chartOptions = {
    legend: {
      display: false
    },
    title: {
      display: false
    },
    tooltips: {
      mode: 'index',
      intersect: false,
      callbacks: {
        label: function (tooltipItem, data) {
          this.supplyAPY = data['datasets'][0]['data'][tooltipItem['index']];
          // return data['datasets'][0]['label'] + ' ' + this.supplyAPY + '%';
        }.bind(this),
      },
      backgroundColor: '#FFF',
      titleFontSize: 14,
      titleFontColor: '#000',
      bodyFontColor: '#1cb3a3',
      bodyFontSize: 14,
      displayColors: false
    },
    hover: {
      mode: 'nearest',
      intersect: true
    },
    scales: {
      xAxes: [{
        ticks: {
          display: false
        },
        type: 'time',
        time: {
          unit: 'day',
          parser: 'timeFormat',
          tooltipFormat: 'DD MMM YYYY',
        },
        gridLines: {
          display: false
        }
      }],
      yAxes: [{
        ticks: {
          display: false
        },
        gridLines: {
          display: false
        }
      }]
    },
    elements: {
      point: {
        radius: 0
      }
    }
  }

  ngOnInit() {
    this.supplyAPY = this.chartData.dataSet[0];
  }
  ngAfterViewInit() {

    $('#strategies').select2({
      data: [{"id":"1","text":"cDAI","apy":"50"},{"id":"1","text":"IVTDemo","apy":"20"}],
      dropdownCssClass: 'bigdrop',
      minimumResultsForSearch: Infinity,
      templateResult: this.formatCountrySelection,
      dropdownParent: $('#strategiesGroup')
    });
    $('.select2-main').one('select2:open', function (e) {
      $('input.select2-search__field').prop('placeholder', 'Search');
    });

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
    this.canvas = document.getElementById('myChart');
    this.ctx = this.canvas.getContext('2d');
    let myChart = new Chart(this.ctx, {
      type: 'line',
      data: {
        labels: this.chartData.label,
        datasets: [{
          label: 'Supply APY',
          data: this.chartData.dataSet,
          backgroundColor: 'rgb(28, 179, 163)',
          borderColor: 'rgb(28, 179, 163)',
          borderWidth: 2,
          fill: false,
          lineTension: 0,
        }]
      },
      options: this.chartOptions
    });
  }

  formatCountrySelection(strategies) {
    if (!strategies.id) {
      return strategies.text;
    }
    var $strategies = $(
      '<span>' + strategies.text + '<i>' + strategies.apy + '%</i></span>'
    );
    return $strategies;
  }

}

import { Component, OnInit, AfterViewInit } from '@angular/core';
import Chart from 'chart.js';
import { ethers } from 'ethers';
import { getAddress } from 'ethers/utils';
import { blockchainConstants } from '../environments/blockchain-constants';
declare var $: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit, AfterViewInit {
  title = 'Konkrete';

  private ethereum: any;
  private web3: any;
  public provider: any;
  public supplyAPY;
  public collateralSupplyEnable = false;
  public collateralBorrowEnable = false;
  public typeViewSupply = 'withdraw';
  public typeViewBorrow = 'repay';
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
    this.initializeMetaMask();
    this.supplyAPY = this.chartData.dataSet[0];
  }
  ngAfterViewInit() {

    $('#supply').select2({
      data: [{"id":"1","text":"cDAI","apy":"50"},{"id":"1","text":"IVTDemo","apy":"20"}],
      dropdownCssClass: 'bigdrop',
      minimumResultsForSearch: Infinity,
      templateResult: this.formatCountrySelection,
      dropdownParent: $('#supplyGroup')
    });
    $('#borrow').select2({
      data: [{"id":"1","text":"cDAI","apy":"50"},{"id":"1","text":"IVTDemo","apy":"20"}],
      dropdownCssClass: 'bigdrop',
      minimumResultsForSearch: Infinity,
      templateResult: this.formatCountrySelection,
      dropdownParent: $('#borrowGroup')
    });
    $('.select2-main').one('select2:open', function (e) {
      $('input.select2-search__field').prop('placeholder', 'Search');
    });

    this.supplyChart();
    this.borrowChart();
  }

  public async initializeMetaMask() {
    this.ethereum = window['ethereum'];
    await this.ethereum.enable();
    this.web3 = new ethers.providers.Web3Provider(this.ethereum);
    this.setup();
  }

  public async setup() {
    const contractAddresses = await this.getContractAddresses();
    console.log(contractAddresses);
  }
  private async getContractAddresses() {
    let contractAddresses = {};
    const network = await this.web3.getNetwork();
    if (network.name === 'homestead') {
      contractAddresses = blockchainConstants.mainnet;
    } else {
      contractAddresses = blockchainConstants[network.name];
    }
    return contractAddresses;
  }


  openSupplyModal() {
    $('#supplyModal').modal('show');
  }
  openBorrowModal() {
    $('#borrowModal').modal('show');
  }

  enableSupplyCollateral() {
    this.collateralSupplyEnable = true;
  }
  enableBorrowCollateral() {
    this.collateralBorrowEnable = true;
  }

  viewWithdrawForm() {
    this.typeViewSupply = 'withdraw';
  }

  viewSupplyForm() {
    this.typeViewSupply = 'supply';
  }

  viewRepayForm() {
    this.typeViewBorrow = 'repay';
  }

  viewBorrowForm() {
    this.typeViewBorrow = 'borrow';
  }

  supplyChart() {
    this.canvas = document.getElementById('supplyChart');
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
  borrowChart() {
    this.canvas = document.getElementById('borrowChart');
    this.ctx = this.canvas.getContext('2d');
    let myChart = new Chart(this.ctx, {
      type: 'line',
      data: {
        labels: this.chartData.label,
        datasets: [{
          label: 'Supply APY',
          data: this.chartData.dataSet,
          backgroundColor: 'rgb(217, 84, 108)',
          borderColor: 'rgb(217, 84, 108)',
          borderWidth: 2,
          fill: false,
          lineTension: 0,
        }]
      },
      options: this.chartOptions
    });
  }

  formatCountrySelection(supply) {
    if (!supply.id) {
      return supply.text;
    }
    var $supply = $(
      '<span>' + supply.text + '<i>' + supply.apy + '%</i></span>'
    );
    return $supply;
  }

}

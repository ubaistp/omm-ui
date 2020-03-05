import { Component, OnInit, AfterViewInit } from '@angular/core';
import Chart from 'chart.js';
import { ethers } from 'ethers';
import { getAddress } from 'ethers/utils';
import { blockchainConstants } from '../environments/blockchain-constants';
import * as Comptroller from '../assets/contracts/Comptroller.json';
import * as PriceOracleProxy from '../assets/contracts/PriceOracleProxy.json';
import * as CErc20Delegator from '../assets/contracts/CErc20Delegator.json';
import * as CErc20 from '../assets/contracts/CErc20.json';
import * as DAIInterestRateModel from '../assets/contracts/DAIInterestRateModel.json';
import * as WhitePaperInterestRateModel from '../assets/contracts/WhitePaperInterestRateModel.json';

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
  public userAddress: any;
  public Contracts: any;
  public contractAddresses: any;
  public BLOCKS_YEAR = 2102400;
  public tokenData: any;
  // public cTokenData: any;
  public supplyAPY;
  public collateralSupplyEnable = false;
  public collateralBorrowEnable = false;
  public typeViewSupply = 'withdraw';
  public typeViewBorrow = 'repay';
  public canvas: any;
  public ctx: any;
  public chartData = {
    dataSet: Array.from({ length: 7 }, () => Math.floor(Math.random() * 50) + 10),
    label: [1578392733000, 1578306333000, 1578219933000, 1578133533000, 1578047133000, 1577960733000, 1577874333000],
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
  };

  constructor() {
    this.tokenData = [{id: '1', text: 'DAI', apy: '50'}, {id: '1', text: 'IVTDemo', apy: '20'}];
    this.initializeMetaMask();
  }

  ngOnInit() {
    // this.initializeMetaMask();
    this.supplyAPY = this.chartData.dataSet[0];
  }
  ngAfterViewInit() {

    $('#supply').select2({
      data: this.tokenData,
      dropdownCssClass: 'bigdrop',
      minimumResultsForSearch: Infinity,
      templateResult: this.formatCountrySelection,
      dropdownParent: $('#supplyGroup')
    });
    $('#borrow').select2({
      data: this.tokenData,
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
    // tslint:disable-next-line: no-string-literal
    this.ethereum = window['ethereum'];
    await this.ethereum.enable();
    this.web3 = new ethers.providers.Web3Provider(this.ethereum);
    this.setup();
  }

  public async setup() {
    this.userAddress = await this.web3.getSigner().getAddress();
    const contractAddresses = await this.getContractAddresses();
    this.initAllContracts(contractAddresses);
    this.tokenData.forEach(async (token) => {
      this.initToken(token);
      token.priceEth = await this.getPrice(token.cTokenAddress);
      token.collateralFactor = await this.getCollateralFactor(token.cTokenAddress);
      const apy = await this.getAPY(this.Contracts[`c${token.name}`]);
      token.borrowApy = apy[0];
      token.supplyApy = apy[1];
      token.utilizationRate = await this.getUtilizationRate(this.Contracts[`c${token.name}`]);
    });
    console.log(this.tokenData);
  }

  private async getContractAddresses() {
    let contractAddresses = {};
    this.contractAddresses = {};
    const network = await this.web3.getNetwork();
    if (network.name === 'homestead') {
      contractAddresses = blockchainConstants.mainnet;
    } else {
      contractAddresses = blockchainConstants[network.name];
    }
    this.contractAddresses = contractAddresses;
    return contractAddresses;
  }

  private initToken(token) {
    token.text === 'DAI' ? token.name = 'DAI' : token.name = 'IVTDemo';
    token.tokenAddress = this.contractAddresses[token.name];
    token.cTokenAddress = this.contractAddresses[`c${token.name}`];
    // if (token.text === 'DAI') {

    // } else {

    // }

  }
  private async initAllContracts(contractAddresses) {
    this.Contracts = {};
    this.Contracts.Comptroller = this.initContract(contractAddresses.Comptroller, Comptroller.abi);
    this.Contracts.PriceOracleProxy = this.initContract(contractAddresses.PriceOracleProxy, PriceOracleProxy.abi);
    this.Contracts.cDAI = this.initContract(contractAddresses.cDAI, CErc20Delegator.abi);
    this.Contracts.cIVTDemo = this.initContract(contractAddresses.cIVTDemo, CErc20.abi);

    // this.getAPY(this.Contracts.cDAI)
    // this.getUtilizationRate(this.Contracts.cDAI)
    console.log(this.Contracts);
  }

  private initContract(contractAddress, abi) {
    return new ethers.Contract(contractAddress, abi, this.web3.getSigner());
  }

  public async getPrice(cTokenAddress) {
    const price = await this.Contracts.PriceOracleProxy.getUnderlyingPrice(cTokenAddress);
    const priceStr = this.getNumber(price);
    return priceStr;
  }

  public async getCollateralFactor(cTokenAddress) {
    const markets = await this.Contracts.Comptroller.markets(cTokenAddress);
    const colFactorStr = this.getNumber(markets.collateralFactorMantissa);
    return colFactorStr;
  }

  public async getAPY(cTokenContract) {
    let borrowRate = await cTokenContract.borrowRatePerBlock();
    borrowRate = this.getNumber(borrowRate);
    let supplyRate = await cTokenContract.supplyRatePerBlock();
    supplyRate = this.getNumber(supplyRate);
    const borrowApy = this.BLOCKS_YEAR * parseFloat(borrowRate);
    const supplyApy = this.BLOCKS_YEAR * parseFloat(supplyRate);
    const divBy = 10 ** 16;
    const borrowApyPerc = borrowApy / divBy;
    const supplyApyPerc = supplyApy / divBy;
    // console.log(borrowApyPerc.toFixed(3), supplyApyPerc.toFixed(3));
    return [borrowApyPerc.toFixed(3), supplyApyPerc.toFixed(3)];
  }

  public async getUtilizationRate(cTokenContract) {
    // let interestRateModelAbi;
    // if (cTokenContract == this.Contracts.cDAI) {
    //   interestRateModelAbi = DAIInterestRateModel.abi;
    // } else {
    //   interestRateModelAbi = WhitePaperInterestRateModel.abi;
    // }
    // const intRateModelAddr = await cTokenContract.interestRateModel();
    // const interestRateContract = this.initContract(intRateModelAddr, interestRateModelAbi);
    const cash = await cTokenContract.getCash();
    const borrow = await cTokenContract.totalBorrows();
    const reserves = await cTokenContract.totalReserves();
    const utilizationRate = (parseFloat(borrow) * (10 ** 18)) / (parseFloat(cash) + parseFloat(borrow) - parseFloat(reserves));
    // console.log(utilizationRate)
    // let utilizationRate = await interestRateContract.utilizationRate(cash, borrow, reserves);
    // utilizationRate = this.getNumber(utilizationRate);
    // console.log(utilizationRate)
    return utilizationRate.toString();
  }

  public getNumber(hexNum) {
    return ethers.utils.bigNumberify(hexNum).toString();
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

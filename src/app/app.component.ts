import { Component, OnInit, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import Chart from 'chart.js';
import { ethers } from 'ethers';
import { getAddress, BigNumber } from 'ethers/utils';
import { blockchainConstants } from '../environments/blockchain-constants';
import * as Comptroller from '../assets/contracts/Comptroller.json';
import * as PriceOracleProxy from '../assets/contracts/PriceOracleProxy.json';
import * as CErc20Delegator from '../assets/contracts/CErc20Delegator.json';
import * as CErc20 from '../assets/contracts/CErc20.json';
import * as EIP20Interface from '../assets/contracts/EIP20Interface.json';
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
  public accountLiquidity: any;
  public selectedTokenIndex = 0;
  public ethUsdExchangeRate: any;
  public totalSupplyBalance = 0;
  public totalBorrowBalance = 0;
  public amountInput: any;
  public supplyAPY;
  public collateralSupplyEnable = false;
  public collateralBorrowEnable = false;
  public typeViewSupply = 'withdraw';
  public typeViewBorrow = 'repay';
  public canvas: any;
  public ctx: any;
  public supplyData=[];
  public borrowData=[];
  public dataObj={};
  public supplyTokenData=[];
  public borrowTokenData=[];
  public supplyBalance;
  public borrowBalance;
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

  constructor(private httpClient: HttpClient) {
    // this.getExchangeRate();
    this.tokenData = [
      {
        id: '0',
        text: 'DAI',
        apy: '50',
        enabled: false,
        approved: false
      },
      {
        id: '1',
        text: 'IVTDemo',
        apy: '20',
        enabled: false,
        approved: false
      }
    ];
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

  filterTable(){
    console.log(this.tokenData)
      this.supplyData = this.tokenData;
      this.borrowData = this.tokenData;
      this.supplyTokenData = this.tokenData;
      this.borrowTokenData = this.tokenData;
      this.supplyData = this.supplyData.filter(el=>el.cTokenSupplyBalance > 0)
      if(this.supplyData.length > 0){
        this.dataObj["showSupply"] = true;
      }
      this.borrowData = this.borrowData.filter(el=>el.tokenBorrowBalance > 0)
      if(this.borrowData.length > 0){
        this.dataObj["showBorrow"] = true;
      }
      this.supplyTokenData = this.supplyTokenData.filter(el=>el.cTokenSupplyBalance == 0 && el.tokenBorrowBalance == 0)
      if(this.supplyTokenData.length > 0){
        this.dataObj["showSupplyToken"] = true;
      }
      this.borrowTokenData = this.borrowTokenData.filter(el=>el.tokenBorrowBalance == 0 && el.cTokenSupplyBalance == 0)
      if(this.borrowTokenData.length > 0){
        this.dataObj["showBorrowToken"] = true;
      }
      this.tokenData.filter(el=>el["supplyBalance"] = (el.cTokenSupplyBalance * parseFloat(el.priceUsd)))
      this.supplyBalance = 0
      this.tokenData.filter(el => this.supplyBalance =this.supplyBalance + el.supplyBalance)
      this.tokenData.filter(el=>el["borrowBalance"] = (el.tokenBorrowBalance * parseFloat(el.priceUsd)))
      this.borrowBalance = 0
      this.tokenData.filter(el => this.borrowBalance =this.borrowBalance + el.borrowBalance)
      console.log(this.borrowBalance)
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
    await this.getExchangeRate();
    await this.tokenData.forEach(async (token) => {
      this.initToken(token);
    });
    await this.getEnteredMarkets();
    await this.getAccountLiquidity();
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

  private async initToken(token) {
    token.text === 'DAI' ? token.name = 'DAI' : token.name = 'IVTDemo';
    token.tokenAddress = this.contractAddresses[token.name];
    token.cTokenAddress = this.contractAddresses[`c${token.name}`];

    token.priceUsd = await this.getPrice(token.cTokenAddress);
    token.collateralFactor = await this.getCollateralFactor(token.cTokenAddress);
    const apy = await this.getAPY(this.Contracts[`c${token.name}`]);
    token.borrowApy = apy[0];
    token.supplyApy = apy[1];
    token.utilizationRate = await this.getUtilizationRate(this.Contracts[`c${token.name}`]);
    token.tokenBalance = parseFloat( await this.getUserTokenBalance(this.Contracts[token.name]) ) / 10 ** 18;
    token.cTokenSupplyBalance = parseFloat( await this.getUserSupplyBalance(this.Contracts[`c${token.name}`], token) ) / 10 ** 8;
    // token.priceUsd = this.getUsdPrice(ethers.utils.formatEther(token.priceEth));
    token.tokenBorrowBalance = parseFloat( await this.getUserBorrowBalance(this.Contracts[`c${token.name}`], token)) / 10 ** 18;
    token.approved = await this.checkApproved(this.Contracts[token.name], token.cTokenAddress);
    console.log(this.totalSupplyBalance , this.totalBorrowBalance );
    this.filterTable();
  }

  private async initAllContracts(contractAddresses) {
    this.Contracts = {};
    this.Contracts.Comptroller = this.initContract(contractAddresses.Comptroller, Comptroller.abi);
    this.Contracts.PriceOracleProxy = this.initContract(contractAddresses.PriceOracleProxy, PriceOracleProxy.abi);
    this.Contracts.cDAI = this.initContract(contractAddresses.cDAI, CErc20Delegator.abi);
    this.Contracts.cIVTDemo = this.initContract(contractAddresses.cIVTDemo, CErc20.abi);
    this.Contracts.DAI = this.initContract(contractAddresses.DAI, EIP20Interface.abi);
    this.Contracts.IVTDemo = this.initContract(contractAddresses.IVTDemo, EIP20Interface.abi);

    console.log(this.Contracts);
  }

  private initContract(contractAddress, abi) {
    return new ethers.Contract(contractAddress, abi, this.web3.getSigner());
  }

  public async getPrice(cTokenAddress) {
    let tokenPrice = await this.Contracts.PriceOracleProxy.getUnderlyingPrice(cTokenAddress);
    let daiPrice = await this.Contracts.PriceOracleProxy.getUnderlyingPrice(this.contractAddresses.cDAI);
    tokenPrice = this.getNumber(tokenPrice);
    daiPrice = this.getNumber(daiPrice);
    const price = parseFloat(tokenPrice) / parseFloat(daiPrice);
    const priceStr = price.toFixed(3);
    return priceStr;
  }

  public async getCollateralFactor(cTokenAddress) {
    const markets = await this.Contracts.Comptroller.markets(cTokenAddress);
    const colFactorStrTemp = this.getNumber(markets.collateralFactorMantissa);
    const divBy = 10 ** 16;
    const colFactorStr = parseFloat(colFactorStrTemp) / divBy;
    return colFactorStr.toFixed(2).toString();
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

  public async getUserTokenBalance(tokenContract) {
    let tokenBalance = await tokenContract.balanceOf(this.userAddress);
    tokenBalance = this.getNumber(tokenBalance);
    return tokenBalance;
  }
  public async getUserSupplyBalance(cTokenContract, token) {
    let tokenBalance = await cTokenContract.balanceOf(this.userAddress);
    tokenBalance = this.getNumber(tokenBalance);
    if (parseFloat(tokenBalance) > 0) {
      const supplyBal = parseFloat(token.priceUsd) * (parseFloat(tokenBalance) / 10 ** 18);
      this.totalBorrowBalance += supplyBal;
    }
    return tokenBalance;
  }

  public async getUserBorrowBalance(cTokenContract, token) {
    let tokenBalance = await cTokenContract.borrowBalanceStored(this.userAddress);
    tokenBalance = this.getNumber(tokenBalance);
    if (parseFloat(tokenBalance) > 0) {
      const supplyBal = parseFloat(token.priceUsd) * (parseFloat(tokenBalance) / 10 ** 8);
      this.totalSupplyBalance += supplyBal;
    }
    // console.log(this.totalSupplyBalance)
    return tokenBalance;
  }

  public async getAccountLiquidity() {
    const liquidityData = await this.Contracts.Comptroller.getAccountLiquidity(this.userAddress);
    if (this.getNumber(liquidityData[0]) === '0') {
      const val = this.getNumber(liquidityData[1]);
      const valInEth = ethers.utils.formatEther(val);
      this.accountLiquidity = this.getUsdPrice(valInEth);
      // console.log(this.accountLiquidity)
    }
  }
  public twoDecimal(val) {
    val = val.toString();
    val = parseFloat(val);
    return val.toFixed(2);
  }

  public async getExchangeRate() {
    this.ethUsdExchangeRate = null;
    let daiPrice = await this.Contracts.PriceOracleProxy.getUnderlyingPrice(this.contractAddresses.cDAI);
    daiPrice = this.getNumber(daiPrice);
    const price = (10 ** 18) / parseFloat(daiPrice);
    this.ethUsdExchangeRate = price.toFixed(3);
    // console.log(this.ethUsdExchangeRate);
    // const from = 'ETH';
    // const to  = 'USD';
    // await this.httpClient.get(`https://rest.coinapi.io/v1/exchangerate/${from}/${to}`, {
    //   headers: { 'X-CoinAPI-Key': '97DFF9D2-14F9-4ADE-BED6-C05DFE93E338' }
    // })
    // .subscribe(
    //   data => {
    //     this.ethUsdExchangeRate = data['rate'];
    //     this.getAccountLiquidity();
    //     // console.log(this.ethUsdExchangeRate)
    //   },
    //   error => { console.log(error); });
  }

  public async getEnteredMarkets() {
    const assetsInArray = await this.Contracts.Comptroller.getAssetsIn(this.userAddress);
    if (assetsInArray.length === 0) { return; }

    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < assetsInArray.length; i++) {
      // tslint:disable-next-line: prefer-for-of
      for (let j = 0; j < this.tokenData.length; j++) {
        if (assetsInArray[i].toLowerCase() === this.tokenData[j].cTokenAddress.toLowerCase()) {
          this.tokenData[j].enabled = true;
        }
      }
    }
    console.log(this.tokenData);
  }

  public async checkApproved(tokenContract, allowanceOf) {
    let approvedBal = await tokenContract.allowance(this.userAddress, allowanceOf);
    approvedBal = this.getNumber(approvedBal);
    return approvedBal !== '0' ? true : false;
  }
  public getUsdPrice(val) {
    return (parseFloat(val) * parseFloat(this.ethUsdExchangeRate)).toString();
  }

  public getNumber(hexNum) {
    return ethers.utils.bigNumberify(hexNum).toString();
  }


  public async erc20Approve() {
    const amountStr = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
    const tokenName = this.tokenData[this.selectedTokenIndex].name;
    const tokenContract = this.Contracts[tokenName];
    const tx = await tokenContract.approve(this.tokenData[this.selectedTokenIndex].cTokenAddress, amountStr);
    await this.web3.waitForTransaction(tx.hash);
    window.location.reload();
  }

  public async enterExitMarket(token) {
    let tx;
    if (token.enabled === true) {
      tx = await this.Contracts.Comptroller.exitMarket(token.cTokenAddress);
    } else {
      tx = await this.Contracts.Comptroller.enterMarkets(token.cTokenAddress);
    }
    await this.web3.waitForTransaction(tx.hash);
    window.location.reload();
  }

  public async mint() {
    // let x = ethers.utils.RLP.decode(['uint256'], '0xa0712d680000000000000000000000000000000000000000000000000de0b6b3a7640000');
    // console.log(x, this.amountInput);
    const tokenName = this.tokenData[this.selectedTokenIndex].name;
    const cTokenContract = this.Contracts[`c${tokenName}`];
    const tx = await cTokenContract.mint(ethers.utils.parseEther(this.amountInput));
    await this.web3.waitForTransaction(tx.hash);
    window.location.reload();
  }

  public async borrow() {
    const amount = this.amountInput * (10 ** 18);
    const tokenName = this.tokenData[this.selectedTokenIndex].name;
    const cTokenContract = this.Contracts[`c${tokenName}`];
    const tx = await cTokenContract.borrow(amount);
    await this.web3.waitForTransaction(tx.hash);
    window.location.reload();
  }

  public async repayBorrow() {
    const amount = this.amountInput * (10 ** 18);
    const tokenName = this.tokenData[this.selectedTokenIndex].name;
    const cTokenContract = this.Contracts[`c${tokenName}`];
    const tx = await cTokenContract.repayBorrow(amount);
    await this.web3.waitForTransaction(tx.hash);
    window.location.reload();
  }

  public async withdrawUnderlying() {
    const amount = this.amountInput * (10 ** 18);
    const tokenName = this.tokenData[this.selectedTokenIndex].name;
    const cTokenContract = this.Contracts[`c${tokenName}`];
    const tx = await cTokenContract.redeemUnderlying(amount);
    await this.web3.waitForTransaction(tx.hash);
    window.location.reload();
  }

  openSupplyModal(i) {
    this.amountInput = '';
    $('#supply').val(this.tokenData[i].id);
    this.selectedTokenIndex = $('#supply').val();
    $('#supply').trigger('change');
    $('#supply').on('change', function() {
      this.selectedTokenIndex = $('#supply').val();
    }.bind(this));
    $('#supplyModal').modal('show');
  }
  openBorrowModal(i) {
    this.amountInput = '';
    $('#borrow').val(this.tokenData[i].id);
    this.selectedTokenIndex = $('#borrow').val();
    $('#borrow').trigger('change');
    $('#borrow').on('change', function() {
      this.selectedTokenIndex = $('#borrow').val();
    }.bind(this));
    $('#borrowModal').modal('show');
  }

  enableSupplyCollateral() {
    this.collateralSupplyEnable = true;
    // this.erc20Approve();
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
      '<span>' + supply.text + '</span>'
    );
    return $supply;
  }

}

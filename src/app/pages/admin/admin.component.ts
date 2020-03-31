import { Component, OnInit, ViewEncapsulation, AfterViewInit } from '@angular/core';
import { ethers } from 'ethers';
import Web3 from 'web3';
import { blockchainConstants } from '../../../environments/blockchain-constants';
import * as Comptroller from '../../../assets/contracts/Comptroller.json';
import * as CErc20Delegator from '../../../assets/contracts/CErc20Delegator.json';
import * as CErc20Immutable from '../../../assets/contracts/CErc20Immutable.json';
import * as IVTDemoABI from '../../../assets/contracts/IVTDemoABI.json';
// import * as EIP20Interface from '../../../assets/contracts/EIP20Interface.json';

declare var $: any;
declare var cApp: any;

@Component({
  selector: '',
  templateUrl: './admin.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class AdminComponent implements OnInit, AfterViewInit {

  public ethereum: any;
  public web3: any;
  public userAddress: any;
  public Contracts: any;
  public contractAddresses: any;
  public tokenData: any;
  public cTokenAddress: any;
  public cTkCollateralAddress: any;
  public cTokenRatio: any;
  public isUserAdmin = false;
  public erc20AddressFull: any;
  public collateralFacFull: any;
  public callCount = 0;

  constructor() {
  }

  ngOnInit() {
    this.initializeMetaMask();
  }

  ngAfterViewInit() {
  }

  public async initializeMetaMask() {
    this.ethereum = window['ethereum'];
    this.web3 = new ethers.providers.Web3Provider(this.ethereum);
    await this.setup();
  }

  public async setup() {
    cApp.blockPage({
      overlayColor: '#000000',
      state: 'secondary',
      message: 'Please Wait...'
    });
    this.userAddress = await this.web3.getSigner().getAddress();
    const contractAddresses = await this.getContractAddresses();
    const allListedTokens = await this.fetchAllMarkets();
    this.initAllContracts(contractAddresses);
    this.checkAdmin();
    this.fetchTokens(allListedTokens);
    // console.log(this.Contracts);
    // console.log(this.tokenData);
  }

  public async afterInitToken() {
    // if (this.callCount < this.tokenData.length) {
    //   return;
    // }
    cApp.unblockPage();
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

  private initAllContracts(contractAddresses) {
    this.Contracts = {};
    this.Contracts.Comptroller = this.initContract(contractAddresses.Comptroller, Comptroller.abi);
  }

  private initContract(contractAddress, abi) {
    return new ethers.Contract(contractAddress, abi, this.web3.getSigner());
  }

  public async fetchTokens(allListedTokens) {
    this.tokenData = [];
    for (const cTokenAddress of allListedTokens) {
      const token = {} as any;
      token.cTokenAddress = cTokenAddress;
      this.initToken(token);
      this.tokenData.push(token);
    }
  }

  private async initToken(token) {
    token.isListed = true;
    const cTokenContract = this.initContract(token.cTokenAddress, CErc20Delegator.abi);
    cTokenContract.name().then(cTokenName => {
      token.cTokenName = cTokenName;
    });
    cTokenContract.underlying().then(underlyingTokenAddress => {
      token.tokenAddress = underlyingTokenAddress;
      const tokenContract = this.initContract(underlyingTokenAddress, IVTDemoABI.abi);
      tokenContract.name().then(name => {
        token.name = name;
        this.afterInitToken();
      });
    });
    this.getCollateralFactor(token.cTokenAddress).then(collateralFactor => {
      token.collateralFactor = collateralFactor;
    });
    // const cTokenName = await cTokenContract.name();
    // const underlyingTokenAddress = await cTokenContract.underlying();
    // const tokenContract = this.initContract(underlyingTokenAddress, IVTDemoABI.abi);
    // token.name = await tokenContract.name();
    // token.tokenAddress = underlyingTokenAddress;
    // token.cTokenName = cTokenName;
    // token.isListed = true;
    // token.collateralFactor = await this.getCollateralFactor(token.cTokenAddress);
    // this.callCount++;
    // this.afterInitToken();
}

  public async getCollateralFactor(cTokenAddress) {
    const markets = await this.Contracts.Comptroller.markets(cTokenAddress);
    const colFactorStrTemp = this.getNumber(markets.collateralFactorMantissa);
    const divBy = 10 ** 16;
    const colFactorStr = parseFloat(colFactorStrTemp) / divBy;
    return colFactorStr.toFixed(2).toString();
  }

  public getNumber(hexNum) {
    return ethers.utils.bigNumberify(hexNum).toString();
  }

  public async checkAdmin() {
    const admin = await this.Contracts.Comptroller.admin();
    const user = await this.web3.getSigner().getAddress();
    this.isUserAdmin = (admin.toLowerCase() === user.toLowerCase()) ? true : false;
  }

  public async addToken() {
    if (this.cTokenAddress === undefined || this.cTokenAddress === null) {
      return;
    }
    try {
      const tx = await this.Contracts.Comptroller._supportMarket(this.cTokenAddress);
      await this.web3.waitForTransaction(tx.hash);
      window.location.reload();
    } catch (error) { console.error(error); }
  }

  public async updateCR() {
    if (this.cTkCollateralAddress === undefined || this.cTkCollateralAddress === null) {
      return;
    }
    if (this.cTokenRatio === undefined || this.cTokenRatio === null) {
      return;
    }
    const colFac = parseFloat(this.cTokenRatio);
    if (colFac <= 0) {
      console.log('invalid');
      return;
    }
    try {
      const colFacStr = (colFac * (10 ** 16)).toString();
      const tx = await this.Contracts.Comptroller._setCollateralFactor(this.cTkCollateralAddress, colFacStr);
      await this.web3.waitForTransaction(tx.hash);
      window.location.reload();
    } catch (error) { console.error(error); }
  }

  public async addCompleteMarket() {
    if (this.erc20AddressFull === undefined || this.erc20AddressFull === null
      || this.collateralFacFull === undefined || this.collateralFacFull === null) {
      return;
    }
    if (parseFloat(this.collateralFacFull) <= 0) {
      console.log('invalid');
      return;
    }
    try {
      // get parameter data
      const Erc20Token = this.initContract(this.erc20AddressFull, IVTDemoABI.abi);
      const erc20Name = await Erc20Token.name();
      const erc20Symbol = await Erc20Token.symbol();
      const admin = await this.Contracts.Comptroller.admin();
      const cTokenName = 'c' + erc20Name;
      const cTokenSymbol = 'c' + erc20Symbol;

      // deploy cToken
      const abi = CErc20Immutable.abi;
      const bytecode = CErc20Immutable.bytecode;
      const factory = new ethers.ContractFactory(abi, bytecode, this.web3.getSigner());
      const cTokenContract = await factory.deploy(this.erc20AddressFull, this.contractAddresses.Comptroller,
        this.contractAddresses.DynamicInterestRateModel, 0.2 * (10 ** 9), cTokenName, cTokenSymbol, 8, admin);
      await cTokenContract.deployed();

      // call support market in comptroller
      const tx = await this.Contracts.Comptroller._supportMarket(cTokenContract.address);
      await this.web3.waitForTransaction(tx.hash);

      // update collateral factor in comptroller
      const colFac = parseFloat(this.collateralFacFull);
      const colFacStr = (colFac * (10 ** 16)).toString();
      const tx2 = await this.Contracts.Comptroller._setCollateralFactor(cTokenContract.address, colFacStr);
      await this.web3.waitForTransaction(tx2.hash);

      this.erc20AddressFull = null;
      this.collateralFacFull = null;
      window.location.reload();
    } catch (error) {
      console.error(error);
    }
  }
  public async fetchAllMarkets() {
    const myWeb3 = new Web3(Web3.givenProvider);
    let abi;
    abi = Comptroller.abi;
    const web3Contract = new myWeb3.eth.Contract(abi, this.contractAddresses.Comptroller);

    const result = await web3Contract.getPastEvents('MarketListed', {
      fromBlock: 0,
      toBlock: 'latest'
    });
    const allListedTokens = [];
    result.forEach(log => {
      allListedTokens.push(log.returnValues.cToken);
    });
    return allListedTokens;
  }
}

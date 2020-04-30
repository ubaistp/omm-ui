import { Component, OnInit, ViewEncapsulation, AfterViewInit } from '@angular/core';
import { ethers } from 'ethers';
import Web3 from 'web3';
import { blockchainConstants } from '../../../environments/blockchain-constants';
import * as Comptroller from '../../../assets/contracts/Comptroller.json';
import * as CErc20Delegator from '../../../assets/contracts/CErc20Delegator.json';
import * as CErc20Immutable from '../../../assets/contracts/CErc20Immutable.json';
import * as IVTDemoABI from '../../../assets/contracts/IVTDemoABI.json';
import * as WhitePaperInterestRateModel from '../../../assets/contracts/WhitePaperInterestRateModel.json';

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
  public GAS_PRICE = ethers.utils.parseUnits('20', 'gwei');
  public irData: any;
  public cTokenAddress: any;
  public cTkCollateralAddress: any;
  public cTokenRatio: any;
  public isUserAdmin = false;
  public erc20AddressFull: any;
  public collateralFacFull: any;
  public irModelAddrFull: any;
  public updateIr: any = {};

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

    // In case of unknown networks
    if (typeof contractAddresses === 'undefined') { return; }

    const allListedTokens = await this.fetchAllMarkets();
    this.initAllContracts(contractAddresses);
    this.checkAdmin();

    // In case there are no markets
    if (allListedTokens.length === 0 ) {
      this.afterInitToken();
      return;
    }

    this.fetchTokens(allListedTokens);
    this.fetchIRData();
    // console.log(this.Contracts);
    // console.log(this.tokenData);
  }

  public async afterInitToken() {
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
    // Mainnet default Dai fix
    let removeAddr = '0x235d02C9E7909B7Cc42ffA10Ef591Ea670346F42';
    removeAddr = removeAddr.toLowerCase();

    this.tokenData = [];
    for (const cTokenAddress of allListedTokens) {
      // Mainnet default Dai fix
      if (cTokenAddress.toLowerCase() !== removeAddr) {
        const token = {} as any;
        token.cTokenAddress = cTokenAddress;
        this.initToken(token);
        this.tokenData.push(token);
      }
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
      tokenContract.symbol().then((symbol) => {
        token.symbol = this.capitalize(symbol);
      });
      tokenContract.name().then(name => {
        token.name = name;
        this.afterInitToken();
      });
    });
    cTokenContract.interestRateModel().then(interestRateModel => {
      token.interestRateModel = interestRateModel;
    });
    this.getCollateralFactor(token.cTokenAddress).then(collateralFactor => {
      token.collateralFactor = collateralFactor;
    });
  }

  public fetchIRData() {
    this.irData = [];
    const irAddrArray = this.contractAddresses.DynamicInterestRateModel;
    irAddrArray.forEach(addr => {
      this.irData.push({address: addr});
    });
    this.irData.forEach(irObj => {
      const White = this.initContract(irObj.address, WhitePaperInterestRateModel.abi);
      White.baseRatePerBlock().then((baseRate) => {
        baseRate = parseFloat(this.getNumber(baseRate));
        let baseRateYear: any = 2102400 * baseRate / 10 ** 18;
        baseRateYear = baseRateYear.toFixed(2);
        irObj.baseRate = parseFloat(baseRateYear) * 100;
      });

      White.multiplierPerBlock().then((multiplier) => {
        multiplier = parseFloat(this.getNumber(multiplier));
        let multiplierYear: any = 2102400 * multiplier / 10 ** 18;
        multiplierYear = multiplierYear.toFixed(2);
        irObj.multiplier = parseFloat(multiplierYear) * 100;
      });
    });
    // console.log(this.irData);
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
      const overrides = {
        gasPrice: this.GAS_PRICE,
      };
      const tx = await this.Contracts.Comptroller._supportMarket(this.cTokenAddress, overrides);
      await this.web3.waitForTransaction(tx.hash);
      window.location.reload();
    } catch (error) { console.error(error); }
  }

  public async updateCR() {
    if (this.cTkCollateralAddress === undefined || this.cTkCollateralAddress === null) { return; }
    if (this.cTokenRatio === undefined || this.cTokenRatio === null) { return; }
    const colFac = parseFloat(this.cTokenRatio);
    if (colFac < 0) { return; }

    try {
      const colFacStr = (colFac * (10 ** 16)).toString();
      const overrides = {
        gasPrice: this.GAS_PRICE,
      };
      const tx = await this.Contracts.Comptroller._setCollateralFactor(this.cTkCollateralAddress, colFacStr, overrides);
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
    const irAddrArray = this.contractAddresses.DynamicInterestRateModel;
    const check = irAddrArray.includes(this.irModelAddrFull);
    if (!check) { return; }

    const overrides = {
      gasPrice: this.GAS_PRICE,
    };
    try {
      // get parameter data
      const Erc20Token = this.initContract(this.erc20AddressFull, IVTDemoABI.abi);
      const erc20Name = await Erc20Token.name();
      const erc20Symbol = await Erc20Token.symbol();
      const erc20Decimals = await Erc20Token.decimals();
      const admin = await this.Contracts.Comptroller.admin();
      const cTokenName = 'k' + erc20Name;
      const cTokenSymbol = 'k' + erc20Symbol;
      const cTokenDecimals = 8;
      const totalDecimals = parseFloat(erc20Decimals) + cTokenDecimals;
      let initialExcRateMantissaStr = '2';
      initialExcRateMantissaStr = initialExcRateMantissaStr.padEnd(totalDecimals + 1, '0');

      // deploy cToken
      const abi = CErc20Immutable.abi;
      const bytecode = CErc20Immutable.bytecode;
      const factory = new ethers.ContractFactory(abi, bytecode, this.web3.getSigner());
      const cTokenContract = await factory.deploy(this.erc20AddressFull, this.contractAddresses.Comptroller,
        this.irModelAddrFull, initialExcRateMantissaStr, cTokenName, cTokenSymbol, cTokenDecimals, admin, overrides);
      // await cTokenContract.deployed();

      // call support market in comptroller
      const tx = await this.Contracts.Comptroller._supportMarket(cTokenContract.address, overrides);
      // await this.web3.waitForTransaction(tx.hash);

      // update collateral factor in comptroller
      const colFac = parseFloat(this.collateralFacFull);
      const colFacStr = (colFac * (10 ** 16)).toString();
      const tx2 = await this.Contracts.Comptroller._setCollateralFactor(cTokenContract.address, colFacStr, overrides);
      await this.web3.waitForTransaction(tx2.hash);

      this.erc20AddressFull = null;
      this.collateralFacFull = null;
      this.irModelAddrFull = null;
      window.location.reload();
    } catch (error) {
      console.error(error);
    }
  }

  public async updateIrModel() {
    // checks
    if (typeof this.updateIr.tokenAddress === 'undefined') { return; }
    if (!this.contractAddresses.DynamicInterestRateModel.includes(this.updateIr.irAddress)) { return; }

    try {
      const TokenContract = this.initContract(this.updateIr.tokenAddress, CErc20Delegator.abi);
      const overrides = {
        gasPrice: this.GAS_PRICE,
      };
      const tx = await TokenContract._setInterestRateModel(this.updateIr.irAddress, overrides);
      await this.web3.waitForTransaction(tx.hash);
      window.location.reload();
    } catch (error) { console.error(error); }
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

  public toDecimal(val, decimal) {
    if (val === undefined || val === null) {
        return 0;
    }
    val = val.toString();
    val = parseFloat(val);
    return val.toFixed(decimal);
  }

  public trucateAddress(address) {
    if (address === null || address === undefined) { return; }
    const start4Digits = address.slice(0, 6);
    const separator = '...';
    const last4Digits = address.slice(-4);
    return (start4Digits.padStart(2, '0') + separator.padStart(2, '0') + last4Digits.padStart(2, '0'));
  }

  public capitalize(s) {
    return s && s[0].toUpperCase() + s.slice(1);
  }
}

import { Component, OnInit, ViewEncapsulation, AfterViewInit } from '@angular/core';
import { ethers } from 'ethers';
import { blockchainConstants } from '../../../environments/blockchain-constants';
import { tempConstants } from '../../../environments/temp-constants';
import * as Comptroller from '../../../assets/contracts/Comptroller.json';
import * as CErc20Delegator from '../../../assets/contracts/CErc20Delegator.json';
import * as CErc20Immutable from '../../../assets/contracts/CErc20Immutable.json';
import * as CErc20 from '../../../assets/contracts/CErc20.json';
import * as IVTDemoABI from '../../../assets/contracts/IVTDemoABI.json';
import * as EIP20Interface from '../../../assets/contracts/EIP20Interface.json';
// import * as PriceOracleProxy from '../../../assets/contracts/PriceOracleProxy.json';
@Component({
  selector: "",
  templateUrl: "./admin.component.html",
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
  public isUserAdmin: Boolean = false;
  public erc20AddressFull: any;
  public collateralFacFull: any;

  constructor() {
    this.tokenData = [
      {
        id: '0',
        text: 'DAI',
      },
      {
        id: '1',
        text: 'IVTDemo',
      }
    ];
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
    this.userAddress = await this.web3.getSigner().getAddress();
    const contractAddresses = await this.getContractAddresses();
    await this.initAllContracts(contractAddresses);
    await this.checkAdmin();
    await this.fetchTokens();
    // await this.tokenData.forEach(async (token) => {
    //   this.initToken(token);
    // });
    console.log(this.Contracts)
    console.log(this.tokenData)
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
  private async initAllContracts(contractAddresses) {
    this.Contracts = {};
    this.Contracts.Comptroller = this.initContract(contractAddresses.Comptroller, Comptroller.abi);
    // this.Contracts.PriceOracleProxy = this.initContract(contractAddresses.PriceOracleProxy, PriceOracleProxy.abi);
    this.Contracts.cDAI = this.initContract(contractAddresses.cDAI, CErc20Delegator.abi);
    this.Contracts.cIVTDemo = this.initContract(contractAddresses.cIVTDemo, CErc20.abi);
    this.Contracts.DAI = this.initContract(contractAddresses.DAI, EIP20Interface.abi);
    this.Contracts.IVTDemo = this.initContract(contractAddresses.IVTDemo, EIP20Interface.abi);
  }

  private initContract(contractAddress, abi) {
    return new ethers.Contract(contractAddress, abi, this.web3.getSigner());
  }

  public async fetchTokens() {
    this.tokenData = [];
    for (const key of Object.keys(this.contractAddresses)) {
      const markets = await this.Contracts.Comptroller.markets(this.contractAddresses[key]);
      if (markets.isListed === true) {
        let token = {} as any;
        const cTokenContract = this.initContract(this.contractAddresses[key], CErc20Delegator.abi);
        const cTokenName = await cTokenContract.name();
        const underlyingTokenAddress = await cTokenContract.underlying();
        const tokenContract = this.initContract(underlyingTokenAddress, IVTDemoABI.abi);
        token.name = await tokenContract.name();

        token.tokenAddress = underlyingTokenAddress;
        token.cTokenAddress = this.contractAddresses[key];
        token.cTokenName = cTokenName;
        token.isListed = true;
        token.collateralFactor = await this.getCollateralFactor(token.cTokenAddress);
        this.tokenData.push(token);
      }
    }
  }

  // private async initToken(token) {
  //   token.text === 'DAI' ? token.name = 'DAI' : token.name = 'IVTDemo';
  //   token.tokenAddress = this.contractAddresses[token.name];
  //   token.cTokenAddress = this.contractAddresses[`c${token.name}`];
  //   token.cTokenName = `c${token.name}`;
  //   const market = await this.Contracts.Comptroller.markets(token.cTokenAddress);
  //   token.isListed = market.isListed;
  //   token.collateralFactor = await this.getCollateralFactor(token.cTokenAddress);
  // }

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
    let colFac = parseFloat(this.cTokenRatio);
    if (colFac <= 0 || colFac >= 100) {
      console.log('invalid');
      return;
    }
    try {
      const tx = await this.Contracts.Comptroller._setCollateralFactor(this.cTkCollateralAddress, colFac * (10 ** 16));
      await this.web3.waitForTransaction(tx.hash);
      window.location.reload();
    } catch (error) { console.error(error); }
  }

  public async addCompleteMarket() {
    if (this.erc20AddressFull === undefined || this.erc20AddressFull === null
      || this.collateralFacFull === undefined || this.collateralFacFull === null) {
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
      // console.log(cTokenContract.address);
      // console.log(cTokenContract.deployTransaction.hash);
      await cTokenContract.deployed();

      // call support market in comptroller
      const tx = await this.Contracts.Comptroller._supportMarket(cTokenContract.address);
      await this.web3.waitForTransaction(tx.hash);

      // update collateral factor in comptroller
      const colFac = parseFloat(this.collateralFacFull);
      const tx2 = await this.Contracts.Comptroller._setCollateralFactor(cTokenContract.address, colFac * (10 ** 16));
      await this.web3.waitForTransaction(tx2.hash);

      // store cToken Address
      const network = await this.web3.getNetwork();
      tempConstants[network].push("a","b")

      this.erc20AddressFull = null;
      this.collateralFacFull = null;

    } catch (error) {
      console.error(error);
    }
  }
  public async temp() {
    const network = await this.web3.getNetwork();
    console.log(network.name, tempConstants[network.name]);
    tempConstants[network.name].append("a","b")

  }
}

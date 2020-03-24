import { Component, OnInit, ViewEncapsulation, AfterViewInit } from '@angular/core';
import { ethers } from 'ethers';
import { blockchainConstants } from '../../../environments/blockchain-constants';
import * as Comptroller from '../../../assets/contracts/Comptroller.json';
import * as PriceOracleProxy from '../../../assets/contracts/PriceOracleProxy.json';
import * as CErc20Delegator from '../../../assets/contracts/CErc20Delegator.json';
import * as CErc20 from '../../../assets/contracts/CErc20.json';
import * as IVTDemoABI from '../../../assets/contracts/IVTDemoABI.json';
import * as EIP20Interface from '../../../assets/contracts/EIP20Interface.json';
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
  public cTokenRatio: any;
  public isUserAdmin: Boolean = false;

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
    await this.tokenData.forEach(async (token) => {
      this.initToken(token);
    });
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
    this.Contracts.PriceOracleProxy = this.initContract(contractAddresses.PriceOracleProxy, PriceOracleProxy.abi);
    this.Contracts.cDAI = this.initContract(contractAddresses.cDAI, CErc20Delegator.abi);
    this.Contracts.cIVTDemo = this.initContract(contractAddresses.cIVTDemo, CErc20.abi);
    this.Contracts.DAI = this.initContract(contractAddresses.DAI, EIP20Interface.abi);
    this.Contracts.IVTDemo = this.initContract(contractAddresses.IVTDemo, EIP20Interface.abi);
  }

  private initContract(contractAddress, abi) {
    return new ethers.Contract(contractAddress, abi, this.web3.getSigner());
  }

  private async initToken(token) {
    token.text === 'DAI' ? token.name = 'DAI' : token.name = 'IVTDemo';
    token.tokenAddress = this.contractAddresses[token.name];
    token.cTokenAddress = this.contractAddresses[`c${token.name}`];
    token.cTokenName = `c${token.name}`;
    const market = await this.Contracts.Comptroller.markets(token.cTokenAddress);
    token.isListed = market.isListed;
    token.collateralFactor = await this.getCollateralFactor(token.cTokenAddress);

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
    console.log(this.isUserAdmin, admin, user);
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
}

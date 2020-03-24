import { Injectable } from '@angular/core';
import { ethers } from 'ethers';
import { blockchainConstants } from '../environments/blockchain-constants';
import * as Comptroller from '../assets/contracts/Comptroller.json';
import * as PriceOracleProxy from '../assets/contracts/PriceOracleProxy.json';
import * as CErc20Delegator from '../assets/contracts/CErc20Delegator.json';
import * as CErc20 from '../assets/contracts/CErc20.json';
import * as IVTDemoABI from '../assets/contracts/IVTDemoABI.json';
import * as EIP20Interface from '../assets/contracts/EIP20Interface.json';

@Injectable()
export class SharedService {
  public ethereum: any;
  public web3: any;
  public userAddress: any;
  public Contracts: any;
  public contractAddresses: any;

  constructor() {
    if (typeof window['ethereum'] !== 'undefined' || (typeof window['web3'] !== 'undefined')) {
      this.ethereum = window['ethereum'];
      this.web3 = new ethers.providers.Web3Provider(this.ethereum);
    }
  }

  public async initializeMetaMask() {
    try {
      if (typeof window['ethereum'] === 'undefined' || (typeof window['web3'] === 'undefined')) {
        return;
      }
      await this.ethereum.enable();
      await this.setup();
    } catch (error) {
        throw(error);
    }
  }
  public getWeb3() {
    return this.web3;
  }

  public async setup() {
    this.userAddress = await this.web3.getSigner().getAddress();
    const contractAddresses = await this.getContractAddresses();
    // console.log(this.contractAddresses)
    this.initAllContracts(contractAddresses);
    // console.log(this.userAddress, this.Contracts)
    // await this.getExchangeRate();
    // await this.tokenData.forEach(async (token) => {
    //     this.initToken(token);
    // });
    // await this.getEnteredMarkets();
    // await this.getAccountLiquidity();
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

  public getUserAddress() {
    return this.userAddress;
  }
  public getAllContracts() {
    // console.log(this.Contracts)
    return this.Contracts;
  }
  // public getUserAddress() {
  //   return this.userAddress;
  // }

  private initContract(contractAddress, abi) {
    return new ethers.Contract(contractAddress, abi, this.web3.getSigner());
  }
}

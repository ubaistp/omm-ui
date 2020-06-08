import { Injectable } from '@angular/core';
import { ethers } from 'ethers';
import { ReplaySubject } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';
import WalletConnectProvider from '@walletconnect/web3-provider';
import { blockchainConstants } from '../environments/blockchain-constants';
import * as Comptroller from '../assets/contracts/Comptroller.json';
import * as PriceOracleProxy from '../assets/contracts/PriceOracleProxy.json';
import * as CErc20Delegator from '../assets/contracts/CErc20Delegator.json';
import * as CErc20 from '../assets/contracts/CErc20.json';
import * as EIP20Interface from '../assets/contracts/EIP20Interface.json';

declare var $: any;

@Injectable({
  providedIn: 'root',
})
export class SharedService {
  public ethereum: any;
  public web3: any;
  public userAddress: any;
  public Contracts: any;
  public contractAddresses: any;
  private proceedApp = new ReplaySubject<any>();
  public proceedApp$ = this.proceedApp.asObservable();

  constructor(private cookie: CookieService) {
    this.initWalletConnection();
  }

  private initWalletConnection() {
    try {
      const cookieExists: boolean = this.cookie.check('connected_wallet_name');

      if (cookieExists === false) {
        this.toggleWalletConnectionModal('show');
        return;
      }

      const walletName = this.cookie.get('connected_wallet_name');
      if (walletName) {
        this.connect(walletName);
      } else {
        this.toggleWalletConnectionModal('show');
      }
    } catch (error) {
      console.error(error);
      this.toggleWalletConnectionModal('show');
    }
  }

  public async connect(walletName) {
    switch (walletName) {
      case 'metamask': {
        await this.initializeMetaMask();
        break;
      }
      case 'wallet-connect': {
        await this.initializeWalletConnect();
        break;
      }
      default: {
        this.toggleWalletConnectionModal('show');
        break;
      }
    }
  }

  public async initializeWalletConnect() {
    try {
      const wcProvider = new WalletConnectProvider({
        infuraId: blockchainConstants.infuraID // Required
      });
      await wcProvider.enable();
      await this.setWalletCookie('wallet-connect');
      this.web3 = new ethers.providers.Web3Provider(wcProvider);
      // await wcProvider.close()
      await this.setup();
    } catch (error) {
      $('#walletRejectModal').modal('show');
      throw(error);
    }
  }

  public async initializeMetaMask() {
    try {
      if (typeof window['ethereum'] === 'undefined' || (typeof window['web3'] === 'undefined')) {
        setTimeout(() => { $('#noMetaMaskModal').modal('show'); }, 1);
        return;
      }
      this.ethereum = window['ethereum'];
      this.web3 = new ethers.providers.Web3Provider(this.ethereum);
      await this.ethereum.enable();
      await this.setWalletCookie('metamask');
      await this.setup();
    } catch (error) {
        if (error.code === 4001) {
          $('#walletRejectModal').modal('show');
        } else {
          throw(error);
        }
    }
  }

  private setWalletCookie(value) {
    this.cookie.set('connected_wallet_name', value, 15);
  }

  private toggleWalletConnectionModal(operation) {
    setTimeout(() => { $('#walletConnectionModal').modal(operation); }, 1);
  }

  public getWeb3() {
    return this.web3;
  }

  public async setup() {
    this.userAddress = await this.web3.getSigner().getAddress();
    this.toggleWalletConnectionModal('hide');
    this.proceedApp.next(true);

    // const contractAddresses = await this.getContractAddresses();
    // console.log(this.contractAddresses)
    // this.initAllContracts(contractAddresses);
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

import { Injectable } from '@angular/core';
import { ethers } from 'ethers';
import { ReplaySubject } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';
import WalletConnectProvider from '@walletconnect/web3-provider';
import { blockchainConstants } from '../environments/blockchain-constants';

declare var $: any;

@Injectable({
  providedIn: 'root',
})
export class SharedService {
  public web3: any;
  public userAddress: any;
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
      window['ethereum'].autoRefreshOnNetworkChange = false;
      this.web3 = new ethers.providers.Web3Provider(window['ethereum']);
      await window['ethereum'].enable();
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

  private deleteWalletCookie() {
    this.cookie.delete('connected_wallet_name');
  }

  private toggleWalletConnectionModal(operation) {
    setTimeout(() => { $('#walletConnectionModal').modal(operation); }, 1);
  }

  public async disconnectWallet() {
    if (typeof(this.web3) === undefined) { return; }

    const walletName = this.cookie.get('connected_wallet_name');
    if (walletName === 'wallet-connect') {
      await this.web3.provider.close();
    }

    this.deleteWalletCookie();
    this.toggleWalletConnectionModal('show');
    window.location.reload();
  }

  public getWeb3() {
    return this.web3;
  }


  public getNewProvider() {
    return new ethers.providers.Web3Provider(this.web3.provider);
  }

  public async setup() {
    this.userAddress = await this.web3.getSigner().getAddress();
    this.toggleWalletConnectionModal('hide');
    this.proceedApp.next(true);
  }

  public getUserAddress() {
    return this.userAddress;
  }

}

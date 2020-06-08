import { Component, OnInit, ViewEncapsulation, AfterViewInit } from '@angular/core';
import { SharedService } from '../commonData.service';

declare var $: any;

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  encapsulation: ViewEncapsulation.None,
  providers: []
})
export class HeaderComponent implements OnInit, AfterViewInit {

  // private ethereum: any;
  private web3: any;
  public userAddress;
  public networkString: any;

  constructor(private sharedService: SharedService) {
    // this.initialize();
  }
  ngOnInit() {
    this.sharedService.proceedApp$.subscribe((value) => {
      if (value === true) {
        this.initialize();
      }
    });
  }
  ngAfterViewInit() {
    // if (typeof window['ethereum'] === 'undefined' || (typeof window['web3'] === 'undefined')) {
    //   return;
    // }
    if (typeof this.web3 === 'undefined') { return; }

    this.web3.on('accountsChanged', () => {             // NOT RELOADING
      window.location.reload();
    });

    this.web3.on('networkChanged', () => {
      window.location.reload();
    });
  }

  public async connect(walletName) {
    await this.sharedService.connect(walletName);
  }

  public async initialize() {
    this.networkString = {};
    // if (typeof window['ethereum'] === 'undefined' || (typeof window['web3'] === 'undefined')) {
    //   setTimeout(() => { $('#noMetaMaskModal').modal('show'); }, 1);
    //   return;
    // }
    // try {
    //   await this.sharedService.initializeMetaMask();
    // } catch (error) {
    //   if (error.code === 4001) {
    //     $('#metaMaskRejectModal').modal('show');
    //   } else { console.error(error); }
    // }
    // this.ethereum = await this.sharedService.ethereum;
    this.web3 = await this.sharedService.web3;

    if (typeof(this.web3) === undefined) { return; }

    const network = await this.web3.getNetwork();
    const networkName = network.name;

    switch (networkName) {
      case 'homestead': {
        this.networkString.show = true;
        this.networkString.name = 'Main Ethereum';
        break;
      }
      case 'kovan': {
        this.networkString.show = true;
        this.networkString.name = 'Kovan';
        break;
      }
      case 'rinkeby': {
        this.networkString.show = true;
        this.networkString.name = 'Rinkeby';
        break;
      }
      case 'ropsten': {
        this.networkString.show = true;
        this.networkString.name = 'Ropsten';
        break;
      }
      default: {
        $('#unknownNetModal').modal('show');
        break;
      }
    }

    this.userAddress = await this.web3.getSigner().getAddress();
  }

  public disconnectWallet() {
    this.sharedService.disconnectWallet();
  }

  public reloadPage() {
    window.location.reload();
  }

  public trucateAddress(address) {
    if (address === null || address === undefined) { return; }
    const start4Digits = address.slice(0, 6);
    const separator = '...';
    const last4Digits = address.slice(-4);
    return (start4Digits.padStart(2, '0') + separator.padStart(2, '0') + last4Digits.padStart(2, '0'));
  }

  viewOnboardingModal() {
    $('#previewModal').modal('show');
  }

}

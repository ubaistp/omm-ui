import { Component, OnInit, ViewEncapsulation, AfterViewInit } from '@angular/core';
import { SharedService } from '../commonData.service';

declare var $:any;

@Component({
  selector: "app-header",
  templateUrl: "./header.component.html",
  encapsulation: ViewEncapsulation.None,
  providers: [SharedService]
})
export class HeaderComponent implements OnInit, AfterViewInit {

  private ethereum: any;
  private web3: any;
  public userAddress;

  constructor(private sharedService: SharedService) {
    this.initialize();
  }
  ngOnInit() {

  }
  ngAfterViewInit() {
  }

  public async initialize() {
    if (typeof window['ethereum'] === 'undefined' || (typeof window['web3'] === 'undefined')) {
      setTimeout(() => { $('#noMetaMaskModal').modal('show'); }, 1);
      return;
    }
    try {
      await this.sharedService.initializeMetaMask();
    } catch (error) {
      if (error.code === 4001) {
        $('#metaMaskRejectModal').modal('show');
      } else { console.error(error); }
    }
    this.ethereum = await this.sharedService.ethereum;
    this.web3 = await this.sharedService.web3;

    if (typeof(this.web3) === undefined) { return; }

    const network = await this.web3.getNetwork();
    if (network.name !== 'kovan') {
      $('#kovanNetModal').modal('show');
      return;
    }
    this.userAddress = await this.web3.getSigner().getAddress();
  }

  public async modalCheck() {

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
}

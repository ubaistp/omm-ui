import { ethers } from 'ethers';
import { Injectable } from '@angular/core';

@Injectable()
export class SharedService {
    public ethereum: any;
    public web3: any;
    public userAddress: any = 0;

    constructor() {
        // this.initializeMetaMask();
    }

    public async initializeMetaMask() {
      try {
          if (typeof window['ethereum'] === 'undefined' || (typeof window['web3'] === 'undefined')) {
            return;
          }
          this.ethereum = window['ethereum'];
          await this.ethereum.enable();
          this.web3 = new ethers.providers.Web3Provider(this.ethereum);
          // this.setup();
          await this.initialize();

      } catch (error) {
          throw(error);
      }
    }

    public async initialize() {
      this.userAddress = await this.web3.getSigner().getAddress();
    }


}

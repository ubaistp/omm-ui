import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ethers } from 'ethers';
import { blockchainConstants } from '../../../environments/blockchain-constants';
import { SharedService } from '../../commonData.service';
import { BigNumber } from 'bignumber.js';
import * as Comp from '../../../assets/contracts/Comp.json';
import * as Comptroller from '../../../assets/contracts/Comptroller.json';

declare var $: any;
declare var cApp: any;
BigNumber.config({ ROUNDING_MODE: BigNumber.ROUND_DOWN });


@Component({
    selector: '',
    templateUrl: './governance.component.html',
    encapsulation: ViewEncapsulation.None,
    providers: []
})
export class GovernanceComponent implements OnInit {

    private web3: any;
    public userAddress: any;
    public Contracts: any;
    public contractAddresses: any;
    public GAS_PRICE = ethers.utils.parseUnits('20', 'gwei');
    public compBalance: any;
    public compEarned: any;

    constructor(private http: HttpClient, private sharedService: SharedService) {
    }

    ngOnInit() {
      this.sharedService.proceedApp$.subscribe(
        value => {
          if (value === true) {
              this.initializeProvider();
          }
        },
        error => console.error(error)
      );
    }

    public async initializeProvider() {
        try {
            this.web3 = await this.sharedService.web3;
            await this.setup();
        } catch (error) {
            if (error.code === 4001) {
                $('#metaMaskRejectModal').modal('show');
            } else { console.error(error); }
        }
    }

    public reloadPage() {
        window.location.reload();
    }

    public async setup() {
        this.userAddress = await this.web3.getSigner().getAddress();
        // this.userAddress = '0xa13b3E79f2ed49BC05Af2274dC509D73a75cAFE2';
        cApp.blockPage({
          overlayColor: '#000000',
          state: 'secondary',
          message: 'Loading App...'
        });
        const contractAddresses = await this.getContractAddresses();

        // In case of unknown networks
        if (typeof contractAddresses === 'undefined') { return; }
        await this.initAllContracts(contractAddresses);

        this.compBalance = await this.getCompBalance();
        this.compEarned = await this.getCompEarned();
        this.estimateGasPrice();
        cApp.unblockPage();
    }


    private async estimateGasPrice() {
      let proposedGP: any;
      const url = 'https://ethgasstation.info/json/ethgasAPI.json';
      this.http.get(url)
      .subscribe(
        data => {
          proposedGP = (parseFloat(data['fast']) + parseFloat(data['average'])) / (10 * 2);   // convert to gWei then average
          proposedGP = proposedGP.toFixed();
          this.GAS_PRICE = ethers.utils.parseUnits(proposedGP, 'gwei');
        },
        async (error) => {
          let gasPrice = await this.web3.getGasPrice();
          gasPrice = ethers.utils.formatUnits(gasPrice, 'gwei');

          proposedGP = parseFloat(gasPrice) + parseFloat(gasPrice) * 0.15;  // 15% extra
          proposedGP = proposedGP.toFixed();
          this.GAS_PRICE = ethers.utils.parseUnits(proposedGP, 'gwei');
        }
      );
    }

    private async getContractAddresses() {
        let contractAddresses = {};
        this.contractAddresses = {};
        const network = await this.web3.getNetwork();
        if (network.name === 'homestead') {
            // this.networkData.name = 'mainnet';
            contractAddresses = blockchainConstants.mainnet;
        } else {
            // this.networkData.name = network.name;
            contractAddresses = blockchainConstants[network.name];
        }
        this.contractAddresses = contractAddresses;
        return contractAddresses;
    }


    private async initAllContracts(contractAddresses) {
        this.Contracts = {};
        this.Contracts.Comptroller = this.initContract(contractAddresses.Comptroller, Comptroller.abi);

        const compAddress = await this.Contracts.Comptroller.getCompAddress();
        this.Contracts.Comp = this.initContract(compAddress, Comp.abi);
    }

    private initContract(contractAddress, abi) {
        return new ethers.Contract(contractAddress, abi, this.web3.getSigner());
    }

    private async getCompBalance(){
      let compTokenBalance = await this.Contracts.Comp.balanceOf(this.userAddress);
      compTokenBalance = this.getNumber(compTokenBalance);
      const tokenDecimals = await this.Contracts.Comp.decimals();
      compTokenBalance = parseFloat(compTokenBalance)/(10 ** parseFloat(tokenDecimals));
      return compTokenBalance;
    }

    private async getCompEarned(){
      let compTokenEarned = await this.Contracts.Comptroller.compAccrued(this.userAddress);
      compTokenEarned = this.getNumber(compTokenEarned);
      const tokenDecimals = await this.Contracts.Comp.decimals();
      compTokenEarned = parseFloat(compTokenEarned)/(10 ** parseFloat(tokenDecimals));
      return compTokenEarned;
    }

    public toDecimal(val, decimal) {
        if (val === undefined || val === null) {
            return 0;
        }
        val = val.toString();
        val = new BigNumber(val);
        return val.toFixed(decimal);
    }

    public localeString(num, precision) {
      if (num === null || num === undefined) { return; }

      num = parseFloat(num);
      num = num.toLocaleString(undefined, {maximumFractionDigits: precision});
      return num;
    }

    public getNumber(hexNum) {
        return ethers.utils.bigNumberify(hexNum).toString();
    }
    public async collectCompEarned() {
        this.estimateGasPrice();

        const overrides = {
          gasPrice: this.GAS_PRICE,
        };
        const tx = await this.Contracts.Comptroller.claimComp(this.userAddress, overrides);
        await this.web3.waitForTransaction(tx.hash);
        window.location.reload();
    }

}

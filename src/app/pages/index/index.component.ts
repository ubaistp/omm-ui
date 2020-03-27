import { Component, OnInit, ViewEncapsulation, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ethers } from 'ethers';
import Web3 from 'web3';
import { blockchainConstants } from '../../../environments/blockchain-constants';
import * as Comptroller from '../../../assets/contracts/Comptroller.json';
import * as PriceOracleProxy from '../../../assets/contracts/PriceOracleProxy.json';
import * as CErc20Delegator from '../../../assets/contracts/CErc20Delegator.json';
import * as CErc20Immutable from '../../../assets/contracts/CErc20Immutable.json';
import * as CErc20 from '../../../assets/contracts/CErc20.json';
import * as IVTDemoABI from '../../../assets/contracts/IVTDemoABI.json';
import * as EIP20Interface from '../../../assets/contracts/EIP20Interface.json';

declare var $: any;

@Component({
    selector: '',
    templateUrl: './index.component.html',
    encapsulation: ViewEncapsulation.None,
    providers: []
})
export class IndexComponent implements OnInit, AfterViewInit {

    private ethereum: any;
    private web3: any;
    public provider: any;
    public userAddress: any;
    public Contracts: any;
    public contractAddresses: any;
    public BLOCKS_YEAR = 2102400;
    public DECIMAL_8 = 10 ** 8;
    public DECIMAL_18 = 10 ** 18;
    public tokenData: any;
    public accountLiquidity = 0;
    public selectedTokenIndex = 0;
    public ethUsdExchangeRate: any;
    public totalSupplyBalance = 0;
    public totalBorrowBalance = 0;
    public amountInput: any;
    public sliderPercentage = 0;
    public netApy = 0;
    public loadComplete = false;

    public collateralSupplyEnable = false;
    public collateralBorrowEnable = false;
    public typeViewSupply = 'withdraw';
    public typeViewBorrow = 'repay';
    public canvas: any;
    public ctx: any;
    public supplyData = [];
    public borrowData = [];
    public dataObj = {
        showBorrow: false,
        showBorrowToken: false,
        showSupply: false,
        showSupplyToken: false
    };
    public supplyTokenData = [];
    public borrowTokenData = [];
    public supplyBalance;
    public borrowBalance;

    constructor(private httpClient: HttpClient) {
        this.initializeMetaMask();
    }

    ngOnInit() {
        // this.initializeMetaMask();
    }
    ngAfterViewInit() {
        if (typeof window['ethereum'] === 'undefined' || (typeof window['web3'] === 'undefined')) {
            return;
        }

        window['ethereum'].on('accountsChanged', () => {
            window.location.reload();
        });

        window['ethereum'].on('networkChanged', () => {
            window.location.reload();
        });
        // this.initializeMetaMask();
    }

    filterTable() {
        this.supplyData = this.tokenData;
        this.borrowData = this.tokenData;
        this.supplyTokenData = this.tokenData;
        this.borrowTokenData = this.tokenData;
        this.supplyData = this.supplyData.filter(el => el.cTokenSupplyBalance > 0)
        if (this.supplyData.length > 0) {
            this.dataObj["showSupply"] = true;
        }
        this.borrowData = this.borrowData.filter(el => el.tokenBorrowBalance > 0)
        if (this.borrowData.length > 0) {
            this.dataObj["showBorrow"] = true;
        }
        this.supplyTokenData = this.supplyTokenData.filter(el => el.cTokenSupplyBalance == 0 && el.tokenBorrowBalance == 0)
        if (this.supplyTokenData.length > 0) {
            this.dataObj["showSupplyToken"] = true;
        }
        this.borrowTokenData = this.borrowTokenData.filter(el => el.tokenBorrowBalance == 0 && el.cTokenSupplyBalance == 0)
        if (this.borrowTokenData.length > 0) {
            this.dataObj["showBorrowToken"] = true;
        }
        this.tokenData.filter(el => el["supplyBalance"] = (el.cTokenSupplyBalance * parseFloat(el.priceUsd)))
        this.supplyBalance = 0
        this.tokenData.filter(el => this.supplyBalance = this.supplyBalance + el.supplyBalance)
        this.tokenData.filter(el => el["borrowBalance"] = (el.tokenBorrowBalance * parseFloat(el.priceUsd)))
        this.borrowBalance = 0
        this.tokenData.filter(el => this.borrowBalance = this.borrowBalance + el.borrowBalance);
        if (this.accountLiquidity !== 0) {
            this.sliderPercentage = parseFloat(this.borrowBalance) / (this.accountLiquidity) * 100;
        }
    }

    public setSelect2() {
        setTimeout(() => {
          $('#supply').select2({
            data: this.tokenData,
            dropdownCssClass: 'bigdrop',
            minimumResultsForSearch: Infinity,
            templateResult: this.formatCountrySelection,
            dropdownParent: $('#supplyGroup')
          });
          $('#borrow').select2({
              data: this.tokenData,
              dropdownCssClass: 'bigdrop',
              minimumResultsForSearch: Infinity,
              templateResult: this.formatCountrySelection,
              dropdownParent: $('#borrowGroup')
          });
          $('.select2-main').one('select2:open', function (e) {
              $('input.select2-search__field').prop('placeholder', 'Search');
          });
        }, 1);
    }

    public async initializeMetaMask() {
        try {
            if (typeof window['ethereum'] === 'undefined' || (typeof window['web3'] === 'undefined')) {
                setTimeout(() => { $('#noMetaMaskModal').modal('show'); }, 1);
                return;
            }
            this.ethereum = window['ethereum'];
            await this.ethereum.enable();
            this.web3 = new ethers.providers.Web3Provider(this.ethereum);
            const network = await this.web3.getNetwork();
            if (network.name !== 'kovan') {
                $('#kovanNetModal').modal('show');
                return;
            }
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
        $('#loadingModal').modal('show');
        const contractAddresses = await this.getContractAddresses();
        const allListedTokens = await this.fetchAllMarkets();
        await this.initAllContracts(contractAddresses);
        await this.fetchTokens(allListedTokens);
        this.filterTable();
        this.calcNetApy();
        await this.getExchangeRate();
        // await this.tokenData.forEach(async (token) => {
        //     this.initToken(token);
        // });
        await this.getEnteredMarkets();
        await this.getAccountLiquidity();
        // console.log(this.tokenData)
        this.setSelect2();
        this.loadComplete = true;
        $('#loadingModal').modal('hide');
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

    public async fetchTokens(allListedTokens) {
      this.tokenData = [];
      for (const cTokenAddress of allListedTokens) {
        const markets = await this.Contracts.Comptroller.markets(cTokenAddress);
        if (markets.isListed === true) {
          let token = {} as any;
          token.id = this.tokenData.length;
          token.enabled = false;
          token.approved = false;
          const cTokenContract = this.initContract(cTokenAddress, CErc20Delegator.abi);
          const cTokenName = await cTokenContract.name();
          const underlyingTokenAddress = await cTokenContract.underlying();
          const tokenContract = this.initContract(underlyingTokenAddress, IVTDemoABI.abi);
          token.name = await tokenContract.name();
          token.text = token.name;
          token.tokenAddress = underlyingTokenAddress;
          token.cTokenAddress = cTokenAddress;
          token.cTokenName = cTokenName;
          token.isListed = true;

          token.priceUsd = await this.getPrice(token.cTokenAddress);
          token.collateralFactor = await this.getCollateralFactor(token.cTokenAddress);

          const apy = await this.getAPY(cTokenContract);
          token.borrowApy = apy[0];
          token.supplyApy = apy[1];
          token.utilizationRate = parseFloat(await this.getUtilizationRate(cTokenContract)) / 10 ** 18;
          token.tokenBalance = parseFloat(await this.getUserTokenBalance(tokenContract)) / 10 ** 18;
          token.cTokenSupplyBalance = parseFloat(await this.getUserSupplyBalance(cTokenContract, token));
          token.tokenBorrowBalance = parseFloat(await this.getUserBorrowBalance(cTokenContract, token)) / 10 ** 18;
          token.approved = await this.checkApproved(tokenContract, token.cTokenAddress);
          token.availableBorrow = await this.getAvailableBorrow(cTokenContract);
          await this.getAccountLiquidity();
          this.tokenData.push(token);
        }
      }
    }

    private async initToken(token) {
        // token.text === 'DAI' ? token.name = 'DAI' : token.name = 'IVTDemo';
        // token.tokenAddress = this.contractAddresses[token.name];
        // token.cTokenAddress = this.contractAddresses[`c${token.name}`];

        // token.priceUsd = await this.getPrice(token.cTokenAddress);
        // token.collateralFactor = await this.getCollateralFactor(token.cTokenAddress);
        // const apy = await this.getAPY(this.Contracts[`c${token.name}`]);
        // token.borrowApy = apy[0];
        // token.supplyApy = apy[1];
        // token.utilizationRate = parseFloat(await this.getUtilizationRate(this.Contracts[`c${token.name}`])) / 10 ** 18;
        // token.tokenBalance = parseFloat(await this.getUserTokenBalance(this.Contracts[token.name])) / 10 ** 18;
        // token.cTokenSupplyBalance = parseFloat(await this.getUserSupplyBalance(this.Contracts[`c${token.name}`], token));
        // token.tokenBorrowBalance = parseFloat(await this.getUserBorrowBalance(this.Contracts[`c${token.name}`], token)) / 10 ** 18;
        // token.approved = await this.checkApproved(this.Contracts[token.name], token.cTokenAddress);
        // token.availableBorrow = await this.getAvailableBorrow(this.Contracts[`c${token.name}`]);
        // await this.getAccountLiquidity();
        // this.filterTable();
        // this.calcNetApy();
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

    public async getPrice(cTokenAddress) {
        let tokenPrice = await this.Contracts.PriceOracleProxy.getUnderlyingPrice(cTokenAddress);
        let daiPrice = await this.Contracts.PriceOracleProxy.getUnderlyingPrice(this.contractAddresses.cDAI);
        tokenPrice = this.getNumber(tokenPrice);
        daiPrice = this.getNumber(daiPrice);
        const price = parseFloat(tokenPrice) / parseFloat(daiPrice);
        const priceStr = price.toFixed(3);
        return priceStr;
    }

    public async getCollateralFactor(cTokenAddress) {
        const markets = await this.Contracts.Comptroller.markets(cTokenAddress);
        const colFactorStrTemp = this.getNumber(markets.collateralFactorMantissa);
        const divBy = 10 ** 16;
        const colFactorStr = parseFloat(colFactorStrTemp) / divBy;
        return colFactorStr.toFixed(2).toString();
    }

    public async getAPY(cTokenContract) {
        let borrowRate = await cTokenContract.borrowRatePerBlock();
        borrowRate = this.getNumber(borrowRate);
        let supplyRate = await cTokenContract.supplyRatePerBlock();
        supplyRate = this.getNumber(supplyRate);
        const borrowApy = this.BLOCKS_YEAR * parseFloat(borrowRate);
        const supplyApy = this.BLOCKS_YEAR * parseFloat(supplyRate);
        const divBy = 10 ** 16;
        const borrowApyPerc = borrowApy / divBy;
        const supplyApyPerc = supplyApy / divBy;
        return [borrowApyPerc.toFixed(3), supplyApyPerc.toFixed(3)];
    }

    public async getUtilizationRate(cTokenContract) {
        const cash = await cTokenContract.getCash();
        const borrow = await cTokenContract.totalBorrows();
        const reserves = await cTokenContract.totalReserves();
        const divBy = (parseFloat(cash) + parseFloat(borrow) - parseFloat(reserves));
        if (divBy === 0) {
          return '0';
        }
        const utilizationRate = (parseFloat(borrow) * (10 ** 18)) / divBy;
        return utilizationRate.toString();
    }

    public async getUserTokenBalance(tokenContract) {
        let tokenBalance = await tokenContract.balanceOf(this.userAddress);
        tokenBalance = this.getNumber(tokenBalance);
        return tokenBalance;
    }
    public async getUserSupplyBalance(cTokenContract, token) {
        let tokenBalance = await cTokenContract.balanceOf(this.userAddress);
        tokenBalance = this.getNumber(tokenBalance);

        if (parseFloat(tokenBalance) > 0) {
            let exchangeRateStored = await cTokenContract.exchangeRateStored();
            exchangeRateStored = this.getNumber(exchangeRateStored);
            const bal = (parseFloat(tokenBalance) * parseFloat(exchangeRateStored)) / 10 ** 36;
            tokenBalance = bal;
            const supplyBal = parseFloat(token.priceUsd) * (parseFloat(tokenBalance));
            this.totalSupplyBalance += supplyBal;
        }
        return tokenBalance;
    }

    public async getUserBorrowBalance(cTokenContract, token) {
        let tokenBalance = await cTokenContract.borrowBalanceStored(this.userAddress);
        tokenBalance = this.getNumber(tokenBalance);
        if (parseFloat(tokenBalance) > 0) {
            const borrowBal = parseFloat(token.priceUsd) * (parseFloat(tokenBalance) / 10 ** 8);
            this.totalBorrowBalance += borrowBal;
        }
        return tokenBalance;
    }
    public calcNetApy() {
        let posApy = 0;
        let negApy = 0;
        this.tokenData.forEach(token => {
            if (parseFloat(token.supplyBalance) > 0 && parseFloat(token.supplyApy) > 0 && parseFloat(this.supplyBalance) > 0) {
                posApy += parseFloat(token.supplyBalance) * parseFloat(token.supplyApy) / parseFloat(this.supplyBalance);
            }
            if (parseFloat(token.borrowBalance) > 0 && parseFloat(token.borrowApy) > 0 && parseFloat(this.borrowBalance) > 0) {
                negApy += parseFloat(token.borrowBalance) * parseFloat(token.borrowApy) / parseFloat(this.borrowBalance);
            }
        });
        this.netApy = posApy - negApy;
    }
    public async getAccountLiquidity() {
        this.tokenData.forEach(token => {
            if (parseFloat(token.supplyBalance) > 0 && token.enabled === true) {
                this.accountLiquidity += (parseFloat(token.collateralFactor) * parseFloat(token.supplyBalance) / 100);
            }
        });
        // console.log(this.accountLiquidity);
        // const liquidityData = await this.Contracts.Comptroller.getAccountLiquidity(this.userAddress);
        // if (this.getNumber(liquidityData[0]) === '0') {
        //   const val = this.getNumber(liquidityData[1]);
        //   const valInEth = ethers.utils.formatEther(val);
        //   this.accountLiquidity = this.getUsdPrice(valInEth);
        //   // console.log(this.accountLiquidity)
        // }
    }
    public toDecimal(val, decimal) {
        if (val === undefined || val === null) {
            return;
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

    public async getExchangeRate() {
        this.ethUsdExchangeRate = null;
        let daiPrice = await this.Contracts.PriceOracleProxy.getUnderlyingPrice(this.contractAddresses.cDAI);
        daiPrice = this.getNumber(daiPrice);
        const price = (10 ** 18) / parseFloat(daiPrice);
        this.ethUsdExchangeRate = price.toFixed(3);
    }

    public async getEnteredMarkets() {
        const assetsInArray = await this.Contracts.Comptroller.getAssetsIn(this.userAddress);
        if (assetsInArray.length === 0) { return; }

        // tslint:disable-next-line: prefer-for-of
        for (let i = 0; i < assetsInArray.length; i++) {
            // tslint:disable-next-line: prefer-for-of
            for (let j = 0; j < this.tokenData.length; j++) {
                if (assetsInArray[i].toLowerCase() === this.tokenData[j].cTokenAddress.toLowerCase()) {
                    this.tokenData[j].enabled = true;
                }
            }
        }
    }

    public async getAvailableBorrow(cTokenContract) {
        let cash = await cTokenContract.getCash();
        cash = this.getNumber(cash);
        const availableBorrow = parseFloat(cash) / this.DECIMAL_18;
        return availableBorrow.toString();
    }
    public async checkApproved(tokenContract, allowanceOf) {
        let approvedBal = await tokenContract.allowance(this.userAddress, allowanceOf);
        approvedBal = this.getNumber(approvedBal);
        return approvedBal !== '0' ? true : false;
    }
    public getUsdPrice(val) {
        return (parseFloat(val) * parseFloat(this.ethUsdExchangeRate)).toString();
    }

    public getNumber(hexNum) {
        return ethers.utils.bigNumberify(hexNum).toString();
    }


    public async erc20Approve() {
        const amountStr = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
        const tokenAddress = this.tokenData[this.selectedTokenIndex].tokenAddress;
        const tokenContract = this.initContract(tokenAddress, IVTDemoABI.abi);
        const tx = await tokenContract.approve(this.tokenData[this.selectedTokenIndex].cTokenAddress, amountStr);
        await this.web3.waitForTransaction(tx.hash);
        window.location.reload();
    }

    public async enterExitMarket(token) {
        let addressArray = [];
        addressArray.push(token.cTokenAddress);
        let tx;
        if (token.enabled === true) {
            tx = await this.Contracts.Comptroller.exitMarket(token.cTokenAddress);
        } else {
            tx = await this.Contracts.Comptroller.enterMarkets(addressArray);
        }
        await this.web3.waitForTransaction(tx.hash);
        window.location.reload();
    }

    public async mint() {
        // const tokenName = this.tokenData[this.selectedTokenIndex].name;
        // const cTokenContract = this.Contracts[`c${tokenName}`];
        const cTokenAddress = this.tokenData[this.selectedTokenIndex].cTokenAddress;
        const cTokenContract = this.initContract(cTokenAddress, CErc20Immutable.abi);
        const tx = await cTokenContract.mint(ethers.utils.parseEther(this.amountInput));
        await this.web3.waitForTransaction(tx.hash);
        window.location.reload();
    }

    public async withdrawUnderlying() {
        // const tokenName = this.tokenData[this.selectedTokenIndex].name;
        // const cTokenContract = this.Contracts[`c${tokenName}`];
        const cTokenAddress = this.tokenData[this.selectedTokenIndex].cTokenAddress;
        const cTokenContract = this.initContract(cTokenAddress, CErc20Immutable.abi);
        const tx = await cTokenContract.redeemUnderlying(ethers.utils.parseEther(this.amountInput));
        await this.web3.waitForTransaction(tx.hash);
        window.location.reload();
    }

    public async borrow() {
        // const tokenName = this.tokenData[this.selectedTokenIndex].name;
        // const cTokenContract = this.Contracts[`c${tokenName}`];
        const cTokenAddress = this.tokenData[this.selectedTokenIndex].cTokenAddress;
        const cTokenContract = this.initContract(cTokenAddress, CErc20Immutable.abi);
        const tx = await cTokenContract.borrow(ethers.utils.parseEther(this.amountInput), { gasLimit: 400000 });
        await this.web3.waitForTransaction(tx.hash);
        window.location.reload();
    }

    public async repayBorrow() {
        // const tokenName = this.tokenData[this.selectedTokenIndex].name;
        // const cTokenContract = this.Contracts[`c${tokenName}`];
        const cTokenAddress = this.tokenData[this.selectedTokenIndex].cTokenAddress;
        const cTokenContract = this.initContract(cTokenAddress, CErc20Immutable.abi);
        const tx = await cTokenContract.repayBorrow(ethers.utils.parseEther(this.amountInput), { gasLimit: 350000 });
        await this.web3.waitForTransaction(tx.hash);
        window.location.reload();
    }

    public async faucet() {
        // const tokenName = this.tokenData[this.selectedTokenIndex].name;
        // const tokenAddress = this.contractAddresses[tokenName];
        // const IvtContract = this.initContract(tokenAddress, IVTDemoABI.abi);
        const tokenAddress = this.tokenData[this.selectedTokenIndex].tokenAddress;
        const tokenContract = this.initContract(tokenAddress, IVTDemoABI.abi);
        const tx = await tokenContract.allocateTo(this.userAddress, ethers.utils.parseEther('10000'));
        await this.web3.waitForTransaction(tx.hash);
        window.location.reload();
    }

    openSupplyModal(i) {
        this.amountInput = null;
        $('#supply').val(this.tokenData[i].id);
        this.selectedTokenIndex = $('#supply').val();
        $('#supply').trigger('change');
        $('#supply').on('change', function () {
            this.selectedTokenIndex = $('#supply').val();
        }.bind(this));
        $('#supplyModal').modal('show');
    }
    openBorrowModal(i) {
        this.amountInput = null;
        $('#borrow').val(this.tokenData[i].id);
        this.selectedTokenIndex = $('#borrow').val();
        $('#borrow').trigger('change');
        $('#borrow').on('change', function () {
            this.selectedTokenIndex = $('#borrow').val();
        }.bind(this));
        $('#borrowModal').modal('show');
    }

    enableSupplyCollateral() {
        this.collateralSupplyEnable = true;
        this.erc20Approve();
    }
    enableBorrowCollateral() {
        this.collateralBorrowEnable = true;
        this.erc20Approve();
    }

    viewWithdrawForm() {
        this.typeViewSupply = 'withdraw';
    }

    viewSupplyForm() {
        this.typeViewSupply = 'supply';
    }

    viewRepayForm() {
        this.typeViewBorrow = 'repay';
    }

    viewBorrowForm() {
        this.typeViewBorrow = 'borrow';
    }

    formatCountrySelection(supply) {
        if (!supply.id) {
            return supply.text;
        }
        const $supply = $(
            '<span>' + supply.text + '</span>'
        );
        return $supply;
    }

}

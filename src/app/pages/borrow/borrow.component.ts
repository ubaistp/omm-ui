import { Component, OnInit, ViewEncapsulation, AfterViewInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ethers } from 'ethers';
import Web3 from 'web3';
import { BigNumber } from 'bignumber.js';
import { blockchainConstants } from '../../../environments/blockchain-constants';
import { SharedService } from '../../commonData.service';
import * as Comptroller from '../../../assets/contracts/Comptroller.json';
import * as PriceOracle from '../../../assets/contracts/PriceOracle.json';
import * as CErc20Delegator from '../../../assets/contracts/CErc20Delegator.json';
import * as CErc20Immutable from '../../../assets/contracts/CErc20Immutable.json';
// import * as CErc20 from '../../../assets/contracts/CErc20.json';
import * as IVTDemoABI from '../../../assets/contracts/IVTDemoABI.json';
import * as ERC20Detailed from '../../../assets/contracts/ERC20Detailed.json';
// import * as EIP20Interface from '../../../assets/contracts/EIP20Interface.json';

declare var $: any;
declare var cApp: any;
BigNumber.config({ ROUNDING_MODE: BigNumber.ROUND_DOWN });

@Component({
  selector: '',
  templateUrl: './borrow.component.html',
  encapsulation: ViewEncapsulation.None,
  providers: []
})
export class BorrowComponent implements OnInit, AfterViewInit, OnDestroy {

  private web3: any;
  public userAddress: any;
  public Contracts: any;
  public contractAddresses: any;
  public BLOCKS_YEAR = 2102400;
  public GAS_PRICE = ethers.utils.parseUnits('20', 'gwei');
  public DECIMAL_18 = 10 ** 18;
  public tokenData: any;
  public accountLiquidity = 0;
  public selectedTokenIndex = 0;
  public totalSupplyBalance = 0;
  public totalBorrowBalance = 0;
  public amountInput: any;
  public sliderPercentage = 0;
  public apyData = { netApy: 0, posApy: 0, negApy: 0 };
  public loadComplete = false;
  public polling: any;
  public callCount = 0;
  public numListedMarkets = 0;
  public networkData = { name: null, isMainnet: false };
  public cashTokenData = [];
  public assetTokenData = [];

  public collateralSupplyEnable = false;
  public collateralBorrowEnable = false;
  public typeViewSupply = 'supply';
  public typeViewBorrow = 'borrow';
  public totalCashLoans = 0;
  public totalCashDeployed = 0;

  constructor(private http: HttpClient, private sharedService: SharedService) { }

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

  ngAfterViewInit() {
    this.updateBalanceEffect();
  }
  ngOnDestroy() {
    clearInterval(this.polling);
  }

  filterTable() {
    this.cashTokenData = this.filterCashTokenArray();
    this.assetTokenData = this.filterAssetTokenArray();
  }

  private calcTotalLoanAmount() {
    this.totalCashLoans = 0;
    this.cashTokenData.forEach(token => {
      if (parseFloat(token.totalErc20Borrows) >= 0) {
        this.totalCashLoans += (parseFloat(token.totalErc20Borrows) * parseFloat(token.priceUsd));
      }
    });
  }

  private calcTotalDeployedAmount() {
    this.totalCashDeployed = 5;
    this.cashTokenData.forEach(token => {
      if (parseFloat(token.totalErc20Supply) >= 0) {
        this.totalCashDeployed += (parseFloat(token.totalErc20Supply) * parseFloat(token.priceUsd));
      }
    });
  }

  public filterCashTokenArray() {
    if (this.tokenData.length === 0) { return; }

    const result = this.tokenData.filter(token => parseFloat(token.collateralFactor) === 0);
    return result;
  }

  public filterAssetTokenArray() {
    if (this.tokenData.length === 0) { return; }

    const result = this.tokenData.filter(token => parseFloat(token.collateralFactor) !== 0);
    return result;
  }

  public setSelect2() {
    setTimeout(() => {
      $('#supply').select2({
        data: this.assetTokenData,
        dropdownCssClass: 'bigdrop',
        minimumResultsForSearch: Infinity,
        templateResult: this.formatCountrySelection,
        dropdownParent: $('#supplyGroup')
      });
      $('#borrow').select2({
        data: this.cashTokenData,
        dropdownCssClass: 'bigdrop',
        minimumResultsForSearch: Infinity,
        templateResult: this.formatCountrySelection,
        dropdownParent: $('#borrowGroup')
      });
      // tslint:disable-next-line: only-arrow-functions
      $('.select2-main').one('select2:open', function(e) {
        $('input.select2-search__field').prop('placeholder', 'Search');
      });
    }, 0);
  }

  private updateBalanceEffect() {
    const secondsInYear = 31622400;
    const updateIntervalInSec = 7;
    this.polling = setInterval(() => {
      if (this.toDecimal(this.totalSupplyBalance, 7) > 0 && this.apyData.posApy > 0) {
        const posApyPerSec = this.apyData.posApy / secondsInYear;
        const posApyPerInterval = posApyPerSec * updateIntervalInSec;
        this.totalSupplyBalance += (this.totalSupplyBalance * posApyPerInterval / 100);
      }
      if (this.toDecimal(this.totalBorrowBalance, 7) > 0 && this.apyData.negApy > 0) {
        const negApyPerSec = this.apyData.negApy / secondsInYear;
        const negApyPerInterval = negApyPerSec * updateIntervalInSec;
        this.totalBorrowBalance += (this.totalBorrowBalance * negApyPerInterval / 100);
      }
    }, updateIntervalInSec * 1000);
  }

  public async initializeProvider() {
    try {
      this.web3 = await this.sharedService.web3;
      await this.setup();

    } catch (error) {
      console.error(error);
    }
  }

  public reloadPage() {
    window.location.reload();
  }

  public async setup() {
    this.userAddress = await this.web3.getSigner().getAddress();
    // this.userAddress = '0x5a995f45CcE03670D94a0c89572dc74598d57581';
    cApp.blockPage({
      overlayColor: '#000000',
      state: 'secondary',
      message: 'Loading App...'
    });
    const contractAddresses = await this.getContractAddresses();

    // In case of unknown networks
    if (typeof contractAddresses === 'undefined') { return; }

    const allListedTokens = await this.fetchAllMarkets();
    await this.initAllContracts(contractAddresses);
    const necessaryMarkets = await this.removeUnnecessaryMarkets(allListedTokens);
    this.estimateGasPrice();

    // In case there are no markets
    if (allListedTokens.length === 0) {
      cApp.unblockPage();
      return;
    }
    this.fetchTokens(necessaryMarkets);
    // console.log(this.tokenData);
  }

  public async afterInitToken() {
    this.callCount++;
    if (this.callCount < this.numListedMarkets) {
      return;
    }
    // timeout for all async calls to resolve
    setTimeout(async () => {
      await this.getEnteredMarkets();
      this.filterTable();
      await this.getAccountLiquidity();
      this.calcNetApy();
      this.setSelect2();
      this.calcTotalLoanAmount();
      this.calcTotalDeployedAmount();
      if (this.accountLiquidity !== 0) {
        this.sliderPercentage = (this.totalBorrowBalance) / (this.accountLiquidity) * 100;
      }
      this.loadComplete = true;
    }, 100);
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
      this.networkData.name = 'mainnet';
      contractAddresses = blockchainConstants.mainnet;
    } else {
      this.networkData.name = network.name;
      contractAddresses = blockchainConstants[network.name];
    }
    this.contractAddresses = contractAddresses;
    return contractAddresses;
  }

  public async fetchAllMarkets() {
    const myWeb3 = new Web3(this.web3.provider);
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

  private async removeUnnecessaryMarkets(allListedTokens) {
    const minNecessaryPrice = 0.001;
    const necessaryMarkets = [];
    if (this.contractAddresses.TokensToBeRemoved) {
      for (const cTokenAddress of allListedTokens) {
        if (!this.contractAddresses.TokensToBeRemoved.includes(cTokenAddress)) {
          const price = await this.getPrice(cTokenAddress);
          const colFac = await this.getCollateralFactor(cTokenAddress);
          if (parseFloat(price) >= minNecessaryPrice || parseFloat(colFac) !== 0) {
            necessaryMarkets.push(cTokenAddress);
          }
        }
      }
    } else {
      for (const cTokenAddress of allListedTokens) {
        const price = await this.getPrice(cTokenAddress);
        const colFac = await this.getCollateralFactor(cTokenAddress);
        if (parseFloat(price) >= minNecessaryPrice || parseFloat(colFac) !== 0) {
          necessaryMarkets.push(cTokenAddress);
        }
      }
    }
    this.numListedMarkets = necessaryMarkets.length;
    return necessaryMarkets;
  }

  public fetchTokens(allListedTokens) {
    this.tokenData = [];
    for (const cTokenAddress of allListedTokens) {
      const token = {} as any;
      token.id = this.tokenData.length;
      token.enabled = false;
      token.approved = false;
      token.cTokenAddress = cTokenAddress;
      this.initToken(token);
      this.tokenData.push(token);
    }
  }

  private async initToken(token) {
    token.isListed = true;
    const cTokenContract = this.initContract(token.cTokenAddress, CErc20Delegator.abi);
    this.getPrice(token.cTokenAddress).then(priceUsd => {
      token.priceUsd = parseFloat(priceUsd).toFixed(2);
      this.getUserSupplyBalance(cTokenContract, token).then(cTokenSupplyBalance => {
        token.cTokenSupplyBalance = parseFloat(cTokenSupplyBalance);
        token.cTokenSupplyBalanceUSD = this.getUserSupplyBalanceUSD(token);
      });
      this.getUserBorrowBalance(cTokenContract, token).then(tokenBorrowBalance => {
        token.tokenBorrowBalance = parseFloat(tokenBorrowBalance);
        token.tokenBorrowBalanceUSD = this.getUserBorrowBalanceUSD(token);
      });
    });
    cTokenContract.name().then(cTokenName => {
      token.cTokenName = cTokenName;
    });
    cTokenContract.underlying().then(underlyingTokenAddress => {
      token.tokenAddress = underlyingTokenAddress;
      const tokenContract = this.initContract(underlyingTokenAddress, IVTDemoABI.abi);
      tokenContract.decimals().then(async (decimals) => {
        const divBy = 10 ** parseFloat(decimals);
        token.erc20Decimals = decimals;
        this.getUserTokenBalance(tokenContract).then(tokenBalance => {
          token.tokenBalance = parseFloat(tokenBalance) / divBy;
          this.afterInitToken();
        });
        tokenContract.totalSupply().then((totalSupply) => {
          totalSupply = this.getNumber(totalSupply);
          token.erc20TotalSupply = parseFloat(totalSupply) / 10 ** parseFloat(token.erc20Decimals);
        });
      });
      tokenContract.symbol().then((symbol) => {
        symbol = this.capitalize(symbol);
        token.symbol = symbol;
        token.text = token.symbol;
      });
      tokenContract.name().then(async (name) => {
        token.name = name;
        // this.afterInitToken();
      });
      this.checkApproved(tokenContract, token.cTokenAddress).then(approved => {
        token.approved = approved;
      });
      this.getCtokenBorrows(cTokenContract, tokenContract).then(totalErc20Borrows => {
        token.totalErc20Borrows = totalErc20Borrows;
      });
      this.getCtokenSupply(cTokenContract, tokenContract).then(totalErc20Supply => {
        token.totalErc20Supply = totalErc20Supply;
      });
    });
    this.getCollateralFactor(token.cTokenAddress).then(collateralFactor => {
      token.collateralFactor = collateralFactor;
    });
    this.getAPY(cTokenContract).then(apy => {
      token.borrowApy = apy[0];
      token.supplyApy = apy[1];
    });
    this.getUtilizationRate(cTokenContract).then(utilizationRate => {
      token.utilizationRate = parseFloat(utilizationRate) / 10 ** 18;
    });
    this.getAvailableBorrow(cTokenContract).then(availableBorrow => {
      token.availableBorrow = availableBorrow;
    });
  }

  private async initAllContracts(contractAddresses) {
    this.Contracts = {};
    this.Contracts.Comptroller = this.initContract(contractAddresses.Comptroller, Comptroller.abi);

    const oracleAddress = await this.Contracts.Comptroller.oracle();
    this.Contracts.PriceOracleProxy = this.initContract(oracleAddress, PriceOracle.abi);
  }

  private initContract(contractAddress, abi) {
    return new ethers.Contract(contractAddress, abi, this.web3.getSigner());
  }

  public async getPrice(cTokenAddress) {
    let tokenPrice = await this.Contracts.PriceOracleProxy.getUnderlyingPrice(cTokenAddress);
    tokenPrice = this.getNumber(tokenPrice);
    // let daiPrice = await this.Contracts.PriceOracleProxy.getUnderlyingPrice(this.contractAddresses.kDAI);
    // daiPrice = this.getNumber(daiPrice);
    // const price = parseFloat(tokenPrice) / parseFloat(daiPrice);

    // when default deployed Dai was removed
    const price = parseFloat(tokenPrice) / this.DECIMAL_18;
    return price.toString();
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

  public async getCtokenBorrows(cTokenContract, tokenContract) {
    const borrow = await cTokenContract.totalBorrows();
    const erc20Decimals = await tokenContract.decimals();
    const erc20Borrows = parseFloat(borrow) / 10 ** parseFloat(erc20Decimals);
    return erc20Borrows;
  }

  public async getCtokenSupply(cTokenContract, tokenContract) {
    const erc20Decimals = await tokenContract.decimals();
    const borrow = await cTokenContract.totalBorrows();
    const cash = await cTokenContract.getCash();
    const reserves = await cTokenContract.totalReserves();
    const added = (parseFloat(cash) + parseFloat(borrow) + parseFloat(reserves));
    const divBy = 10 ** parseFloat(erc20Decimals);
    const result = added / divBy;
    return result;
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
      const underlying = await cTokenContract.underlying();
      const tokenContract = this.initContract(underlying, ERC20Detailed.abi);
      const tokenDecimals = await tokenContract.decimals();
      const divBy = this.DECIMAL_18 * (10 ** parseFloat(tokenDecimals));

      let exchangeRateStored = await cTokenContract.exchangeRateStored();
      exchangeRateStored = this.getNumber(exchangeRateStored);
      const bal = (parseFloat(tokenBalance) * parseFloat(exchangeRateStored)) / divBy;
      tokenBalance = bal;
      const supplyBal = parseFloat(token.priceUsd) * (parseFloat(tokenBalance));
      this.totalSupplyBalance += supplyBal;
    }
    return tokenBalance;
  }

  private getUserSupplyBalanceUSD(token) {
    return parseFloat(token.cTokenSupplyBalance) * parseFloat(token.priceUsd);
  }

  public async getUserBorrowBalance(cTokenContract, token) {
    let tokenBalance = await cTokenContract.borrowBalanceStored(this.userAddress);
    tokenBalance = this.getNumber(tokenBalance);
    if (parseFloat(tokenBalance) > 0) {
      const underlying = await cTokenContract.underlying();
      const tokenContract = this.initContract(underlying, ERC20Detailed.abi);
      const tokenDecimals = await tokenContract.decimals();

      tokenBalance = parseFloat(tokenBalance) / 10 ** parseFloat(tokenDecimals);
      const borrowBal = parseFloat(token.priceUsd) * parseFloat(tokenBalance);
      this.totalBorrowBalance += borrowBal;
    }
    return tokenBalance;
  }

  private getUserBorrowBalanceUSD(token) {
    return parseFloat(token.tokenBorrowBalance) * parseFloat(token.priceUsd);
  }

  public calcNetApy() {
    let posApy = 0;
    let negApy = 0;
    this.tokenData.forEach(token => {
      if (parseFloat(token.cTokenSupplyBalanceUSD) > 0 && parseFloat(token.supplyApy) > 0 && (this.totalSupplyBalance) > 0) {
        posApy += parseFloat(token.cTokenSupplyBalanceUSD) * parseFloat(token.supplyApy) / (this.totalSupplyBalance);
      }
      if (parseFloat(token.tokenBorrowBalanceUSD) > 0 && parseFloat(token.borrowApy) > 0 && (this.totalBorrowBalance) > 0) {
        negApy += parseFloat(token.tokenBorrowBalanceUSD) * parseFloat(token.borrowApy) / (this.totalBorrowBalance);
      }
    });
    this.apyData.netApy = posApy - negApy;
    this.apyData.posApy = posApy;
    this.apyData.negApy = negApy;
  }
  public async getAccountLiquidity() {
    this.accountLiquidity = 0;
    this.tokenData.forEach(token => {
      if (parseFloat(token.cTokenSupplyBalanceUSD) > 0 && token.enabled === true) {
        this.accountLiquidity += (parseFloat(token.collateralFactor) * parseFloat(token.cTokenSupplyBalanceUSD) / 100);
      }
    });
  }
  public toDecimal(val, decimal) {
    if (val === undefined || val === null) {
      return 0;
    }
    val = val.toString();
    val = new BigNumber(val);
    return val.toFixed(decimal);
  }
  public trucateAddress(address) {
    if (address === null || address === undefined) { return; }
    const start4Digits = address.slice(0, 6);
    const separator = '...';
    const last4Digits = address.slice(-4);
    return (start4Digits.padStart(2, '0') + separator.padStart(2, '0') + last4Digits.padStart(2, '0'));
  }
  public capitalize(s) {
    return s && s[0].toUpperCase() + s.slice(1);
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
    const underlying = await cTokenContract.underlying();
    const tokenContract = this.initContract(underlying, ERC20Detailed.abi);
    const tokenDecimals = await tokenContract.decimals();

    let cash = await cTokenContract.getCash();
    cash = this.getNumber(cash);
    const availableBorrow = parseFloat(cash) / (10 ** parseFloat(tokenDecimals));
    return availableBorrow.toString();
  }
  public async checkApproved(tokenContract, allowanceOf) {
    let approvedBal = await tokenContract.allowance(this.userAddress, allowanceOf);
    approvedBal = this.getNumber(approvedBal);
    return approvedBal !== '0' ? true : false;
  }

  public getNumber(hexNum) {
    return ethers.utils.bigNumberify(hexNum).toString();
  }

  public async erc20Approve() {
    this.estimateGasPrice();
    const amountStr = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
    const tokenAddress = this.tokenData[this.selectedTokenIndex].tokenAddress;
    const tokenContract = this.initContract(tokenAddress, IVTDemoABI.abi);
    const overrides = {
      gasPrice: this.GAS_PRICE,
    };
    const tx = await tokenContract.approve(this.tokenData[this.selectedTokenIndex].cTokenAddress, amountStr, overrides);
    await this.web3.waitForTransaction(tx.hash);
    window.location.reload();
  }

  public async enterExitMarket(token) {
    this.estimateGasPrice();
    const addressArray = [];
    addressArray.push(token.cTokenAddress);
    let tx;
    const overrides = {
      gasPrice: this.GAS_PRICE,
    };
    if (token.enabled === true) {
      tx = await this.Contracts.Comptroller.exitMarket(token.cTokenAddress, overrides);
    } else {
      tx = await this.Contracts.Comptroller.enterMarkets(addressArray, overrides);
    }
    await this.web3.waitForTransaction(tx.hash);
    window.location.reload();
  }

  public async mint() {
    this.estimateGasPrice();
    const tokenAddress = this.tokenData[this.selectedTokenIndex].tokenAddress;
    const TokenContract = this.initContract(tokenAddress, ERC20Detailed.abi);
    const decimals = await TokenContract.decimals();
    const mulBy = 10 ** parseFloat(decimals);
    let amountInDec: any = parseFloat(this.amountInput) * mulBy;
    amountInDec = amountInDec.toLocaleString('fullwide', { useGrouping: false });

    const cTokenAddress = this.tokenData[this.selectedTokenIndex].cTokenAddress;
    const cTokenContract = this.initContract(cTokenAddress, CErc20Immutable.abi);
    const overrides = {
      gasPrice: this.GAS_PRICE,
    };
    const tx = await cTokenContract.mint(amountInDec, overrides);
    await this.web3.waitForTransaction(tx.hash);
    window.location.reload();
  }

  public async withdrawUnderlying() {
    this.estimateGasPrice();
    const tokenAddress = this.tokenData[this.selectedTokenIndex].tokenAddress;
    const TokenContract = this.initContract(tokenAddress, ERC20Detailed.abi);
    const decimals = await TokenContract.decimals();
    const mulBy = 10 ** parseFloat(decimals);
    let amountInDec: any = parseFloat(this.amountInput) * mulBy;
    amountInDec = amountInDec.toLocaleString('fullwide', { useGrouping: false });

    const cTokenAddress = this.tokenData[this.selectedTokenIndex].cTokenAddress;
    const cTokenContract = this.initContract(cTokenAddress, CErc20Immutable.abi);
    const overrides = {
      gasPrice: this.GAS_PRICE,
    };
    const tx = await cTokenContract.redeemUnderlying(amountInDec, overrides);
    await this.web3.waitForTransaction(tx.hash);
    window.location.reload();
  }
  public async borrow() {
    this.estimateGasPrice();
    const tokenAddress = this.tokenData[this.selectedTokenIndex].tokenAddress;
    const TokenContract = this.initContract(tokenAddress, ERC20Detailed.abi);
    const decimals = await TokenContract.decimals();
    const mulBy = 10 ** parseFloat(decimals);
    let amountInDec: any = parseFloat(this.amountInput) * mulBy;
    amountInDec = amountInDec.toLocaleString('fullwide', { useGrouping: false });

    const cTokenAddress = this.tokenData[this.selectedTokenIndex].cTokenAddress;
    const cTokenContract = this.initContract(cTokenAddress, CErc20Immutable.abi);
    const overrides = {
      gasPrice: this.GAS_PRICE,
      gasLimit: 600000,
    };
    const tx = await cTokenContract.borrow(amountInDec, overrides);
    await this.web3.waitForTransaction(tx.hash);
    window.location.reload();
  }

  public async repayBorrow() {
    this.estimateGasPrice();
    const tokenAddress = this.tokenData[this.selectedTokenIndex].tokenAddress;
    const TokenContract = this.initContract(tokenAddress, ERC20Detailed.abi);
    const decimals = await TokenContract.decimals();
    const mulBy = 10 ** parseFloat(decimals);
    let amountInDec: any = parseFloat(this.amountInput) * mulBy;
    amountInDec = amountInDec.toLocaleString('fullwide', { useGrouping: false });

    const cTokenAddress = this.tokenData[this.selectedTokenIndex].cTokenAddress;
    const cTokenContract = this.initContract(cTokenAddress, CErc20Immutable.abi);
    const overrides = {
      gasPrice: this.GAS_PRICE,
      gasLimit: 450000,
    };
    const tx = await cTokenContract.repayBorrow(amountInDec, overrides);
    await this.web3.waitForTransaction(tx.hash);
    window.location.reload();
  }

  public localeString(num, precision) {
    if (num === null || num === undefined) { return; }

    num = parseFloat(num);
    num = num.toLocaleString(undefined, { maximumFractionDigits: precision });
    return num;
  }

  public async faucet() {
    const tokenAddress = this.tokenData[this.selectedTokenIndex].tokenAddress;
    const tokenContract = this.initContract(tokenAddress, IVTDemoABI.abi);
    const overrides = {
      gasPrice: this.GAS_PRICE,
    };
    const tx = await tokenContract.allocateTo(this.userAddress, ethers.utils.parseEther('10000'), overrides);
    await this.web3.waitForTransaction(tx.hash);
    window.location.reload();
  }

  openSupplyModal(i) {
    this.amountInput = null;
    $('#supply').val(this.tokenData[i].id);
    this.selectedTokenIndex = $('#supply').val();
    $('#supply').trigger('change');
    $('#supply').on('change', function() {
      this.selectedTokenIndex = $('#supply').val();
    }.bind(this));
    $('#supplyModal').modal('show');
  }
  openBorrowModal(i) {
    this.amountInput = null;
    $('#borrow').val(this.tokenData[i].id);
    this.selectedTokenIndex = $('#borrow').val();
    $('#borrow').trigger('change');
    $('#borrow').on('change', function() {
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

import { Component, OnInit, ViewEncapsulation, AfterViewInit } from '@angular/core';
import { SharedService } from '../commonData.service';
import { CookieService } from 'ngx-cookie-service';
import emailjs from 'emailjs-com';

declare var $: any;

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  encapsulation: ViewEncapsulation.None,
  providers: []
})
export class HeaderComponent implements OnInit, AfterViewInit {

  private web3: any;
  public userAddress;
  public networkString: any;
  private networkName: any;


  constructor(private sharedService: SharedService, private cookie: CookieService) {
    this.initialize();
  }
  ngOnInit() {
    this.sharedService.proceedApp$.subscribe((value) => {
      if (value === true) {
        this.initialize();
      }
    });
  }
  ngAfterViewInit() {
    $( '.onboarding-next-btn' ).on( 'click', () => {
      const name = $('input[name=\'user_name\']').val();
      const email = $('input[name=\'email\']').val();
      const phone = $('input[name=\'phone\']').val();
      const investorType = $('input[name=\'wholesale_investing_as\']:checked').val();
      alert(name + email + phone + investorType);
      $('.carousel').carousel('next');
    });
    // $("#onboarding_pd_btn").click(() => $(".carousel").carousel("next"));
  }

  public async connect(walletName) {
    await this.sharedService.connect(walletName);
    window['ethereum'].on('networkChanged', () => {
        window.location.reload();
    });
    const cookieExists: boolean = this.cookie.check('first_visit');
    this.cookie.set('first_visit', 'true', 730);
    if (!cookieExists) {
      $('#previewModal').modal('show');
    }
  }

  public async initialize() {
    this.networkString = {};
    this.web3 = await this.sharedService.web3;

    if (typeof(this.web3) === 'undefined') { return; }

    const network = await this.web3.getNetwork();
    const networkName = network.name;
    this.networkName = network.name;

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
    this.reloadListener();
  }

  public disconnectWallet() {
    this.sharedService.disconnectWallet();
  }

  private reloadListener() {
    setInterval(async () => {
      const provider = await this.sharedService.getNewProvider();

      const currentAddress = await provider.getSigner().getAddress();
      if (currentAddress.toLowerCase() !== this.userAddress.toLowerCase()) {
        window.location.reload();
      }

      const network = (await provider.getNetwork()).name;
      if (network.toLowerCase() !== this.networkName.toLowerCase()) {
        window.location.reload();
      }
    }, 1000);
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

  submitOnboardingForm() {
    const myform = $('#myform');
    const investorType = $('input[name=\'wholesale_investing_as\']:checked').val();

    // var params = myform.serializeArray().reduce(function(obj, item) {
    //    obj[item.name] = item.value;
    //    return obj;
    // }, {});

    const params = {
        investor_type: investorType
    };

    // tslint:disable: variable-name
    const service_id = 'sendgrid';
    const template_id = 'template_siNEEQDI';
    const user_id = 'user_CQFZWxNZIFSRRJphtIHwZ';
    myform.find('button').text('Sending...');
    emailjs.send(service_id, template_id, params, user_id)
      .then(() => {
          alert('Sent!');
          myform.find('button').text('Send');
        }, (err) => {
          alert('Oops! Something went wrong. Please try again later.\r\n Response:\n ' + JSON.stringify(err));
          myform.find('button').text('Send');
    });
    return false;
  }

}

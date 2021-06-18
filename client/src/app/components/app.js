import React from 'react';
import Panels from './panels';
import Brand from './panels/brand';
import Settings from './panels/settings';
import Viewer from './panels/viewer';
import * as AppConst from '../appConstants';
import { ErrorModal } from './controls/error-modal/error-modal';
import { NCIFooter } from './controls/nci-footer/nci-footer';
import './main.scss'

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.defaultSettings = {
      array: AppConst.settings.defaults.array,
      sample: AppConst.settings.defaults.sample,
      probes: AppConst.settings.defaults.probes,
      probesCount: AppConst.settings.defaults.probes.length,
      probesIndex: 0,
      currentProbe: AppConst.settings.defaults.probes[0],
      padding: AppConst.settings.defaults.padding,
      smoothing: AppConst.settings.defaults.smoothing,
      annotationType: AppConst.settings.defaults.annotationType,
      signalType: AppConst.settings.defaults.signalType,
      viewMode: AppConst.settings.defaults.viewMode,
      snpFilter: AppConst.settings.defaults.snpFilter,
      errorModal: AppConst.settings.defaults.errorModal
    };

    const queryString = require('query-string');
    const parsed = queryString.parse(location.search);
    if (parsed.array !== undefined) {
      var array = parsed.array;
      if (Object.keys(AppConst.settings.arrays).indexOf(array) != -1) {
        this.defaultSettings.array = array;
      }
    }
    if (parsed.sample !== undefined) {
      var sample = parsed.sample;
      if (Object.keys(AppConst.settings.samples).indexOf(sample) != -1) {
        this.defaultSettings.sample = sample;
      }
    }
    if (parsed.probes !== undefined) {
      this.defaultSettings.probes = parsed.probes.split(',');
      this.defaultSettings.probesCount = parsed.probes.split(',').length;
      this.defaultSettings.currentProbe = parsed.probes.split(',')[0];
    }
    if (parsed.padding !== undefined) {
      var padding = parseInt(parsed.padding);
      console.log(padding, [20, 50, 100, 200, 500].indexOf(padding));
      if ([20, 50, 100, 200, 500].indexOf(padding) != -1) {
        this.defaultSettings.padding = padding;
      }
    }
    if (parsed.smoothing !== undefined) {
      var smoothing = parseInt(parsed.smoothing);
      console.log(smoothing, [0, 1, 2, 3, 5].indexOf(smoothing));
      if ([0, 1, 2, 3, 5].indexOf(smoothing) != -1) {
        this.defaultSettings.smoothing = smoothing;
      }
    }

    this.state = {
      brandTitle: 'FORGE2 TF',
      brandSubtitle: 'TF-centric SNP array browser',
      settings: this.defaultSettings,
      settingsChangeStart: false,
      plotKey: 0,
      plotKeyPrefix: 'plot-',
      tfTableKey: 0,
      tfTableKeyPrefix: 'tfTable-',
      errorModal: this.defaultSettings.errorModal
    };
    this.updateSettings = this.updateSettings.bind(this);
    this.updateSettingsChange = this.updateSettingsChange.bind(this);
    this.randomInt = this.randomInt.bind(this);
    this.updateCurrentProbe = this.updateCurrentProbe.bind(this);
    this.updateCloseErrorModal = this.updateCloseErrorModal.bind(this);
    this.updateShowErrorModal = this.updateShowErrorModal.bind(this);
  }

  componentDidMount() {
    console.log('initial settings...');
    console.log(this.state.settings);
  }

  updateSettings(settings) {
    this.setState(
      {
        settingsChangeStart: true,
        settings: settings,
        plotKey: this.state.plotKeyPrefix + this.randomInt(0, 1000000),
        tfTableKey: this.state.tfTableKeyPrefix + this.randomInt(0, 1000000),
      },
      function () {
        console.log('updated global settings...');
        console.log(this.state.settings);
      }
    );
  }

  updateSettingsChange(changeState, callback) {
    this.setState(
      {
        settingsChangeStart: changeState,
      },
      function () {
        if (callback) callback();
      }
    );
  }

  updateCurrentProbe(direction) {
    var nextProbeIndex = null;
    var previousSettings = this.state.settings;
    //console.log("app - updateCurrentProbe() - previousSettings", previousSettings);
    switch (direction) {
      case 'previous':
        nextProbeIndex =
          previousSettings.probesIndex - 1 >= 0
            ? (previousSettings.probesIndex - 1) % previousSettings.probesCount
            : previousSettings.probesCount - 1;
        break;
      case 'next':
        nextProbeIndex =
          (previousSettings.probesIndex + 1) % previousSettings.probesCount;
        break;
      default:
        break;
    }
    var nextSettings = JSON.parse(JSON.stringify(this.state.settings));
    nextSettings['probesIndex'] = nextProbeIndex;
    nextSettings['currentProbe'] = this.state.settings.probes[nextProbeIndex];
    //console.log("app - updateCurrentProbe() - nextSettings", nextSettings);
    this.setState(
      {
        settingsChangeStart: true,
        settings: nextSettings,
        plotKey: this.state.plotKeyPrefix + this.randomInt(0, 1000000),
        tfTableKey: this.state.tfTableKeyPrefix + this.randomInt(0, 1000000),
      },
      function () {
        console.log('updated global settings...');
        console.log(this.state.settings);
      }
    );
  }

  randomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
  }

  updateShowErrorModal() {
    this.setState(
      {
        errorModal: true,
      },
      function () {
        console.log('show error modal...');
      }
    );
  }

  updateCloseErrorModal() {
    this.setState(
      {
        errorModal: false,
      },
      function () {
        console.log('close error modal...');
      }
    );
  }

  render() {

    return (
      <>
        <header className="bg-dark">
          <a href="#main" className="sr-only sr-only-focusable d-block text-white bg-primary-dark text-center">
            Skip to Main Content
          </a>
          <div className="">
            <div className="">
              <a href="https://dceg.cancer.gov/" target="_blank">
                <img src="assets/img/dceg-logo-inverted.svg" height="110" alt="National Cancer Institute Logo" />
              </a>
            </div>
          </div>
        </header>

        <main className="parent-container" id="main">
          <h1 className="sr-only">FORGE2 TF</h1>
          <ErrorModal 
            visible={this.state.errorModal} 
            closeErrorModal={
              this.updateCloseErrorModal
            } />

          <Panels
            panelSide="right-side"
            id="right-side-container"
            ref="rightSideContainer"
          >
            <Viewer
              id="viewer"
              settings={this.state.settings}
              settingsChangeStart={this.state.settingsChangeStart}
              updateSettingsChange={this.updateSettingsChange}
              updateCurrentProbe={this.updateCurrentProbe}
              plotKey={this.state.plotKeyPrefix + this.randomInt(0, 1000000)}
              tfTableKey={
                this.state.tfTableKeyPrefix + this.randomInt(0, 1000000)
              }
              updateShowErrorModal={this.updateShowErrorModal}
            />
          </Panels>
          <Panels
            panelSide="left-side px-3 py-2"
            id="left-side-container"
            ref="leftSideContainer"
          >
            <Brand
              brandTitle={this.state.brandTitle}
              brandSubtitle={this.state.brandSubtitle}
            />
            <h2 className="description" style={{fontSize: '14.4px'}}>About</h2>
            <p className="description">
              The <em>FORGE2 TF</em> application is an adjunct to the{' '}
              <a href="https://forge2.altiusinstitute.org/" target="_blank" style={{color: "#0062cc"}}>FORGE2</a> GWAS
              analysis tool. This enables the exploration of DNase I tag
              (chromatin accessibility) signal surrounding GWAS array SNPs and the
              calculation of significance of overlap with transcription factor
              binding sites from common TF databases.
            </p>
            <hr />
            {/*<h6 className="description spacer">Usage</h6>
                <p className="description">Select the desired array, sample, probe IDs, and padding values.</p> 
                <p className="description">Output includes a rendering of the signal and highlighted sequence representing factor binding sites.</p> */}
            <Settings
              id="settings"
              ref="settings"
              title="Settings"
              settings={this.state.settings}
              updateSettings={this.updateSettings}
              updateShowErrorModal={this.updateShowErrorModal}
            />
          </Panels>
        </main>

        <NCIFooter
          className="py-4 bg-dark text-light"
          title={
            <div className="mb-4">
              <div className="h4 mb-0">
                <b>Division of Cancer Epidemiology and Genetics</b>
              </div>
              <div className="h6">at the National Cancer Institute</div>
            </div>
          }
          columns={
            [
              {
                title: "CONTACT INFORMATION", 
                links: [
                  {
                    title: "Contact Us", 
                    href: "https://www.cancer.gov/contact"
                  },
                  {
                    title: "Support", 
                    href: "mailto:NCIFORGE2TFWebAdmin@mail.nih.gov"
                  }
                ]
              },
              {
                title: "MORE INFORMATION", 
                links: [
                  {
                    title: "About This Website", 
                    href: "https://www.cancer.gov/about-website"
                  },
                  {
                    title: "Multimedia", 
                    href: "https://www.cancer.gov/multimedia"
                  },
                  {
                    title: "Publications", 
                    href: "https://www.cancer.gov/publications"
                  },
                  {
                    title: "Site Map", 
                    href: "https://www.cancer.gov/about-website/sitemap"
                  },
                  {
                    title: "Digital Standards for NCI Websites", 
                    href: "https://www.cancer.gov/digital-standards"
                  }
                ]
              },
              {
                title: "POLICIES", 
                links: [
                  {
                    title: "Accessibility", 
                    href: "https://www.cancer.gov/policies/accessibility"
                  },
                  {
                    title: "Content Policy", 
                    href: "https://www.cancer.gov/policies/comments"
                  },
                  {
                    title: "Disclaimer", 
                    href: "https://www.cancer.gov/policies/disclaimer"
                  },
                  {
                    title: "FOIA", 
                    href: "https://www.cancer.gov/policies/foia"
                  },
                  {
                    title: "Privacy & Security", 
                    href: "https://www.cancer.gov/policies/privacy-security"
                  },
                  {
                    title: "Reuse & Copyright", 
                    href: "https://www.cancer.gov/policies/copyright-reuse"
                  },
                  {
                    title: "Syndication Services", 
                    href: "https://www.cancer.gov/syndication"
                  },
                  {
                    title: "Website Linking", 
                    href: "https://www.cancer.gov/policies/linking"
                  }
                ]
              }
            ]
          }
        />
      </>
    );
  }
}

// render(<App/>, document.getElementById('app'));

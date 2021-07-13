import React from 'react';
import { NCIFooter } from './controls/nci-footer/nci-footer';
import './main.scss';
import { Navbar, Nav } from 'react-bootstrap';
import {
  HashRouter as Router,
  Route,
  NavLink,
  Redirect,
} from 'react-router-dom';
import { Home } from './pages/home/home';
import { Citations } from './pages/citations/citations';
import eFORGETF from './pages/eforge-tf/eforge-tf';
// import { About } from './pages/about/about';


export function App() {

  const links = [
    {
      route: '/home',
      title: 'Home',
    },
    {
      route: '/eforge-tf',
      title: 'eFORGE-TF',
    },
    {
      route: '/citations',
      title: 'Citations',
    },
    // {
    //   route: '/about',
    //   title: 'About',
    // },
  ];

  return (
    <Router>
      <header className="bg-dark">
        <a
          href="#main"
          className="sr-only sr-only-focusable d-block text-white bg-primary-dark text-center"
        >
          Skip to Main Content
        </a>
        <div className="">
          <div className="">
            <a href="https://dceg.cancer.gov/" target="_blank">
              <img
                src="assets/img/dceg-logo-inverted.svg"
                height="110"
                alt="National Cancer Institute Logo"
              />
            </a>
          </div>
        </div>
      </header>

      <Navbar bg="dark" expand="sm" className="navbar-dark bg-navbar-dark py-0">
        <Navbar.Toggle aria-controls="app-navbar" />
        <Navbar.Collapse id="app-navbar">
          <Nav className="mr-auto">
            {links.map((link, index) => (
              <NavLink
                key={`navlink-${index}`}
                exact={link.route === '/'}
                activeClassName="active font-weight-bold"
                className="nav-link px-3"
                to={link.route}
              >
                {link.title}
              </NavLink>
            ))}
          </Nav>
        </Navbar.Collapse>
      </Navbar>

      <main className="parent-container" id="main">
        <h1 className="sr-only">FORGE2 TF</h1>
        {/* <ErrorModal
          visible={this.state.errorModal}
          closeErrorModal={this.updateCloseErrorModal}
        /> */}
        {/* <Row>
          <Col className="left-side p-2">
            <div className="ml-4 mr-3">
              <Brand
                brandTitle={this.state.brandTitle}
                brandSubtitle={this.state.brandSubtitle}
              />
              <h2 className="description" style={{ fontSize: '14.4px' }}>
                About
              </h2>
              <p className="description">
                The <em>FORGE2 TF</em> application is an adjunct to the{' '}
                <a
                  href="https://forge2.altiusinstitute.org/"
                  target="_blank"
                  style={{ color: '#0062cc' }}
                >
                  FORGE2
                </a>{' '}
                GWAS analysis tool. This enables the exploration of DNase I tag
                (chromatin accessibility) signal surrounding GWAS array SNPs and
                the calculation of significance of overlap with transcription
                factor binding sites from common TF databases.
              </p>
              <hr />
              <Settings
                id="settings"
                ref="settings"
                title="Settings"
                settings={this.state.settings}
                updateSettings={this.updateSettings}
                updateShowErrorModal={this.updateShowErrorModal}
              />
            </div>
          </Col>
          <Col className="right-side pl-0">
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
          </Col>
        </Row> */}
        <Route exact path={`/`} render={() => <Redirect to="/home" />} />
        <Route path="/home" exact={true} component={Home} />
        <Route path="/eforge-tf" component={eFORGETF} />
        <Route path="/citations" component={Citations} />
        {/* <Route path="/about" component={About} /> */}
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
        columns={[
          {
            title: 'CONTACT INFORMATION',
            links: [
              {
                title: 'Contact Us',
                href: 'https://www.cancer.gov/contact',
              },
              {
                title: 'Support',
                href: 'mailto:NCIFORGE2TFWebAdmin@mail.nih.gov',
              },
            ],
          },
          {
            title: 'MORE INFORMATION',
            links: [
              {
                title: 'About This Website',
                href: 'https://www.cancer.gov/about-website',
              },
              {
                title: 'Multimedia',
                href: 'https://www.cancer.gov/multimedia',
              },
              {
                title: 'Publications',
                href: 'https://www.cancer.gov/publications',
              },
              {
                title: 'Site Map',
                href: 'https://www.cancer.gov/about-website/sitemap',
              },
              {
                title: 'Digital Standards for NCI Websites',
                href: 'https://www.cancer.gov/digital-standards',
              },
            ],
          },
          {
            title: 'POLICIES',
            links: [
              {
                title: 'Accessibility',
                href: 'https://www.cancer.gov/policies/accessibility',
              },
              {
                title: 'Content Policy',
                href: 'https://www.cancer.gov/policies/comments',
              },
              {
                title: 'Disclaimer',
                href: 'https://www.cancer.gov/policies/disclaimer',
              },
              {
                title: 'FOIA',
                href: 'https://www.cancer.gov/policies/foia',
              },
              {
                title: 'Privacy & Security',
                href: 'https://www.cancer.gov/policies/privacy-security',
              },
              {
                title: 'Reuse & Copyright',
                href: 'https://www.cancer.gov/policies/copyright-reuse',
              },
              {
                title: 'Syndication Services',
                href: 'https://www.cancer.gov/syndication',
              },
              {
                title: 'Website Linking',
                href: 'https://www.cancer.gov/policies/linking',
              },
            ],
          },
        ]}
      />
    </Router>
  );
}
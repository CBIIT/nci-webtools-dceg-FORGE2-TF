import React from 'react';

class Brand extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div className="brand-container">
        <img
          src="assets/img/altius_logo.png"
          className="brand-logo"
          alt="Brand Logo"
        />
        <span className="brand-text text-dark">{this.props.brandTitle}</span>
        <div className="brand-subtitle">{this.props.brandSubtitle}</div>
      </div>
    );
  }
}

export default Brand;

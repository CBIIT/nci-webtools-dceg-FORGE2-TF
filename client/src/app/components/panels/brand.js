import React from 'react';

class Brand extends React.Component {

  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div>
        <div className="brand-container">
          <img src="./assets/img/altius_logo.png" className="brand-logo" />
          <span className="brand-text">{this.props.brandTitle}</span>
          <div className="brand-subtitle">{this.props.brandSubtitle}</div>
        </div>
      </div>
    );
  }

}

export default Brand;
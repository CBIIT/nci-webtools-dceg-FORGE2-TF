import React from 'react';

class Panels extends React.Component {

  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div className={this.props.panelSide} id={this.props.id}>
        {this.props.children}
      </div>
    );
  }

}

export default Panels;
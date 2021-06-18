import React from 'react';
import { Modal, Button } from 'react-bootstrap';

export function ErrorModal(props) {

  return (
    <Modal
      data-testid="ErrorModal"
      show={props.visible}
      onHide={props.closeErrorModal}
      >
      <Modal.Header closeButton>
        <Modal.Title>Internal Server Error</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p>
          An error occured when requesting data. If this problem persists, please contact the administrator at <a href="mailto:NCIFORGE2TFWebAdmin@mail.nih.gov">NCIFORGE2TFWebAdmin@mail.nih.gov</a>.
        </p>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={props.closeErrorModal}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

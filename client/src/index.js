import React from 'react';
import ReactDOM from 'react-dom';
import App from './app/components/app';
import store from './app/services/store';
import { Provider } from 'react-redux';

ReactDOM.render(
    <Provider store={store}>
        <App />
    </Provider>, 
    document.getElementById('app')
);

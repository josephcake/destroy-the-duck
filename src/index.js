import React from "react";
import ReactDOM from "react-dom";

import "./styles/_base.scss";
import App from "./App";
import * as serviceWorker from "./serviceWorker";
import { TableContextProvider } from "./Context/TableContext";

ReactDOM.render(
  <TableContextProvider>
    <App />
  </TableContextProvider>,

  document.getElementById("root")
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();

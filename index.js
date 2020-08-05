import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import "bootstrap/dist/css/bootstrap.min.css";
import HttpLoadingBar from "owp.http-loading-bar";

ReactDOM.render(
    <main>
        <HttpLoadingBar />
        <App />
    </main>,
    document.getElementById("root")
);
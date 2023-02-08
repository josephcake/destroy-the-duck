import React, { useState } from "react";
import "./App.css";
import Main from "./Main/Main";
import Nav from "./Nav/Nav";
import Footer from "./Footer/Footer";
import Intro from "./Popup/Intro";
import { Legend } from "./Legend/Legend";
import { TableContext } from "./Context/TableContext";

function App() {
  const [intro, setIntro] = useState(true);
  const toggleIntro = () => {
    setIntro(!intro);
  };
  return (
    <TableContext.Consumer>
      {({  clearBoard, buildMaze, selectAlgorithm, go, toggleSpeed }) => {
        return (
          <div className="App">
            <Nav
              setIntro={toggleIntro}
              clearBoard={clearBoard}
              buildMaze={buildMaze}
              selectAlgorithm={selectAlgorithm}
              go={go}
              toggleSpeed={toggleSpeed}
            />
            <Legend />
            <div className="spacer"/>
            <Main />
            <div className="spacer"/>
            <Footer />
            {intro && <Intro setIntro={toggleIntro} />}
          </div>
        )
      }}
      </TableContext.Consumer>
  );
}

export default App;

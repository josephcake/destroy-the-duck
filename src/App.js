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
      {({  clearBoard, buildMaze, selectAlgorithm, go, running }) => {
        return (
          <div className="App">
            <Nav
              setIntro={toggleIntro}
              clearBoard={clearBoard}
              buildMaze={buildMaze}
              selectAlgorithm={selectAlgorithm}
              go={go}
              running={running}
            />
            <Legend />
            <Main />
            <Footer />
            {intro && <Intro setIntro={toggleIntro} />}
          </div>
        )
      }}
      </TableContext.Consumer>
  );
}

export default App;

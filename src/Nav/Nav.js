import React, {useState} from "react";
import { isWallFinishedRendering } from "./helper/isWallFinishedRendering";
import { isDuckFound } from "./helper/isDuckFound";

const Nav = ({setIntro, clearBoard, buildMaze, selectAlgorithm, go}) => {
  const [isRunning, setIsRunning] = useState(false)
  const [selectedAlgo, setSelectedAlgo] = useState(null)
  const [selectedMaze, setSelectedMaze] = useState(null)

  const handleGo = (go) =>{
    go()
    setIsRunning(true)
    isDuckFound(selectedAlgo,selectedMaze,setIsRunning)
  }

  const shouldUpdateMazeSelection = (buildMaze, e) => {
    if(!isRunning){
      const name = e.target.value
      setSelectedMaze(name)
      buildMaze(name)
      setIsRunning(true)
      isWallFinishedRendering(name, setIsRunning)
    }else{
    }
  }
  const handleSelectAlgorithm = (e) =>{
    let algorithm = e.target.value;
    setSelectedAlgo(algorithm)
    selectAlgorithm(e)
  }
  return (
    <div className={"nav"}>
      <div className={"nav__algo nav__items"}>
        <img
          onClick={setIntro}
          className={"nav-image"}
          src={require("../Images/duck.png")}
          alt={"Duck"}
        />
      </div>
      <div className={"nav__algo nav__items"}>
        <select
          className={"nav__select"}
          disabled={isRunning}
          onChange={e => handleSelectAlgorithm(e)}
        >
          <option className={"nav__select_option"} value={"algorithm"}>
            Algorithm
          </option>

          <option
            className={"nav__select_option"}
            value={"knownEndPointSearch"}
          >
            Known Direction
          </option>
          <option
            className={"nav__select_option"}
            value={"linearSearch"}
          >
            Linear Search
          </option>
          <option
            className={"nav__select_option"}
            value={"breadthFirstSearch"}
          >
            Breadth First Search
          </option>
          <option
            className={"nav__select_option"}
            value={"depthFirstSearch"}
          >
            Depth First Search
          </option>
          <option
            className={"nav__select_option"}
            value={"bidirectionalSearch"}
          >
            Bidirectional Search
          </option>
          <option
            className={"nav__select_option"}
            value={"randomSearch"}
          >
            Random Search
          </option>
        </select>
      </div>
      <div className={"nav__wall nav__items"}>
        <select
          className={"nav__select"}
          disabled={isRunning}
          id="maze"
          onChange={e => shouldUpdateMazeSelection(buildMaze, e)}
        >
          <option className={"nav__select_option"} value={"maze"}>
            Maze
          </option>
          <option className={"nav__select_option"} value={"basic"}>
            Basic
          </option>
          <option className={"nav__select_option"} value={"spiral"}>
            Spiral
          </option>
          <option className={"nav__select_option"} value={"target"}>
            Target
          </option>
          <option className={"nav__select_option"} value={"stair"}>
            Stair
          </option>
          <option className={"nav__select_option"} value={"checker"}>
            Checker
          </option>
          <option className={"nav__select_option"} value={"forest"}>
            Forest
          </option>
          <option className={"nav__select_option"} value={"horizontal"}>
            Horizontal Wide
          </option>
          <option className={"nav__select_option"} value={"vertical"}>
            Vertical Wide
          </option>
          <option
            className={"nav__select_option"}
            value={"horizontalNarrow"}
          >
            Horizontal Narrow
          </option>
          <option
            className={"nav__select_option"}
            value={"verticalNarrow"}
          >
            Vertical Narrow
          </option>
          <option className={"nav__select_option"} value={"random"}>
            Random
          </option>
        </select>
      </div>
      <div className={"nav__action nav__items"}>
        <button
          onClick={()=>handleGo(go)}
          className={"nav__button go"}
          disabled={isRunning}
        >
          Go!
        </button>
      </div>

      <div className={"nav__board nav__items"}>
        <button
          className={"nav__button"}
          onClick={()=>clearBoard()}
          disabled={isRunning}
        >
          Clear Board
        </button>

        <button
          name={"wall"}
          disabled={isRunning}
          className={"nav__button"}
          onClick={e => clearBoard(e)}
        >
          Clear Wall
        </button>

        <button
          name={"visited"}
          disabled={isRunning}
          className={"nav__button"}
          onClick={e => clearBoard(e)}
        >
          Clear Path
        </button>
      </div>
    </div>
  );
}

export default Nav;

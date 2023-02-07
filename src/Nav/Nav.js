import React, {useState} from "react";
import { isWallFinishedRendering } from "./helper/isWallFinishedRendering";
import { isDuckFound } from "./helper/isDuckFound";
import {algorithmOptions,mazeOptions,clearButtons,settingsToggle} from './constants'
import {NavButtons, NavOptions, NavSettingsToggle} from './NavItems'

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
          {algorithmOptions.map(algo => (
            <NavOptions key={algo.value} value={algo.value} text={algo.text}/>
          ))}
        </select>
      </div>
      <div className={"nav__wall nav__items"}>
        <select
          className={"nav__select"}
          disabled={isRunning}
          id="maze"
          onChange={e => shouldUpdateMazeSelection(buildMaze, e)}
        >
          {mazeOptions.map(maze => (
            <NavOptions key={maze.value} value={maze.value} text={maze.text}/>
          ))}
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
        {clearButtons.map(btn=> (
          <NavButtons key={btn.text} name={btn.name} text={btn.text} isRunning={isRunning} clearBoard={clearBoard}/>
        ))}
      </div>
      <div className={"nav__algo nav__items"}>
            <NavSettingsToggle className={"nav__algo nav__items nav__setting nav__setting_theme"} name={"theme"}/>
            <NavSettingsToggle className={"nav__algo nav__items nav__setting nav__setting_speed"} name={"speed"}/>
      </div>

    </div>
  );
}

export default Nav;

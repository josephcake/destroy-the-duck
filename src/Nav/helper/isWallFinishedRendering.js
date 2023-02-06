import { BASIC_WALL } from "../../Wall/BasicWall";
import { SPIRAL_WALL } from "../../Wall/SpiralWall";
import { STAIR_WALL } from "../../Wall/StairWall";
import { TARGET_WALL } from "../../Wall/TargetWall";
import { CHECKER_WALL } from "../../Wall/CheckerWall";
import { FOREST_WALL } from "../../Wall/ForestWall";

const mazeType = [
  "basic",
  "spiral",
  "stair",
  "target",
  "checker",
  "forest"
];
const mazes = [
  BASIC_WALL,
  SPIRAL_WALL,
  STAIR_WALL,
  TARGET_WALL,
  CHECKER_WALL,
  FOREST_WALL
];

export const isWallFinishedRendering = (name,setIsRunning) =>{
  const idx = mazeType.indexOf(name);
  if(idx === -1){
    let checkWall = setInterval(()=>{
      let lastR = 31
      let lastC = 75
      let endR = 34
      let endC = 78
      while(lastC < endC || lastR < endR){
        if(lastC <= endC){
          let lastCellID = `${lastR}-${lastC}`
          let lastCell = document.getElementById(lastCellID);
          if(lastCell.className === 'wall'){
            clearInterval(checkWall)
            return setIsRunning(false)
          }else{
            if(lastC === endC){
              lastC = 75
              lastR ++
            }else{
              lastC ++
            }
          }
        }
      }
    }, 2000)
  }else{
    const mazeLength = mazes[idx].length
    let lastCellID = mazes[idx][mazeLength-1]
    let lastCell = document.getElementById(lastCellID);

    let checkWall = setInterval(()=>{
      if(lastCell && lastCell.className === 'wall'){
        clearInterval(checkWall)
        return setIsRunning(false)
      }
    }, 2000)
  }
}
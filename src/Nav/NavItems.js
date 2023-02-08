import React from 'react'
export const NavOptions = ({value, text}) => {
  return (
    <option className={"nav__select_option"} value={value}>
      {text}
    </option>
  )
}

export const NavButtons = ({name, text, isRunning, clearBoard}) => {
  const shouldClear = (e) =>{
    if(name){
      clearBoard(e)
    }else{
      clearBoard()
    }
  }
  return (
    <button
      name={name}
      disabled={isRunning}
      className={"nav__button"}
      onClick={e => shouldClear(e)}
    >
      {text}
    </button>
  )
}

export const NavSettingsToggle = ({name,className, text, isRunning,handleClick=()=>{}}) => {
  return (
    <div
      disabled={isRunning}
      onClick={handleClick}
      className={className}
      name={name}
    >
      {text ? text : null}
    </div>
  )
}